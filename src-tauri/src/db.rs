use std::path::Path;

use rusqlite::Connection;

use crate::error::{AppError, AppResult};

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
];

struct Migration {
    target_version: u32,
    name: &'static str,
    sql: &'static str,
}

pub fn open_at(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(path)?;
    configure(&conn)?;
    run_migrations(&conn)?;
    Ok(conn)
}

#[cfg(test)]
pub fn open_in_memory() -> AppResult<Connection> {
    let conn = Connection::open_in_memory()?;
    configure(&conn)?;
    run_migrations(&conn)?;
    Ok(conn)
}

fn configure(conn: &Connection) -> AppResult<()> {
    // Apply pragmas every time we open a connection — they are per-connection.
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    Ok(())
}

fn run_migrations(conn: &Connection) -> AppResult<()> {
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
            AppError::Other(format!(
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
            let _ = open_at(&path).expect("first open runs migrations");
        }
        // Second open with the same path must not re-run migrations.
        let conn = open_at(&path).expect("second open");
        let phase_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM phases", [], |row| row.get(0))
            .expect("count phases");
        assert_eq!(phase_count, 8, "seed should land exactly once");
    }
}
