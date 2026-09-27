use std::path::Path;
use std::time::Duration;

use rusqlite::{Connection, OpenFlags};

use crate::error::{RepoError, RepoResult};

// Wait this long for a write lock before returning SQLITE_BUSY. With two
// processes (Tauri app + MCP server) sharing one WAL database, the writer may
// briefly hold the lock; 5s lets the loser retry instead of erroring out. R1.
const BUSY_TIMEOUT: Duration = Duration::from_millis(5000);

// Ordered list of migrations. `target_version` is the value PRAGMA user_version
// should hold after the migration succeeds. Versions must be strictly increasing.
const MIGRATIONS: &[Migration] = &[
    Migration {
        target_version: 1,
        name: "0001_initial",
        sql: include_str!("../migrations/0001_initial.sql"),
    },
    Migration {
        target_version: 2,
        name: "0002_seed",
        sql: include_str!("../migrations/0002_seed.sql"),
    },
    Migration {
        target_version: 3,
        name: "0003_drafts",
        sql: include_str!("../migrations/0003_drafts.sql"),
    },
    Migration {
        target_version: 4,
        name: "0004_compositions",
        sql: include_str!("../migrations/0004_compositions.sql"),
    },
    Migration {
        target_version: 5,
        name: "0005_macros_order_index",
        sql: include_str!("../migrations/0005_macros_order_index.sql"),
    },
    Migration {
        target_version: 6,
        name: "0006_modifiers_order_index",
        sql: include_str!("../migrations/0006_modifiers_order_index.sql"),
    },
    Migration {
        target_version: 7,
        name: "0007_alignment_phrases_order_index",
        sql: include_str!("../migrations/0007_alignment_phrases_order_index.sql"),
    },
    Migration {
        target_version: 8,
        name: "0008_compositions_order_index",
        sql: include_str!("../migrations/0008_compositions_order_index.sql"),
    },
    Migration {
        target_version: 9,
        name: "0009_phrases_order_index",
        sql: include_str!("../migrations/0009_phrases_order_index.sql"),
    },
    Migration {
        target_version: 10,
        name: "0010_scene_icons_lucide",
        sql: include_str!("../migrations/0010_scene_icons_lucide.sql"),
    },
    Migration {
        target_version: 11,
        name: "0011_seed_sub_stages",
        sql: include_str!("../migrations/0011_seed_sub_stages.sql"),
    },
    Migration {
        target_version: 12,
        name: "0012_settings",
        sql: include_str!("../migrations/0012_settings.sql"),
    },
    Migration {
        target_version: 13,
        name: "0013_soft_delete",
        sql: include_str!("../migrations/0013_soft_delete.sql"),
    },
    Migration {
        target_version: 14,
        name: "0014_alignment_coordinates",
        sql: include_str!("../migrations/0014_alignment_coordinates.sql"),
    },
    Migration { target_version: 15, name: "0015_websites", sql: include_str!("../migrations/0015_websites.sql") },
];

struct Migration {
    target_version: u32,
    name: &'static str,
    sql: &'static str,
}

/// The schema version this binary was built against (highest migration).
pub fn latest_version() -> u32 {
    MIGRATIONS
        .last()
        .map(|m| m.target_version)
        .unwrap_or_default()
}

/// Open the database for read+write and bring it up to the latest schema.
/// Only the migration owner (the Tauri main app) should call this — never the
/// MCP server, which must not race migrations against the app (R1).
pub fn open_and_migrate(path: &Path) -> RepoResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    // Self-check before anything else touches the file. Two reasons for this
    // exact position: `configure` sets journal_mode, which *rewrites the file
    // header* — there is no reason to write to a file we may be about to refuse
    // — and applying migration DDL on top of a damaged b-tree is what turns a
    // file the user could still have restored into one nobody can. Refuse
    // instead, and let lib.rs point them at backups/ (HANDOFF 21.3).
    //
    // busy_timeout is the one setting that has to precede the check: it is pure
    // connection state (it writes nothing) and without it a database another
    // process is mid-write on would come back SQLITE_BUSY instead of waiting.
    conn.busy_timeout(BUSY_TIMEOUT)?;
    quick_check(&conn)?;
    configure(&conn)?;
    // Snapshot into the backups/ dir next to the DB file before any migration
    // touches the schema. Fresh installs (no pending migrations) skip this.
    let backups_dir = crate::backup::backups_dir_for(path);
    run_migrations_with_backup(&conn, Some(&backups_dir))?;
    Ok(conn)
}

