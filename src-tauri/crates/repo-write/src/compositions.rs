use chrono::Utc;
use rusqlite::{params, Connection};
use uuid::Uuid;

use repo_core::error::{RepoError, RepoResult};
use repo_core::models::Composition;

// Direct omar-driven editing of composition assets (plan asset-editing-and-adaptive-layout
// §0 Q2/Q6, decision A + per-phase). Distinct from the draft-promote path in
// `promote.rs`: these mutate the real `compositions` table in response to a user
// action in the Composition workbench, not a Claude-proposed draft. Lives in
// `repo-write` so the MCP binary (repo-core only) can't reach them.
//
// A composition's "content" is a `modifier_ids` array (not free text), stored as a
// JSON column (decision D-b). Ordering is PER phase: order_index restarts at 0
// inside each phase, so create appends at the end of its own phase and reorder
// rewrites positions within a single phase.

/// Insert a user-authored composition at the end of its phase. The phases FK
/// rejects an unknown phase_id; scene_id is optional (NULL = phase-archived only).
pub fn create_composition(
    conn: &Connection,
    phase_id: &str,
    name: &str,
    modifier_ids: &[String],
    scene_id: Option<&str>,
) -> RepoResult<Composition> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now();
    let now = created_at.to_rfc3339();
    let modifier_ids_json = serde_json::to_string(modifier_ids)?;
    conn.execute(
        "INSERT INTO compositions
            (id, name, modifier_ids, phase_id, scene_id, usage_count,
             last_used_at, created_at, notes, deprecated, order_index)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, NULL, ?6, NULL, 0,
             (SELECT COALESCE(MAX(order_index) + 1, 0) FROM compositions WHERE phase_id = ?4))",
        params![id, name, modifier_ids_json, phase_id, scene_id, now],
    )?;
    let order_index: i64 = conn.query_row(
        "SELECT order_index FROM compositions WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(Composition {
        id,
        name: name.to_string(),
        modifier_ids: modifier_ids.to_vec(),
        phase_id: phase_id.to_string(),
        scene_id: scene_id.map(str::to_string),
        usage_count: 0,
        last_used_at: None,
        created_at,
        notes: None,
        deprecated: false,
        order_index,
    })
}

/// Rename / re-pick the modifier set of an existing composition. phase_id,
/// scene_id, order_index and usage stats are left untouched (parity with the
/// macro/alignment edit path, which only mutates name + body).
pub fn update_composition(
    conn: &Connection,
    id: &str,
    name: &str,
    modifier_ids: &[String],
) -> RepoResult<()> {
    let modifier_ids_json = serde_json::to_string(modifier_ids)?;
    let changed = conn.execute(
        "UPDATE compositions SET name = ?2, modifier_ids = ?3 WHERE id = ?1",
        params![id, name, modifier_ids_json],
    )?;
    if changed == 0 {
        return Err(missing_composition(id));
    }
    Ok(())
}

/// Permanently remove a composition. This is an irreversible hard delete (plan
/// §1.3 delete grading); the UI guards it behind a confirm dialog.
pub fn delete_composition(conn: &Connection, id: &str) -> RepoResult<()> {
    let changed = conn.execute("DELETE FROM compositions WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(missing_composition(id));
    }
    Ok(())
}

/// Persist a new sort order WITHIN a single phase by rewriting order_index for
/// the given ids in one transaction. `ordered_ids` is the full visible order of
/// that phase; each id's order_index becomes its position in the slice. An id
/// that is unknown OR belongs to a different phase is rejected, so a stale
/// renderer list can't silently no-op or cross phases.
pub fn reorder_compositions(
    conn: &Connection,
    phase_id: &str,
    ordered_ids: &[String],
) -> RepoResult<()> {
    // unchecked_transaction takes &Connection (not &mut), so it composes with the
    // shared-borrow `guard_schema_then` write path that holds the AppState mutex.
    let tx = conn.unchecked_transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        let changed = tx.execute(
            "UPDATE compositions SET order_index = ?2 WHERE id = ?1 AND phase_id = ?3",
            params![id, idx as i64, phase_id],
        )?;
        if changed == 0 {
            return Err(missing_composition(id));
        }
    }
    tx.commit()?;
    Ok(())
}

