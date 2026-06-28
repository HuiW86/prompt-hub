use rusqlite::{params, Connection};
use uuid::Uuid;

use repo_core::error::{RepoError, RepoResult};
use repo_core::models::Scene;

// Direct omar-driven editing of Scene containers (plan scene-substage-editing).
// A Scene is the top-level grouping that holds phrases and (optionally) sub-stages.
// Lives in `repo-write` so the MCP binary (repo-core only) can't reach them, the
// same compile-time write isolation the phrase / macro / modifier paths use.
//
// Ordering is a single GLOBAL partition: scenes have no parent, so order_index is
// a flat sequence across all scenes and reorder rewrites that one list. The
// `role_presets` column is a JSON array of strings (TEXT NOT NULL DEFAULT '[]'),
// matching how `repo.rs::list_scenes_with_children` decodes it.

/// Insert a user-authored scene at the end of the global scenes list. `visible`
/// defaults to true and `role_presets` is encoded as a JSON array, matching the
/// read path's decoder.
pub fn create_scene(
    conn: &Connection,
    name: &str,
    icon: Option<&str>,
    role_presets: &[String],
    color: Option<&str>,
) -> RepoResult<Scene> {
    let id = Uuid::new_v4().to_string();
    let role_presets_json = serde_json::to_string(role_presets)?;
    // Single-statement append: the MAX subquery resolves the next global slot
    // atomically, so concurrent creates can't collide on MAX+1.
    conn.execute(
        "INSERT INTO scenes (id, name, icon, order_index, visible, role_presets, color)
         VALUES (?1, ?2, ?3,
             (SELECT COALESCE(MAX(order_index) + 1, 0) FROM scenes),
             1, ?4, ?5)",
        params![id, name, icon, role_presets_json, color],
    )?;
    let order_index: i64 = conn.query_row(
        "SELECT order_index FROM scenes WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(Scene {
        id,
        name: name.to_string(),
        icon: icon.map(str::to_string),
        order_index,
        visible: true,
        role_presets: role_presets.to_vec(),
        color: color.map(str::to_string),
    })
}

/// Rename / edit a scene's name, icon, role_presets and color. order_index and
/// visible are left untouched (parity with the phrase / macro edit path). Hitting
/// 0 rows means the id is unknown.
pub fn update_scene(
    conn: &Connection,
    id: &str,
    name: &str,
    icon: Option<&str>,
    role_presets: &[String],
    color: Option<&str>,
) -> RepoResult<()> {
    let role_presets_json = serde_json::to_string(role_presets)?;
    let changed = conn.execute(
        "UPDATE scenes SET name = ?2, icon = ?3, role_presets = ?4, color = ?5 WHERE id = ?1",
        params![id, name, icon, role_presets_json, color],
    )?;
    if changed == 0 {
        return Err(missing_scene(id));
    }
    Ok(())
}

/// Permanently remove a scene, but refuse (D4) when it still has phrases or
/// sub-stages: deleting would orphan children, so the app-layer check returns
/// `SceneNotEmpty` instead. An empty scene that hits 0 rows on DELETE means the
/// id was unknown.
pub fn delete_scene(conn: &Connection, id: &str) -> RepoResult<()> {
    let phrase_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM phrases WHERE scene_id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    let sub_stage_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sub_stages WHERE scene_id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    if phrase_count > 0 || sub_stage_count > 0 {
        return Err(RepoError::SceneNotEmpty {
            scene_id: id.to_string(),
        });
    }
    let changed = conn.execute("DELETE FROM scenes WHERE id = ?1", params![id])?;
    if changed == 0 {
        return Err(missing_scene(id));
    }
    Ok(())
}

/// Persist a new global sort order by rewriting order_index for the given ids in
/// one transaction. `ordered_ids` is the full visible order of all scenes; each
/// id's order_index becomes its position in the slice. An unknown id is rejected
/// so a stale renderer list can't silently no-op.
pub fn reorder_scenes(conn: &Connection, ordered_ids: &[String]) -> RepoResult<()> {
    // unchecked_transaction takes &Connection (not &mut), so it composes with the
    // shared-borrow `guard_schema_then` write path that holds the AppState mutex.
    let tx = conn.unchecked_transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        let changed = tx.execute(
            "UPDATE scenes SET order_index = ?2 WHERE id = ?1",
            params![id, idx as i64],
        )?;
        if changed == 0 {
            return Err(missing_scene(id));
        }
    }
    tx.commit()?;
    Ok(())
}