/// `PRAGMA quick_check`: the cheap half of `integrity_check` — it verifies page
/// and b-tree structure but skips the index-content cross-check, which is what
/// keeps it fast enough to sit on the startup path of every launch.
///
/// A healthy database answers with the single row `ok`. Anything else (rows
/// describing damage, or a statement that fails with a corruption code because
/// the file is too broken to even walk) becomes
/// [`RepoError::IntegrityCheckFailed`]. Non-corruption errors are passed through
/// unchanged so a locked or busy database is not mislabelled as damaged.
fn quick_check(conn: &Connection) -> RepoResult<()> {
    // Cap the rows we pull: quick_check on a badly damaged file can emit one row
    // per broken page, and the detail string ends up in a dialog a human reads.
    const MAX_DETAIL_ROWS: usize = 5;

    let rows: Vec<String> = match conn
        .prepare("PRAGMA quick_check")
        .and_then(|mut stmt| {
            stmt.query_map([], |row| row.get::<_, String>(0))?
                .collect::<rusqlite::Result<Vec<String>>>()
        }) {
        Ok(rows) => rows,
        Err(e) if is_corruption(&e) => {
            let detail = e.to_string();
            log::error!("quick_check could not run: {detail}");
            return Err(RepoError::IntegrityCheckFailed { detail });
        }
        Err(e) => return Err(e.into()),
    };

    if rows.first().is_some_and(|first| first == "ok") {
        return Ok(());
    }

    let detail = if rows.is_empty() {
        "quick_check returned no result".to_string()
    } else {
        rows.iter()
            .take(MAX_DETAIL_ROWS)
            .cloned()
            .collect::<Vec<_>>()
            .join("; ")
    };
    log::error!("quick_check failed: {detail}");
    Err(RepoError::IntegrityCheckFailed { detail })
}

/// Whether a rusqlite error means "this file is damaged" as opposed to "this
/// database is busy / locked / misused".
fn is_corruption(err: &rusqlite::Error) -> bool {
    use rusqlite::ffi::ErrorCode;
    matches!(
        err,
        rusqlite::Error::SqliteFailure(e, _)
            if matches!(e.code, ErrorCode::DatabaseCorrupt | ErrorCode::NotADatabase)
    )
}

/// Open the database read-only for a non-owner consumer (the MCP server).
/// Does NOT run migrations; instead it refuses to open unless the on-disk
/// schema version exactly matches `latest_version()`, so the MCP server never
/// reads a half-migrated or future schema (R1).
pub fn open_read_only(path: &Path) -> RepoResult<Connection> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_ONLY
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    // journal_mode / synchronous can't be set on a read-only handle (they need
    // a write); the owner already put the file in WAL. Only the per-connection
    // settings that are legal read-only.
    conn.busy_timeout(BUSY_TIMEOUT)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;

    let found: u32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    let expected = latest_version();
    if found != expected {
        return Err(RepoError::SchemaVersionMismatch { found, expected });
    }
    Ok(conn)
}

