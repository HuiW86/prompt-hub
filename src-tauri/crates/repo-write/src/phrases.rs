use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use repo_core::error::{RepoError, RepoResult};
use repo_core::models::Phrase;

// Direct omar-driven editing of scene-phrase assets (plan scene-phrase-editing).
// Distinct from `alignment_phrases.rs`: a `Phrase` is bound to a SCENE (and an
// OPTIONAL sub-stage), not a phase. Lives in `repo-write` so the MCP binary
// (repo-core only) can't reach them.
//
// Ordering is PER (scene_id, sub_stage_id) partition: order_index restarts at 0
// inside each group, so create appends at the end of its own group and reorder
// rewrites positions within a single group. Unlike alignment phrases, sub_stage_id
// is NULLABLE — the "ungrouped" phrases (sub_stage_id IS NULL) form their own
// partition, handled explicitly in every partition predicate below.

/// Insert a user-authored phrase at the end of its (scene_id, sub_stage_id)
/// partition. The scenes FK rejects an unknown scene_id and the sub_stages FK
/// rejects an unknown sub_stage_id.
pub fn create_phrase(
    conn: &Connection,
    scene_id: &str,
    name: &str,
    content: &str,
    sub_stage_id: Option<&str>,
) -> RepoResult<Phrase> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now();
    let now = created_at.to_rfc3339();
    // Single-statement append: the MAX subquery resolves the next slot inside the
    // target partition atomically, so concurrent creates can't collide on MAX+1.
    conn.execute(
        "INSERT INTO phrases
            (id, scene_id, name, content, usage_count, last_used_at, created_at,
             notes, deprecated, sub_stage_id, order_index)
         VALUES (?1, ?2, ?3, ?4, 0, NULL, ?5, NULL, 0, ?6,
             (SELECT COALESCE(MAX(order_index) + 1, 0) FROM phrases
              WHERE scene_id = ?2 AND (sub_stage_id = ?6 OR (?6 IS NULL AND sub_stage_id IS NULL))))",
        params![id, scene_id, name, content, now, sub_stage_id],
    )?;
    let order_index: i64 = conn.query_row(
        "SELECT order_index FROM phrases WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(Phrase {
        id,
        scene_id: scene_id.to_string(),
        name: name.to_string(),
        content: content.to_string(),
        usage_count: 0,
        last_used_at: None,
        created_at,
        notes: None,
        deprecated: false,
        sub_stage_id: sub_stage_id.map(str::to_string),
        order_index,
    })
}

/// Rename / edit a phrase and optionally move it to a different sub-stage.
/// - sub_stage_id unchanged: only name/content are written; order_index stays put
///   (parity with the alignment-phrase / macro / modifier edit path).
/// - sub_stage_id changed: the row moves to the END of the target partition via a
///   single UPDATE whose subquery resolves MAX(order_index)+1 of the destination.
///   Because the row still carries its OLD sub_stage_id at evaluation time, it is
///   not counted in its own destination MAX — no off-by-one, and atomic against
///   concurrent writers (decision ②). The vacated slot in the source partition is
///   left as a gap; the read path only ORDER BYs, so gaps are harmless.
pub fn update_phrase(
    conn: &Connection,
    id: &str,
    name: &str,
    content: &str,
    sub_stage_id: Option<&str>,
) -> RepoResult<()> {
    let current: Option<Option<String>> = conn
        .query_row(
            "SELECT sub_stage_id FROM phrases WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    let current = match current {
        None => return Err(missing_phrase(id)),
        Some(v) => v,
    };

    if current.as_deref() == sub_stage_id {
        conn.execute(
            "UPDATE phrases SET name = ?2, content = ?3 WHERE id = ?1",
            params![id, name, content],
        )?;
    } else {
        conn.execute(
            "UPDATE phrases SET name = ?2, content = ?3, sub_stage_id = ?4,
                order_index = (SELECT COALESCE(MAX(order_index) + 1, 0) FROM phrases
                    WHERE scene_id = (SELECT scene_id FROM phrases WHERE id = ?1)
                      AND (sub_stage_id = ?4 OR (?4 IS NULL AND sub_stage_id IS NULL)))
             WHERE id = ?1",
            params![id, name, content, sub_stage_id],
        )?;
    }
    Ok(())
}

