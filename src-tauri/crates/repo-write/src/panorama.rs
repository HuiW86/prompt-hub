//! Panorama layout writes (I-02, M-01): the upsert behind the placement menu
//! and the three-state import of the `panorama_placements` export key.

use repo_core::panorama::{list_panorama_placements, validate_pin_slot, PanoramaPlacement};
use repo_core::{RepoError, RepoResult};
use rusqlite::{params, Connection};

/// Upsert one item's placement and return the full list afterwards.
///
/// - `group_id` and `pin_slot` both `None` deletes the row.
/// - Taking a pin slot someone else holds clears theirs in the same transaction;
///   it is not an error. The caller sees the displaced item in the returned
///   list (I-04 builds its undo toast from that).
/// - The asset must exist and not be trashed.
pub fn set_panorama_placement(
    conn: &Connection,
    input: PanoramaPlacement,
) -> RepoResult<Vec<PanoramaPlacement>> {
    validate_pin_slot(input.pin_slot)?;
    let kind = input.asset_kind.as_str();
    let tx = conn.unchecked_transaction()?;

    let alive: bool = tx.query_row(
        "SELECT (?1 = 'macro' AND EXISTS (
                   SELECT 1 FROM macros WHERE id = ?2 AND deleted_at IS NULL))
             OR (?1 = 'phrase' AND EXISTS (
                   SELECT 1 FROM phrases WHERE id = ?2 AND deleted_at IS NULL))
             OR (?1 = 'alignment_phrase' AND EXISTS (
                   SELECT 1 FROM alignment_phrases WHERE id = ?2 AND deleted_at IS NULL))
             OR (?1 = 'modifier' AND EXISTS (
                   SELECT 1 FROM modifiers WHERE id = ?2 AND deleted_at IS NULL))
             OR (?1 = 'composition' AND EXISTS (
                   SELECT 1 FROM compositions WHERE id = ?2 AND deleted_at IS NULL))",
        params![kind, input.asset_id],
        |r| r.get(0),
    )?;
    if !alive {
        return Err(RepoError::Other("条目不存在或已删除，请刷新后重试".into()));
    }

    if input.group_id.is_none() && input.pin_slot.is_none() {
        tx.execute(
            "DELETE FROM panorama_placements WHERE asset_kind = ?1 AND asset_id = ?2",
            params![kind, input.asset_id],
        )?;
    } else {
        if let Some(slot) = input.pin_slot {
            tx.execute(
                "UPDATE panorama_placements SET pin_slot = NULL
                 WHERE pin_slot = ?1 AND NOT (asset_kind = ?2 AND asset_id = ?3)",
                params![slot, kind, input.asset_id],
            )?;
            // The displaced row may now say nothing at all; never store that.
            tx.execute(
                "DELETE FROM panorama_placements WHERE group_id IS NULL AND pin_slot IS NULL",
                [],
            )?;
        }
        tx.execute(
            "INSERT INTO panorama_placements (asset_kind, asset_id, group_id, pin_slot)
             VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT (asset_kind, asset_id)
             DO UPDATE SET group_id = excluded.group_id, pin_slot = excluded.pin_slot",
            params![
                kind,
                input.asset_id,
                input.group_id.map(|g| g.as_str()),
                input.pin_slot
            ],
        )?;
    }

    tx.commit()?;
    list_panorama_placements(conn)
}

