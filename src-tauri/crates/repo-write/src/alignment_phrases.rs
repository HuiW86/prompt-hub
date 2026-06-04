use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use repo_core::error::{RepoError, RepoResult};
use repo_core::models::AlignmentPhrase;

// Direct omar-driven editing of alignment-phrase assets (plan asset-editing-and-adaptive-layout
// §0 Q2/Q6, decision D-c). Distinct from the draft-promote path in `promote.rs`:
// these mutate the real `alignment_phrases` table in response to a user action in
// the AlignmentPhrases region, not a Claude-proposed draft. Lives in `repo-write`
// so the MCP binary (repo-core only) can't reach them.
//
// B2 (02-constitution): alignment phrases are the PROTOCOL layer — bound to a
// phase, never mixed into the Composition/Macro task workbench. Ordering is PER
// phase: order_index restarts at 0 inside each phase, so create appends at the end
// of its own phase and reorder rewrites positions within a single phase.

/// Insert a user-authored alignment phrase at the end of its phase. Always
/// non-default (is_default=0): the seeded phase default stays the protocol
/// default, and the partial unique index (one is_default=1 per phase) would
/// otherwise reject a second default. The phases FK rejects an unknown phase_id.
pub fn create_alignment_phrase(
    conn: &Connection,
    phase_id: &str,
    name: &str,
    content: &str,
) -> RepoResult<AlignmentPhrase> {
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now();
    let now = created_at.to_rfc3339();
    conn.execute(
        "INSERT INTO alignment_phrases
            (id, phase_id, name, content, is_default, usage_count, last_used_at,
             created_at, notes, deprecated, order_index)
         VALUES (?1, ?2, ?3, ?4, 0, 0, NULL, ?5, NULL, 0,
             (SELECT COALESCE(MAX(order_index) + 1, 0) FROM alignment_phrases WHERE phase_id = ?2))",
        params![id, phase_id, name, content, now],
    )?;
    let order_index: i64 = conn.query_row(
        "SELECT order_index FROM alignment_phrases WHERE id = ?1",
        params![id],
        |row| row.get(0),
    )?;
    Ok(AlignmentPhrase {
        id,
        phase_id: phase_id.to_string(),
        name: name.to_string(),
        content: content.to_string(),
        is_default: false,
        usage_count: 0,
        last_used_at: None,
        created_at,
        notes: None,
        deprecated: false,
        order_index,
    })
}

/// Rename / edit the body of an existing alignment phrase. phase_id, is_default,
/// order_index and usage stats are left untouched (parity with the macro/modifier
/// edit path, which only mutates name/content).
pub fn update_alignment_phrase(
    conn: &Connection,
    id: &str,
    name: &str,
    content: &str,
) -> RepoResult<()> {
    let changed = conn.execute(
        "UPDATE alignment_phrases SET name = ?2, content = ?3 WHERE id = ?1",
        params![id, name, content],
    )?;
    if changed == 0 {
        return Err(missing_alignment_phrase(id));
    }
    Ok(())
}

/// Permanently remove an alignment phrase. Rejects the phase default
/// (is_default=1): every phase must keep exactly one protocol default (D-c). The
/// UI guards the non-default delete behind a confirm dialog.
pub fn delete_alignment_phrase(conn: &Connection, id: &str) -> RepoResult<()> {
    let is_default: Option<i64> = conn
        .query_row(
            "SELECT is_default FROM alignment_phrases WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    match is_default {
        None => Err(missing_alignment_phrase(id)),
        Some(flag) if flag != 0 => Err(RepoError::DefaultAlignmentPhraseProtected(id.to_string())),
        Some(_) => {
            conn.execute("DELETE FROM alignment_phrases WHERE id = ?1", params![id])?;
            Ok(())
        }
    }
}

/// Persist a new sort order WITHIN a single phase by rewriting order_index for
/// the given ids in one transaction. `ordered_ids` is the full visible order of
/// that phase; each id's order_index becomes its position in the slice. An id
/// that is unknown OR belongs to a different phase is rejected, so a stale
/// renderer list can't silently no-op or cross phases.
pub fn reorder_alignment_phrases(
    conn: &Connection,
    phase_id: &str,
    ordered_ids: &[String],
) -> RepoResult<()> {
    // unchecked_transaction takes &Connection (not &mut), so it composes with the
    // shared-borrow `guard_schema_then` write path that holds the AppState mutex.
    let tx = conn.unchecked_transaction()?;
    for (idx, id) in ordered_ids.iter().enumerate() {
        let changed = tx.execute(
            "UPDATE alignment_phrases SET order_index = ?2 WHERE id = ?1 AND phase_id = ?3",
            params![id, idx as i64, phase_id],
        )?;
        if changed == 0 {
            return Err(missing_alignment_phrase(id));
        }
    }
    tx.commit()?;
    Ok(())
}

