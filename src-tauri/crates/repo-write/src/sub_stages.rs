use rusqlite::{params, Connection};
use uuid::Uuid;

use repo_core::error::{RepoError, RepoResult};
use repo_core::models::SubStage;

// Direct omar-driven editing of SubStage groups (plan scene-substage-editing).
// A SubStage is a same-level grouping WITHIN one scene (01-spec §8.4: not a
// nested sub-scene). Lives in `repo-write` so the MCP binary (repo-core only)
// can't reach them.
//
// Ordering is PER-SCENE: order_index restarts at 0 inside each scene, so create
// appends at the end of its own scene and reorder rewrites positions within a
// single scene's list. The sub_stages FK rejects an unknown scene_id.

/// Insert a sub-stage at the end of its scene's list. The scenes FK rejects an
/// unknown scene_id.
pub fn create_sub_stage(conn: &Connection, scene_id: &str, name: &str) -> RepoResult<SubStage> {
    let id = Uuid::new_v4().to_string();
    // Single-statement append: the MAX subquery resolves the next slot inside the
    // target scene atomically, so concurrent creates can't collide on MAX+1.
    conn.execute(
        "INSERT INTO sub_stages (id, scene_id, name, order_index)
         VALUES (?1, ?2, ?3,
             (SELECT COALESCE(MAX(order_index) + 1, 0) FROM sub_stages WHERE scene_id = ?2))",
        params![id, scene_id, name],
    )?;
    let order_index: i64 = conn.query_row(
        "SELECT order_index FROM sub_stages WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        |row| row.get(0),
    )?;
    Ok(SubStage {
        id,
        scene_id: scene_id.to_string(),
        name: name.to_string(),
        order_index,
        deleted_at: None,
    })
}

/// Rename a sub-stage. order_index is left untouched (parity with the phrase /
/// macro edit path). Hitting 0 rows means the id is unknown.
pub fn update_sub_stage(conn: &Connection, id: &str, name: &str) -> RepoResult<()> {
    let changed = conn.execute(
        "UPDATE sub_stages SET name = ?2 WHERE id = ?1 AND deleted_at IS NULL",
        params![id, name],
    )?;
    if changed == 0 {
        return Err(missing_sub_stage(id));
    }
    Ok(())
}

/// Move a sub-stage to the trash (ADR-028) and touch NOTHING else. Until this
/// ADR the delete also nulled `phrases.sub_stage_id` for the whole group inside
/// the transaction; sub-decision 7 removed that, because an unbind is exactly the
/// bookkeeping a restore would then have to undo. The child phrases keep pointing
/// at the trashed sub-stage and the read path shows them as ungrouped
/// (`repo::list_phrases_by_scene`), so restoring the sub-stage is a single-row
/// UPDATE and its phrases return to it by themselves. The unbind now happens once,
/// at `trash::purge_trash`, where the bare FK really does need it. Deleting a
/// sub-stage already in the trash is a no-op; an unknown id is an error.
pub fn delete_sub_stage(conn: &Connection, id: &str) -> RepoResult<()> {
    match crate::soft_delete::soft_delete_row(conn, "sub_stages", id)? {
        crate::soft_delete::SoftDeleteOutcome::Missing => Err(missing_sub_stage(id)),
        _ => Ok(()),
    }
}

/// Persist a new sort order WITHIN one scene by rewriting order_index for the
/// given ids in one transaction. `ordered_ids` is the full visible order of that
/// scene's sub-stages; each id's order_index becomes its position in the slice.
/// An id that is unknown OR belongs to a different scene is rejected, so a stale
/// renderer list can't silently no-op or cross scenes.
pub fn reorder_sub_stages(
    conn: &Connection,
    scene_id: &str,
    ordered_ids: &[String],
) -> RepoResult<()> {
    let tx = conn.unchecked_transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        let changed = tx.execute(
            "UPDATE sub_stages SET order_index = ?2
             WHERE id = ?1 AND scene_id = ?3 AND deleted_at IS NULL",
            params![id, idx as i64, scene_id],
        )?;
        if changed == 0 {
            return Err(missing_sub_stage(id));
        }
    }
    tx.commit()?;
    Ok(())
}