/// Import half of the three-state contract. Runs inside the import transaction,
/// AFTER every asset table has been restored, so "matches an asset" is judged
/// against the restored library (trashed assets included — they came back too).
///
/// - `None` (key absent, a 1.4-or-older file): keep the local rows that still
///   match an asset, drop the rest. Returns `None`.
/// - `Some(rows)`: replace the table; rows that match no asset are dropped
///   silently. Returns the number of rows actually written.
pub fn import_panorama_placements(
    conn: &Connection,
    rows: Option<&[PanoramaPlacement]>,
) -> RepoResult<Option<usize>> {
    let Some(rows) = rows else {
        delete_dangling_placements(conn)?;
        return Ok(None);
    };
    conn.execute("DELETE FROM panorama_placements", [])?;
    let mut written = 0;
    for p in rows {
        validate_pin_slot(p.pin_slot)?;
        if p.group_id.is_none() && p.pin_slot.is_none() {
            continue;
        }
        written += conn.execute(
            "INSERT INTO panorama_placements (asset_kind, asset_id, group_id, pin_slot)
             SELECT ?1, ?2, ?3, ?4
             WHERE (?1 = 'macro' AND EXISTS (SELECT 1 FROM macros WHERE id = ?2))
                OR (?1 = 'phrase' AND EXISTS (SELECT 1 FROM phrases WHERE id = ?2))
                OR (?1 = 'alignment_phrase' AND EXISTS (
                      SELECT 1 FROM alignment_phrases WHERE id = ?2))
                OR (?1 = 'modifier' AND EXISTS (SELECT 1 FROM modifiers WHERE id = ?2))
                OR (?1 = 'composition' AND EXISTS (SELECT 1 FROM compositions WHERE id = ?2))",
            params![
                p.asset_kind.as_str(),
                p.asset_id,
                p.group_id.map(|g| g.as_str()),
                p.pin_slot
            ],
        )?;
    }
    Ok(Some(written))
}