fn missing_alignment_phrase(id: &str) -> RepoError {
    RepoError::TargetNotFound {
        table: "alignment_phrases".to_string(),
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

    fn phase(conn: &Connection, phase_id: &str) -> Vec<AlignmentPhrase> {
        repo::list_alignment_phrases(conn)
            .expect("list")
            .into_iter()
            .filter(|a| a.phase_id == phase_id)
            .collect()
    }

    #[test]
    fn create_appends_at_end_of_its_phase() {
        let (_dir, conn) = migrated_conn();
        let before_max = phase(&conn, "phase-diverge")
            .iter()
            .map(|a| a.order_index)
            .max()
            .unwrap_or(-1);

        let a = create_alignment_phrase(&conn, "phase-diverge", "A", "body").expect("create a");
        assert_eq!(a.phase_id, "phase-diverge");
        assert!(!a.is_default, "user-authored phrase must be non-default");
        assert_eq!(a.order_index, before_max + 1);

        let b = create_alignment_phrase(&conn, "phase-diverge", "B", "body").expect("create b");
        assert_eq!(b.order_index, a.order_index + 1);
    }

    #[test]
    fn create_orders_independently_per_phase() {
        let (_dir, conn) = migrated_conn();
        let div_max = phase(&conn, "phase-diverge")
            .iter()
            .map(|a| a.order_index)
            .max()
            .unwrap_or(-1);
        let und_max = phase(&conn, "phase-understand")
            .iter()
            .map(|a| a.order_index)
            .max()
            .unwrap_or(-1);

        let div = create_alignment_phrase(&conn, "phase-diverge", "D", "body").expect("div");
        let und = create_alignment_phrase(&conn, "phase-understand", "U", "body").expect("und");
        assert_eq!(div.order_index, div_max + 1);
        assert_eq!(und.order_index, und_max + 1);
    }

    #[test]
    fn create_rejects_unknown_phase() {
        let (_dir, conn) = migrated_conn();
        let err =
            create_alignment_phrase(&conn, "phase-bogus", "X", "body").expect_err("unknown phase");
        // Surfaced as a rusqlite FK violation wrapped in RepoError.
        assert!(matches!(err, RepoError::Sqlite(_)), "got {err:?}");
    }

    #[test]
    fn update_edits_name_and_content() {
        let (_dir, conn) = migrated_conn();
        let created =
            create_alignment_phrase(&conn, "phase-diverge", "Old", "old body").expect("create");
        update_alignment_phrase(&conn, &created.id, "Renamed", "new body").expect("update");

        let found = repo::list_alignment_phrases(&conn)
            .expect("list")
            .into_iter()
            .find(|a| a.id == created.id)
            .expect("present");
        assert_eq!(found.name, "Renamed");
        assert_eq!(found.content, "new body");
        assert_eq!(found.phase_id, "phase-diverge");
        assert_eq!(found.order_index, created.order_index);
    }

    #[test]
    fn update_missing_errors() {
        let (_dir, conn) = migrated_conn();
        let err = update_alignment_phrase(&conn, "nope", "x", "y").expect_err("missing");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }

    #[test]
    fn delete_removes_non_default_row() {
        let (_dir, conn) = migrated_conn();
        let created =
            create_alignment_phrase(&conn, "phase-diverge", "Doomed", "body").expect("create");
        delete_alignment_phrase(&conn, &created.id).expect("delete");
        assert!(
            repo::list_alignment_phrases(&conn)
                .expect("list")
                .iter()
                .all(|a| a.id != created.id),
            "deleted phrase must not be listed"
        );
        let err = delete_alignment_phrase(&conn, &created.id).expect_err("second delete");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }

    #[test]
    fn delete_rejects_phase_default() {
        let (_dir, conn) = migrated_conn();
        // The seed gives every phase one is_default=1 phrase; pick the diverge one.
        let default = phase(&conn, "phase-diverge")
            .into_iter()
            .find(|a| a.is_default)
            .expect("seed default present");
        let err = delete_alignment_phrase(&conn, &default.id).expect_err("default protected");
        assert!(
            matches!(err, RepoError::DefaultAlignmentPhraseProtected(ref id) if *id == default.id),
            "got {err:?}"
        );
        // The default must still be listed (delete was a no-op).
        assert!(
            phase(&conn, "phase-diverge")
                .iter()
                .any(|a| a.id == default.id),
            "protected default must survive"
        );
    }

    #[test]
    fn reorder_rewrites_order_index_within_phase() {
        let (_dir, conn) = migrated_conn();
        // Build a known set of user phrases in one phase for a deterministic assert.
        let a = create_alignment_phrase(&conn, "phase-diverge", "a", "b").expect("a");
        let b = create_alignment_phrase(&conn, "phase-diverge", "b", "b").expect("b");
        let c = create_alignment_phrase(&conn, "phase-diverge", "c", "b").expect("c");
        let new_order = vec![c.id.clone(), a.id.clone(), b.id.clone()];
        reorder_alignment_phrases(&conn, "phase-diverge", &new_order).expect("reorder");

        let after: Vec<String> = phase(&conn, "phase-diverge")
            .into_iter()
            .filter(|a| new_order.contains(&a.id))
            .map(|a| a.id)
            .collect();
        assert_eq!(after, new_order, "diverge phase order must match reorder");
    }

    #[test]
    fn reorder_rejects_unknown_id() {
        let (_dir, conn) = migrated_conn();
        let err = reorder_alignment_phrases(&conn, "phase-diverge", &["ghost".to_string()])
            .expect_err("unknown id");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }

    #[test]
    fn reorder_rejects_id_from_other_phase() {
        let (_dir, conn) = migrated_conn();
        let div = create_alignment_phrase(&conn, "phase-diverge", "div", "b").expect("div");
        // Reordering the understand phase must not accept a diverge id.
        let err = reorder_alignment_phrases(&conn, "phase-understand", std::slice::from_ref(&div.id))
            .expect_err("cross-phase id");
        assert!(matches!(err, RepoError::TargetNotFound { .. }), "got {err:?}");
    }
}