fn missing_composition(id: &str) -> RepoError {
    RepoError::TargetNotFound {
        table: "compositions".to_string(),
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

    fn phase(conn: &Connection, phase_id: &str) -> Vec<Composition> {
        repo::list_compositions(conn)
            .expect("list")
            .into_iter()
            .filter(|c| c.phase_id == phase_id)
            .collect()
    }

    #[test]
    fn create_appends_at_end_of_its_phase() {
        let (_dir, conn) = migrated_conn();
        let before_max = phase(&conn, "phase-diverge")
            .iter()
            .map(|c| c.order_index)
            .max()
            .unwrap_or(-1);

        let a = create_composition(&conn, "phase-diverge", "A", &["m1".to_string()], None)
            .expect("create a");
        assert_eq!(a.phase_id, "phase-diverge");
        assert_eq!(a.modifier_ids, vec!["m1".to_string()]);
        assert_eq!(a.order_index, before_max + 1);

        let b =
            create_composition(&conn, "phase-diverge", "B", &[], None).expect("create b");
        assert_eq!(b.order_index, a.order_index + 1);
    }

    #[test]
    fn create_orders_independently_per_phase() {
        let (_dir, conn) = migrated_conn();
        let div_max = phase(&conn, "phase-diverge")
            .iter()
            .map(|c| c.order_index)
            .max()
            .unwrap_or(-1);
        let und_max = phase(&conn, "phase-understand")
            .iter()
            .map(|c| c.order_index)
            .max()
            .unwrap_or(-1);

        let div = create_composition(&conn, "phase-diverge", "D", &[], None).expect("div");
        let und = create_composition(&conn, "phase-understand", "U", &[], None).expect("und");
        assert_eq!(div.order_index, div_max + 1);
        assert_eq!(und.order_index, und_max + 1);
    }

    #[test]
    fn create_rejects_unknown_phase() {
        let (_dir, conn) = migrated_conn();
        let err = create_composition(&conn, "phase-bogus", "X", &[], None)
            .expect_err("unknown phase");
        // Surfaced as a rusqlite FK violation wrapped in RepoError.
        assert!(matches!(err, RepoError::Sqlite(_)), "got {err:?}");
    }

    #[test]
    fn update_edits_name_and_modifier_ids() {
        let (_dir, conn) = migrated_conn();
        let created = create_composition(&conn, "phase-diverge", "Old", &["m1".to_string()], None)
            .expect("create");
        update_composition(&conn, &created.id, "Renamed", &["m2".to_string(), "m3".to_string()])
            .expect("update");

        let found = repo::list_compositions(&conn)
            .expect("list")
            .into_iter()
            .find(|c| c.id == created.id)
            .expect("present");
        assert_eq!(found.name, "Renamed");
        assert_eq!(found.modifier_ids, vec!["m2".to_string(), "m3".to_string()]);
        assert_eq!(found.phase_id, "phase-diverge");
        assert_eq!(found.order_index, created.order_index);
    }

    #[test]
    fn update_missing_errors() {
        let (_dir, conn) = migrated_conn();
        let err = update_composition(&conn, "nope", "x", &[]).expect_err("missing");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }

    #[test]
    fn delete_removes_row() {
        let (_dir, conn) = migrated_conn();
        let created =
            create_composition(&conn, "phase-diverge", "Doomed", &[], None).expect("create");
        delete_composition(&conn, &created.id).expect("delete");
        assert!(
            repo::list_compositions(&conn)
                .expect("list")
                .iter()
                .all(|c| c.id != created.id),
            "deleted composition must not be listed"
        );
        let err = delete_composition(&conn, &created.id).expect_err("second delete");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }

    #[test]
    fn reorder_rewrites_order_index_within_phase() {
        let (_dir, conn) = migrated_conn();
        let a = create_composition(&conn, "phase-diverge", "a", &[], None).expect("a");
        let b = create_composition(&conn, "phase-diverge", "b", &[], None).expect("b");
        let c = create_composition(&conn, "phase-diverge", "c", &[], None).expect("c");
        let new_order = vec![c.id.clone(), a.id.clone(), b.id.clone()];
        reorder_compositions(&conn, "phase-diverge", &new_order).expect("reorder");

        let after: Vec<String> = phase(&conn, "phase-diverge")
            .into_iter()
            .filter(|c| new_order.contains(&c.id))
            .map(|c| c.id)
            .collect();
        assert_eq!(after, new_order, "diverge phase order must match reorder");
    }

    #[test]
    fn reorder_rejects_unknown_id() {
        let (_dir, conn) = migrated_conn();
        let err = reorder_compositions(&conn, "phase-diverge", &["ghost".to_string()])
            .expect_err("unknown id");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }

    #[test]
    fn reorder_rejects_id_from_other_phase() {
        let (_dir, conn) = migrated_conn();
        let div = create_composition(&conn, "phase-diverge", "div", &[], None).expect("div");
        let err =
            reorder_compositions(&conn, "phase-understand", std::slice::from_ref(&div.id))
                .expect_err("cross-phase id");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }
}
