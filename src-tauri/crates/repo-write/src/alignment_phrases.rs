use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use repo_core::error::{RepoError, RepoResult};
use repo_core::models::{AlignmentPhrase, AlignmentPhraseCoordinates, AxisKind};

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

/// Reject a coordinate id that does not exist, or that belongs to a different
/// axis than the column it is being written to (ADR-029). Called for each of the
/// three coordinates before either write path touches a row, so a rejected
/// coordinate leaves the phrase exactly as it was.
///
/// The FK alone would catch a nonexistent id, but nothing in SQL stops a `layer`
/// value from being stored in `mode_id` — the three columns all point at the
/// same table. That mistake is invisible until the copy path renders a layer
/// name in the mode slot, which is why it is checked here rather than left to
/// the schema.
fn validate_axis_ref(conn: &Connection, axis: AxisKind, id: Option<&str>) -> RepoResult<()> {
    let Some(id) = id else {
        // NULL means "unconstrained on this axis" — the default for every phrase
        // the seed ships and every phrase that existed before 0014.
        return Ok(());
    };
    let found: Option<String> = conn
        .query_row(
            "SELECT axis FROM alignment_axis_values WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    match found {
        None => Err(RepoError::TargetNotFound {
            table: "alignment_axis_values".to_string(),
            target_id: id.to_string(),
        }),
        Some(found) if found == axis.as_str() => Ok(()),
        Some(found) => Err(RepoError::AxisValueMismatch {
            id: id.to_string(),
            expected: axis.as_str().to_string(),
            found,
        }),
    }
}

fn validate_coordinates(conn: &Connection, coords: &AlignmentPhraseCoordinates) -> RepoResult<()> {
    validate_axis_ref(conn, AxisKind::Layer, coords.layer_id.as_deref())?;
    validate_axis_ref(conn, AxisKind::Domain, coords.domain_id.as_deref())?;
    validate_axis_ref(conn, AxisKind::Mode, coords.mode_id.as_deref())?;
    Ok(())
}

/// Insert a user-authored alignment phrase at the end of its phase. Always
/// non-default (is_default=0): the seeded phase default stays the protocol
/// default, and the partial unique index (one is_default=1 per phase) would
/// otherwise reject a second default. The phases FK rejects an unknown phase_id.
///
/// `coords` carries the ADR-029 classification and coordinates. All-default
/// (`kind = opening`, three NULLs, no `cue_axis`) reproduces the pre-0014
/// behaviour exactly, which is what a plain "new phrase" form still sends.
/// `content_revised_at` stays NULL: a phrase that has just been written has no
/// revision to split its ledger on.
pub fn create_alignment_phrase(
    conn: &Connection,
    phase_id: &str,
    name: &str,
    content: &str,
    coords: &AlignmentPhraseCoordinates,
) -> RepoResult<AlignmentPhrase> {
    let tx = conn.unchecked_transaction()?;
    validate_coordinates(&tx, coords)?;
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now();
    let now = created_at.to_rfc3339();
    tx.execute(
        "INSERT INTO alignment_phrases
            (id, phase_id, name, content, is_default, usage_count, last_used_at,
             created_at, notes, deprecated, order_index,
             kind, layer_id, domain_id, mode_id, cue_axis, content_revised_at)
         VALUES (?1, ?2, ?3, ?4, 0, 0, NULL, ?5, NULL, 0,
             (SELECT COALESCE(MAX(order_index) + 1, 0) FROM alignment_phrases WHERE phase_id = ?2),
             ?6, ?7, ?8, ?9, ?10, NULL)",
        params![
            id,
            phase_id,
            name,
            content,
            now,
            coords.kind.as_str(),
            coords.layer_id,
            coords.domain_id,
            coords.mode_id,
            coords.cue_axis.map(|c| c.as_str()),
        ],
    )?;
    let order_index: i64 = tx.query_row(
        "SELECT order_index FROM alignment_phrases WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
        |row| row.get(0),
    )?;
    tx.commit()?;
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
        deleted_at: None,
        kind: coords.kind,
        layer_id: coords.layer_id.clone(),
        domain_id: coords.domain_id.clone(),
        mode_id: coords.mode_id.clone(),
        cue_axis: coords.cue_axis,
        content_revised_at: None,
    })
}

