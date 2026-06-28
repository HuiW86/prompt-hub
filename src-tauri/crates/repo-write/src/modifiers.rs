use chrono::Utc;
use rusqlite::{params, Connection};
use uuid::Uuid;

use repo_core::error::{RepoError, RepoResult};
use repo_core::models::Modifier;

// Direct omar-driven editing of modifier assets (plan asset-editing-and-adaptive-layout
// §0 Q2/Q6, decision D-a). Distinct from the draft-promote path in `promote.rs`:
// these mutate the real `modifiers` table in response to a user action in the
// ModifierGrid, not a Claude-proposed draft. Lives in `repo-write` so the MCP
// binary (repo-core only) can't reach them.
//
// Ordering is PER group_kind quadrant (cognition/action/delivery/constraint):
// order_index restarts at 0 inside each group, so create appends at the end of its
// own quadrant and reorder rewrites positions within a single quadrant.

/// Insert a user-authored modifier at the end of its group_kind quadrant. The
/// schema CHECK rejects a group_kind outside the four allowed values.
pub fn create_modifier(
    conn: &Connection,
    name: &str,
    content: &str,
    group_kind: &str,
) -> RepoResult<Modifier> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now();
    let now = created_at.to_rfc3339();
    conn.execute(
        "INSERT INTO modifiers
            (id, name, content, group_kind, usage_count, last_used_at,
             created_at, notes, deprecated, order_index)
         VALUES (?1, ?2, ?3, ?4, 0, NULL, ?5, NULL, 0,
             (SELECT COALESCE(MAX(order_index) + 1, 0) FROM modifiers WHERE group_kind = ?4))",
        params![id, name, content, group_kind, now],
    )?;
    let order_index: i64 = conn.query_row(
        "SELECT order_index FROM modifiers WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(Modifier {
        id,
        name: name.to_string(),
        content: content.to_string(),
        group_kind: group_kind.to_string(),
        usage_count: 0,
        last_used_at: None,
        created_at,
        notes: None,
        deprecated: false,
        order_index,
    })
}

/// Rename / edit the body of an existing modifier. group_kind, order_index and
/// usage stats are left untouched: moving a modifier between quadrants would
/// require an order_index recompute and is deferred (P2a.1 keeps parity with the
/// macro edit path, which only mutates name/content).
pub fn update_modifier(conn: &Connection, id: &str, name: &str, content: &str) -> RepoResult<()> {
    let changed = conn.execute(
        "UPDATE modifiers SET name = ?2, content = ?3 WHERE id = ?1",
        params![id, name, content],
    )?;
    if changed == 0 {
        return Err(missing_modifier(id));
    }
    Ok(())
}

/// Permanently remove a modifier. This is an irreversible hard delete (plan §1.3
/// delete grading); the UI guards it behind a confirm dialog.
pub fn delete_modifier(conn: &Connection, id: &str) -> RepoResult<()> {
    let changed = conn.execute("DELETE FROM modifiers WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(missing_modifier(id));
    }
    Ok(())
}

/// Persist a new sort order WITHIN a single group_kind quadrant by rewriting
/// order_index for the given ids in one transaction. `ordered_ids` is the full
/// visible order of that quadrant; each id's order_index becomes its position in
/// the slice. An id that is unknown OR belongs to a different group_kind is
/// rejected, so a stale renderer list can't silently no-op or cross quadrants.
pub fn reorder_modifiers(
    conn: &Connection,
    group_kind: &str,
    ordered_ids: &[String],
) -> RepoResult<()> {
    // unchecked_transaction takes &Connection (not &mut), so it composes with the
    // shared-borrow `guard_schema_then` write path that holds the AppState mutex.
    let tx = conn.unchecked_transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        let changed = tx.execute(
            "UPDATE modifiers SET order_index = ?2 WHERE id = ?1 AND group_kind = ?3",
            params![id, idx as i64, group_kind],
        )?;
        if changed == 0 {
            return Err(missing_modifier(id));
        }
    }
    tx.commit()?;
    Ok(())
}

