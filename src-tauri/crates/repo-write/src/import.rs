use rusqlite::{params, Connection};
use serde::Serialize;

use repo_core::error::{RepoError, RepoResult};
use repo_core::export::{ExportBundle, DATA_SCHEMA_VERSION};
use repo_core::models::{
    AlignmentAxisValue, AlignmentPhrase, Composition, Macro, Modifier, Phase, Phrase, Scene,
    SubStage,
};

// Per-table row counts written by a restore, returned to the UI so it can report
// "imported N modifiers, M macros, …".
#[derive(Debug, Default, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    pub modifiers: usize,
    pub macros: usize,
    pub scenes: usize,
    pub sub_stages: usize,
    pub phrases: usize,
    pub phases: usize,
    pub alignment_phrases: usize,
    pub compositions: usize,
    // ADR-029. `None` when the bundle carried no `alignment_axis_values` key at
    // all (a 1.1 / 1.2 backup): the table was left untouched, and reporting `0`
    // would read as "restored nothing" when the truth is "did not participate".
    pub alignment_axis_values: Option<usize>,
}

// The asset tables a restore wipes, in FK-safe delete order (children first).
// `usage_records` is wiped too — D2 doesn't export it, and its phase_id FK would
// dangle after the phases it points at are replaced. `sops`/`sop_steps`/`drafts`
// are left untouched: SOP has no writes yet (always empty) and drafts is an
// independent MCP staging table, not part of the asset backup. `settings` is
// likewise untouched and must stay that way — wiping it during a restore would
// silently reset the user's wake chord to the default, i.e. an asset import
// would change how the app is summoned (ADR-027). Guarded by
// `import_preserves_machine_local_settings`.
const WIPE_ORDER: &[&str] = &[
    "usage_records",
    "compositions",
    "macros",
    "phrases",
    "sub_stages",
    "alignment_phrases",
    "phases",
    "scenes",
    "modifiers",
];

// `alignment_axis_values` is NOT in WIPE_ORDER, and that is the contract, not an
// oversight (06-prd §6.9 rule ②). It is wiped only when the bundle actually
// carries the key — a missing key means the file predates 1.3 and has nothing to
// restore, so clearing the table would delete the user's whole coordinate system
// to replace it with nothing. A key that is present but empty DOES wipe: that is
// a user who really has no axis values. Missing ≠ empty, the same distinction
// `sops` and `usage_records` already rely on.
const AXIS_VALUES_TABLE: &str = "alignment_axis_values";

/// Restore a full backup (PRD §7.5 "从 JSON 导入"). `deleted_at` round-trips
/// verbatim, so a restore reproduces the trash as it was rather than silently
/// resurrecting it (ADR-028 sub-decision 6). Strategy D1=A: a single
/// all-or-nothing transaction wipes every asset table and re-inserts the bundle's
/// rows by their original IDs, so cross-references survive verbatim. `foreign_keys`
/// stay enforced but are deferred to COMMIT, which lets the phases ↔
/// alignment_phrases reference cycle (and any insert order) resolve as a set.
pub fn import_json(conn: &Connection, json: &str) -> RepoResult<ImportSummary> {
    let bundle: ExportBundle = serde_json::from_str(json)?;
    check_schema_version(&bundle.schema_version)?;

    let tx = conn.unchecked_transaction()?;
    // Defer FK checks to COMMIT: clearing parents before children (and the
    // phases ↔ alignment_phrases cycle) would otherwise trip mid-transaction.
    tx.pragma_update(None, "defer_foreign_keys", "ON")?;

    for table in WIPE_ORDER {
        tx.execute(&format!("DELETE FROM {table}"), [])?;
    }
    if bundle.alignment_axis_values.is_some() {
        tx.execute(&format!("DELETE FROM {AXIS_VALUES_TABLE}"), [])?;
    }

    insert_modifiers(&tx, &bundle.modifiers)?;
    insert_scenes(&tx, &bundle.scenes)?;
    insert_phases(&tx, &bundle.phases)?;
    // Before the phrases: their three coordinate columns are FKs into this
    // table. Deferred FK checking would let either order commit, but inserting
    // the parents first keeps the file readable as what it is.
    if let Some(values) = &bundle.alignment_axis_values {
        insert_alignment_axis_values(&tx, values)?;
    }
    insert_alignment_phrases(&tx, &bundle.alignment_phrases)?;
    insert_sub_stages(&tx, &bundle.sub_stages)?;
    insert_phrases(&tx, &bundle.phrases)?;
    insert_macros(&tx, &bundle.macros)?;
    insert_compositions(&tx, &bundle.compositions)?;

    tx.commit()?;

    Ok(ImportSummary {
        modifiers: bundle.modifiers.len(),
        macros: bundle.macros.len(),
        scenes: bundle.scenes.len(),
        sub_stages: bundle.sub_stages.len(),
        phrases: bundle.phrases.len(),
        phases: bundle.phases.len(),
        alignment_phrases: bundle.alignment_phrases.len(),
        compositions: bundle.compositions.len(),
        alignment_axis_values: bundle.alignment_axis_values.as_ref().map(Vec::len),
    })
}