/// Rename / edit the body / re-coordinate an existing alignment phrase.
/// phase_id, is_default, order_index and usage stats are left untouched (parity
/// with the macro/modifier edit path).
///
/// Three ADR-029 rules live here. The first two are about keeping the drift
/// ledger's split point honest; the third is about not destroying data an
/// unaware caller never mentioned:
///
///   * `content_revised_at` is stamped ONLY when `content` actually differs from
///     what is stored. Renaming, re-coordinating and setting a default are not
///     revisions; if they moved the split point, every ledger segment would be
///     cut by noise instead of by the edit the user is trying to evaluate.
///   * `notes` — the "迭代说明" column that has had a type and an export slot
///     since v0.3 and no writer at all — is written in the same call, because a
///     revision and its reason belong to one action. `None` leaves it alone
///     rather than clearing it, so a rename cannot silently drop the note
///     attached to an earlier revision.
///   * `coords` is `Option`, and OMITTED IS NOT THE SAME AS EMPTY. `None` leaves
///     `kind` and all four coordinate columns exactly as they are — which is
///     what the name/content editor sends, and what stops it from silently
///     demoting a live cue to an opening phrase and blanking its axis. `Some`
///     writes all five verbatim, so an explicit NULL in a coordinate really does
///     clear it: that is the only way the UI can remove a coordinate at all.
pub fn update_alignment_phrase(
    conn: &Connection,
    id: &str,
    name: &str,
    content: &str,
    notes: Option<&str>,
    coords: Option<&AlignmentPhraseCoordinates>,
) -> RepoResult<()> {
    let tx = conn.unchecked_transaction()?;
    if let Some(coords) = coords {
        validate_coordinates(&tx, coords)?;
    }
    let stored: Option<String> = tx
        .query_row(
            "SELECT content FROM alignment_phrases WHERE id = ?1 AND deleted_at IS NULL",
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    let Some(stored) = stored else {
        return Err(missing_alignment_phrase(id));
    };
    // Compared in Rust rather than in the UPDATE's CASE expression: the rule is
    // the point of the column, and it should be readable without knowing that
    // SQLite evaluates SET right-hand sides against the pre-update row.
    let revised_at = if stored == content {
        None
    } else {
        Some(Utc::now().to_rfc3339())
    };
    let changed = tx.execute(
        "UPDATE alignment_phrases
            SET name = ?2,
                content = ?3,
                notes = COALESCE(?4, notes),
                content_revised_at = COALESCE(?5, content_revised_at)
         WHERE id = ?1 AND deleted_at IS NULL",
        params![id, name, content, notes, revised_at],
    )?;
    if changed == 0 {
        return Err(missing_alignment_phrase(id));
    }
    // A SECOND statement rather than a `COALESCE(?, kind)` in the first, because
    // COALESCE cannot tell "the caller said nothing" from "the caller said
    // NULL" — and here those two must mean opposite things (leave it alone vs
    // clear it). Same transaction, so the pair is still atomic.
    if let Some(coords) = coords {
        tx.execute(
            "UPDATE alignment_phrases
                SET kind = ?2, layer_id = ?3, domain_id = ?4, mode_id = ?5, cue_axis = ?6
             WHERE id = ?1 AND deleted_at IS NULL",
            params![
                id,
                coords.kind.as_str(),
                coords.layer_id,
                coords.domain_id,
                coords.mode_id,
                coords.cue_axis.map(|c| c.as_str()),
            ],
        )?;
    }
    tx.commit()?;
    Ok(())
}

/// Move an alignment phrase to the trash (ADR-028): an in-place `deleted_at`
/// stamp, not a row removal. Still rejects the phase default (is_default=1) —
/// every phase must keep exactly one protocol default (D-c), and ADR-028 does not
/// reopen that. A phrase already in the trash is a no-op.
pub fn delete_alignment_phrase(conn: &Connection, id: &str) -> RepoResult<()> {
    // soft-delete-gate: exempt — the delete path must see trashed rows to tell
    // "already in the trash" (a no-op) apart from "no such id" (an error), and to
    // avoid re-reporting the default guard for a row nobody can act on.
    let row: Option<(i64, Option<String>)> = conn
        .query_row(
            "SELECT is_default, deleted_at FROM alignment_phrases WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    match row {
        None => Err(missing_alignment_phrase(id)),
        // Already in the trash: nothing to do, and the default guard below would
        // be answering about a row that is not on screen anyway.
        Some((_, Some(_))) => Ok(()),
        Some((flag, None)) if flag != 0 => {
            Err(RepoError::DefaultAlignmentPhraseProtected(id.to_string()))
        }
        Some(_) => {
            crate::soft_delete::soft_delete_row(conn, "alignment_phrases", id)?;
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
            "UPDATE alignment_phrases SET order_index = ?2
             WHERE id = ?1 AND phase_id = ?3 AND deleted_at IS NULL",
            params![id, idx as i64, phase_id],
        )?;
        if changed == 0 {
            return Err(missing_alignment_phrase(id));
        }
    }
    tx.commit()?;
    Ok(())
}

/// Swap which phrase is a phase's protocol default (P3-6: delete refuses the
/// default and create is always non-default, so without this the seeded default
/// would be locked in forever). One transaction: the old default drops to 0, the
/// target rises to 1 (clear-before-set satisfies the partial unique index of one
/// is_default=1 per phase), and phases.default_alignment_phrase_id follows so
/// the denormalized pointer never drifts. An id that is unknown OR belongs to a
/// different phase is rejected up front (same TargetNotFound contract as
/// reorder), leaving the current default untouched. Idempotent on the current
/// default.
pub fn set_default_alignment_phrase(conn: &Connection, phase_id: &str, id: &str) -> RepoResult<()> {
    let tx = conn.unchecked_transaction()?;
    let in_phase: Option<i64> = tx
        .query_row(
            "SELECT 1 FROM alignment_phrases
             WHERE id = ?1 AND phase_id = ?2 AND deleted_at IS NULL",
            params![id, phase_id],
            |row| row.get(0),
        )
        .optional()?;
    if in_phase.is_none() {
        return Err(missing_alignment_phrase(id));
    }
    tx.execute(
        "UPDATE alignment_phrases SET is_default = 0
         WHERE phase_id = ?1 AND is_default = 1 AND deleted_at IS NULL",
        params![phase_id],
    )?;
    tx.execute(
        "UPDATE alignment_phrases SET is_default = 1
         WHERE id = ?1 AND deleted_at IS NULL",
        params![id],
    )?;
    tx.execute(
        "UPDATE phases SET default_alignment_phrase_id = ?2 WHERE id = ?1",
        params![phase_id, id],
    )?;
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

        let a = create_alignment_phrase(&conn, "phase-diverge", "A", "body", &Default::default()).expect("create a");
        assert_eq!(a.phase_id, "phase-diverge");
        assert!(!a.is_default, "user-authored phrase must be non-default");
        assert_eq!(a.order_index, before_max + 1);

        let b = create_alignment_phrase(&conn, "phase-diverge", "B", "body", &Default::default()).expect("create b");
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

        let div = create_alignment_phrase(&conn, "phase-diverge", "D", "body", &Default::default()).expect("div");
        let und = create_alignment_phrase(&conn, "phase-understand", "U", "body", &Default::default()).expect("und");
        assert_eq!(div.order_index, div_max + 1);
        assert_eq!(und.order_index, und_max + 1);
    }

    #[test]
    fn create_rejects_unknown_phase() {
        let (_dir, conn) = migrated_conn();
        let err =
            create_alignment_phrase(&conn, "phase-bogus", "X", "body", &Default::default()).expect_err("unknown phase");
        // Surfaced as a rusqlite FK violation wrapped in RepoError.
        assert!(matches!(err, RepoError::Sqlite(_)), "got {err:?}");
    }

    #[test]
    fn update_edits_name_and_content() {
        let (_dir, conn) = migrated_conn();
        let created =
            create_alignment_phrase(&conn, "phase-diverge", "Old", "old body", &Default::default()).expect("create");
        update_alignment_phrase(&conn, &created.id, "Renamed", "new body", None, Some(&Default::default())).expect("update");

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
        let err = update_alignment_phrase(&conn, "nope", "x", "y", None, Some(&Default::default())).expect_err("missing");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn delete_removes_non_default_row() {
        let (_dir, conn) = migrated_conn();
        let created =
            create_alignment_phrase(&conn, "phase-diverge", "Doomed", "body", &Default::default()).expect("create");
        delete_alignment_phrase(&conn, &created.id).expect("delete");
        assert!(
            repo::list_alignment_phrases(&conn)
                .expect("list")
                .iter()
                .all(|a| a.id != created.id),
            "deleted phrase must not be listed"
        );
        // ADR-028: the row is soft-deleted, so it is still there with
        // `deleted_at` set, and deleting again is a no-op rather than an error —
        // the shape the drafts soft delete has had since `0003` (`mark_discarded`
        // guards on the opposite status).
        delete_alignment_phrase(&conn, &created.id).expect("second delete is a no-op");
        let stamped: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM alignment_phrases WHERE id = ?1 AND deleted_at IS NOT NULL",
                [&created.id],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(stamped, 1, "row must survive with deleted_at set");
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
        let a = create_alignment_phrase(&conn, "phase-diverge", "a", "b", &Default::default()).expect("a");
        let b = create_alignment_phrase(&conn, "phase-diverge", "b", "b", &Default::default()).expect("b");
        let c = create_alignment_phrase(&conn, "phase-diverge", "c", "b", &Default::default()).expect("c");
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
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn reorder_rejects_id_from_other_phase() {
        let (_dir, conn) = migrated_conn();
        let div = create_alignment_phrase(&conn, "phase-diverge", "div", "b", &Default::default()).expect("div");
        // Reordering the understand phase must not accept a diverge id.
        let err =
            reorder_alignment_phrases(&conn, "phase-understand", std::slice::from_ref(&div.id))
                .expect_err("cross-phase id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    fn phase_default_pointer(conn: &Connection, phase_id: &str) -> Option<String> {
        repo::list_phases(conn)
            .expect("list phases")
            .into_iter()
            .find(|p| p.id == phase_id)
            .expect("phase present")
            .default_alignment_phrase_id
    }

    #[test]
    fn set_default_swaps_flag_and_phase_pointer_in_one_call() {
        let (_dir, conn) = migrated_conn();
        let old_default = phase(&conn, "phase-diverge")
            .into_iter()
            .find(|a| a.is_default)
            .expect("seed default present");
        let promoted =
            create_alignment_phrase(&conn, "phase-diverge", "New default", "body", &Default::default()).expect("create");

        set_default_alignment_phrase(&conn, "phase-diverge", &promoted.id).expect("set default");

        let after = phase(&conn, "phase-diverge");
        let defaults: Vec<&AlignmentPhrase> = after.iter().filter(|a| a.is_default).collect();
        assert_eq!(defaults.len(), 1, "exactly one default per phase");
        assert_eq!(defaults[0].id, promoted.id);
        assert!(
            !after
                .iter()
                .find(|a| a.id == old_default.id)
                .expect("old default still listed")
                .is_default,
            "old default must be demoted, not deleted"
        );
        assert_eq!(
            phase_default_pointer(&conn, "phase-diverge"),
            Some(promoted.id.clone()),
            "phases.default_alignment_phrase_id must follow the swap"
        );

        // The demoted phrase is now deletable (delete refuses only the default).
        delete_alignment_phrase(&conn, &old_default.id).expect("old default deletable after swap");
    }

    #[test]
    fn set_default_is_idempotent_on_current_default() {
        let (_dir, conn) = migrated_conn();
        let default = phase(&conn, "phase-diverge")
            .into_iter()
            .find(|a| a.is_default)
            .expect("seed default present");
        set_default_alignment_phrase(&conn, "phase-diverge", &default.id).expect("idempotent");
        let defaults: Vec<AlignmentPhrase> = phase(&conn, "phase-diverge")
            .into_iter()
            .filter(|a| a.is_default)
            .collect();
        assert_eq!(defaults.len(), 1);
        assert_eq!(defaults[0].id, default.id);
    }

    #[test]
    fn set_default_missing_id_errors() {
        let (_dir, conn) = migrated_conn();
        let err = set_default_alignment_phrase(&conn, "phase-diverge", "ghost")
            .expect_err("unknown id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn set_default_rejects_cross_phase_id_and_keeps_old_default() {
        let (_dir, conn) = migrated_conn();
        let div = create_alignment_phrase(&conn, "phase-diverge", "div", "b", &Default::default()).expect("div");
        let und_default = phase(&conn, "phase-understand")
            .into_iter()
            .find(|a| a.is_default)
            .expect("seed default present");

        // Promoting a diverge phrase as the understand default must be rejected…
        let err = set_default_alignment_phrase(&conn, "phase-understand", &div.id)
            .expect_err("cross-phase id");
        assert!(
            matches!(err, RepoError::TargetNotFound { .. }),
            "got {err:?}"
        );
        // …and the understand phase keeps its current default (tx never started
        // mutating).
        let still_default = phase(&conn, "phase-understand")
            .into_iter()
            .find(|a| a.is_default)
            .expect("default survives");
        assert_eq!(still_default.id, und_default.id);
    }

    // ── ADR-029: coordinates, kind, and the revision split point ─────────────

    fn coords(layer: Option<&str>, domain: Option<&str>, mode: Option<&str>) -> AlignmentPhraseCoordinates {
        AlignmentPhraseCoordinates {
            kind: repo_core::models::PhraseKind::Opening,
            cue_axis: None,
            layer_id: layer.map(str::to_string),
            domain_id: domain.map(str::to_string),
            mode_id: mode.map(str::to_string),
        }
    }

    fn stored(conn: &Connection, id: &str) -> AlignmentPhrase {
        repo::list_alignment_phrases(conn)
            .expect("list")
            .into_iter()
            .find(|p| p.id == id)
            .expect("phrase must be listed")
    }

    #[test]
    fn create_stores_coordinates_and_kind() {
        let (_dir, conn) = migrated_conn();
        let created = create_alignment_phrase(
            &conn,
            "phase-diverge",
            "架构推演",
            "铺开架构选项",
            &coords(
                Some("axv-layer-architecture"),
                Some("axv-domain-tech"),
                Some("axv-mode-diverge"),
            ),
        )
        .expect("create");
        // This is the prototype's "常用档位" and it needed no new object: it is
        // one ordinary phrase carrying three coordinates (ADR-029 子决策 2).
        let read = stored(&conn, &created.id);
        assert_eq!(read.layer_id.as_deref(), Some("axv-layer-architecture"));
        assert_eq!(read.domain_id.as_deref(), Some("axv-domain-tech"));
        assert_eq!(read.mode_id.as_deref(), Some("axv-mode-diverge"));
        assert_eq!(read.kind, repo_core::models::PhraseKind::Opening);
        assert_eq!(
            read.content_revised_at, None,
            "a phrase just written has no revision to split on"
        );
    }

    /// The three coordinate columns all point at one table, so the FK alone
    /// cannot tell a layer id in `mode_id` from a correct one. Rejected rather
    /// than coerced: silently dropping it would show the user a coordinate they
    /// thought they set.
    #[test]
    fn a_coordinate_from_the_wrong_axis_is_rejected_and_writes_nothing() {
        let (_dir, conn) = migrated_conn();
        let before: i64 = conn
            .query_row("SELECT COUNT(*) FROM alignment_phrases", [], |r| r.get(0))
            .expect("count");

        let err = create_alignment_phrase(
            &conn,
            "phase-diverge",
            "错位",
            "body",
            // A layer value handed to the mode column.
            &coords(None, None, Some("axv-layer-path")),
        )
        .expect_err("axis mismatch");
        assert!(
            matches!(&err, RepoError::AxisValueMismatch { expected, found, .. }
                     if expected == "mode" && found == "layer"),
            "got {err:?}"
        );
        let after: i64 = conn
            .query_row("SELECT COUNT(*) FROM alignment_phrases", [], |r| r.get(0))
            .expect("count");
        assert_eq!(after, before, "a rejected create must leave no row behind");

        // A coordinate id that does not exist at all reports the ordinary
        // not-found contract, not the mismatch one.
        let err = create_alignment_phrase(
            &conn,
            "phase-diverge",
            "不存在",
            "body",
            &coords(Some("axv-nope"), None, None),
        )
        .expect_err("unknown coordinate");
        assert!(
            matches!(&err, RepoError::TargetNotFound { table, .. } if table == "alignment_axis_values"),
            "got {err:?}"
        );
    }

    #[test]
    fn update_leaves_content_revised_at_alone_when_only_the_name_or_coordinates_change() {
        let (_dir, conn) = migrated_conn();
        let created =
            create_alignment_phrase(&conn, "phase-diverge", "原名", "原文", &Default::default())
                .expect("create");

        // Rename + re-coordinate in one go: neither is a content revision.
        update_alignment_phrase(
            &conn,
            &created.id,
            "改名了",
            "原文",
            None,
            Some(&coords(Some("axv-layer-path"), None, None)),
        )
        .expect("update");

        let read = stored(&conn, &created.id);
        assert_eq!(read.name, "改名了");
        assert_eq!(read.layer_id.as_deref(), Some("axv-layer-path"));
        assert_eq!(
            read.content_revised_at, None,
            "moving the split point on a rename would cut every ledger segment by noise"
        );
    }

    #[test]
    fn update_stamps_content_revised_at_and_the_note_when_the_body_really_changes() {
        let (_dir, conn) = migrated_conn();
        let created =
            create_alignment_phrase(&conn, "phase-diverge", "原名", "原文", &Default::default())
                .expect("create");

        update_alignment_phrase(
            &conn,
            &created.id,
            "原名",
            "改过的正文",
            Some("上一版太笼统"),
            Some(&Default::default()),
        )
        .expect("update");

        let read = stored(&conn, &created.id);
        assert_eq!(read.content, "改过的正文");
        // `notes` — a column with a type, an export slot and no writer at all
        // since v0.3 — finally has one, and it is the same write as the revision.
        assert_eq!(read.notes.as_deref(), Some("上一版太笼统"));
        let revised = read
            .content_revised_at
            .expect("a real content change stamps the split point");

        // A later edit that does NOT change the body leaves both alone.
        update_alignment_phrase(
            &conn,
            &created.id,
            "又改名",
            "改过的正文",
            None,
            Some(&Default::default()),
        )
        .expect("rename only");
        let again = stored(&conn, &created.id);
        assert_eq!(again.content_revised_at, Some(revised));
        assert_eq!(
            again.notes.as_deref(),
            Some("上一版太笼统"),
            "omitting notes must not erase the note from the previous revision"
        );
    }

    #[test]
    fn update_rejects_a_mismatched_coordinate_without_touching_the_row() {
        let (_dir, conn) = migrated_conn();
        let created =
            create_alignment_phrase(&conn, "phase-diverge", "原名", "原文", &Default::default())
                .expect("create");

        let err = update_alignment_phrase(
            &conn,
            &created.id,
            "新名",
            "新正文",
            None,
            Some(&coords(Some("axv-mode-diverge"), None, None)),
        )
        .expect_err("a mode value in the layer column");
        assert!(matches!(err, RepoError::AxisValueMismatch { .. }), "got {err:?}");

        let read = stored(&conn, &created.id);
        assert_eq!(read.name, "原名");
        assert_eq!(read.content, "原文");
        assert_eq!(read.content_revised_at, None);
    }

    /// The regression this Option exists for. The name/content editor sends no
    /// coordinates payload at all; before this, that was read as "an opening
    /// phrase with no coordinates" and a rename QUIETLY demoted a live cue —
    /// wiping its `kind` and `cue_axis`, and with them its place in the drift
    /// ledger. usage_records is append-only, so nothing downstream would ever
    /// have noticed.
    #[test]
    fn update_without_a_coordinates_payload_leaves_kind_and_coordinates_alone() {
        let (_dir, conn) = migrated_conn();
        // Give a seeded cue coordinates too, so all five columns are non-default
        // and a silent overwrite would be unmistakable.
        conn.execute(
            "UPDATE alignment_phrases SET layer_id = 'axv-layer-path',
                    domain_id = 'axv-domain-tech', mode_id = 'axv-mode-converge'
             WHERE id = 'ap-live-shift-layer'",
            [],
        )
        .expect("coordinate the cue");

        update_alignment_phrase(
            &conn,
            "ap-live-shift-layer",
            "换层：实现层",
            "换层：实现层",
            None,
            // No coordinates payload — exactly what the name/content editor sends.
            None,
        )
        .expect("rename");

        let read = stored(&conn, "ap-live-shift-layer");
        assert_eq!(read.name, "换层：实现层");
        assert_eq!(
            read.kind,
            repo_core::models::PhraseKind::Cue,
            "a rename must not turn a cue into an opening phrase"
        );
        assert_eq!(
            read.cue_axis,
            Some(repo_core::models::CueAxis::Layer),
            "a rename must not erase which axis the cue corrects"
        );
        assert_eq!(read.layer_id.as_deref(), Some("axv-layer-path"));
        assert_eq!(read.domain_id.as_deref(), Some("axv-domain-tech"));
        assert_eq!(read.mode_id.as_deref(), Some("axv-mode-converge"));
        // The content DID change, so the split point still moves.
        assert!(read.content_revised_at.is_some());
    }

    /// The other half of the same distinction: an explicit payload of NULLs is a
    /// real instruction and must clear the columns. Without this, the UI would
    /// have no way to remove a coordinate once set.
    #[test]
    fn an_explicit_coordinates_payload_of_nulls_clears_them() {
        let (_dir, conn) = migrated_conn();
        conn.execute(
            "UPDATE alignment_phrases SET layer_id = 'axv-layer-path',
                    domain_id = 'axv-domain-tech'
             WHERE id = 'ap-form-explore'",
            [],
        )
        .expect("coordinate a phrase");

        update_alignment_phrase(
            &conn,
            "ap-form-explore",
            "探讨",
            &stored(&conn, "ap-form-explore").content,
            None,
            Some(&coords(None, None, None)),
        )
        .expect("clear coordinates");

        let read = stored(&conn, "ap-form-explore");
        assert_eq!(read.layer_id, None);
        assert_eq!(read.domain_id, None);
        assert_eq!(read.mode_id, None);
        assert_eq!(
            read.content_revised_at, None,
            "clearing coordinates is not a content revision"
        );
    }
}
