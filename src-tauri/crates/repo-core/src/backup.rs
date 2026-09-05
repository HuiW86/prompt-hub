//! WAL-safe database snapshots for the fail-safe restore paths (import wipe,
//! pre-migration, daily). `VACUUM INTO` is used instead of a bare `fs::copy`: in
//! WAL mode the `.db` file alone is incomplete (recent pages live in `-wal`), so
//! a filesystem copy of the main file can miss committed data. `VACUUM INTO`
//! asks SQLite to write a consistent, fully-checkpointed copy of the live
//! database — safe to run against an active connection.
//!
//! Two properties this module owes its callers, both learned the hard way:
//!
//! 1. **Retention is per prefix.** One shared quota let a loop of failing
//!    startups (each taking a `pre-migrate` snapshot) evict every `pre-import`
//!    and `daily` file. The prefixes are independent recovery stories and must
//!    not compete for the same slots.
//! 2. **Identical content does not consume a slot.** `VACUUM INTO` is
//!    byte-deterministic for an unchanged database, so a repeated snapshot can
//!    be recognised by hash and dropped. Without this, a migration that fails on
//!    every launch burns through the whole quota with copies of one moment,
//!    destroying the only thing that could restore the user.

use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rusqlite::Connection;
use sha2::{Digest, Sha256};

use crate::error::{RepoError, RepoResult};

/// Retention for a prefix with no explicit quota. Also the quota for the two
/// event-driven prefixes.
pub const MAX_BACKUPS: usize = 5;

/// Retention for `daily`: a full week of rolling snapshots.
pub const MAX_DAILY_BACKUPS: usize = 7;

/// Taken by `db::open_and_migrate` before the first migration transaction opens.
pub const PREFIX_PRE_MIGRATE: &str = "pre-migrate";
/// Taken by the import command before the wipe-and-restore.
pub const PREFIX_PRE_IMPORT: &str = "pre-import";
/// Taken at startup and hourly thereafter once a day has elapsed.
pub const PREFIX_DAILY: &str = "daily";

/// How stale the newest `daily-*.db` must be before another one is due.
pub const DAILY_BACKUP_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);

/// How long a `.tmp` staging file must sit untouched before the sweep is willing
/// to call it abandoned. Generous on purpose — see `sweep_stale_temp_files`.
const STALE_TEMP_AGE: Duration = Duration::from_secs(60 * 60);

/// Directory (under the DB's parent) where auto-backups are written.
pub const BACKUPS_DIRNAME: &str = "backups";

/// How many snapshots to keep for `prefix`. Quotas are per prefix so a storm of
/// one kind cannot evict another kind (see the module note).
fn quota_for(prefix: &str) -> usize {
    match prefix {
        PREFIX_PRE_MIGRATE | PREFIX_PRE_IMPORT => MAX_BACKUPS,
        PREFIX_DAILY => MAX_DAILY_BACKUPS,
        _ => MAX_BACKUPS,
    }
}

/// What a `snapshot` call actually did. Both variants mean "there is a good,
/// current snapshot on disk at this path" — callers treat them alike and only
/// an `Err` aborts the risky operation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SnapshotOutcome {
    /// A new file was created because the database differs from the newest
    /// snapshot of the same prefix.
    Written(PathBuf),
    /// The database is byte-identical to the newest snapshot of the same
    /// prefix, so that file was kept and no slot was consumed.
    Unchanged(PathBuf),
}

impl SnapshotOutcome {
    /// The snapshot the caller can restore from, whichever way it got there.
    pub fn path(&self) -> &Path {
        match self {
            SnapshotOutcome::Written(p) | SnapshotOutcome::Unchanged(p) => p,
        }
    }
}

/// Resolve the `backups/` directory that sits next to the database file.
pub fn backups_dir_for(db_path: &Path) -> PathBuf {
    db_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(BACKUPS_DIRNAME)
}