// Accept any backup whose MAJOR version matches this build's. Minor differences
// are backward-compatible by the §7.7.1 contract (serde ignores unknown fields on
// a newer-minor file; a missing array on an older-minor file deserializes empty).
fn check_schema_version(found: &str) -> RepoResult<()> {
    let expected_major = parse_major(DATA_SCHEMA_VERSION)
        .expect("DATA_SCHEMA_VERSION is a valid major.minor constant");
    match parse_major(found) {
        Some(major) if major == expected_major => Ok(()),
        _ => Err(RepoError::ImportSchemaUnsupported {
            found: found.to_string(),
            expected_major,
        }),
    }
}

fn parse_major(v: &str) -> Option<u32> {
    v.split('.').next()?.parse().ok()
}

fn insert_modifiers(conn: &Connection, rows: &[Modifier]) -> RepoResult<()> {
    for m in rows {
        conn.execute(
            "INSERT INTO modifiers
                (id, name, content, group_kind, usage_count, last_used_at,
                 created_at, notes, deprecated, order_index, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                m.id,
                m.name,
                m.content,
                m.group_kind,
                m.usage_count,
                m.last_used_at.map(|t| t.to_rfc3339()),
                m.created_at.to_rfc3339(),
                m.notes,
                m.deprecated as i64,
                m.order_index,
                m.deleted_at.map(|t| t.to_rfc3339()),
            ],
        )?;
    }
    Ok(())
}

fn insert_scenes(conn: &Connection, rows: &[Scene]) -> RepoResult<()> {
    for s in rows {
        conn.execute(
            "INSERT INTO scenes
                (id, name, icon, order_index, visible, role_presets, color, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                s.id,
                s.name,
                s.icon,
                s.order_index,
                s.visible as i64,
                serde_json::to_string(&s.role_presets)?,
                s.color,
                s.deleted_at.map(|t| t.to_rfc3339()),
            ],
        )?;
    }
    Ok(())
}

fn insert_phases(conn: &Connection, rows: &[Phase]) -> RepoResult<()> {
    for p in rows {
        conn.execute(
            "INSERT INTO phases
                (id, name, order_index, color, description, visible, default_alignment_phrase_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                p.id,
                p.name,
                p.order_index,
                p.color,
                p.description,
                p.visible as i64,
                p.default_alignment_phrase_id,
            ],
        )?;
    }
    Ok(())
}

fn insert_alignment_axis_values(conn: &Connection, rows: &[AlignmentAxisValue]) -> RepoResult<()> {
    for v in rows {
        conn.execute(
            "INSERT INTO alignment_axis_values (id, axis, name, hint, order_index)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![v.id, v.axis.as_str(), v.name, v.hint, v.order_index],
        )?;
    }
    Ok(())
}

