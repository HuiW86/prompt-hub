use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use repo_core::error::{RepoError, RepoResult};
use repo_core::models::{AlignmentAxisValue, AxisKind};

// The three coordinate axes' value lists (ADR-029 子决策 2, 06-prd §6.6-bis).
//
// This table is user content but NOT an asset: it has no `deleted_at`, no
// `deprecated`, no `usage_count`, it is never copied, and it produces no usage
// records. It exists so the coordinate system itself stays editable from inside
// the app (01-spec §2.9 哲学九) rather than needing a migration per value.
//
// `order_index` is partitioned BY axis, the same way modifiers partition by
// group_kind and phrases by sub_stage_id: each axis restarts at 0, so create
// appends within its own axis and reorder rewrites positions inside one axis.

/// Append a value to the end of its axis.
pub fn create_alignment_axis_value(
    conn: &Connection,
    axis: AxisKind,
    name: &str,
    hint: Option<&str>,
) -> RepoResult<AlignmentAxisValue> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO alignment_axis_values (id, axis, name, hint, order_index)
         VALUES (?1, ?2, ?3, ?4,
             (SELECT COALESCE(MAX(order_index) + 1, 0)
              FROM alignment_axis_values WHERE axis = ?2))",
        params![id, axis.as_str(), name, hint],
    )?;
    let order_index: i64 = conn.query_row(
        "SELECT order_index FROM alignment_axis_values WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(AlignmentAxisValue {
        id,
        axis,
        name: name.to_string(),
        hint: hint.map(str::to_string),
        order_index,
    })
}

/// Rename a value or change its hint. The axis is deliberately NOT editable:
/// moving a value between axes would silently invalidate every phrase pointing
/// at it from the old axis's column, and there is no way to fix that up that
/// isn't just "delete it and make a new one".
pub fn update_alignment_axis_value(
    conn: &Connection,
    id: &str,
    name: &str,
    hint: Option<&str>,
) -> RepoResult<()> {
    let changed = conn.execute(
        "UPDATE alignment_axis_values SET name = ?2, hint = ?3 WHERE id = ?1",
        params![id, name, hint],
    )?;
    if changed == 0 {
        return Err(missing_axis_value(id));
    }
    Ok(())
}

/// Destroy a value for good. There is no trash for this table (06-prd §6.6-bis
/// "删除策略"): the loss `deleted_at` protects against is "I deleted something I
/// wrote", and what is lost here is a label plus some phrases' coordinates —
/// not one phrase, not one usage record, not one id.
///
/// Phrases pointing at it fall back to "unconstrained on that axis". That is the
/// `ON DELETE SET NULL` in migration 0014 doing the work, but only when
/// `PRAGMA foreign_keys` is on; a connection that somehow has it off would
/// leave dangling ids instead, so the same transaction blanks the columns
/// explicitly in that case. TRASHED phrases are blanked too, by both paths —
/// SQL cannot see `deleted_at`, which is exactly why the delete confirmation
/// reports `trashedRefCount` alongside `refCount`.
pub fn delete_alignment_axis_value(conn: &Connection, id: &str) -> RepoResult<()> {
    let tx = conn.unchecked_transaction()?;
    let exists: Option<i64> = tx
        .query_row(
            "SELECT 1 FROM alignment_axis_values WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    if exists.is_none() {
        return Err(missing_axis_value(id));
    }

    let fk_on: i64 = tx.pragma_query_value(None, "foreign_keys", |row| row.get(0))?;
    if fk_on == 0 {
        // db.rs::configure turns foreign keys on for every connection this app
        // opens, so this branch should be unreachable. Keep it anyway: the cost
        // is three UPDATEs that touch nothing, and the alternative failure mode
        // is a phrase carrying a coordinate id that no longer resolves.
        tx.execute(
            "UPDATE alignment_phrases SET layer_id = NULL WHERE layer_id = ?1",
            params![id],
        )?;
        tx.execute(
            "UPDATE alignment_phrases SET domain_id = NULL WHERE domain_id = ?1",
            params![id],
        )?;
        tx.execute(
            "UPDATE alignment_phrases SET mode_id = NULL WHERE mode_id = ?1",
            params![id],
        )?;
    }

    tx.execute(
        "DELETE FROM alignment_axis_values WHERE id = ?1",
        params![id],
    )?;
    tx.commit()?;
    Ok(())
}