/// Snapshot the live database behind `conn` into
/// `<backups_dir>/<prefix>-<unix_secs>.db` using `VACUUM INTO`, unless the
/// newest snapshot of the same prefix already holds byte-identical content — in
/// which case the existing file is kept and returned as `Unchanged`. After a
/// real write the directory is pruned down to that prefix's quota.
///
/// Producing the snapshot is fail-safe, never best-effort: callers treat an
/// `Err` as "abort the risky operation" (do not import / do not migrate). The
/// two housekeeping steps around it are the exception — sweeping another run's
/// debris and re-stamping a kept file's timestamp both log and continue on
/// failure, because neither can make the resulting snapshot any less good.
pub fn snapshot(
    conn: &Connection,
    backups_dir: &Path,
    prefix: &str,
) -> RepoResult<SnapshotOutcome> {
    std::fs::create_dir_all(backups_dir)?;
    sweep_stale_temp_files(backups_dir, prefix);

    // Land in a hidden `.tmp` name first so a half-written or duplicate copy is
    // never visible to `prune` / `latest_for_prefix` (both of which only look at
    // `*.db`) and never mistaken for a restorable backup.
    //
    // The name carries our pid because two processes share this directory in
    // practice — the installed app and a working-tree build were both running
    // today. `reserve_path` checks existence and then creates, which is racy
    // across processes; the pid makes the two candidate names disjoint so the
    // race has nothing to land on.
    let tmp = reserve_path(
        backups_dir,
        &format!(".{prefix}-"),
        &format!("-{}", std::process::id()),
        "tmp",
    );

    // `VACUUM INTO` takes a string literal path; bind it as a parameter so a path
    // containing a quote can't break the statement. It refuses to overwrite, so
    // the reserved name must not exist — `reserve_path` guarantees that.
    let tmp_str = tmp.to_string_lossy().into_owned();
    if let Err(e) = conn.execute("VACUUM INTO ?1", [tmp_str.as_str()]) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e.into());
    }

    let outcome = promote_temp_snapshot(backups_dir, prefix, &tmp);
    if outcome.is_err() {
        // Never leave a stray temp file behind for the next run to trip over.
        let _ = std::fs::remove_file(&tmp);
    }
    outcome
}

/// Decide what to do with a freshly vacuumed temp file: drop it when it merely
/// repeats the newest snapshot of this prefix, otherwise rename it into place
/// and prune.
fn promote_temp_snapshot(
    backups_dir: &Path,
    prefix: &str,
    tmp: &Path,
) -> RepoResult<SnapshotOutcome> {
    let fresh = sha256_file(tmp)?;

    if let Some(previous) = latest_for_prefix(backups_dir, prefix) {
        // A previous file we cannot read is treated as "different" rather than
        // as an error: writing a new snapshot is always the safe direction.
        if sha256_file(&previous).is_ok_and(|hash| hash == fresh) {
            std::fs::remove_file(tmp)?;
            // Stamp the kept file as of now. "We looked, and the database had not
            // changed" discharges today's backup exactly as much as writing a
            // byte-identical copy would have; the schedule in `daily_backup_due`
            // reads this mtime, so without the touch an unchanged database stays
            // permanently overdue and every hourly poll pays a full VACUUM INTO
            // plus two hashes, under the connection lock, to throw the result
            // away. Best-effort: a snapshot we could not re-stamp is still a
            // good snapshot, so a failure only costs an early next attempt.
            if let Err(e) = touch_mtime(&previous, SystemTime::now()) {
                log::warn!(
                    "could not refresh the timestamp on {}: {e}",
                    previous.display()
                );
            }
            log::info!("backup unchanged, kept {} ({prefix})", previous.display());
            return Ok(SnapshotOutcome::Unchanged(previous));
        }
    }

    // No pid in the final name: it is a permanent artifact a human may have to
    // pick out of a folder, and `name_order_key` parses this shape.
    let target = reserve_path(backups_dir, &format!("{prefix}-"), "", "db");
    std::fs::rename(tmp, &target)?;
    log::info!("backup written: {}", target.display());
    prune(backups_dir, prefix)?;
    Ok(SnapshotOutcome::Written(target))
}