fn missing_sub_stage(id: &str) -> RepoError {
    RepoError::TargetNotFound {
        table: "sub_stages".to_string(),
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

    // Sub-stages of a scene in stored sort order.
    fn sub_stages(conn: &Connection, scene_id: &str) -> Vec<SubStage> {
        let mut stmt = conn
            .prepare(
                "SELECT id, scene_id, name, order_index FROM sub_stages
                 WHERE scene_id = ?1 AND deleted_at IS NULL ORDER BY order_index ASC",
            )
            .expect("prepare");
        stmt.query_map(params![scene_id], |row| {
            Ok(SubStage {
                id: row.get("id")?,
                scene_id: row.get("scene_id")?,
                name: row.get("name")?,
                order_index: row.get("order_index")?,
                // Filtered out by the query above; a listed sub-stage is alive.
                deleted_at: None,
            })
        })
        .expect("query")
        .collect::<rusqlite::Result<Vec<_>>>()
        .expect("collect")
    }

    #[test]
    fn seed_grants_scene_plan_four_sub_stages() {
        let (_dir, conn) = migrated_conn();
        // 0011 seed: 生成/评审/修订/定版 at order_index 0..3.
        let rows = sub_stages(&conn, "scene-plan");
        assert_eq!(rows.len(), 4);
        assert_eq!(rows[0].id, "ss-plan-generate");
        assert_eq!(rows[0].order_index, 0);
        assert_eq!(rows[3].id, "ss-plan-final");
        assert_eq!(rows[3].order_index, 3);
    }

    #[test]
    fn create_appends_at_end_of_scene() {
        let (_dir, conn) = migrated_conn();
        // scene-research has no seeded sub-stages, so the first append starts at 0.
        let a = create_sub_stage(&conn, "scene-research", "甲").expect("a");
        assert_eq!(a.order_index, 0);
        let b = create_sub_stage(&conn, "scene-research", "乙").expect("b");
        assert_eq!(b.order_index, 1);
    }

    #[test]
    fn create_orders_independently_per_scene() {
        let (_dir, conn) = migrated_conn();
        // scene-plan already has 4 seeded sub-stages, so the next slot is 4.
        let next = create_sub_stage(&conn, "scene-plan", "复盘").expect("next");
        assert_eq!(next.order_index, 4);
    }

    #[test]
    fn create_rejects_unknown_scene() {
        let (_dir, conn) = migrated_conn();
        let err = create_sub_stage(&conn, "scene-bogus", "x").expect_err("unknown scene");
        assert!(matches!(err, RepoError::Sqlite(_)), "got {err:?}");
    }

    #[test]
    fn update_renames() {
        let (_dir, conn) = migrated_conn();
        let s = create_sub_stage(&conn, "scene-research", "Old").expect("create");
        update_sub_stage(&conn, &s.id, "New").expect("update");
        let found = sub_stages(&conn, "scene-research")
            .into_iter()
            .find(|x| x.id == s.id)
            .expect("present");
        assert_eq!(found.name, "New");
        assert_eq!(found.order_index, s.order_index);
    }

    #[test]
    fn update_missing_errors() {
        let (_dir, conn) = migrated_conn();
        let err = update_sub_stage(&conn, "nope", "x").expect_err("missing");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn delete_leaves_child_phrases_bound_so_restore_regroups_them() {
        let (_dir, conn) = migrated_conn();
        // Seed binds phrase-plan-export / phrase-plan-permission to ss-plan-generate.
        let bound: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM phrases WHERE sub_stage_id = 'ss-plan-generate'",
                [],
                |row| row.get(0),
            )
            .expect("count bound");
        assert_eq!(bound, 2);

        delete_sub_stage(&conn, "ss-plan-generate").expect("delete");

        // ADR-028 sub-decision 7: the unbind that used to happen here is gone.
        // The phrases keep pointing at the soft-deleted sub-stage, which is what
        // makes restore a single UPDATE with no bookkeeping — the read layer is
        // responsible for showing them as ungrouped meanwhile, and the purge is
        // what finally unbinds them.
        assert!(sub_stages(&conn, "scene-plan")
            .iter()
            .all(|s| s.id != "ss-plan-generate"));
        let still_bound: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM phrases
                 WHERE id IN ('phrase-plan-export','phrase-plan-permission')
                   AND sub_stage_id = 'ss-plan-generate'",
                [],
                |row| row.get(0),
            )
            .expect("count still bound");
        assert_eq!(still_bound, 2, "children must stay bound to survive restore");
    }

    /// The other half of sub-decision 7. `delete_leaves_child_phrases_bound...`
    /// proves the column is not nulled; this proves the two consequences that
    /// makes possible: while the sub-stage is in the trash the read layer hands
    /// its phrases back as UNGROUPED (the CASE in `repo::list_phrases_by_scene`),
    /// and a plain restore regroups them with no bookkeeping at all.
    #[test]
    fn restore_regroups_phrases_that_read_as_ungrouped_while_the_sub_stage_is_trashed() {
        let (_dir, conn) = migrated_conn();

        let grouped_before = repo::list_scenes_with_children(&conn)
            .expect("list")
            .into_iter()
            .find(|s| s.scene.id == "scene-plan")
            .expect("scene-plan")
            .phrases
            .into_iter()
            .filter(|p| p.sub_stage_id.as_deref() == Some("ss-plan-generate"))
            .count();
        assert_eq!(grouped_before, 2, "seed binds two phrases to 生成");

        delete_sub_stage(&conn, "ss-plan-generate").expect("delete");

        let during = repo::list_scenes_with_children(&conn)
            .expect("list")
            .into_iter()
            .find(|s| s.scene.id == "scene-plan")
            .expect("scene-plan");
        assert!(
            during.sub_stages.iter().all(|s| s.id != "ss-plan-generate"),
            "a trashed sub-stage must not be offered as a group"
        );
        let orphaned: Vec<&str> = during
            .phrases
            .iter()
            .filter(|p| {
                ["phrase-plan-export", "phrase-plan-permission"].contains(&p.id.as_str())
            })
            .map(|p| {
                assert_eq!(
                    p.sub_stage_id, None,
                    "a phrase whose sub-stage is in the trash must read as ungrouped"
                );
                p.id.as_str()
            })
            .collect();
        assert_eq!(orphaned.len(), 2, "both phrases must still be listed");

        crate::trash::restore_asset(&conn, repo_core::AssetKind::SubStage, "ss-plan-generate")
            .expect("restore");

        let after = repo::list_scenes_with_children(&conn)
            .expect("list")
            .into_iter()
            .find(|s| s.scene.id == "scene-plan")
            .expect("scene-plan");
        let restored = after
            .sub_stages
            .iter()
            .find(|s| s.id == "ss-plan-generate")
            .expect("sub-stage is back");
        assert_eq!(restored.order_index, 0, "it returns to its own slot");
        let regrouped = after
            .phrases
            .iter()
            .filter(|p| p.sub_stage_id.as_deref() == Some("ss-plan-generate"))
            .count();
        assert_eq!(
            regrouped, 2,
            "the phrases regroup by themselves — restore wrote one row"
        );
    }

    #[test]
    fn delete_missing_errors() {
        let (_dir, conn) = migrated_conn();
        let err = delete_sub_stage(&conn, "nope").expect_err("missing");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn reorder_rewrites_within_scene() {
        let (_dir, conn) = migrated_conn();
        let order: Vec<String> = sub_stages(&conn, "scene-plan")
            .into_iter()
            .map(|s| s.id)
            .collect();
        let mut reversed = order.clone();
        reversed.reverse();
        reorder_sub_stages(&conn, "scene-plan", &reversed).expect("reorder");
        let after: Vec<String> = sub_stages(&conn, "scene-plan")
            .into_iter()
            .map(|s| s.id)
            .collect();
        assert_eq!(after, reversed);
    }

    #[test]
    fn reorder_rejects_unknown_id() {
        let (_dir, conn) = migrated_conn();
        let err = reorder_sub_stages(&conn, "scene-plan", &["ghost".to_string()])
            .expect_err("unknown id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn reorder_rejects_id_from_other_scene() {
        let (_dir, conn) = migrated_conn();
        // A scene-plan sub-stage must not be accepted when reordering another scene.
        let err = reorder_sub_stages(&conn, "scene-research", &["ss-plan-generate".to_string()])
            .expect_err("cross-scene id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }
}
