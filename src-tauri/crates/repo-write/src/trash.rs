use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use repo_core::error::{RepoError, RepoResult};
use repo_core::trash::AssetKind;

// ADR-028 P0: the two write halves of the trash — put a row back, or destroy the
// whole trash. Everything else in this crate only ever moves rows INTO it
// (`soft_delete::soft_delete_row`).
//
// Table names below are interpolated from `AssetKind::table()`, a closed set of
// `&'static str`s; no caller-supplied text ever reaches a statement.

/// How much `purge_trash` destroyed. Returned so the UI can report it — the
/// single irreversible action ADR-028 creates should say what it did.
#[derive(Debug, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PurgeSummary {
    /// Asset rows hard-deleted across the seven tables.
    pub assets: usize,
    /// usage_records rows dropped because their target no longer exists.
    pub usage_records: usize,
}

/// Take one asset back out of the trash: `deleted_at` returns to NULL and the row
/// reappears in its list read at the id, creation time and sort position it always
/// had. Restoring a row that is already alive is a no-op; an unknown id is an error.
///
/// One special case, forced by the unique index migration 0013 rebuilt: an
/// alignment phrase can sit in the trash carrying `is_default = 1` while another
/// phrase has since become its phase's live default. Restoring it as-is would
/// violate `idx_alignment_phrase_one_default_per_phase`, so the restored row is
/// demoted to a normal phrase instead. Failing the restore would be the wrong
/// trade: the user asked for their content back, not for a constraint lecture, and
/// the default is one click to re-appoint.
pub fn restore_asset(conn: &Connection, kind: AssetKind, id: &str) -> RepoResult<()> {
    let table = kind.table();
    let tx = conn.unchecked_transaction()?;

    // soft-delete-gate: exempt — restore only ever addresses rows the rest of the
    // codebase hides; filtering them out here would make the command impossible.
    let deleted_at: Option<Option<String>> = tx
        .query_row(
            &format!("SELECT deleted_at FROM {table} WHERE id = ?1"),
            params![id],
            |row| row.get(0),
        )
        .optional()?;
    match deleted_at {
        None => {
            return Err(RepoError::TargetNotFound {
                table: table.to_string(),
                target_id: id.to_string(),
            })
        }
        // Already alive (double-click, or an undo that raced a refresh).
        Some(None) => {
            tx.commit()?;
            return Ok(());
        }
        Some(Some(_)) => {}
    }

    if kind == AssetKind::AlignmentPhrase {
        demote_if_phase_already_has_a_default(&tx, id)?;
    }

    tx.execute(
        &format!("UPDATE {table} SET deleted_at = NULL WHERE id = ?1"),
        params![id],
    )?;
    tx.commit()?;
    Ok(())
}