/// Whether a fresh `daily` snapshot is owed as of `now`: either none exists yet,
/// or the newest one is at least [`DAILY_BACKUP_INTERVAL`] old.
///
/// A clock that has moved backwards (newest file stamped in the future) reports
/// "not due" rather than snapshotting on every check.
pub fn daily_backup_due(backups_dir: &Path, now: SystemTime) -> bool {
    let Some(newest) = latest_for_prefix(backups_dir, PREFIX_DAILY) else {
        return true;
    };
    match std::fs::metadata(&newest).and_then(|m| m.modified()) {
        // Unreadable mtime: err toward taking the backup.
        Err(_) => true,
        Ok(mtime) => now
            .duration_since(mtime)
            .map(|age| age >= DAILY_BACKUP_INTERVAL)
            .unwrap_or(false),
    }
}

/// Pick a file name under `backups_dir` that does not exist yet, of the form
/// `<stem_prefix><unix_secs><stem_suffix>[-<n>].<extension>`. The trailing
/// numeric suffix guards against two snapshots landing in the same whole second
/// (e.g. an import right after a migration) clobbering each other.
fn reserve_path(
    backups_dir: &Path,
    stem_prefix: &str,
    stem_suffix: &str,
    extension: &str,
) -> PathBuf {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        // Clock before the epoch is implausible; fall back to 0 rather than fail
        // the backup (a monotonic-enough name is all we need for uniqueness here,
        // and prune keeps the newest by mtime, not by parsed timestamp).
        .unwrap_or(0);

    let mut path = backups_dir.join(format!("{stem_prefix}{secs}{stem_suffix}.{extension}"));
    let mut dedup = 1u32;
    while path.exists() {
        path = backups_dir.join(format!("{stem_prefix}{secs}{stem_suffix}-{dedup}.{extension}"));
        dedup += 1;
    }
    path
}

/// Set `path`'s modification time. Used to record that a snapshot was confirmed
/// current, not just that it was created.
fn touch_mtime(path: &Path, now: SystemTime) -> std::io::Result<()> {
    std::fs::OpenOptions::new()
        .write(true)
        .open(path)?
        .set_modified(now)
}

/// Delete leftover `.{prefix}-*.tmp` staging files from an earlier run that died
/// between the `VACUUM INTO` and the rename. Nothing else ever writes these
/// names, so anything old enough is debris — and each piece of debris is a
/// complete copy of the database, which on a real library is not a rounding
/// error.
///
/// **Age decides, not ownership.** Two processes share this directory in
/// practice (the installed app and a working-tree build were both running
/// today), so a sweep that deleted every temp file it did not itself create
/// would eventually land between another process's `VACUUM INTO` and its
/// rename. That process's rename then fails with `NotFound`, and on the
/// pre-migrate path the user is told their database is broken — the sweep would
/// have manufactured the disaster it exists to tidy up after.
///
/// Testing pid liveness instead would need a libc dependency and still races,
/// since pids are recycled. An hour is orders of magnitude longer than any
/// `VACUUM INTO` of a prompt library, so age is both cheaper and more honest:
/// it claims only what it can actually observe.
fn sweep_stale_temp_files(backups_dir: &Path, prefix: &str) {
    let needle = format!(".{prefix}-");
    let now = SystemTime::now();
    let Ok(read_dir) = std::fs::read_dir(backups_dir) else {
        return;
    };
    for path in read_dir.filter_map(|e| e.ok()).map(|e| e.path()) {
        let is_ours = path.extension().is_some_and(|ext| ext == "tmp")
            && path
                .file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with(&needle));
        if !is_ours {
            continue;
        }
        // No readable age — unreadable metadata, or a timestamp in the future
        // after a clock change — means we cannot prove the file is abandoned.
        // Leave it: deleting blind is the only direction with a victim.
        let age = std::fs::metadata(&path)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|mtime| now.duration_since(mtime).ok());
        let Some(age) = age else { continue };
        if age < STALE_TEMP_AGE {
            continue;
        }
        match std::fs::remove_file(&path) {
            Ok(()) => log::warn!(
                "removed a backup staging file left behind by an interrupted run: {}",
                path.display()
            ),
            Err(e) => log::warn!(
                "could not remove the stale backup staging file {}: {e}",
                path.display()
            ),
        }
    }
}