fn missing_modifier(id: &str) -> RepoError {
    RepoError::TargetNotFound {
        table: "modifiers".to_string(),
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

    fn group(conn: &Connection, group_kind: &str) -> Vec<Modifier> {
        repo::list_modifiers(conn)
            .expect("list")
            .into_iter()
            .filter(|m| m.group_kind == group_kind)
            .collect()
    }

    #[test]
    fn create_modifier_appends_at_end_of_its_quadrant() {
        let (_dir, conn) = migrated_conn();
        let before_max = group(&conn, "cognition")
            .iter()
            .map(|m| m.order_index)
            .max()
            .unwrap_or(-1);

        let a = create_modifier(&conn, "A", "body", "cognition").expect("create a");
        assert_eq!(a.group_kind, "cognition");
        assert_eq!(a.order_index, before_max + 1);

        let b = create_modifier(&conn, "B", "body", "cognition").expect("create b");
        assert_eq!(b.order_index, a.order_index + 1);
    }

    #[test]
    fn create_modifier_orders_independently_per_group_kind() {
        let (_dir, conn) = migrated_conn();
        let cog_max = group(&conn, "cognition")
            .iter()
            .map(|m| m.order_index)
            .max()
            .unwrap_or(-1);
        let act_max = group(&conn, "action")
            .iter()
            .map(|m| m.order_index)
            .max()
            .unwrap_or(-1);

        let cog = create_modifier(&conn, "C", "body", "cognition").expect("create cog");
        let act = create_modifier(&conn, "Ac", "body", "action").expect("create act");
        assert_eq!(cog.order_index, cog_max + 1);
        assert_eq!(act.order_index, act_max + 1);
    }

    #[test]
    fn create_modifier_rejects_invalid_group_kind() {
        let (_dir, conn) = migrated_conn();
        let err = create_modifier(&conn, "X", "body", "bogus").expect_err("invalid group");
        // Surfaced as a rusqlite CHECK violation wrapped in RepoError.
        assert!(matches!(err, RepoError::Sqlite(_)), "got {err:?}");
    }

    #[test]
    fn update_modifier_edits_name_and_content() {
        let (_dir, conn) = migrated_conn();
        let created = create_modifier(&conn, "Old", "old body", "delivery").expect("create");
        update_modifier(&conn, &created.id, "Renamed", "new body").expect("update");

        let found = repo::list_modifiers(&conn)
            .expect("list")
            .into_iter()
            .find(|m| m.id == created.id)
            .expect("present");
        assert_eq!(found.name, "Renamed");
        assert_eq!(found.content, "new body");
        assert_eq!(found.group_kind, "delivery");
        assert_eq!(found.order_index, created.order_index);
    }

    #[test]
    fn update_missing_modifier_errors() {
        let (_dir, conn) = migrated_conn();
        let err = update_modifier(&conn, "nope", "x", "y").expect_err("missing");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn delete_modifier_removes_row() {
        let (_dir, conn) = migrated_conn();
        let created = create_modifier(&conn, "Doomed", "body", "constraint").expect("create");
        delete_modifier(&conn, &created.id).expect("delete");
        assert!(
            repo::list_modifiers(&conn)
                .expect("list")
                .iter()
                .all(|m| m.id != created.id),
            "deleted modifier must not be listed"
        );
        let err = delete_modifier(&conn, &created.id).expect_err("second delete");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn reorder_modifiers_rewrites_order_index_within_quadrant() {
        let (_dir, conn) = migrated_conn();
        // Build a known quadrant from scratch so the assertion is deterministic
        // regardless of seed contents.
        let a = create_modifier(&conn, "a", "b", "action").expect("a");
        let b = create_modifier(&conn, "b", "b", "action").expect("b");
        let c = create_modifier(&conn, "c", "b", "action").expect("c");
        let new_order = vec![c.id.clone(), a.id.clone(), b.id.clone()];
        reorder_modifiers(&conn, "action", &new_order).expect("reorder");

        let after: Vec<String> = group(&conn, "action")
            .into_iter()
            .filter(|m| new_order.contains(&m.id))
            .map(|m| m.id)
            .collect();
        assert_eq!(after, new_order, "action quadrant order must match reorder");
    }

    #[test]
    fn reorder_rejects_unknown_id() {
        let (_dir, conn) = migrated_conn();
        let err =
            reorder_modifiers(&conn, "cognition", &["ghost".to_string()]).expect_err("unknown id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn reorder_rejects_id_from_other_quadrant() {
        let (_dir, conn) = migrated_conn();
        let cog = create_modifier(&conn, "cog", "b", "cognition").expect("cog");
        // Reordering the action quadrant must not accept a cognition id.
        let err = reorder_modifiers(&conn, "action", std::slice::from_ref(&cog.id))
            .expect_err("cross-quadrant id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }
}