fn missing_scene(id: &str) -> RepoError {
    RepoError::TargetNotFound {
        table: "scenes".to_string(),
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

    // All scenes in stored sort order (including the 3 seeds).
    fn all_scenes(conn: &Connection) -> Vec<Scene> {
        let mut stmt = conn
            .prepare(
                "SELECT id, name, icon, order_index, visible, role_presets, color
                 FROM scenes ORDER BY order_index ASC",
            )
            .expect("prepare");
        stmt.query_map([], |row| {
            let presets_json: String = row.get("role_presets")?;
            Ok(Scene {
                id: row.get("id")?,
                name: row.get("name")?,
                icon: row.get("icon")?,
                order_index: row.get("order_index")?,
                visible: row.get::<_, i64>("visible")? != 0,
                role_presets: serde_json::from_str(&presets_json).unwrap_or_default(),
                color: row.get("color")?,
            })
        })
        .expect("query")
        .collect::<rusqlite::Result<Vec<_>>>()
        .expect("collect")
    }

    #[test]
    fn create_appends_at_end_of_global_order() {
        let (_dir, conn) = migrated_conn();
        // 3 seeded scenes occupy order_index 0..2.
        let before = all_scenes(&conn).len() as i64;
        let s = create_scene(
            &conn,
            "新场景",
            Some("sparkles"),
            &["架构师".to_string()],
            Some("#534AB7"),
        )
        .expect("create");
        assert_eq!(s.order_index, before);
        assert!(s.visible);
        assert_eq!(s.role_presets, vec!["架构师".to_string()]);

        let t = create_scene(&conn, "再一个", None, &[], None).expect("create 2");
        assert_eq!(t.order_index, s.order_index + 1);
        assert!(t.icon.is_none());
        assert!(t.role_presets.is_empty());
    }

    #[test]
    fn update_edits_fields_keeps_order_index_and_visible() {
        let (_dir, conn) = migrated_conn();
        let created = create_scene(&conn, "Old", None, &[], None).expect("create");
        update_scene(
            &conn,
            &created.id,
            "Renamed",
            Some("wand"),
            &["新角色".to_string()],
            Some("#abcdef"),
        )
        .expect("update");
        let found = all_scenes(&conn)
            .into_iter()
            .find(|s| s.id == created.id)
            .expect("present");
        assert_eq!(found.name, "Renamed");
        assert_eq!(found.icon.as_deref(), Some("wand"));
        assert_eq!(found.role_presets, vec!["新角色".to_string()]);
        assert_eq!(found.color.as_deref(), Some("#abcdef"));
        assert_eq!(found.order_index, created.order_index);
        assert!(found.visible);
    }

    #[test]
    fn update_missing_errors() {
        let (_dir, conn) = migrated_conn();
        let err = update_scene(&conn, "nope", "x", None, &[], None).expect_err("missing");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn delete_rejects_scene_with_phrases() {
        let (_dir, conn) = migrated_conn();
        // scene-plan is seeded with 2 phrases.
        let err = delete_scene(&conn, "scene-plan").expect_err("non-empty scene");
        assert!(
            matches!(err, RepoError::SceneNotEmpty { ref scene_id } if scene_id == "scene-plan"),
            "got {err:?}"
        );
    }

    #[test]
    fn delete_rejects_scene_with_only_sub_stages() {
        let (_dir, conn) = migrated_conn();
        let s = create_scene(&conn, "WithStage", None, &[], None).expect("create");
        conn.execute(
            "INSERT INTO sub_stages (id, scene_id, name, order_index) VALUES ('ss-tmp', ?1, 'x', 0)",
            params![s.id],
        )
        .expect("insert sub_stage");
        let err = delete_scene(&conn, &s.id).expect_err("scene with sub-stage");
        assert!(
            matches!(err, RepoError::SceneNotEmpty { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn delete_succeeds_on_empty_scene() {
        let (_dir, conn) = migrated_conn();
        let s = create_scene(&conn, "Empty", None, &[], None).expect("create");
        delete_scene(&conn, &s.id).expect("delete empty");
        assert!(all_scenes(&conn).iter().all(|x| x.id != s.id));
        let err = delete_scene(&conn, &s.id).expect_err("second delete");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn reorder_rewrites_global_order() {
        let (_dir, conn) = migrated_conn();
        let order: Vec<String> = all_scenes(&conn).into_iter().map(|s| s.id).collect();
        let mut reversed = order.clone();
        reversed.reverse();
        reorder_scenes(&conn, &reversed).expect("reorder");
        let after: Vec<String> = all_scenes(&conn).into_iter().map(|s| s.id).collect();
        assert_eq!(after, reversed);
    }

    #[test]
    fn reorder_rejects_unknown_id() {
        let (_dir, conn) = migrated_conn();
        let err = reorder_scenes(&conn, &["ghost".to_string()]).expect_err("unknown id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }
}