fn insert_alignment_phrases(conn: &Connection, rows: &[AlignmentPhrase]) -> RepoResult<()> {
    for a in rows {
        conn.execute(
            "INSERT INTO alignment_phrases
                (id, phase_id, name, content, is_default, usage_count, last_used_at,
                 created_at, notes, deprecated, order_index, deleted_at,
                 kind, layer_id, domain_id, mode_id, cue_axis, content_revised_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
                     ?16, ?17, ?18)",
            params![
                a.id,
                a.phase_id,
                a.name,
                a.content,
                a.is_default as i64,
                a.usage_count,
                a.last_used_at.map(|t| t.to_rfc3339()),
                a.created_at.to_rfc3339(),
                a.notes,
                a.deprecated as i64,
                a.order_index,
                a.deleted_at.map(|t| t.to_rfc3339()),
                a.kind.as_str(),
                a.layer_id,
                a.domain_id,
                a.mode_id,
                a.cue_axis.map(|c| c.as_str()),
                a.content_revised_at.map(|t| t.to_rfc3339()),
            ],
        )?;
    }
    Ok(())
}

fn insert_sub_stages(conn: &Connection, rows: &[SubStage]) -> RepoResult<()> {
    for ss in rows {
        conn.execute(
            "INSERT INTO sub_stages (id, scene_id, name, order_index, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                ss.id,
                ss.scene_id,
                ss.name,
                ss.order_index,
                ss.deleted_at.map(|t| t.to_rfc3339()),
            ],
        )?;
    }
    Ok(())
}

fn insert_phrases(conn: &Connection, rows: &[Phrase]) -> RepoResult<()> {
    for p in rows {
        conn.execute(
            "INSERT INTO phrases
                (id, scene_id, name, content, usage_count, last_used_at, created_at,
                 notes, deprecated, sub_stage_id, order_index, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                p.id,
                p.scene_id,
                p.name,
                p.content,
                p.usage_count,
                p.last_used_at.map(|t| t.to_rfc3339()),
                p.created_at.to_rfc3339(),
                p.notes,
                p.deprecated as i64,
                p.sub_stage_id,
                p.order_index,
                p.deleted_at.map(|t| t.to_rfc3339()),
            ],
        )?;
    }
    Ok(())
}

fn insert_macros(conn: &Connection, rows: &[Macro]) -> RepoResult<()> {
    for m in rows {
        let expand_from = m
            .expand_from
            .as_ref()
            .map(serde_json::to_string)
            .transpose()?;
        conn.execute(
            "INSERT INTO macros
                (id, name, content, expand_from, native, role, task, usage_count,
                 last_used_at, created_at, notes, scene_id, deprecated, order_index,
                 deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                m.id,
                m.name,
                m.content,
                expand_from,
                m.native as i64,
                m.role,
                m.task,
                m.usage_count,
                m.last_used_at.map(|t| t.to_rfc3339()),
                m.created_at.to_rfc3339(),
                m.notes,
                m.scene_id,
                m.deprecated as i64,
                m.order_index,
                m.deleted_at.map(|t| t.to_rfc3339()),
            ],
        )?;
    }
    Ok(())
}