/// The `(unix_secs, dedup)` a snapshot's file name encodes, as a sortable key.
/// A name we cannot parse sorts oldest, so debris can never masquerade as the
/// newest snapshot and win the dedup comparison.
///
/// This exists because the obvious tie-break — comparing paths as strings — runs
/// backwards for exactly the case it is needed in: `prefix-100-1.db` was written
/// after `prefix-100.db`, but `'-'` (0x2D) sorts below `'.'` (0x2E), so the
/// string comparison calls the older file newer.
fn name_order_key(path: &Path, prefix: &str) -> (u64, u32) {
    let Some(tail) = path
        .file_name()
        .and_then(|n| n.to_str())
        .and_then(|n| n.strip_suffix(".db"))
        .and_then(|n| n.strip_prefix(&format!("{prefix}-")))
    else {
        return (0, 0);
    };
    let mut parts = tail.splitn(2, '-');
    let secs = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let dedup = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    (secs, dedup)
}

/// Every `<prefix>-*.db` in `backups_dir`, newest first. Files of other prefixes
/// and the hidden `.tmp` staging files are invisible here by construction.
///
/// Ordering is by mtime, with the timestamp encoded in the file name as
/// tie-breaker, so two snapshots taken inside one filesystem timestamp tick
/// still order deterministically and in the direction they were written.
fn entries_for_prefix(backups_dir: &Path, prefix: &str) -> Vec<(SystemTime, PathBuf)> {
    let needle = format!("{prefix}-");
    let Ok(read_dir) = std::fs::read_dir(backups_dir) else {
        return Vec::new();
    };
    let mut entries: Vec<(SystemTime, PathBuf)> = read_dir
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|ext| ext == "db"))
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with(&needle))
        })
        .filter_map(|p| {
            let mtime = std::fs::metadata(&p).and_then(|m| m.modified()).ok()?;
            Some((mtime, p))
        })
        .collect();

    entries.sort_by(|a, b| {
        b.0.cmp(&a.0)
            .then_with(|| name_order_key(&b.1, prefix).cmp(&name_order_key(&a.1, prefix)))
    });
    entries
}

/// The newest `<prefix>-*.db`, if any.
fn latest_for_prefix(backups_dir: &Path, prefix: &str) -> Option<PathBuf> {
    entries_for_prefix(backups_dir, prefix)
        .into_iter()
        .next()
        .map(|(_, path)| path)
}

/// Keep only the newest `quota_for(prefix)` files of THIS prefix, deleting the
/// rest. Other prefixes are never counted and never touched. Any single removal
/// failure aborts (the caller decides whether that's fatal), but a fresh
/// snapshot already succeeded before this runs, so retention is the only thing
/// at risk.
fn prune(backups_dir: &Path, prefix: &str) -> RepoResult<()> {
    let quota = quota_for(prefix);
    let entries = entries_for_prefix(backups_dir, prefix);
    if entries.len() <= quota {
        return Ok(());
    }

    let doomed = entries.len() - quota;
    for (_, path) in entries.into_iter().skip(quota) {
        std::fs::remove_file(&path).map_err(RepoError::from)?;
    }
    log::info!("pruned {doomed} {prefix} backup(s) over the quota of {quota}");
    Ok(())
}

