//! Machine-local key/value settings (ADR-027).
//!
//! Scope discipline: this table exists for exactly one reason — Rust needs a
//! value BEFORE the webview mounts, so localStorage (where every other
//! preference lives) cannot supply it. `global_hotkey` is the only such key
//! today. Adding a key here that the frontend could have owned splits the
//! settings story for no gain; see the membership rule in migration
//! `0012_settings.sql` and the table in `src/stores/settingsStore.ts`.
//!
//! Not exported: these values are machine-local configuration, not portable
//! assets (`export.rs` deliberately omits the table).

use rusqlite::{params, Connection, OptionalExtension};

use crate::error::RepoResult;

/// Storage key for the global wake chord.
pub const GLOBAL_HOTKEY_KEY: &str = "global_hotkey";

/// Shipped default wake chord, in `tauri-plugin-global-shortcut` accelerator
/// syntax. Seeded by migration 0012 and used as the in-code fallback, so the
/// two can never disagree.
pub const DEFAULT_GLOBAL_HOTKEY: &str = "Alt+Space";

/// Read a raw setting. `None` means "no row", which callers translate into
/// their own default rather than an error.
pub fn get(conn: &Connection, key: &str) -> RepoResult<Option<String>> {
    Ok(conn
        .query_row("SELECT value FROM settings WHERE key = ?1", params![key], |row| row.get(0))
        .optional()?)
}

/// Upsert a raw setting.
pub fn set(conn: &Connection, key: &str, value: &str) -> RepoResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

/// The configured wake chord, falling back to [`DEFAULT_GLOBAL_HOTKEY`] when
/// the row is absent.
///
/// The fallback is deliberate rather than defensive boilerplate: hand-editing
/// this table with `sqlite3` is the documented last-resort escape hatch when a
/// binding locks the user out of the window (ADR-027 sub-decision 3), and a
/// `DELETE` typed instead of an `UPDATE` must not turn the app into a brick.
/// A missing row is a recoverable state, not a corrupt database.
pub fn global_hotkey(conn: &Connection) -> RepoResult<String> {
    Ok(get(conn, GLOBAL_HOTKEY_KEY)?.unwrap_or_else(|| DEFAULT_GLOBAL_HOTKEY.to_string()))
}

/// Persist the wake chord. Callers must have already registered it with the OS
/// — the stored value is meant to describe what is actually live, so writing it
/// before a successful `register()` would leave the settings UI advertising a
/// chord that does nothing (ADR-027 sub-decision 2).
pub fn set_global_hotkey(conn: &Connection, accelerator: &str) -> RepoResult<()> {
    set(conn, GLOBAL_HOTKEY_KEY, accelerator)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn migration_seeds_the_shipped_default() {
        let conn = open_in_memory().expect("open in-memory db");
        assert_eq!(
            global_hotkey(&conn).expect("read hotkey"),
            DEFAULT_GLOBAL_HOTKEY
        );
    }

    #[test]
    fn set_then_get_round_trips() {
        let conn = open_in_memory().expect("open in-memory db");
        set_global_hotkey(&conn, "Ctrl+Shift+P").expect("write hotkey");
        assert_eq!(global_hotkey(&conn).expect("read hotkey"), "Ctrl+Shift+P");
    }

    #[test]
    fn set_is_an_upsert_not_a_duplicate_insert() {
        let conn = open_in_memory().expect("open in-memory db");
        set_global_hotkey(&conn, "Ctrl+Shift+P").expect("first write");
        set_global_hotkey(&conn, "Alt+Backquote").expect("second write");

        let rows: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM settings WHERE key = ?1",
                params![GLOBAL_HOTKEY_KEY],
                |row| row.get(0),
            )
            .expect("count rows");
        assert_eq!(rows, 1, "repeated writes must update the single row");
        assert_eq!(global_hotkey(&conn).expect("read hotkey"), "Alt+Backquote");
    }

    #[test]
    fn a_deleted_row_falls_back_to_the_default_instead_of_erroring() {
        // The sqlite3 escape hatch (ADR-027 sub-decision 3) is only safe if a
        // mistyped DELETE leaves the app bootable.
        let conn = open_in_memory().expect("open in-memory db");
        conn.execute("DELETE FROM settings", [])
            .expect("clear settings");
        assert_eq!(
            global_hotkey(&conn).expect("read hotkey"),
            DEFAULT_GLOBAL_HOTKEY
        );
    }
}