/// Permanently remove a phrase (no is_default protection — phrases have none).
/// The source partition keeps its gap; the read path is gap-tolerant.
pub fn delete_phrase(conn: &Connection, id: &str) -> RepoResult<()> {
    let changed = conn.execute("DELETE FROM phrases WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(missing_phrase(id));
    }
    Ok(())
}

/// Persist a new sort order WITHIN a single (scene_id, sub_stage_id) partition by
/// rewriting order_index for the given ids in one transaction. `ordered_ids` is
/// the full visible order of that partition; each id's order_index becomes its
/// position in the slice. An id that is unknown OR belongs to a different scene /
/// sub-stage is rejected, so a stale renderer list can't silently no-op or cross
/// partitions. `sub_stage_id = None` targets the ungrouped partition.
pub fn reorder_phrases(
    conn: &Connection,
    scene_id: &str,
    sub_stage_id: Option<&str>,
    ordered_ids: &[String],
) -> RepoResult<()> {
    // unchecked_transaction takes &Connection (not &mut), so it composes with the
    // shared-borrow `guard_schema_then` write path that holds the AppState mutex.
    let tx = conn.unchecked_transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        let changed = tx.execute(
            "UPDATE phrases SET order_index = ?2
             WHERE id = ?1 AND scene_id = ?3
               AND (sub_stage_id = ?4 OR (?4 IS NULL AND sub_stage_id IS NULL))",
            params![id, idx as i64, scene_id, sub_stage_id],
        )?;
        if changed == 0 {
            return Err(missing_phrase(id));
        }
    }
    tx.commit()?;
    Ok(())
}