/// Clear `is_default` on a trashed alignment phrase when its phase already has a
/// live default. See `restore_asset`'s doc comment for why this demotes rather
/// than fails.
fn demote_if_phase_already_has_a_default(tx: &Connection, id: &str) -> RepoResult<()> {
    // soft-delete-gate: exempt — reads the trashed row that is being restored.
    let row: Option<(String, i64)> = tx
        .query_row(
            "SELECT phase_id, is_default FROM alignment_phrases WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()?;
    let Some((phase_id, is_default)) = row else {
        return Ok(());
    };
    if is_default == 0 {
        return Ok(());
    }
    let live_default: Option<i64> = tx
        .query_row(
            "SELECT 1 FROM alignment_phrases
             WHERE phase_id = ?1 AND is_default = 1 AND id <> ?2 AND deleted_at IS NULL",
            params![phase_id, id],
            |row| row.get(0),
        )
        .optional()?;
    if live_default.is_some() {
        tx.execute(
            "UPDATE alignment_phrases SET is_default = 0 WHERE id = ?1",
            params![id],
        )?;
    }
    Ok(())
}

/// Empty the trash for real. This is the one irreversible action ADR-028 creates
/// (sub-decision 4: nothing expires on its own), so it does all of its work in a
/// single transaction — either the trash is gone or nothing happened.
///
/// Order matters because every foreign key in this schema is bare: no cascade, no
/// SET NULL, so a parent deleted before its children raises instead of cleaning
/// up. Children go first, and the two dangling-reference cases are neutralised
/// before the deletes rather than discovered during them:
///   * a LIVE phrase still pointing at a trashed sub-stage is unbound here — this
///     is the unbind `delete_sub_stage` stopped doing (sub-decision 7), moved to
///     the one moment it is actually required;
///   * `phases.default_alignment_phrase_id` is cleared if it names a trashed
///     phrase, which the delete guard should prevent but an imported bundle can
///     still produce — without this the user could never empty their trash.
///
/// Scenes are the one table with a conditional delete: a scene reached the trash
/// empty, but a stale renderer could have added a live child afterwards, and
/// destroying it then would fail the whole purge. Such a scene is simply left in
/// the trash.
///
/// Finally the usage_records that lost their target are dropped. Until this
/// moment usage history is untouched (sub-decision 5) — that is what lets a
/// restored asset reconnect to its own past by id.
pub fn purge_trash(conn: &Connection) -> RepoResult<PurgeSummary> {
    let tx = conn.unchecked_transaction()?;

    tx.execute(
        "UPDATE phrases SET sub_stage_id = NULL
         WHERE sub_stage_id IN (SELECT id FROM sub_stages WHERE deleted_at IS NOT NULL)",
        [],
    )?;
    tx.execute(
        "UPDATE phases SET default_alignment_phrase_id = NULL
         WHERE default_alignment_phrase_id IN
               (SELECT id FROM alignment_phrases WHERE deleted_at IS NOT NULL)",
        [],
    )?;

    let mut assets = 0usize;
    // Children first: compositions / macros / phrases reference scenes;
    // sub_stages reference scenes; alignment_phrases reference phases (which are
    // never purged). modifiers are referenced by nothing (compositions hold their
    // ids in a JSON column, not an FK), so they go last with the parents.
    for sql in [
        "DELETE FROM compositions WHERE deleted_at IS NOT NULL",
        "DELETE FROM macros WHERE deleted_at IS NOT NULL",
        "DELETE FROM phrases WHERE deleted_at IS NOT NULL",
        "DELETE FROM sub_stages WHERE deleted_at IS NOT NULL",
        "DELETE FROM alignment_phrases WHERE deleted_at IS NOT NULL",
        "DELETE FROM scenes
          WHERE deleted_at IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM phrases      WHERE scene_id = scenes.id)
            AND NOT EXISTS (SELECT 1 FROM sub_stages   WHERE scene_id = scenes.id)
            AND NOT EXISTS (SELECT 1 FROM macros       WHERE scene_id = scenes.id)
            AND NOT EXISTS (SELECT 1 FROM compositions WHERE scene_id = scenes.id)",
        "DELETE FROM modifiers WHERE deleted_at IS NOT NULL",
    ] {
        assets += tx.execute(sql, [])?;
    }

    // Orphans, by target_type. Rows with a NULL target_id (composition uses carry
    // no asset id) can't be orphaned and are left alone.
    let usage_records = tx.execute(
        "DELETE FROM usage_records
         WHERE target_id IS NOT NULL
           AND ((target_type = 'modifier'
                 AND NOT EXISTS (SELECT 1 FROM modifiers WHERE id = usage_records.target_id))
             OR (target_type = 'macro'
                 AND NOT EXISTS (SELECT 1 FROM macros WHERE id = usage_records.target_id))
             OR (target_type = 'phrase'
                 AND NOT EXISTS (SELECT 1 FROM phrases WHERE id = usage_records.target_id))
             OR (target_type = 'composition'
                 AND NOT EXISTS (SELECT 1 FROM compositions WHERE id = usage_records.target_id))
             OR (target_type = 'alignment'
                 AND NOT EXISTS (SELECT 1 FROM alignment_phrases
                                  WHERE id = usage_records.target_id)))",
        [],
    )?;

    tx.commit()?;
    Ok(PurgeSummary {
        assets,
        usage_records,
    })
}
