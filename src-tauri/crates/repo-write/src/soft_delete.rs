use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};

use repo_core::error::RepoResult;

// ADR-028: the shared in-place delete. Every `delete_*` in this crate stopped
// being a `DELETE FROM` and became this single UPDATE, so the row keeps its id,
// created_at, order_index and every usage_records row that points at it — the
// four things ADR-022 and ADR-025 each named when they rejected a "move the row
// to a trash table" design. Restore is the reverse UPDATE (`trash::restore_asset`).
//
// The table name is interpolated, never bound: SQLite cannot parameterize an
// identifier. Every call site passes a `&'static str` literal naming one of the
// seven asset tables, so no user input reaches the statement text.

/// What an in-place delete actually did. Callers map `Missing` onto their own
/// module's not-found error; `AlreadyDeleted` is a success (deleting a row that
/// is already in the trash is a no-op, not an error — an undo/redo race or a
/// double-click must not surface a failure).
pub(crate) enum SoftDeleteOutcome {
    Deleted,
    AlreadyDeleted,
    Missing,
}

/// Stamp `deleted_at` on a live row. Timestamp format is RFC 3339 in UTC, the
/// same format `created_at` / `last_used_at` use everywhere in this workspace.
pub(crate) fn soft_delete_row(
    conn: &Connection,
    table: &'static str,
    id: &str,
) -> RepoResult<SoftDeleteOutcome> {
    let now = Utc::now().to_rfc3339();
    let changed = conn.execute(
        &format!("UPDATE {table} SET deleted_at = ?2 WHERE id = ?1 AND deleted_at IS NULL"),
        params![id, now],
    )?;
    if changed > 0 {
        return Ok(SoftDeleteOutcome::Deleted);
    }
    // Zero rows means either "no such id" or "already in the trash", and the two
    // must not collapse into one answer.
    // soft-delete-gate: exempt — an existence probe run precisely to tell a
    // missing row apart from an already-trashed one; filtering would erase the
    // distinction it exists to make.
    let exists: Option<i64> = conn
        .query_row(
            &format!("SELECT 1 FROM {table} WHERE id = ?1"),
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    Ok(match exists {
        Some(_) => SoftDeleteOutcome::AlreadyDeleted,
        None => SoftDeleteOutcome::Missing,
    })
}