fn insert_compositions(conn: &Connection, rows: &[Composition]) -> RepoResult<()> {
    for c in rows {
        conn.execute(
            "INSERT INTO compositions
                (id, name, modifier_ids, phase_id, scene_id, usage_count,
                 last_used_at, created_at, notes, deprecated, order_index, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                c.id,
                c.name,
                serde_json::to_string(&c.modifier_ids)?,
                c.phase_id,
                c.scene_id,
                c.usage_count,
                c.last_used_at.map(|t| t.to_rfc3339()),
                c.created_at.to_rfc3339(),
                c.notes,
                c.deprecated as i64,
                c.order_index,
                c.deleted_at.map(|t| t.to_rfc3339()),
            ],
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use repo_core::db;
    use repo_core::export::export_json;

    fn migrated_conn() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("prompt-hub.db");
        let conn = db::open_and_migrate(&path).expect("migrate");
        (dir, conn)
    }

    #[test]
    fn round_trip_export_then_import_preserves_seed_counts() {
        let (_dir, conn) = migrated_conn();
        let json = export_json(&conn).expect("export");
        let summary = import_json(&conn, &json).expect("import");
        assert_eq!(summary.phases, 9);
        assert_eq!(summary.alignment_phrases, 20);
        assert_eq!(summary.macros, 4);
        assert_eq!(summary.scenes, 3);
        assert_eq!(summary.alignment_axis_values, Some(16));

        // The DB still holds exactly the seed after a self-restore.
        let phases: i64 = conn
            .query_row("SELECT COUNT(*) FROM phases", [], |r| r.get(0))
            .expect("count");
        assert_eq!(phases, 9);
    }

    #[test]
    fn import_replaces_existing_data_wholesale() {
        let (_dir, conn) = migrated_conn();
        let backup = export_json(&conn).expect("export seed");

        // Add a macro AFTER the backup snapshot; a restore must erase it.
        conn.execute(
            "INSERT INTO macros (id, name, content, native, created_at, order_index)
             VALUES ('extra', 'Extra', 'body', 1, '2026-01-01T00:00:00Z', 99)",
            [],
        )
        .expect("insert extra");
        let before: i64 = conn
            .query_row("SELECT COUNT(*) FROM macros", [], |r| r.get(0))
            .expect("count");
        assert_eq!(before, 5);

        import_json(&conn, &backup).expect("restore");
        let after: i64 = conn
            .query_row("SELECT COUNT(*) FROM macros WHERE id = 'extra'", [], |r| {
                r.get(0)
            })
            .expect("count");
        assert_eq!(after, 0, "post-snapshot macro must be wiped by restore");
    }

    #[test]
    fn import_preserves_machine_local_settings() {
        // ADR-027: `settings` is machine-local config, not a portable asset.
        // Restoring an asset backup must not change how the app is summoned.
        let (_dir, conn) = migrated_conn();
        repo_core::settings::set_global_hotkey(&conn, "Ctrl+Shift+P").expect("set hotkey");
        let backup = export_json(&conn).expect("export seed");

        import_json(&conn, &backup).expect("restore");

        assert_eq!(
            repo_core::settings::global_hotkey(&conn).expect("read hotkey"),
            "Ctrl+Shift+P",
            "a wipe-and-restore must not reset the user's wake chord"
        );
    }

    #[test]
    fn import_restores_deprecated_and_invisible_rows() {
        let (_dir, conn) = migrated_conn();
        // Deprecate a macro and hide a scene, then snapshot — the full backup must
        // carry both so the restore reinstates them (not just visible rows).
        conn.execute("UPDATE macros SET deprecated = 1 WHERE id IN (SELECT id FROM macros LIMIT 1)", [])
            .expect("deprecate");
        conn.execute("UPDATE scenes SET visible = 0 WHERE id IN (SELECT id FROM scenes LIMIT 1)", [])
            .expect("hide");
        let backup = export_json(&conn).expect("export");

        import_json(&conn, &backup).expect("restore");
        let deprecated: i64 = conn
            .query_row("SELECT COUNT(*) FROM macros WHERE deprecated = 1", [], |r| {
                r.get(0)
            })
            .expect("count");
        let hidden: i64 = conn
            .query_row("SELECT COUNT(*) FROM scenes WHERE visible = 0", [], |r| {
                r.get(0)
            })
            .expect("count");
        assert_eq!(deprecated, 1);
        assert_eq!(hidden, 1);
    }

    #[test]
    fn import_rejects_incompatible_major_version() {
        let (_dir, conn) = migrated_conn();
        let mut json: serde_json::Value =
            serde_json::from_str(&export_json(&conn).expect("export")).expect("parse");
        json["schema_version"] = serde_json::json!("2.0");
        let err = import_json(&conn, &json.to_string()).expect_err("must reject");
        assert!(
            matches!(err, RepoError::ImportSchemaUnsupported { .. }),
            "got {err:?}"
        );
    }

    #[test]
    fn import_is_atomic_on_bad_payload() {
        let (_dir, conn) = migrated_conn();
        // A phrase referencing a scene that the bundle never inserts violates the FK
        // at COMMIT; the whole restore must roll back, leaving the seed intact.
        let mut json: serde_json::Value =
            serde_json::from_str(&export_json(&conn).expect("export")).expect("parse");
        json["phrases"]
            .as_array_mut()
            .expect("array")
            .push(serde_json::json!({
                "id": "orphan",
                "sceneId": "no-such-scene",
                "name": "Orphan",
                "content": "body",
                "usageCount": 0,
                "lastUsedAt": null,
                "createdAt": "2026-01-01T00:00:00Z",
                "notes": null,
                "deprecated": false,
                "subStageId": null,
                "orderIndex": 0
            }));
        let err = import_json(&conn, &json.to_string()).expect_err("FK violation");
        assert!(matches!(err, RepoError::Sqlite(_)), "got {err:?}");

        // Seed survives: the failed transaction rolled back cleanly.
        let phases: i64 = conn
            .query_row("SELECT COUNT(*) FROM phases", [], |r| r.get(0))
            .expect("count");
        assert_eq!(phases, 9, "rollback must leave the original data intact");
    }

    // ── ADR-029: data schema 1.3 ────────────────────────────────────────────

    /// Rule ① of 06-prd §6.9: a bundle with NO `alignment_axis_values` key must
    /// still deserialize. 1.0 → 1.1 was the last time a top-level key appeared,
    /// so this path — "MAJOR matches, minor is older, a whole key is absent" —
    /// has never actually been exercised before.
    ///
    /// Rule ②: that same absent key must leave the table ALONE. Wiping it would
    /// destroy the user's entire coordinate system to restore a file that does
    /// not contain one.
    #[test]
    fn importing_a_1_2_bundle_without_the_key_leaves_the_axis_table_untouched() {
        let (_dir, conn) = migrated_conn();
        // A user-added axis value, so "untouched" means something beyond the seed.
        conn.execute(
            "INSERT INTO alignment_axis_values (id, axis, name, hint, order_index)
             VALUES ('axv-mine', 'mode', '试探', NULL, 3)",
            [],
        )
        .expect("add a value");
        let before: i64 = conn
            .query_row("SELECT COUNT(*) FROM alignment_axis_values", [], |r| r.get(0))
            .expect("count");
        assert_eq!(before, 17);

        // Strip the key and the six new phrase fields, exactly as a backup taken
        // by the previous release would look.
        let mut json: serde_json::Value =
            serde_json::from_str(&export_json(&conn).expect("export")).expect("parse");
        json["schema_version"] = serde_json::json!("1.2");
        json.as_object_mut()
            .expect("object")
            .remove("alignment_axis_values");
        for phrase in json["alignment_phrases"].as_array_mut().expect("array") {
            let obj = phrase.as_object_mut().expect("object");
            for key in [
                "kind",
                "layerId",
                "domainId",
                "modeId",
                "cueAxis",
                "contentRevisedAt",
            ] {
                obj.remove(key);
            }
        }

        let summary = import_json(&conn, &json.to_string()).expect("restore a 1.2 backup");
        assert_eq!(
            summary.alignment_axis_values, None,
            "the table did not take part, which is not the same as restoring zero rows"
        );
        let after: i64 = conn
            .query_row("SELECT COUNT(*) FROM alignment_axis_values", [], |r| r.get(0))
            .expect("count");
        assert_eq!(after, 17, "an older backup must not clear the coordinate system");

        // The phrases came back with the documented defaults for the missing
        // fields: opening, uncoordinated, never revised.
        let (kind, layer, revised): (String, Option<String>, Option<String>) = conn
            .query_row(
                "SELECT kind, layer_id, content_revised_at FROM alignment_phrases
                 WHERE id = 'ap-live-stop'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .expect("read");
        assert_eq!(kind, "opening");
        assert_eq!(layer, None);
        assert_eq!(revised, None);
    }

    /// The other half of rule ②: a key that IS present, even as an empty array,
    /// means the user genuinely has no axis values and the table is replaced.
    /// Missing ≠ empty.
    #[test]
    fn importing_a_bundle_with_an_empty_axis_array_wipes_the_table() {
        let (_dir, conn) = migrated_conn();
        let mut json: serde_json::Value =
            serde_json::from_str(&export_json(&conn).expect("export")).expect("parse");
        json["alignment_axis_values"] = serde_json::json!([]);
        // The phrases in this bundle carry no coordinates (the seed sets none),
        // so emptying the table leaves nothing dangling.
        let summary = import_json(&conn, &json.to_string()).expect("restore");
        assert_eq!(summary.alignment_axis_values, Some(0));
        let after: i64 = conn
            .query_row("SELECT COUNT(*) FROM alignment_axis_values", [], |r| r.get(0))
            .expect("count");
        assert_eq!(after, 0);
    }

    /// Full fidelity for the new fields: coordinates, kind, cue axis and the
    /// revision stamp all survive a wipe-and-restore, ids and all.
    #[test]
    fn round_trip_preserves_coordinates_kind_and_the_revision_stamp() {
        let (_dir, conn) = migrated_conn();
        conn.execute(
            "UPDATE alignment_phrases
                SET layer_id = 'axv-layer-architecture',
                    domain_id = 'axv-domain-tech',
                    mode_id = 'axv-mode-diverge',
                    notes = '第二版',
                    content_revised_at = '2026-09-05T10:00:00+00:00'
             WHERE id = 'ap-form-explore'",
            [],
        )
        .expect("coordinate a phrase");

        let json = export_json(&conn).expect("export");
        let summary = import_json(&conn, &json).expect("restore");
        assert_eq!(summary.alignment_axis_values, Some(16));

        let restored: Vec<Option<String>> = conn
            .query_row(
                "SELECT kind, layer_id, domain_id, mode_id, notes, content_revised_at
                 FROM alignment_phrases WHERE id = 'ap-form-explore'",
                [],
                |r| {
                    (0..6)
                        .map(|i| r.get::<_, Option<String>>(i))
                        .collect::<rusqlite::Result<Vec<_>>>()
                },
            )
            .expect("read back");
        assert_eq!(restored[0].as_deref(), Some("opening"));
        assert_eq!(restored[1].as_deref(), Some("axv-layer-architecture"));
        assert_eq!(restored[2].as_deref(), Some("axv-domain-tech"));
        assert_eq!(restored[3].as_deref(), Some("axv-mode-diverge"));
        assert_eq!(restored[4].as_deref(), Some("第二版"));
        assert!(restored[5].is_some(), "the revision stamp round-trips");

        // The cues keep their class and their axis, and 「停」 keeps its blank.
        let cues: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM alignment_phrases WHERE kind = 'cue'",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(cues, 6);
        let stop_axis: Option<String> = conn
            .query_row(
                "SELECT cue_axis FROM alignment_phrases WHERE id = 'ap-live-stop'",
                [],
                |r| r.get(0),
            )
            .expect("read");
        assert_eq!(stop_axis, None);
        let layer_cues: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM alignment_phrases WHERE cue_axis = 'layer'",
                [],
                |r| r.get(0),
            )
            .expect("count");
        assert_eq!(layer_cues, 2);
    }

    /// The axis values must be inserted before the phrases that point at them,
    /// and a bundle whose coordinates name a value the bundle does not contain
    /// must fail as a whole rather than land half-restored.
    #[test]
    fn a_coordinate_with_no_matching_axis_value_rolls_the_whole_import_back() {
        let (_dir, conn) = migrated_conn();
        let mut json: serde_json::Value =
            serde_json::from_str(&export_json(&conn).expect("export")).expect("parse");
        json["alignment_phrases"][0]["layerId"] = serde_json::json!("axv-not-in-this-bundle");
        json["alignment_axis_values"] = serde_json::json!([]);

        let err = import_json(&conn, &json.to_string()).expect_err("FK violation at COMMIT");
        assert!(matches!(err, RepoError::Sqlite(_)), "got {err:?}");

        let values: i64 = conn
            .query_row("SELECT COUNT(*) FROM alignment_axis_values", [], |r| r.get(0))
            .expect("count");
        assert_eq!(values, 16, "rollback must leave the seed coordinate system intact");
    }
}
