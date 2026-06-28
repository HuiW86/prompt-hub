use chrono::Utc;
use rusqlite::{params, Connection};
use uuid::Uuid;

use repo_core::error::{RepoError, RepoResult};
use repo_core::models::Macro;

// Direct omar-driven editing of macro assets (plan asset-editing-and-adaptive-layout
// §0 Q2/Q6). Distinct from the draft-promote path in `promote.rs`: these mutate the
// real `macros` table in response to a user action in MacroGrid, not a Claude-proposed
// draft. Lives in `repo-write` so the MCP binary (repo-core only) can't reach them.

/// Insert a user-authored macro at the end of the current order. A directly
/// created macro is always non-native (native=0, expand_from/role/task NULL),
/// satisfying the table CHECK.
pub fn create_macro(
    conn: &Connection,
    name: &str,
    content: &str,
    scene_id: Option<&str>,
) -> RepoResult<Macro> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now();
    let now = created_at.to_rfc3339();
    conn.execute(
        "INSERT INTO macros
            (id, name, content, expand_from, native, role, task,
             usage_count, last_used_at, created_at, notes, scene_id, deprecated, order_index)
         VALUES (?1, ?2, ?3, NULL, 0, NULL, NULL, 0, NULL, ?4, NULL, ?5, 0,
             (SELECT COALESCE(MAX(order_index) + 1, 0) FROM macros))",
        params![id, name, content, now, scene_id],
    )?;
    let order_index: i64 = conn.query_row(
        "SELECT order_index FROM macros WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(Macro {
        id,
        name: name.to_string(),
        content: content.to_string(),
        expand_from: None,
        native: false,
        role: None,
        task: None,
        usage_count: 0,
        last_used_at: None,
        created_at,
        notes: None,
        scene_id: scene_id.map(str::to_string),
        deprecated: false,
        order_index,
    })
}

/// Rename / edit the body of an existing macro. Other columns (usage stats,
/// order_index, native flags) are left untouched.
pub fn update_macro(conn: &Connection, id: &str, name: &str, content: &str) -> RepoResult<()> {
    let changed = conn.execute(
        "UPDATE macros SET name = ?2, content = ?3 WHERE id = ?1",
        params![id, name, content],
    )?;
    if changed == 0 {
        return Err(missing_macro(id));
    }
    Ok(())
}

/// Permanently remove a macro. This is an irreversible hard delete (plan §1.3
/// delete grading); the UI guards it behind a confirm dialog.
pub fn delete_macro(conn: &Connection, id: &str) -> RepoResult<()> {
    let changed = conn.execute("DELETE FROM macros WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(missing_macro(id));
    }
    Ok(())
}

/// Persist a new sort order by rewriting order_index for the given ids in one
/// transaction. `ordered_ids` is the full visible order; each id's order_index
/// becomes its position in the slice. Unknown ids are rejected so a stale
/// renderer list can't silently no-op part of the reorder.
pub fn reorder_macros(conn: &Connection, ordered_ids: &[String]) -> RepoResult<()> {
    // unchecked_transaction takes &Connection (not &mut), so it composes with the
    // shared-borrow `guard_schema_then` write path that holds the AppState mutex.
    let tx = conn.unchecked_transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        let changed = tx.execute(
            "UPDATE macros SET order_index = ?2 WHERE id = ?1",
            params![id, idx as i64],
        )?;
        if changed == 0 {
            return Err(missing_macro(id));
        }
    }
    tx.commit()?;
    Ok(())
}

fn missing_macro(id: &str) -> RepoError {
    RepoError::TargetNotFound {
        table: "macros".to_string(),
        target_id: id.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use repo_core::{db, repo};

    fn migrated_conn() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        let conn = db::open_and_migrate(&path).expect("migrate");
        (dir, conn)
    }

    #[test]
    fn create_macro_appends_at_end() {
        let (_dir, conn) = migrated_conn();
        let before = repo::list_macros(&conn).expect("before");
        let max_before = before.iter().map(|m| m.order_index).max().unwrap_or(-1);

        let created = create_macro(&conn, "New", "body", None).expect("create");
        assert!(!created.native);
        assert_eq!(created.order_index, max_before + 1);

        let after = repo::list_macros(&conn).expect("after");
        assert_eq!(after.len(), before.len() + 1);
        // list_macros orders by order_index ASC, so the new one is last.
        assert_eq!(after.last().expect("last").id, created.id);
    }

    #[test]
    fn update_macro_edits_name_and_content() {
        let (_dir, conn) = migrated_conn();
        let created = create_macro(&conn, "Old", "old body", None).expect("create");
        update_macro(&conn, &created.id, "Renamed", "new body").expect("update");

        let found = repo::list_macros(&conn)
            .expect("list")
            .into_iter()
            .find(|m| m.id == created.id)
            .expect("present");
        assert_eq!(found.name, "Renamed");
        assert_eq!(found.content, "new body");
    }

    #[test]
    fn update_missing_macro_errors() {
        let (_dir, conn) = migrated_conn();
        let err = update_macro(&conn, "nope", "x", "y").expect_err("missing");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn delete_macro_removes_row() {
        let (_dir, conn) = migrated_conn();
        let created = create_macro(&conn, "Doomed", "body", None).expect("create");
        delete_macro(&conn, &created.id).expect("delete");
        assert!(
            repo::list_macros(&conn)
                .expect("list")
                .iter()
                .all(|m| m.id != created.id),
            "deleted macro must not be listed"
        );
        let err = delete_macro(&conn, &created.id).expect_err("second delete");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn reorder_macros_rewrites_order_index() {
        let (_dir, conn) = migrated_conn();
        let ids: Vec<String> = repo::list_macros(&conn)
            .expect("list")
            .into_iter()
            .map(|m| m.id)
            .collect();
        assert!(ids.len() >= 2, "seed should have multiple macros");

        let mut reversed = ids.clone();
        reversed.reverse();
        reorder_macros(&conn, &reversed).expect("reorder");

        let after: Vec<String> = repo::list_macros(&conn)
            .expect("list")
            .into_iter()
            .map(|m| m.id)
            .collect();
        assert_eq!(after, reversed, "list order must match the reorder");
    }

    #[test]
    fn reorder_rejects_unknown_id() {
        let (_dir, conn) = migrated_conn();
        let err = reorder_macros(&conn, &["ghost".to_string()]).expect_err("unknown id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }
}