/// Open the database read+write for a non-owner consumer that writes only the
/// drafts staging table (the MCP server). Like `open_read_only` it does NOT run
/// migrations — the Tauri app owns those (R1) — and refuses to open unless the
/// on-disk schema version exactly matches `latest_version()`. The read+write
/// handle is needed because the MCP server writes drafts; compile-time write
/// isolation (no `repo-write` dependency) keeps it off the 7 asset tables.
pub fn open_write_checked(path: &Path) -> RepoResult<Connection> {
    let conn = Connection::open_with_flags(
        path,
        OpenFlags::SQLITE_OPEN_READ_WRITE
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    // No CREATE flag: the file must already exist and be migrated by the owner.
    // journal_mode / synchronous are DB-level settings the owner already set in
    // WAL; a non-owner only applies the legal per-connection settings.
    conn.busy_timeout(BUSY_TIMEOUT)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;

    let found: u32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    let expected = latest_version();
    if found != expected {
        return Err(RepoError::SchemaVersionMismatch { found, expected });
    }
    Ok(conn)
}

#[cfg(test)]
pub fn open_in_memory() -> RepoResult<Connection> {
    let conn = Connection::open_in_memory()?;
    configure(&conn)?;
    // No on-disk path, so no pre-migration backup — pass None.
    run_migrations_with_backup(&conn, None)?;
    Ok(conn)
}

fn configure(conn: &Connection) -> RepoResult<()> {
    // Apply pragmas every time we open a connection — they are per-connection.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    conn.busy_timeout(BUSY_TIMEOUT)?;
    Ok(())
}

/// Run any pending migrations. When `backups_dir` is `Some` AND at least one
/// migration is actually pending, take a WAL-safe `pre-migrate-<unix>.db`
/// snapshot into that directory *before* the first migration transaction opens,
/// so a botched migration is recoverable. A snapshot failure aborts the whole
/// migration (fail-safe): we'd rather refuse to migrate than migrate blind.
/// A fresh install with nothing pending writes no backup.
fn run_migrations_with_backup(conn: &Connection, backups_dir: Option<&Path>) -> RepoResult<()> {
    let current: u32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    let has_pending = MIGRATIONS.iter().any(|m| m.target_version > current);

    // Snapshot exactly once, before touching the schema, and only when there is
    // real work to do. Skipped for in-memory / first-install (no backups_dir or
    // nothing pending).
    if has_pending {
        if let Some(dir) = backups_dir {
            crate::backup::snapshot(conn, dir, crate::backup::PREFIX_PRE_MIGRATE)?;
        }
    }

    for m in MIGRATIONS {
        if m.target_version <= current {
            continue;
        }
        // Each migration runs in its own transaction. SQL scripts may already
        // contain transactional structure, so we wrap them in a transaction
        // here and rely on the migrations being side-effect-free outside it.
        let tx = conn.unchecked_transaction()?;
        tx.execute_batch(m.sql).map_err(|e| {
            RepoError::Other(format!(
                "migration {} ({}) failed: {e}",
                m.target_version, m.name
            ))
        })?;
        tx.pragma_update(None, "user_version", m.target_version)?;
        tx.commit()?;
        log::info!("migration {} ({}) applied", m.target_version, m.name);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_advance_user_version_to_latest() {
        let conn = open_in_memory().expect("open in-memory db");
        let v: u32 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .expect("read user_version");
        let latest = MIGRATIONS
            .last()
            .expect("at least one migration")
            .target_version;
        assert_eq!(v, latest);
    }

    fn backup_db_count(db_path: &Path) -> usize {
        let dir = crate::backup::backups_dir_for(db_path);
        std::fs::read_dir(&dir)
            .map(|rd| {
                rd.filter_map(|e| e.ok())
                    .map(|e| e.path())
                    .filter(|p| {
                        p.extension().is_some_and(|x| x == "db")
                            && p.file_name()
                                .and_then(|n| n.to_str())
                                .is_some_and(|n| n.starts_with("pre-migrate-"))
                    })
                    .count()
            })
            .unwrap_or(0)
    }

    #[test]
    fn fresh_install_takes_no_pre_migration_backup() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        // First-ever open: user_version starts at 0 with all migrations pending,
        // but there's no prior state worth preserving. We still snapshot because
        // migrations run — but the DB was empty. Assert the *reopen* (nothing
        // pending) path produces no new backup instead.
        let _ = open_and_migrate(&path).expect("first open");
        let after_first = backup_db_count(&path);

        // Reopen with everything already migrated: no pending work, no new backup.
        let _ = open_and_migrate(&path).expect("second open");
        assert_eq!(
            backup_db_count(&path),
            after_first,
            "reopen with nothing pending must not add a pre-migrate backup"
        );
    }

    #[test]
    fn pending_migration_takes_a_pre_migration_backup() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        // Stand up a DB pinned at an old schema version so a reopen has real
        // pending migrations to run.
        {
            let conn = Connection::open(&path).expect("create");
            configure(&conn).expect("configure");
            conn.execute_batch(MIGRATIONS[0].sql).expect("run 0001");
            conn.pragma_update(None, "user_version", 1u32)
                .expect("pin v1");
        }
        assert_eq!(backup_db_count(&path), 0, "no backup before migrate");

        let _ = open_and_migrate(&path).expect("migrate from v1 to latest");
        assert_eq!(
            backup_db_count(&path),
            1,
            "a pending migration must leave exactly one pre-migrate snapshot"
        );
    }

    #[test]
    fn migrations_are_idempotent_across_reopen() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        {
            let _ = open_and_migrate(&path).expect("first open runs migrations");
        }
        // Second open with the same path must not re-run migrations.
        let conn = open_and_migrate(&path).expect("second open");
        let phase_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM phases", [], |row| row.get(0))
            .expect("count phases");
        assert_eq!(phase_count, 9, "seed should land exactly once");
    }

    #[test]
    fn open_read_only_succeeds_after_owner_migrated() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        let _owner = open_and_migrate(&path).expect("owner migrates");

        let ro = open_read_only(&path).expect("read-only open at matching version");
        let phase_count: i64 = ro
            .query_row("SELECT COUNT(*) FROM phases", [], |row| row.get(0))
            .expect("count phases read-only");
        assert_eq!(phase_count, 9);

        // Writes must be rejected by SQLite on a read-only handle.
        let write = ro.execute("DELETE FROM phases", []);
        assert!(write.is_err(), "read-only handle must reject writes");
    }

    #[test]
    fn open_write_checked_allows_writes_at_matching_version() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        let _owner = open_and_migrate(&path).expect("owner migrates");

        let rw = open_write_checked(&path).expect("write open at matching version");
        // A write that a read-only handle would reject must succeed here (0 rows
        // touched keeps seed data intact).
        rw.execute("DELETE FROM phases WHERE 0", [])
            .expect("read+write handle must accept writes");
    }

    #[test]
    fn open_write_checked_refuses_on_version_mismatch() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        {
            let conn = Connection::open(&path).expect("create");
            configure(&conn).expect("configure");
            conn.pragma_update(None, "user_version", 1u32)
                .expect("set stale version");
        }
        let err = open_write_checked(&path).expect_err("must refuse stale schema");
        assert!(
            matches!(err, RepoError::SchemaVersionMismatch { found: 1, .. }),
            "expected SchemaVersionMismatch, got {err:?}"
        );
    }

    #[test]
    fn open_read_only_refuses_on_version_mismatch() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        // Create a DB whose schema version is behind what this binary expects,
        // simulating an MCP server that started before the app migrated.
        {
            let conn = Connection::open(&path).expect("create");
            configure(&conn).expect("configure");
            conn.pragma_update(None, "user_version", 1u32)
                .expect("set stale version");
        }
        let err = open_read_only(&path).expect_err("must refuse stale schema");
        assert!(
            matches!(err, RepoError::SchemaVersionMismatch { found: 1, .. }),
            "expected SchemaVersionMismatch, got {err:?}"
        );
    }

    // The two ways a user machine gets `fail_startup` (lib.rs): a file that is
    // not SQLite, and a parent path that cannot become a directory. Both must
    // surface as Err, never panic — the dialog + exit(1) contract in features
    // §3.12 sits on top of this. Verified once on device (G4 W21); this pins it.
    #[test]
    fn open_and_migrate_rejects_non_sqlite_file() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        std::fs::write(&path, vec![0xABu8; 4096]).expect("write garbage");
        let err = open_and_migrate(&path).expect_err("garbage file must not open");
        assert!(
            err.to_string().contains("not a database"),
            "expected sqlite 'file is not a database', got {err}"
        );
    }

    // ── Startup self-check (HANDOFF 21.3) ────────────────────────────────────

    #[test]
    fn open_and_migrate_passes_quick_check_on_a_healthy_database() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        let _first = open_and_migrate(&path).expect("first open must self-check clean");
        // The reopen is the shape every launch after the first sees: a populated
        // file with a live WAL beside it, and nothing pending to migrate.
        let conn = open_and_migrate(&path).expect("reopen must self-check clean");
        quick_check(&conn).expect("an explicit check on a healthy db reports ok");
    }

    /// Overwrite everything past page 1 with garbage. Page 1 carries the file
    /// header and the `sqlite_master` b-tree root, so the file still opens and
    /// still describes its own schema — the damage is exactly the kind only an
    /// integrity check finds, which is the point of running one at startup.
    fn corrupt_every_page_after_the_first(path: &Path) {
        let mut bytes = std::fs::read(path).expect("read db");
        // Bytes 16..18 hold the page size; the value 1 encodes 65536.
        let page_size = match u16::from_be_bytes([bytes[16], bytes[17]]) {
            1 => 65_536usize,
            n => n as usize,
        };
        assert!(
            bytes.len() > page_size * 2,
            "the fixture db must have pages beyond the first for this to damage anything"
        );
        for byte in bytes.iter_mut().skip(page_size) {
            *byte = 0xAB;
        }
        std::fs::write(path, &bytes).expect("write corrupted db");
    }

    #[test]
    fn open_and_migrate_refuses_a_database_that_fails_quick_check() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        {
            let conn = open_and_migrate(&path).expect("build a healthy db");
            // Fold the WAL back into the main file and drop it, so the bytes we
            // damage below are the only copy of those pages — otherwise SQLite
            // would read the good originals out of `-wal` and see nothing wrong.
            conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE)")
                .expect("checkpoint");
        }
        std::fs::remove_file(path.with_extension("db-wal")).ok();
        std::fs::remove_file(path.with_extension("db-shm")).ok();

        corrupt_every_page_after_the_first(&path);

        let err = open_and_migrate(&path).expect_err("a damaged file must not be migrated");
        assert!(
            matches!(err, RepoError::IntegrityCheckFailed { .. }),
            "expected IntegrityCheckFailed, got {err:?}"
        );
        assert!(
            !err.to_string().is_empty(),
            "the dialog shown to the user is built from this message"
        );
    }

    #[test]
    fn open_and_migrate_fails_when_parent_is_not_a_directory() {
        let dir = tempfile::tempdir().expect("tempdir");
        let blocker = dir.path().join("blocker");
        std::fs::write(&blocker, b"x").expect("write blocker file");
        assert!(
            open_and_migrate(&blocker.join("prompt-hub.db")).is_err(),
            "a regular file in the parent position must fail create_dir_all"
        );
    }

    // --- ADR-028 P0: migration 0013 ------------------------------------------

    /// Stand up a database pinned at `user_version = 12`, i.e. everything ADR-028
    /// shipped on top of, with the 0002 / 0011 seeds already in place. This is the
    /// shape a real user's file has the moment they install the release that
    /// carries `0013`.
    fn db_at_version_12() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        configure(&conn).expect("configure");
        for m in MIGRATIONS.iter().filter(|m| m.target_version <= 12) {
            conn.execute_batch(m.sql)
                .unwrap_or_else(|e| panic!("migration {} failed: {e}", m.name));
        }
        conn.pragma_update(None, "user_version", 12u32)
            .expect("pin v12");
        conn
    }

    fn apply_0013(conn: &Connection) {
        let m = MIGRATIONS
            .iter()
            .find(|m| m.name == "0013_soft_delete")
            .expect("0013 must be registered");
        conn.execute_batch(m.sql).expect("apply 0013");
        conn.pragma_update(None, "user_version", m.target_version)
            .expect("bump user_version");
    }

    fn has_column(conn: &Connection, table: &str, column: &str) -> bool {
        let mut stmt = conn
            .prepare(&format!("PRAGMA table_info({table})"))
            .expect("table_info");
        let names: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .expect("query")
            .filter_map(Result::ok)
            .collect();
        names.iter().any(|name| name == column)
    }

    /// 0013 has to land on a database that is already full of the user's data,
    /// not on an empty one. Every one of the seven asset tables must come out
    /// with a `deleted_at` column, and every pre-existing row must come out
    /// alive — `ALTER TABLE ... ADD COLUMN` with no default backfills NULL,
    /// which is exactly the "not deleted" value.
    #[test]
    fn migration_0013_adds_deleted_at_to_a_populated_database_leaving_rows_alive() {
        let conn = db_at_version_12();
        // The two asset tables the seeds leave empty get rows too, so "already
        // has rows" is true for all seven.
        conn.execute(
            "INSERT INTO modifiers
                (id, name, content, group_kind, usage_count, created_at, deprecated, order_index)
             VALUES ('mod-pre', '迁移前的改造器', 'body', 'cognition', 0, '2026-09-01T00:00:00Z', 0, 0)",
            [],
        )
        .expect("insert modifier");
        conn.execute(
            "INSERT INTO compositions
                (id, name, modifier_ids, phase_id, usage_count, created_at, deprecated, order_index)
             VALUES ('comp-pre', '迁移前的组合', '[]', 'phase-diverge', 0, '2026-09-01T00:00:00Z', 0, 0)",
            [],
        )
        .expect("insert composition");

        let tables = [
            "modifiers",
            "macros",
            "alignment_phrases",
            "compositions",
            "phrases",
            "scenes",
            "sub_stages",
        ];
        for t in tables {
            assert!(
                !has_column(&conn, t, "deleted_at"),
                "{t} must not have deleted_at before 0013"
            );
        }

        apply_0013(&conn);

        let v: u32 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .expect("read user_version");
        assert_eq!(v, 13, "0013 owns user_version 13");

        for t in tables {
            assert!(has_column(&conn, t, "deleted_at"), "{t} must gain the column");
            let total: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {t}"), [], |r| r.get(0))
                .expect("count rows");
            assert!(total > 0, "{t} must already hold rows for this to prove anything");
            let stamped: i64 = conn
                .query_row(
                    &format!("SELECT COUNT(*) FROM {t} WHERE deleted_at IS NOT NULL"),
                    [],
                    |r| r.get(0),
                )
                .expect("count stamped rows");
            assert_eq!(
                stamped, 0,
                "{t}: migrating must not send a single existing row to the trash"
            );
        }
    }

    /// The trap ADR-028 §5 "动手前必须先修的两个坑" #1 names: the 0001 form of
    /// `idx_alignment_phrase_one_default_per_phase` cannot see `deleted_at`, so a
    /// trashed default would occupy its phase's only default slot forever. After
    /// 0013 rebuilds the index with `AND deleted_at IS NULL`, appointing a new
    /// default while the old one sits in the trash has to succeed.
    #[test]
    fn migration_0013_rebuilds_the_default_index_so_a_trashed_default_frees_its_slot() {
        let conn = db_at_version_12();
        conn.execute(
            "INSERT INTO alignment_phrases
                (id, phase_id, name, content, is_default, usage_count, created_at,
                 deprecated, order_index)
             VALUES ('ap-diverge-second', 'phase-diverge', '备选', 'body', 0, 0,
                     '2026-09-01T00:00:00Z', 0, 1)",
            [],
        )
        .expect("insert successor");

        apply_0013(&conn);

        conn.execute(
            "UPDATE alignment_phrases SET deleted_at = '2026-09-03T00:00:00+00:00'
             WHERE id = 'ap-diverge-default'",
            [],
        )
        .expect("trash the seeded default");
        conn.execute(
            "UPDATE alignment_phrases SET is_default = 1 WHERE id = 'ap-diverge-second'",
            [],
        )
        .expect("the trashed default must no longer occupy the phase's default slot");

        // And the constraint still holds among live rows.
        conn.execute(
            "INSERT INTO alignment_phrases
                (id, phase_id, name, content, is_default, usage_count, created_at,
                 deprecated, order_index)
             VALUES ('ap-diverge-third', 'phase-diverge', '第三个', 'body', 1, 0,
                     '2026-09-01T00:00:00Z', 0, 2)",
            [],
        )
        .expect_err("two LIVE defaults in one phase must still be rejected");
    }

    // --- ADR-029: migration 0014 ---------------------------------------------

    /// A database pinned at `user_version = 13` — everything ADR-029 lands on
    /// top of. This is the shape a real user's file has the moment they install
    /// the release carrying `0014`.
    fn db_at_version_13() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory db");
        configure(&conn).expect("configure");
        for m in MIGRATIONS.iter().filter(|m| m.target_version <= 13) {
            conn.execute_batch(m.sql)
                .unwrap_or_else(|e| panic!("migration {} failed: {e}", m.name));
        }
        conn.pragma_update(None, "user_version", 13u32)
            .expect("pin v13");
        conn
    }

    fn apply_0014(conn: &Connection) {
        let m = MIGRATIONS
            .iter()
            .find(|m| m.name == "0014_alignment_coordinates")
            .expect("0014 must be registered");
        conn.execute_batch(m.sql).expect("apply 0014");
        conn.pragma_update(None, "user_version", m.target_version)
            .expect("bump user_version");
    }

    /// The one irreversible step in 0014 (ADR-029 §6 不可逆点 ①): `usage_records`
    /// is rebuilt from scratch because SQLite cannot ALTER a CHECK constraint.
    /// This is the highest-write table in the database and it has no
    /// `deleted_at` safety net, so "every historical row survives byte for
    /// byte" is the property the whole migration hinges on. One row per legacy
    /// `source` value, because the rebuilt CHECK has to keep accepting all six.
    #[test]
    fn migration_0014_rebuilds_usage_records_without_losing_a_single_row() {
        let conn = db_at_version_13();
        let legacy_sources = [
            "macro_area",
            "scene",
            "recent",
            "sop",
            "composition",
            "phase_bar",
        ];
        for (i, source) in legacy_sources.iter().enumerate() {
            conn.execute(
                "INSERT INTO usage_records
                    (id, timestamp, target_type, target_id, source, modifier_ids,
                     sop_id, sop_step_order, phase_id)
                 VALUES (?1, ?2, 'alignment', 'ap-diverge-default', ?3, '[\"m1\"]',
                         NULL, ?4, 'phase-diverge')",
                rusqlite::params![
                    format!("u{i}"),
                    format!("2026-09-0{}T00:00:00Z", i + 1),
                    source,
                    i as i64,
                ],
            )
            .expect("insert legacy usage row");
        }
        let before: Vec<(String, String, String, Option<i64>)> = read_usage(&conn);
        assert_eq!(before.len(), 6);

        apply_0014(&conn);

        let v: u32 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .expect("read user_version");
        assert_eq!(v, 14, "0014 owns user_version 14");

        let after = read_usage(&conn);
        assert_eq!(after, before, "every historical row must survive verbatim");

        // The new column exists and is NULL for all of history — the ledger
        // skips those rows rather than inventing a session boundary for them.
        let stamped: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM usage_records WHERE session_started_at IS NOT NULL",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(stamped, 0);

        // The rebuilt CHECK accepts the new value AND still refuses nonsense.
        conn.execute(
            "INSERT INTO usage_records (id, timestamp, target_type, target_id, source, session_started_at)
             VALUES ('u-cue', '2026-09-05T00:00:00Z', 'alignment', 'ap-live-stop', 'live_cue',
                     '2026-09-05T00:00:00Z')",
            [],
        )
        .expect("live_cue must now be a legal source");
        conn.execute(
            "INSERT INTO usage_records (id, timestamp, target_type, target_id, source)
             VALUES ('u-bad', '2026-09-05T00:00:00Z', 'alignment', 'ap-live-stop', 'telepathy')",
            [],
        )
        .expect_err("the CHECK must still reject an unknown source");

        // And the three 0001 indexes came back with the table.
        for index in [
            "idx_usage_records_timestamp",
            "idx_usage_records_target",
            "idx_usage_records_phase",
        ] {
            let found: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
                    [index],
                    |r| r.get(0),
                )
                .expect("look up index");
            assert_eq!(found, 1, "{index} must be recreated after the rebuild");
        }
    }

    fn read_usage(conn: &Connection) -> Vec<(String, String, String, Option<i64>)> {
        let mut stmt = conn
            .prepare(
                "SELECT id, timestamp, source, sop_step_order FROM usage_records ORDER BY id ASC",
            )
            .expect("prepare");
        stmt.query_map([], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
        })
        .expect("query")
        .collect::<rusqlite::Result<Vec<_>>>()
        .expect("collect")
    }

    /// The seed half of 0014: a 9th phase carrying six live cues, six form
    /// phrases spread across existing phases, and 16 axis values.
    #[test]
    fn migration_0014_seeds_the_live_phase_its_cues_and_the_axis_values() {
        let conn = db_at_version_13();
        apply_0014(&conn);

        let axis_values: i64 = conn
            .query_row("SELECT COUNT(*) FROM alignment_axis_values", [], |r| {
                r.get(0)
            })
            .expect("count axis values");
        assert_eq!(axis_values, 16);

        let phrases: i64 = conn
            .query_row("SELECT COUNT(*) FROM alignment_phrases", [], |r| r.get(0))
            .expect("count phrases");
        assert_eq!(phrases, 20, "8 defaults + 6 form phrases + 6 cues");

        let cues: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM alignment_phrases WHERE kind = 'cue'",
                [],
                |r| r.get(0),
            )
            .expect("count cues");
        assert_eq!(cues, 6);

        // ⌘9 copies 「停」, so the pointer and the flag must both name it.
        let default_id: Option<String> = conn
            .query_row(
                "SELECT default_alignment_phrase_id FROM phases WHERE id = 'phase-live'",
                [],
                |r| r.get(0),
            )
            .expect("read pointer");
        assert_eq!(default_id.as_deref(), Some("ap-live-stop"));
        let (name, is_default, cue_axis): (String, i64, Option<String>) = conn
            .query_row(
                "SELECT name, is_default, cue_axis FROM alignment_phrases WHERE id = 'ap-live-stop'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .expect("read 停");
        assert_eq!(name, "停");
        assert_eq!(is_default, 1);
        // The one deliberate blank in the ledger: 「停」 is a halt, not a drift,
        // so it records `live_cue` but belongs to no axis (ADR-029 子决策 4).
        assert_eq!(cue_axis, None);

        // The form phrases land in existing phases, uncoordinated and
        // non-default, so the eight seeded defaults keep their slots.
        let form_defaults: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM alignment_phrases
                 WHERE id LIKE 'ap-form-%' AND (is_default = 1 OR layer_id IS NOT NULL
                       OR domain_id IS NOT NULL OR mode_id IS NOT NULL)",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(form_defaults, 0);
        let critique_phase: String = conn
            .query_row(
                "SELECT phase_id FROM alignment_phrases WHERE id = 'ap-form-critique'",
                [],
                |r| r.get(0),
            )
            .expect("read 挑错");
        // The acknowledged compromise: 挑错 has no seat among the 8 phases and
        // is filed under 收敛 (ADR-029 子决策 1).
        assert_eq!(critique_phase, "phase-converge");
    }

    /// The 9th phase must not break the one-default-per-phase index that 0013
    /// rebuilt, and the seeded 「停」 must occupy 中途's single default slot.
    #[test]
    fn migration_0014_keeps_the_one_default_per_phase_index_intact_for_the_ninth_phase() {
        let conn = db_at_version_13();
        apply_0014(&conn);

        conn.execute(
            "INSERT INTO alignment_phrases
                (id, phase_id, name, content, is_default, usage_count, created_at,
                 deprecated, order_index, kind)
             VALUES ('ap-live-second', 'phase-live', '再来一条', 'body', 1, 0,
                     '2026-09-05T00:00:00Z', 0, 6, 'cue')",
            [],
        )
        .expect_err("a second LIVE default in 中途 must be rejected");

        // Trashing the current default frees the slot, exactly as for the other
        // eight phases.
        conn.execute(
            "UPDATE alignment_phrases SET deleted_at = '2026-09-05T00:00:00+00:00'
             WHERE id = 'ap-live-stop'",
            [],
        )
        .expect("trash 停");
        conn.execute(
            "UPDATE alignment_phrases SET is_default = 1 WHERE id = 'ap-live-converge'",
            [],
        )
        .expect("a trashed default must not hold 中途's slot forever");
    }

    /// The real upgrade path, end to end: an on-disk v13 database with rows in
    /// it, opened by this build. Distinct from the batch-applied tests above
    /// because the runner wraps each migration in ONE transaction with foreign
    /// keys enforced — and 0014 drops and renames a table inside it, which is
    /// the operation most likely to behave differently under those conditions.
    #[test]
    fn migration_0014_upgrades_a_populated_on_disk_database_through_the_runner() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        {
            let conn = Connection::open(&path).expect("create");
            configure(&conn).expect("configure");
            for m in MIGRATIONS.iter().filter(|m| m.target_version <= 13) {
                conn.execute_batch(m.sql).expect("apply through 13");
            }
            conn.pragma_update(None, "user_version", 13u32)
                .expect("pin v13");
            conn.execute(
                "INSERT INTO usage_records
                    (id, timestamp, target_type, target_id, source, phase_id)
                 VALUES ('u-old', '2026-08-01T00:00:00Z', 'alignment',
                         'ap-diverge-default', 'phase_bar', 'phase-diverge')",
                [],
            )
            .expect("a row worth not losing");
        }

        let conn = open_and_migrate(&path).expect("upgrade an existing user's file");
        let v: u32 = conn
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .expect("read user_version");
        assert_eq!(v, latest_version());
        let kept: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM usage_records WHERE id = 'u-old'",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(kept, 1, "the rebuild must carry the user's history across");
        let values: i64 = conn
            .query_row("SELECT COUNT(*) FROM alignment_axis_values", [], |r| {
                r.get(0)
            })
            .expect("count");
        assert_eq!(values, 16);
        // The pre-migrate snapshot is the only way back from the rebuild, so it
        // must actually be on disk (db.rs takes it before the first migration).
        assert_eq!(backup_db_count(&path), 1);
    }

    /// Adding a `REFERENCES` column with `ALTER TABLE ADD COLUMN` is only legal
    /// while foreign keys are enforced if the column defaults to NULL — which is
    /// why all three coordinates are nullable, not merely convenient. Pin the
    /// constraint itself: a coordinate pointing at nothing must be refused, and
    /// deleting an axis value must blank the phrases instead of orphaning them.
    #[test]
    fn migration_0014_wires_the_coordinate_foreign_keys_with_set_null() {
        let conn = db_at_version_13();
        apply_0014(&conn);

        conn.execute(
            "UPDATE alignment_phrases SET layer_id = 'axv-nope' WHERE id = 'ap-form-explore'",
            [],
        )
        .expect_err("a coordinate must reference a real axis value");

        conn.execute(
            "UPDATE alignment_phrases SET layer_id = 'axv-layer-path' WHERE id = 'ap-form-explore'",
            [],
        )
        .expect("a real layer id is accepted");
        conn.execute(
            "DELETE FROM alignment_axis_values WHERE id = 'axv-layer-path'",
            [],
        )
        .expect("hard delete");
        let layer: Option<String> = conn
            .query_row(
                "SELECT layer_id FROM alignment_phrases WHERE id = 'ap-form-explore'",
                [],
                |r| r.get(0),
            )
            .expect("read back");
        assert_eq!(
            layer, None,
            "ON DELETE SET NULL must return the phrase to unconstrained, not delete it"
        );
    }
}
