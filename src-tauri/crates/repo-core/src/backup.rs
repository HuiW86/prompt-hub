//! WAL-safe database snapshots for the fail-safe restore paths (import wipe,
//! pre-migration). `VACUUM INTO` is used instead of a bare `fs::copy`: in WAL
//! mode the `.db` file alone is incomplete (recent pages live in `-wal`), so a
//! filesystem copy of the main file can miss committed data. `VACUUM INTO`
//! asks SQLite to write a consistent, fully-checkpointed copy of the live
//! database — safe to run against an active connection.

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;

use crate::error::{RepoError, RepoResult};

// Keep at most this many auto-backups per directory; older ones are pruned after
// a successful new snapshot so the backups/ dir can't grow without bound.
pub const MAX_BACKUPS: usize = 5;

/// Directory (under the DB's parent) where auto-backups are written.
pub const BACKUPS_DIRNAME: &str = "backups";

/// Resolve the `backups/` directory that sits next to the database file.
pub fn backups_dir_for(db_path: &Path) -> PathBuf {
    db_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(BACKUPS_DIRNAME)
}

/// Snapshot the live database behind `conn` into
/// `<backups_dir>/<prefix>-<unix_secs>.db` using `VACUUM INTO`, then prune the
/// directory down to `MAX_BACKUPS` most-recent files. Returns the path written.
///
/// This is a fail-safe primitive: callers treat an `Err` as "abort the risky
/// operation" (do not import / do not migrate), so nothing here is best-effort.
pub fn snapshot(conn: &Connection, backups_dir: &Path, prefix: &str) -> RepoResult<PathBuf> {
    std::fs::create_dir_all(backups_dir)?;

    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        // Clock before the epoch is implausible; fall back to 0 rather than fail
        // the backup (a monotonic-enough name is all we need for uniqueness here,
        // and prune keeps the newest by mtime, not by parsed timestamp).
        .unwrap_or(0);

    let mut target = backups_dir.join(format!("{prefix}-{secs}.db"));
    // Guard against two snapshots landing in the same whole second (e.g. import
    // right after migrate) clobbering each other — bump a numeric suffix.
    let mut dedup = 1u32;
    while target.exists() {
        target = backups_dir.join(format!("{prefix}-{secs}-{dedup}.db"));
        dedup += 1;
    }

    // `VACUUM INTO` takes a string literal path; bind it as a parameter so a path
    // containing a quote can't break the statement.
    let target_str = target.to_string_lossy();
    conn.execute("VACUUM INTO ?1", [target_str.as_ref()])?;

    prune(backups_dir)?;
    Ok(target)
}

/// Keep only the `MAX_BACKUPS` most-recently-modified `*.db` files in
/// `backups_dir`, deleting the rest. Any single removal failure aborts (the
/// caller decides whether that's fatal), but a fresh snapshot already succeeded
/// before this runs, so retention is the only thing at risk.
fn prune(backups_dir: &Path) -> RepoResult<()> {
    let mut entries: Vec<(SystemTime, PathBuf)> = std::fs::read_dir(backups_dir)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|ext| ext == "db"))
        .filter_map(|p| {
            let mtime = std::fs::metadata(&p).and_then(|m| m.modified()).ok()?;
            Some((mtime, p))
        })
        .collect();

    if entries.len() <= MAX_BACKUPS {
        return Ok(());
    }

    // Newest first, then drop everything past the cap.
    entries.sort_by_key(|entry| std::cmp::Reverse(entry.0));
    for (_, path) in entries.into_iter().skip(MAX_BACKUPS) {
        std::fs::remove_file(&path).map_err(RepoError::from)?;
    }
    Ok(())
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

    #[test]
    fn snapshot_creates_a_restorable_copy() {
        let tmp = tempfile::tempdir().expect("tempdir");
        let (db_path, conn) = migrated(tmp.path());
        let backups = backups_dir_for(&db_path);

        let out = snapshot(&conn, &backups, "pre-import").expect("snapshot");
        assert!(out.exists(), "snapshot file must exist");
        let name = out.file_name().unwrap().to_string_lossy();
        assert!(name.starts_with("pre-import-"), "prefix in name: {name}");

        // The copy is a valid, complete SQLite DB carrying the seed data.
        let restored = Connection::open(&out).expect("open snapshot");
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
        for e in std::fs::read_dir(&backups).unwrap().filter_map(|e| e.ok()) {
            std::fs::remove_file(e.path()).ok();
        }

        // Take 8 real snapshots. prune keeps the 5 newest by mtime; a sleep well
        // past filesystem mtime resolution (HFS+/APFS ~1s in the worst case, but
        // typically ms) keeps the newest-first ordering unambiguous. We assert the
        // set sizes rather than which specific file survives so we don't depend on
        // exact mtime tie-breaking.
        let mut all = Vec::new();
        for _ in 0..8 {
            let out = snapshot(&conn, &backups, "pre-import").expect("snapshot");
            all.push(out);
            std::thread::sleep(Duration::from_millis(20));
        }

        // prune runs after every snapshot, so the dir never exceeds the cap.
        assert_eq!(db_count(&backups), MAX_BACKUPS, "must keep exactly 5");
        // The very newest snapshot must always survive the prune. (We assert the
        // cap + newest rather than per-file survival: within one clock second the
        // dedup suffix can reuse a just-pruned name, so `all` may hold repeated
        // paths — the on-disk count is the authoritative signal.)
        assert!(
            all.last().unwrap().exists(),
            "the newest snapshot must never be pruned"
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

        let err = snapshot(&conn, &backups, "pre-import");
        assert!(err.is_err(), "snapshot into an unwritable target must fail");
    }
}