/// Hex sha256 of a file's bytes, read in chunks so a large database never has to
/// be held in memory.
fn sha256_file(path: &Path) -> RepoResult<String> {
    let mut file = std::fs::File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let read = file.read(&mut buf)?;
        if read == 0 {
            break;
        }
        hasher.update(&buf[..read]);
    }
    let digest = hasher.finalize();
    let mut out = String::with_capacity(digest.len() * 2);
    for byte in digest {
        out.push_str(&format!("{byte:02x}"));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;
    use std::time::Duration;

    fn migrated(dir: &Path) -> (PathBuf, Connection) {
        let path = dir.join("prompt-hub.db");
        let conn = db::open_and_migrate(&path).expect("migrate");
        (path, conn)
    }

    fn db_count(backups_dir: &Path) -> usize {
        std::fs::read_dir(backups_dir)
            .map(|rd| {
                rd.filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| p.extension().is_some_and(|x| x == "db"))
                    .count()
            })
            .unwrap_or(0)
    }

    fn prefix_count(backups_dir: &Path, prefix: &str) -> usize {
        entries_for_prefix(backups_dir, prefix).len()
    }

    /// Nothing in `backups/` should survive between the sub-cases below;
    /// `open_and_migrate` may already have dropped a `pre-migrate` file there.
    fn clear(backups_dir: &Path) {
        if let Ok(rd) = std::fs::read_dir(backups_dir) {
            for e in rd.filter_map(|e| e.ok()) {
                std::fs::remove_file(e.path()).ok();
            }
        }
    }

    /// Make each snapshot's content differ so the hash-dedup path never fires —
    /// used by the retention tests, which are about counting slots, not dedup.
    fn touch(conn: &Connection, n: usize) {
        conn.execute(
            "INSERT INTO modifiers
                (id, name, content, group_kind, usage_count, created_at, deprecated, order_index)
             VALUES (?1, ?1, 'body', 'cognition', 0, '2026-09-04T00:00:00Z', 0, ?2)",
            rusqlite::params![format!("mod-{n}"), n as i64],
        )
        .expect("insert filler row");
    }

    #[test]
    fn snapshot_creates_a_restorable_copy() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let (db_path, conn) = migrated(tmp.path());
        let backups = backups_dir_for(&db_path);

        let out = snapshot(&conn, &backups, PREFIX_PRE_IMPORT).expect("snapshot");
        assert!(
            matches!(out, SnapshotOutcome::Written(_)),
            "the first snapshot of a prefix is always a real write, got {out:?}"
        );
        let path = out.path();
        assert!(path.exists(), "snapshot file must exist");
        let name = path.file_name().unwrap().to_string_lossy();
        assert!(name.starts_with("pre-import-"), "prefix in name: {name}");

        // The copy is a valid, complete SQLite DB carrying the seed data.
        let restored = Connection::open(path).expect("open snapshot");
        let phases: i64 = restored
            .query_row("SELECT COUNT(*) FROM phases", [], |r| r.get(0))
            .expect("count phases in snapshot");
        assert_eq!(phases, 8, "snapshot must carry committed seed rows");
    }

    #[test]
    fn snapshot_prunes_to_five_most_recent() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let (db_path, conn) = migrated(tmp.path());
        let backups = backups_dir_for(&db_path);
        // open_and_migrate may have dropped a pre-migrate snapshot in here; start
        // from a clean dir so this test asserts purely on its own pre-import files.
        clear(&backups);

        // Take 8 real snapshots. prune keeps the 5 newest by mtime; a sleep well
        // past filesystem mtime resolution (HFS+/APFS ~1s in the worst case, but
        // typically ms) keeps the newest-first ordering unambiguous. Each one
        // mutates the DB first so content dedup never turns a write into an
        // Unchanged — this test is about the quota, not the hash.
        let mut all = Vec::new();
        for n in 0..8 {
            touch(&conn, n);
            let out = snapshot(&conn, &backups, PREFIX_PRE_IMPORT).expect("snapshot");
            all.push(out);
            std::thread::sleep(Duration::from_millis(20));
        }

        // prune runs after every snapshot, so the dir never exceeds the cap.
        assert_eq!(db_count(&backups), MAX_BACKUPS, "must keep exactly 5");
        // The very newest snapshot must always survive the prune.
        assert!(
            all.last().unwrap().path().exists(),
            "the newest snapshot must never be pruned"
        );
    }

    /// The bug this module's per-prefix quota exists to kill (HANDOFF 32): a
    /// migration that fails on every launch used to take a `pre-migrate`
    /// snapshot each time and, sharing one five-slot quota, evict every
    /// `pre-import` file — the user's only route back.
    #[test]
    fn a_storm_of_one_prefix_cannot_evict_another_prefix() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let (db_path, conn) = migrated(tmp.path());
        let backups = backups_dir_for(&db_path);
        clear(&backups);

        // The file the user will need if the migration loop is ever escaped.
        touch(&conn, 100);
        let precious = snapshot(&conn, &backups, PREFIX_PRE_IMPORT).expect("pre-import snapshot");
        let precious = precious.path().to_path_buf();

        // Eight distinct pre-migrate snapshots: more than the whole quota.
        for n in 0..8 {
            touch(&conn, n);
            snapshot(&conn, &backups, PREFIX_PRE_MIGRATE).expect("pre-migrate snapshot");
        }

        assert!(
            precious.exists(),
            "a pre-import snapshot must survive any number of pre-migrate snapshots"
        );
        assert_eq!(
            prefix_count(&backups, PREFIX_PRE_IMPORT),
            1,
            "the pre-import prefix keeps its own slots"
        );
        assert_eq!(
            prefix_count(&backups, PREFIX_PRE_MIGRATE),
            MAX_BACKUPS,
            "pre-migrate is capped on its own quota"
        );
    }

    /// The other half of HANDOFF 32: even within one prefix, repeating the same
    /// unchanged database must not consume a slot. `VACUUM INTO` is
    /// byte-deterministic for identical content, which is what makes the hash
    /// comparison decisive rather than merely a heuristic.
    #[test]
    fn an_unchanged_database_reuses_its_snapshot_and_a_changed_one_does_not() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let (db_path, conn) = migrated(tmp.path());
        let backups = backups_dir_for(&db_path);
        clear(&backups);

        let first = snapshot(&conn, &backups, PREFIX_PRE_MIGRATE).expect("first snapshot");
        let SnapshotOutcome::Written(first_path) = first else {
            panic!("the first snapshot of a prefix must be a real write");
        };
        assert_eq!(prefix_count(&backups, PREFIX_PRE_MIGRATE), 1);

        let second = snapshot(&conn, &backups, PREFIX_PRE_MIGRATE).expect("second snapshot");
        assert_eq!(
            second,
            SnapshotOutcome::Unchanged(first_path.clone()),
            "an unchanged DB must report the existing file, not write a new one"
        );
        assert_eq!(
            prefix_count(&backups, PREFIX_PRE_MIGRATE),
            1,
            "a duplicate must not occupy a second slot"
        );
        // And no temp file was left behind.
        assert_eq!(
            std::fs::read_dir(&backups).unwrap().count(),
            1,
            "the .tmp staging file must be cleaned up"
        );

        // One row of real change is enough to earn a new slot.
        touch(&conn, 1);
        let third = snapshot(&conn, &backups, PREFIX_PRE_MIGRATE).expect("third snapshot");
        assert!(
            matches!(third, SnapshotOutcome::Written(ref p) if p != &first_path),
            "a changed DB must write a new file, got {third:?}"
        );
        assert_eq!(
            prefix_count(&backups, PREFIX_PRE_MIGRATE),
            2,
            "both the before and after states must be on disk"
        );
    }

    /// The trap that makes the dedup a pessimisation instead of an optimisation:
    /// `daily_backup_due` reads the newest snapshot's mtime, so if an `Unchanged`
    /// outcome left that mtime alone, a database nobody edits would be forever
    /// overdue — a full `VACUUM INTO` plus two hashes, under the connection lock,
    /// every hour and every launch, all of it thrown away.
    #[test]
    fn an_unchanged_outcome_still_discharges_the_daily_schedule() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let (db_path, conn) = migrated(tmp.path());
        let backups = backups_dir_for(&db_path);
        clear(&backups);

        let first = snapshot(&conn, &backups, PREFIX_DAILY).expect("first daily");
        let kept = first.path().to_path_buf();

        // Age it as a day of real time would.
        let long_ago = SystemTime::now() - Duration::from_secs(25 * 3600);
        touch_mtime(&kept, long_ago).expect("age the snapshot");
        assert!(
            daily_backup_due(&backups, SystemTime::now()),
            "a day-old snapshot is due for a successor"
        );

        // The database has not changed, so no successor gets written...
        let second = snapshot(&conn, &backups, PREFIX_DAILY).expect("second daily");
        assert_eq!(
            second,
            SnapshotOutcome::Unchanged(kept.clone()),
            "an untouched database must not write a second copy"
        );
        // ...and yet today's backup is accounted for.
        assert!(
            !daily_backup_due(&backups, SystemTime::now()),
            "an Unchanged outcome must reset the clock, not leave it expired"
        );

        // The next poll an hour later therefore does no work at all.
        let third = snapshot(&conn, &backups, PREFIX_DAILY).expect("third daily");
        assert_eq!(third, SnapshotOutcome::Unchanged(kept));
        assert_eq!(
            prefix_count(&backups, PREFIX_DAILY),
            1,
            "three daily snapshots of one unchanged database occupy one slot"
        );
    }

    /// A process killed between `VACUUM INTO` and the rename leaves a temp file
    /// that is a full copy of the database, and nothing used to collect it.
    ///
    /// The interesting half is what the sweep must NOT take: a temp file minutes
    /// old may belong to a second process mid-`VACUUM INTO` right now (the
    /// installed app alongside a working-tree build). Deleting that one makes
    /// its rename fail, which on the pre-migrate path tells the user their
    /// database is broken.
    #[test]
    fn the_sweep_takes_abandoned_staging_files_and_leaves_in_flight_ones() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let (db_path, conn) = migrated(tmp.path());
        let backups = backups_dir_for(&db_path);
        clear(&backups);
        let long_ago = SystemTime::now() - Duration::from_secs(2 * 3600);

        let abandoned = backups.join(".daily-100-4242.tmp");
        std::fs::write(&abandoned, b"a killed process left this behind").expect("write debris");
        touch_mtime(&abandoned, long_ago).expect("age the debris");

        // Freshly written: another process could be filling this right now.
        let in_flight = backups.join(".daily-200-4243.tmp");
        std::fs::write(&in_flight, b"a VACUUM INTO may be running into this")
            .expect("write in-flight file");

        // Old, but another prefix's business.
        let other_prefix = backups.join(".pre-import-100-4244.tmp");
        std::fs::write(&other_prefix, b"not this call's business").expect("write other debris");
        touch_mtime(&other_prefix, long_ago).expect("age the other debris");

        snapshot(&conn, &backups, PREFIX_DAILY).expect("daily snapshot");

        assert!(
            !abandoned.exists(),
            "an hours-old staging file of this prefix must be collected"
        );
        assert!(
            in_flight.exists(),
            "a staging file young enough to still be in use must be left alone"
        );
        assert!(
            other_prefix.exists(),
            "another prefix's staging file must be left alone"
        );
    }

    /// Within one clock second the numeric suffix, not the raw file name, decides
    /// which snapshot is newer: `-1.db` was written after `.db`, but `'-'` sorts
    /// below `'.'`, so a plain string comparison gets it exactly backwards.
    #[test]
    fn snapshots_taken_in_the_same_second_order_by_write_order() {
        let dir = tempfile::tempdir().expect("tempdir");
        let earlier = dir.path().join("daily-100.db");
        let later = dir.path().join("daily-100-1.db");
        assert!(
            later < earlier,
            "the premise: as raw paths, the later file compares smaller"
        );
        assert!(
            name_order_key(&later, PREFIX_DAILY) > name_order_key(&earlier, PREFIX_DAILY),
            "as parsed keys, the later file must compare greater"
        );
        assert_eq!(
            name_order_key(&dir.path().join("daily-not-a-number.db"), PREFIX_DAILY),
            (0, 0),
            "an unparseable name sorts oldest so it can never win the dedup comparison"
        );
    }

    #[test]
    fn daily_backups_keep_a_week() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let (db_path, conn) = migrated(tmp.path());
        let backups = backups_dir_for(&db_path);
        clear(&backups);

        for n in 0..10 {
            touch(&conn, n);
            snapshot(&conn, &backups, PREFIX_DAILY).expect("daily snapshot");
        }
        assert_eq!(
            prefix_count(&backups, PREFIX_DAILY),
            MAX_DAILY_BACKUPS,
            "daily keeps seven, not five"
        );
    }

    #[test]
    fn daily_backup_is_due_when_none_exists_or_the_newest_is_a_day_old() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let (db_path, conn) = migrated(tmp.path());
        let backups = backups_dir_for(&db_path);
        clear(&backups);

        assert!(
            daily_backup_due(&backups, SystemTime::now()),
            "with no daily snapshot at all, one is always owed"
        );
        // A dir that does not exist yet (first ever launch) is also "due".
        assert!(
            daily_backup_due(&tmp.path().join("no-such-dir"), SystemTime::now()),
            "a missing backups dir must not suppress the first daily backup"
        );
        // Snapshots of the other prefixes are not daily backups.
        snapshot(&conn, &backups, PREFIX_PRE_MIGRATE).expect("pre-migrate snapshot");
        assert!(
            daily_backup_due(&backups, SystemTime::now()),
            "another prefix's snapshot must not satisfy the daily schedule"
        );

        snapshot(&conn, &backups, PREFIX_DAILY).expect("daily snapshot");
        // Rather than rewrite mtimes (which would need another dependency), move
        // the observer's clock: `now` is a parameter precisely so this is pure.
        let now = SystemTime::now();
        assert!(
            !daily_backup_due(&backups, now),
            "a snapshot taken moments ago is not stale"
        );
        assert!(
            !daily_backup_due(&backups, now + Duration::from_secs(23 * 3600)),
            "23 hours is still inside the interval"
        );
        assert!(
            daily_backup_due(&backups, now + Duration::from_secs(25 * 3600)),
            "past 24 hours, another daily backup is owed"
        );
        assert!(
            !daily_backup_due(&backups, now - Duration::from_secs(48 * 3600)),
            "a clock that jumped backwards must not trigger a backup storm"
        );
    }

    #[test]
    fn snapshot_fails_when_backups_dir_is_a_file() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let (_db_path, conn) = migrated(tmp.path());
        // Occupy a *fresh* backups path with a regular file so create_dir_all
        // fails — stands in for any unwritable-target condition. snapshot must
        // Err. (A fresh dir avoids colliding with the real backups/ that
        // open_and_migrate already created.)
        let blocked = tempfile::tempdir().expect("tempdir");
        let backups = blocked.path().join("backups");
        std::fs::write(&backups, b"not a dir").expect("write blocker file");

        let err = snapshot(&conn, &backups, PREFIX_PRE_IMPORT);
        assert!(err.is_err(), "snapshot into an unwritable target must fail");
    }
}
