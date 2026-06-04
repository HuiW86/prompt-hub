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
    configure(&conn)?;
    run_migrations(&conn)?;
    Ok(conn)
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
    run_migrations(&conn)?;
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

fn run_migrations(conn: &Connection) -> RepoResult<()> {
    let current: u32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
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
        assert_eq!(phase_count, 8, "seed should land exactly once");
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
        assert_eq!(phase_count, 8);

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
}
