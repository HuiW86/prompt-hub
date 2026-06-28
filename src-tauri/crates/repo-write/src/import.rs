use rusqlite::{params, Connection};
use serde::Serialize;

use repo_core::error::{RepoError, RepoResult};
use repo_core::export::{ExportBundle, DATA_SCHEMA_VERSION};
use repo_core::models::{
    AlignmentPhrase, Composition, Macro, Modifier, Phase, Phrase, Scene, SubStage,
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
}

// The asset tables a restore wipes, in FK-safe delete order (children first).
// `usage_records` is wiped too — D2 doesn't export it, and its phase_id FK would
// dangle after the phases it points at are replaced. `sops`/`sop_steps`/`drafts`
// are left untouched: SOP has no writes yet (always empty) and drafts is an
// independent MCP staging table, not part of the asset backup.
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

/// Restore a full backup (PRD §7.5 "从 JSON 导入"). Strategy D1=A: a single
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

    insert_modifiers(&tx, &bundle.modifiers)?;
    insert_scenes(&tx, &bundle.scenes)?;
    insert_phases(&tx, &bundle.phases)?;
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
                 created_at, notes, deprecated, order_index)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
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
            ],
        )?;
    }
    Ok(())
}

fn insert_scenes(conn: &Connection, rows: &[Scene]) -> RepoResult<()> {
    for s in rows {
        conn.execute(
            "INSERT INTO scenes (id, name, icon, order_index, visible, role_presets, color)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                s.id,
                s.name,
                s.icon,
                s.order_index,
                s.visible as i64,
                serde_json::to_string(&s.role_presets)?,
                s.color,
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

fn insert_alignment_phrases(conn: &Connection, rows: &[AlignmentPhrase]) -> RepoResult<()> {
    for a in rows {
        conn.execute(
            "INSERT INTO alignment_phrases
                (id, phase_id, name, content, is_default, usage_count, last_used_at,
                 created_at, notes, deprecated, order_index)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
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
            ],
        )?;
    }
    Ok(())
}

fn insert_sub_stages(conn: &Connection, rows: &[SubStage]) -> RepoResult<()> {
    for ss in rows {
        conn.execute(
            "INSERT INTO sub_stages (id, scene_id, name, order_index)
             VALUES (?1, ?2, ?3, ?4)",
            params![ss.id, ss.scene_id, ss.name, ss.order_index],
        )?;
    }
    Ok(())
}

fn insert_phrases(conn: &Connection, rows: &[Phrase]) -> RepoResult<()> {
    for p in rows {
        conn.execute(
            "INSERT INTO phrases
                (id, scene_id, name, content, usage_count, last_used_at, created_at,
                 notes, deprecated, sub_stage_id, order_index)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
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
                 last_used_at, created_at, notes, scene_id, deprecated, order_index)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
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
                 last_used_at, created_at, notes, deprecated, order_index)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
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
        assert_eq!(summary.phases, 8);
        assert_eq!(summary.alignment_phrases, 8);
        assert_eq!(summary.macros, 4);
        assert_eq!(summary.scenes, 3);

        // The DB still holds exactly the seed after a self-restore.
        let phases: i64 = conn
            .query_row("SELECT COUNT(*) FROM phases", [], |r| r.get(0))
            .expect("count");
        assert_eq!(phases, 8);
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
        assert_eq!(phases, 8, "rollback must leave the original data intact");
    }
}