/// Drop rows whose asset no longer exists in any state (trashed counts as
/// existing). Polymorphic references cannot carry an FK, so this is the cleanup.
pub fn delete_dangling_placements(conn: &Connection) -> RepoResult<usize> {
    Ok(conn.execute(
        "DELETE FROM panorama_placements
         WHERE NOT (
              (asset_kind = 'macro' AND EXISTS (
                 SELECT 1 FROM macros m WHERE m.id = panorama_placements.asset_id))
           OR (asset_kind = 'phrase' AND EXISTS (
                 SELECT 1 FROM phrases m WHERE m.id = panorama_placements.asset_id))
           OR (asset_kind = 'alignment_phrase' AND EXISTS (
                 SELECT 1 FROM alignment_phrases m WHERE m.id = panorama_placements.asset_id))
           OR (asset_kind = 'modifier' AND EXISTS (
                 SELECT 1 FROM modifiers m WHERE m.id = panorama_placements.asset_id))
           OR (asset_kind = 'composition' AND EXISTS (
                 SELECT 1 FROM compositions m WHERE m.id = panorama_placements.asset_id)))",
        [],
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use repo_core::db;
    use repo_core::panorama::{PanoramaAssetKind as K, PanoramaGroupId as G};

    fn conn() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().expect("tempdir");
        let c = db::open_and_migrate(&dir.path().join("prompt-hub.db")).expect("migrate");
        (dir, c)
    }

    fn ids(conn: &Connection, table: &str) -> Vec<String> {
        conn.prepare(&format!("SELECT id FROM {table} ORDER BY id"))
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap()
    }

    fn p(kind: K, id: &str, group: Option<G>, slot: Option<u8>) -> PanoramaPlacement {
        PanoramaPlacement {
            asset_kind: kind,
            asset_id: id.to_string(),
            group_id: group,
            pin_slot: slot,
        }
    }

    #[test]
    fn panorama_set_is_an_upsert() {
        let (_d, c) = conn();
        let m = ids(&c, "macros")[0].clone();
        let out = set_panorama_placement(&c, p(K::Macro, &m, Some(G::Align), None)).unwrap();
        assert_eq!(out, vec![p(K::Macro, &m, Some(G::Align), None)]);
        let out = set_panorama_placement(&c, p(K::Macro, &m, Some(G::Tool), Some(2))).unwrap();
        assert_eq!(out, vec![p(K::Macro, &m, Some(G::Tool), Some(2))]);
    }

    #[test]
    fn panorama_taking_an_occupied_pin_slot_displaces_the_holder() {
        let (_d, c) = conn();
        let macros = ids(&c, "macros");
        let ap = ids(&c, "alignment_phrases")[0].clone();
        set_panorama_placement(&c, p(K::Macro, &macros[0], Some(G::Align), Some(1))).unwrap();
        // Holder with no group: losing the pin leaves nothing, so its row goes.
        set_panorama_placement(&c, p(K::Macro, &macros[1], None, Some(2))).unwrap();

        let out = set_panorama_placement(&c, p(K::AlignmentPhrase, &ap, None, Some(1))).unwrap();
        assert!(out.contains(&p(K::Macro, &macros[0], Some(G::Align), None)));
        assert!(out.contains(&p(K::AlignmentPhrase, &ap, None, Some(1))));

        let out =
            set_panorama_placement(&c, p(K::Macro, &macros[0], Some(G::Align), Some(2))).unwrap();
        assert!(
            out.iter().all(|x| x.asset_id != macros[1]),
            "displaced holder with no group is deleted, not stored empty"
        );
        let stored_empty: i64 = c
            .query_row(
                "SELECT COUNT(*) FROM panorama_placements WHERE group_id IS NULL AND pin_slot IS NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(stored_empty, 0);
    }

    #[test]
    fn panorama_both_null_deletes_the_row() {
        let (_d, c) = conn();
        let m = ids(&c, "macros")[0].clone();
        set_panorama_placement(&c, p(K::Macro, &m, Some(G::Retain), Some(5))).unwrap();
        let out = set_panorama_placement(&c, p(K::Macro, &m, None, None)).unwrap();
        assert!(out.is_empty());
        // Deleting a row that does not exist is a no-op, not an error.
        set_panorama_placement(&c, p(K::Macro, &m, None, None)).unwrap();
    }

    #[test]
    fn panorama_rows_of_trashed_assets_are_hidden_and_come_back_on_restore() {
        let (_d, c) = conn();
        let m = ids(&c, "macros")[0].clone();
        set_panorama_placement(&c, p(K::Macro, &m, Some(G::Execute), Some(4))).unwrap();
        crate::delete_macro(&c, &m).unwrap();
        assert!(list_panorama_placements(&c).unwrap().is_empty());
        assert!(
            set_panorama_placement(&c, p(K::Macro, &m, Some(G::Align), None)).is_err(),
            "a trashed asset cannot be placed"
        );
        crate::restore_asset(&c, repo_core::AssetKind::Macro, &m).unwrap();
        assert_eq!(
            list_panorama_placements(&c).unwrap(),
            vec![p(K::Macro, &m, Some(G::Execute), Some(4))]
        );
    }

    #[test]
    fn panorama_rejects_unknown_assets_and_out_of_range_slots() {
        let (_d, c) = conn();
        let m = ids(&c, "macros")[0].clone();
        assert!(set_panorama_placement(&c, p(K::Macro, "nope", Some(G::Align), None)).is_err());
        // Right id, wrong kind: the reference is (kind, id), not id alone.
        assert!(set_panorama_placement(&c, p(K::Phrase, &m, Some(G::Align), None)).is_err());
        assert!(set_panorama_placement(&c, p(K::Macro, &m, None, Some(0))).is_err());
        assert!(set_panorama_placement(&c, p(K::Macro, &m, None, Some(10))).is_err());
        assert!(list_panorama_placements(&c).unwrap().is_empty());
    }

    #[test]
    fn panorama_wire_format_is_camel_case_with_snake_case_enums() {
        let json = serde_json::to_value(p(K::AlignmentPhrase, "x", Some(G::Cue), Some(9))).unwrap();
        assert_eq!(
            json,
            serde_json::json!({
                "assetKind": "alignment_phrase",
                "assetId": "x",
                "groupId": "cue",
                "pinSlot": 9
            })
        );
    }
}