fn missing_phrase(id: &str) -> RepoError {
    RepoError::TargetNotFound {
        table: "phrases".to_string(),
        target_id: id.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use repo_core::db;

    fn migrated_conn() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        let conn = db::open_and_migrate(&path).expect("migrate");
        (dir, conn)
    }

    fn add_sub_stage(conn: &Connection, id: &str, scene_id: &str) {
        conn.execute(
            "INSERT INTO sub_stages (id, scene_id, name, order_index) VALUES (?1, ?2, ?3, 0)",
            params![id, scene_id, id],
        )
        .expect("insert sub_stage");
    }

    // Phrases of a (scene, sub_stage) partition in stored sort order.
    fn partition(conn: &Connection, scene_id: &str, sub_stage_id: Option<&str>) -> Vec<Phrase> {
        let mut stmt = conn
            .prepare(
                "SELECT id, scene_id, name, content, usage_count, last_used_at, created_at,
                        notes, deprecated, sub_stage_id, order_index
                 FROM phrases
                 WHERE scene_id = ?1 AND (sub_stage_id = ?2 OR (?2 IS NULL AND sub_stage_id IS NULL))
                 ORDER BY order_index ASC, created_at ASC, rowid ASC",
            )
            .expect("prepare");
        let rows = stmt
            .query_map(params![scene_id, sub_stage_id], |row| {
                Ok(Phrase {
                    id: row.get("id")?,
                    scene_id: row.get("scene_id")?,
                    name: row.get("name")?,
                    content: row.get("content")?,
                    usage_count: row.get("usage_count")?,
                    last_used_at: None,
                    created_at: Utc::now(),
                    notes: row.get("notes")?,
                    deprecated: row.get::<_, i64>("deprecated")? != 0,
                    sub_stage_id: row.get("sub_stage_id")?,
                    order_index: row.get("order_index")?,
                })
            })
            .expect("query")
            .collect::<rusqlite::Result<Vec<_>>>()
            .expect("collect");
        rows
    }

    #[test]
    fn backfill_orders_ungrouped_partition_contiguously() {
        let (_dir, conn) = migrated_conn();
        // scene-plan's 2 seeded phrases were bound into ss-plan-generate by the
        // 0011 seed, so they form a contiguous partition there (and the ungrouped
        // partition is now empty).
        assert!(partition(&conn, "scene-plan", None).is_empty());
        let rows = partition(&conn, "scene-plan", Some("ss-plan-generate"));
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].order_index, 0);
        assert_eq!(rows[1].order_index, 1);
    }

    #[test]
    fn create_appends_at_end_of_ungrouped_partition() {
        let (_dir, conn) = migrated_conn();
        let before = partition(&conn, "scene-plan", None).len() as i64;
        let a = create_phrase(&conn, "scene-plan", "A", "body", None).expect("create a");
        assert_eq!(a.order_index, before);
        assert!(a.sub_stage_id.is_none());
        let b = create_phrase(&conn, "scene-plan", "B", "body", None).expect("create b");
        assert_eq!(b.order_index, a.order_index + 1);
    }

    #[test]
    fn create_orders_independently_per_sub_stage() {
        let (_dir, conn) = migrated_conn();
        add_sub_stage(&conn, "ss-1", "scene-plan");
        let g0 = create_phrase(&conn, "scene-plan", "G0", "body", Some("ss-1")).expect("g0");
        let g1 = create_phrase(&conn, "scene-plan", "G1", "body", Some("ss-1")).expect("g1");
        // First grouped phrase starts a fresh partition at 0, independent of the
        // 2 ungrouped seed phrases.
        assert_eq!(g0.order_index, 0);
        assert_eq!(g1.order_index, 1);
    }

    #[test]
    fn create_rejects_unknown_scene() {
        let (_dir, conn) = migrated_conn();
        let err =
            create_phrase(&conn, "scene-bogus", "X", "body", None).expect_err("unknown scene");
        assert!(matches!(err, RepoError::Sqlite(_)), "got {err:?}");
    }

    #[test]
    fn update_edits_name_keeps_order_index_when_group_unchanged() {
        let (_dir, conn) = migrated_conn();
        let created = create_phrase(&conn, "scene-plan", "Old", "old body", None).expect("create");
        update_phrase(&conn, &created.id, "Renamed", "new body", None).expect("update");
        let found = partition(&conn, "scene-plan", None)
            .into_iter()
            .find(|p| p.id == created.id)
            .expect("present");
        assert_eq!(found.name, "Renamed");
        assert_eq!(found.content, "new body");
        assert_eq!(found.order_index, created.order_index);
    }

    #[test]
    fn update_moves_to_target_partition_end() {
        let (_dir, conn) = migrated_conn();
        add_sub_stage(&conn, "ss-a", "scene-plan");
        add_sub_stage(&conn, "ss-b", "scene-plan");
        // Two phrases already in ss-b, so the next free slot there is 2.
        create_phrase(&conn, "scene-plan", "B0", "b", Some("ss-b")).expect("b0");
        create_phrase(&conn, "scene-plan", "B1", "b", Some("ss-b")).expect("b1");
        let moving = create_phrase(&conn, "scene-plan", "M", "m", Some("ss-a")).expect("m");

        update_phrase(&conn, &moving.id, "M", "m", Some("ss-b")).expect("move");

        let target = partition(&conn, "scene-plan", Some("ss-b"));
        let moved = target
            .iter()
            .find(|p| p.id == moving.id)
            .expect("moved row");
        assert_eq!(moved.order_index, 2, "appended at end of target partition");
        assert_eq!(moved.sub_stage_id.as_deref(), Some("ss-b"));
        // Source partition no longer contains it.
        assert!(partition(&conn, "scene-plan", Some("ss-a"))
            .iter()
            .all(|p| p.id != moving.id));
    }

    #[test]
    fn update_moves_into_ungrouped_partition() {
        let (_dir, conn) = migrated_conn();
        add_sub_stage(&conn, "ss-x", "scene-plan");
        let p = create_phrase(&conn, "scene-plan", "P", "p", Some("ss-x")).expect("p");
        let ungrouped_before = partition(&conn, "scene-plan", None).len() as i64;
        update_phrase(&conn, &p.id, "P", "p", None).expect("move to ungrouped");
        let moved = partition(&conn, "scene-plan", None)
            .into_iter()
            .find(|x| x.id == p.id)
            .expect("now ungrouped");
        assert!(moved.sub_stage_id.is_none());
        assert_eq!(moved.order_index, ungrouped_before);
    }

    #[test]
    fn update_missing_errors() {
        let (_dir, conn) = migrated_conn();
        let err = update_phrase(&conn, "nope", "x", "y", None).expect_err("missing");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn delete_removes_row() {
        let (_dir, conn) = migrated_conn();
        let created = create_phrase(&conn, "scene-plan", "Doomed", "body", None).expect("create");
        delete_phrase(&conn, &created.id).expect("delete");
        assert!(partition(&conn, "scene-plan", None)
            .iter()
            .all(|p| p.id != created.id));
        let err = delete_phrase(&conn, &created.id).expect_err("second delete");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn reorder_rewrites_order_index_within_ungrouped_partition() {
        let (_dir, conn) = migrated_conn();
        let a = create_phrase(&conn, "scene-research", "a", "b", None).expect("a");
        let b = create_phrase(&conn, "scene-research", "b", "b", None).expect("b");
        let c = create_phrase(&conn, "scene-research", "c", "b", None).expect("c");
        let new_order = vec![c.id.clone(), a.id.clone(), b.id.clone()];
        // Full ungrouped order of scene-research = 2 seed phrases then a,b,c.
        let full: Vec<String> = partition(&conn, "scene-research", None)
            .into_iter()
            .map(|p| p.id)
            .collect();
        let mut reordered: Vec<String> = full
            .iter()
            .filter(|id| !new_order.contains(id))
            .cloned()
            .collect();
        reordered.extend(new_order.clone());
        reorder_phrases(&conn, "scene-research", None, &reordered).expect("reorder");

        let after: Vec<String> = partition(&conn, "scene-research", None)
            .into_iter()
            .map(|p| p.id)
            .collect();
        assert_eq!(after, reordered);
    }

    #[test]
    fn reorder_grouped_partition_with_null_aware_predicate() {
        let (_dir, conn) = migrated_conn();
        add_sub_stage(&conn, "ss-r", "scene-plan");
        let a = create_phrase(&conn, "scene-plan", "a", "b", Some("ss-r")).expect("a");
        let b = create_phrase(&conn, "scene-plan", "b", "b", Some("ss-r")).expect("b");
        let new_order = vec![b.id.clone(), a.id.clone()];
        reorder_phrases(&conn, "scene-plan", Some("ss-r"), &new_order).expect("reorder grouped");
        let after: Vec<String> = partition(&conn, "scene-plan", Some("ss-r"))
            .into_iter()
            .map(|p| p.id)
            .collect();
        assert_eq!(after, new_order);
    }

    #[test]
    fn reorder_rejects_unknown_id() {
        let (_dir, conn) = migrated_conn();
        let err = reorder_phrases(&conn, "scene-plan", None, &["ghost".to_string()])
            .expect_err("unknown id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn reorder_rejects_id_from_other_partition() {
        let (_dir, conn) = migrated_conn();
        add_sub_stage(&conn, "ss-p", "scene-plan");
        // A grouped phrase must not be accepted when reordering the ungrouped set.
        let grouped = create_phrase(&conn, "scene-plan", "g", "b", Some("ss-p")).expect("grouped");
        let err = reorder_phrases(&conn, "scene-plan", None, std::slice::from_ref(&grouped.id))
            .expect_err("cross-partition id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }
}