/// Persist a new order WITHIN one axis. `ordered_ids` is that axis's full list;
/// each id's `order_index` becomes its position. An id that is unknown OR sits
/// on a different axis is rejected, so a stale renderer list can neither
/// silently no-op nor shuffle one axis using another's ids — the same contract
/// as `reorder_alignment_phrases`.
pub fn reorder_alignment_axis_values(
    conn: &Connection,
    axis: AxisKind,
    ordered_ids: &[String],
) -> RepoResult<()> {
    let tx = conn.unchecked_transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        let changed = tx.execute(
            "UPDATE alignment_axis_values SET order_index = ?2 WHERE id = ?1 AND axis = ?3",
            params![id, idx as i64, axis.as_str()],
        )?;
        if changed == 0 {
            return Err(missing_axis_value(id));
        }
    }
    tx.commit()?;
    Ok(())
}

fn missing_axis_value(id: &str) -> RepoError {
    RepoError::TargetNotFound {
        table: "alignment_axis_values".to_string(),
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

    fn axis(conn: &Connection, axis: AxisKind) -> Vec<AlignmentAxisValue> {
        repo::list_alignment_axis_values(conn)
            .expect("list")
            .into_iter()
            .filter(|v| v.value.axis == axis)
            .map(|v| v.value)
            .collect()
    }

    #[test]
    fn seed_lists_sixteen_values_ordered_within_each_axis() {
        let (_dir, conn) = migrated_conn();
        let all = repo::list_alignment_axis_values(&conn).expect("list");
        assert_eq!(all.len(), 16);
        assert_eq!(axis(&conn, AxisKind::Layer).len(), 7);
        assert_eq!(axis(&conn, AxisKind::Domain).len(), 6);
        assert_eq!(axis(&conn, AxisKind::Mode).len(), 3);
        for a in [AxisKind::Layer, AxisKind::Domain, AxisKind::Mode] {
            let positions: Vec<i64> = axis(&conn, a).iter().map(|v| v.order_index).collect();
            assert_eq!(
                positions,
                (0..positions.len() as i64).collect::<Vec<_>>(),
                "{a:?} must restart at 0 and be contiguous"
            );
        }
        // hint is verbatim from the prototype's LAYERS constant.
        let layer = axis(&conn, AxisKind::Layer);
        assert_eq!(layer[0].name, "意义");
        assert_eq!(layer[0].hint.as_deref(), Some("这件事为什么重要"));
    }

    #[test]
    fn create_appends_within_its_own_axis_only() {
        let (_dir, conn) = migrated_conn();
        let created =
            create_alignment_axis_value(&conn, AxisKind::Mode, "试探", Some("小步验证")).expect("create");
        assert_eq!(created.order_index, 3, "mode seeds 0..2, so the append is 3");
        assert_eq!(axis(&conn, AxisKind::Mode).len(), 4);
        // The other two axes are untouched.
        assert_eq!(axis(&conn, AxisKind::Layer).len(), 7);
        assert_eq!(axis(&conn, AxisKind::Domain).len(), 6);
    }

    #[test]
    fn create_accepts_a_value_without_a_hint() {
        let (_dir, conn) = migrated_conn();
        let created =
            create_alignment_axis_value(&conn, AxisKind::Domain, "生态", None).expect("create");
        assert_eq!(created.hint, None);
    }

    #[test]
    fn update_changes_name_and_hint_but_rejects_an_unknown_id() {
        let (_dir, conn) = migrated_conn();
        update_alignment_axis_value(&conn, "axv-layer-path", "实施路径", Some("怎么分期"))
            .expect("update");
        let renamed = axis(&conn, AxisKind::Layer)
            .into_iter()
            .find(|v| v.id == "axv-layer-path")
            .expect("still there");
        assert_eq!(renamed.name, "实施路径");
        assert_eq!(renamed.hint.as_deref(), Some("怎么分期"));

        let err = update_alignment_axis_value(&conn, "axv-nope", "x", None).expect_err("unknown");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }

    #[test]
    fn reorder_rewrites_one_axis_and_rejects_a_foreign_id() {
        let (_dir, conn) = migrated_conn();
        let mut ids: Vec<String> = axis(&conn, AxisKind::Mode).iter().map(|v| v.id.clone()).collect();
        ids.reverse();
        reorder_alignment_axis_values(&conn, AxisKind::Mode, &ids).expect("reorder");
        let after: Vec<String> = axis(&conn, AxisKind::Mode).iter().map(|v| v.id.clone()).collect();
        assert_eq!(after, ids);

        // A layer id passed as part of the mode axis must be refused outright.
        let err = reorder_alignment_axis_values(
            &conn,
            AxisKind::Mode,
            &["axv-layer-path".to_string()],
        )
        .expect_err("cross-axis id");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }

    /// The whole reason the delete confirmation reports two numbers. SQL's
    /// `ON DELETE SET NULL` has never heard of `deleted_at`, so deleting an axis
    /// value blanks the coordinates of phrases in the TRASH exactly as it does
    /// live ones — and that half only becomes visible to the user on the day
    /// they restore something and find its coordinates gone (06-prd §6.6-bis).
    #[test]
    fn delete_sets_coordinates_to_null_on_live_and_trashed_phrases_alike() {
        let (_dir, conn) = migrated_conn();
        conn.execute(
            "UPDATE alignment_phrases SET layer_id = 'axv-layer-path'
             WHERE id IN ('ap-form-explore', 'ap-form-path')",
            [],
        )
        .expect("coordinate two phrases");
        conn.execute(
            "UPDATE alignment_phrases SET mode_id = 'axv-mode-converge' WHERE id = 'ap-form-path'",
            [],
        )
        .expect("give one of them a second coordinate");
        conn.execute(
            "UPDATE alignment_phrases SET deleted_at = '2026-09-05T00:00:00+00:00'
             WHERE id = 'ap-form-path'",
            [],
        )
        .expect("trash one of them");

        // Both counts are right BEFORE the delete — this is the data the
        // confirmation text is built from.
        let counted = repo::list_alignment_axis_values(&conn)
            .expect("list")
            .into_iter()
            .find(|v| v.value.id == "axv-layer-path")
            .expect("the layer value");
        assert_eq!(counted.ref_count, 1);
        assert_eq!(counted.trashed_ref_count, 1);

        delete_alignment_axis_value(&conn, "axv-layer-path").expect("delete");

        let blanked: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM alignment_phrases WHERE layer_id IS NOT NULL",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(blanked, 0, "both phrases fall back to unconstrained");
        // Not one phrase lost, not one id left dangling, and the OTHER
        // coordinate on the trashed phrase is untouched.
        let survivors: i64 = conn
            .query_row("SELECT COUNT(*) FROM alignment_phrases", [], |r| r.get(0))
            .expect("count");
        assert_eq!(survivors, 20);
        let mode: Option<String> = conn
            .query_row(
                "SELECT mode_id FROM alignment_phrases WHERE id = 'ap-form-path'",
                [],
                |r| r.get(0),
            )
            .expect("read");
        assert_eq!(mode.as_deref(), Some("axv-mode-converge"));
        let still_trashed: Option<String> = conn
            .query_row(
                "SELECT deleted_at FROM alignment_phrases WHERE id = 'ap-form-path'",
                [],
                |r| r.get(0),
            )
            .expect("read");
        assert!(
            still_trashed.is_some(),
            "deleting an axis value must not resurrect anything"
        );
    }

    #[test]
    fn delete_is_a_hard_delete_and_reports_unknown_ids() {
        let (_dir, conn) = migrated_conn();
        delete_alignment_axis_value(&conn, "axv-mode-recon").expect("delete");
        assert_eq!(axis(&conn, AxisKind::Mode).len(), 2);
        let err = delete_alignment_axis_value(&conn, "axv-mode-recon").expect_err("gone for good");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }
}
