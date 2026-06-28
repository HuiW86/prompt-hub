use chrono::{DateTime, Utc};
use rusqlite::{Connection, Row};
use serde::{Deserialize, Serialize};

use crate::error::RepoResult;
use crate::models::{
    AlignmentPhrase, Composition, Macro, Modifier, Phase, Phrase, Scene, SubStage,
};
use crate::repo::{parse_ts, parse_ts_opt};

// The data-layer schema version of the export envelope (PRD §6.9 / §7.7). This is
// the `major.minor` contract for the JSON file itself, NOT the SQLite migration
// `user_version` (currently 11). Bump it when the export shape changes; minor for
// backward-compatible additions, major for breaking changes.
pub const DATA_SCHEMA_VERSION: &str = "1.1";

// The full-fidelity backup envelope (PRD §6.9). Unlike the read paths in `repo`,
// every list here is UNFILTERED — deprecated assets and invisible phases/scenes
// are included, so a wipe-and-restore round-trip never silently drops rows.
//
// Excluded vs PRD §6.9: `sops` (no SOP model/table writes shipped yet) and
// `usage_records` (D2 — usage history is non-portable churn; per-asset usage_count
// already round-trips). Both keys are simply absent rather than empty arrays.
#[derive(Debug, Serialize, Deserialize)]
pub struct ExportBundle {
    pub schema_version: String,
    pub exported_at: DateTime<Utc>,
    pub modifiers: Vec<Modifier>,
    pub macros: Vec<Macro>,
    pub scenes: Vec<Scene>,
    pub sub_stages: Vec<SubStage>,
    pub phrases: Vec<Phrase>,
    pub phases: Vec<Phase>,
    pub alignment_phrases: Vec<AlignmentPhrase>,
    pub compositions: Vec<Composition>,
}

/// Read every asset table at full fidelity and assemble the §6.9 export envelope.
pub fn export_bundle(conn: &Connection) -> RepoResult<ExportBundle> {
    Ok(ExportBundle {
        schema_version: DATA_SCHEMA_VERSION.to_string(),
        exported_at: Utc::now(),
        modifiers: export_modifiers(conn)?,
        macros: export_macros(conn)?,
        scenes: export_scenes(conn)?,
        sub_stages: export_sub_stages(conn)?,
        phrases: export_phrases(conn)?,
        phases: export_phases(conn)?,
        alignment_phrases: export_alignment_phrases(conn)?,
        compositions: export_compositions(conn)?,
    })
}

/// Serialize the whole database to a pretty-printed JSON string (PRD §7.5
/// "导出全部数据" one-click backup).
pub fn export_json(conn: &Connection) -> RepoResult<String> {
    let bundle = export_bundle(conn)?;
    Ok(serde_json::to_string_pretty(&bundle)?)
}

fn export_modifiers(conn: &Connection) -> RepoResult<Vec<Modifier>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, content, group_kind, usage_count, last_used_at,
                created_at, notes, deprecated, order_index
         FROM modifiers
         ORDER BY group_kind ASC, order_index ASC, created_at ASC",
    )?;
    let raw = stmt.query_map([], |row| {
        Ok((
            Modifier {
                id: row.get("id")?,
                name: row.get("name")?,
                content: row.get("content")?,
                group_kind: row.get("group_kind")?,
                usage_count: row.get("usage_count")?,
                last_used_at: None,
                created_at: Utc::now(),
                notes: row.get("notes")?,
                deprecated: row.get::<_, i64>("deprecated")? != 0,
                order_index: row.get("order_index")?,
            },
            row.get::<_, Option<String>>("last_used_at")?,
            row.get::<_, String>("created_at")?,
        ))
    })?;
    let mut out = Vec::new();
    for r in raw {
        let (mut m, last, created) = r?;
        m.last_used_at = parse_ts_opt(last)?;
        m.created_at = parse_ts(created)?;
        out.push(m);
    }
    Ok(out)
}

fn export_macros(conn: &Connection) -> RepoResult<Vec<Macro>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, content, expand_from, native, role, task, usage_count,
                last_used_at, created_at, notes, scene_id, deprecated, order_index
         FROM macros
         ORDER BY order_index ASC, created_at ASC",
    )?;
    let raw = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>("id")?,
            row.get::<_, String>("name")?,
            row.get::<_, String>("content")?,
            row.get::<_, Option<String>>("expand_from")?,
            row.get::<_, i64>("native")? != 0,
            row.get::<_, Option<String>>("role")?,
            row.get::<_, Option<String>>("task")?,
            row.get::<_, i64>("usage_count")?,
            row.get::<_, Option<String>>("last_used_at")?,
            row.get::<_, String>("created_at")?,
            row.get::<_, Option<String>>("notes")?,
            row.get::<_, Option<String>>("scene_id")?,
            row.get::<_, i64>("deprecated")? != 0,
            row.get::<_, i64>("order_index")?,
        ))
    })?;
    let mut out = Vec::new();
    for r in raw {
        let (
            id,
            name,
            content,
            expand_json,
            native,
            role,
            task,
            usage,
            last,
            created,
            notes,
            scene_id,
            deprecated,
            order_index,
        ) = r?;
        let expand_from = match expand_json {
            Some(j) => Some(serde_json::from_str::<Vec<String>>(&j)?),
            None => None,
        };
        out.push(Macro {
            id,
            name,
            content,
            expand_from,
            native,
            role,
            task,
            usage_count: usage,
            last_used_at: parse_ts_opt(last)?,
            created_at: parse_ts(created)?,
            notes,
            scene_id,
            deprecated,
            order_index,
        });
    }
    Ok(out)
}

fn export_phases(conn: &Connection) -> RepoResult<Vec<Phase>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, order_index, color, description, visible, default_alignment_phrase_id
         FROM phases
         ORDER BY order_index ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Phase {
            id: row.get("id")?,
            name: row.get("name")?,
            order_index: row.get("order_index")?,
            color: row.get("color")?,
            description: row.get("description")?,
            visible: row.get::<_, i64>("visible")? != 0,
            default_alignment_phrase_id: row.get("default_alignment_phrase_id")?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn export_alignment_phrases(conn: &Connection) -> RepoResult<Vec<AlignmentPhrase>> {
    let mut stmt = conn.prepare(
        "SELECT id, phase_id, name, content, is_default, usage_count, last_used_at,
                created_at, notes, deprecated, order_index
         FROM alignment_phrases
         ORDER BY phase_id ASC, order_index ASC, created_at ASC",
    )?;
    let raw = stmt.query_map([], |row| {
        Ok((
            AlignmentPhrase {
                id: row.get("id")?,
                phase_id: row.get("phase_id")?,
                name: row.get("name")?,
                content: row.get("content")?,
                is_default: row.get::<_, i64>("is_default")? != 0,
                usage_count: row.get("usage_count")?,
                last_used_at: None,
                created_at: Utc::now(),
                notes: row.get("notes")?,
                deprecated: row.get::<_, i64>("deprecated")? != 0,
                order_index: row.get("order_index")?,
            },
            row.get::<_, Option<String>>("last_used_at")?,
            row.get::<_, String>("created_at")?,
        ))
    })?;
    let mut out = Vec::new();
    for r in raw {
        let (mut ap, last, created) = r?;
        ap.last_used_at = parse_ts_opt(last)?;
        ap.created_at = parse_ts(created)?;
        out.push(ap);
    }
    Ok(out)
}

fn export_compositions(conn: &Connection) -> RepoResult<Vec<Composition>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, modifier_ids, phase_id, scene_id, usage_count,
                last_used_at, created_at, notes, deprecated, order_index
         FROM compositions
         ORDER BY phase_id ASC, order_index ASC, created_at ASC",
    )?;
    let raw = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>("id")?,
            row.get::<_, String>("name")?,
            row.get::<_, String>("modifier_ids")?,
            row.get::<_, String>("phase_id")?,
            row.get::<_, Option<String>>("scene_id")?,
            row.get::<_, i64>("usage_count")?,
            row.get::<_, Option<String>>("last_used_at")?,
            row.get::<_, String>("created_at")?,
            row.get::<_, Option<String>>("notes")?,
            row.get::<_, i64>("deprecated")? != 0,
            row.get::<_, i64>("order_index")?,
        ))
    })?;
    let mut out = Vec::new();
    for r in raw {
        let (id, name, modifier_ids_json, phase_id, scene_id, usage, last, created, notes, dep, oi) =
            r?;
        out.push(Composition {
            id,
            name,
            modifier_ids: serde_json::from_str(&modifier_ids_json)?,
            phase_id,
            scene_id,
            usage_count: usage,
            last_used_at: parse_ts_opt(last)?,
            created_at: parse_ts(created)?,
            notes,
            deprecated: dep,
            order_index: oi,
        });
    }
    Ok(out)
}

fn scene_from_row(row: &Row<'_>) -> rusqlite::Result<(Scene, String)> {
    let role_presets_json: String = row.get("role_presets")?;
    Ok((
        Scene {
            id: row.get("id")?,
            name: row.get("name")?,
            icon: row.get("icon")?,
            order_index: row.get("order_index")?,
            visible: row.get::<_, i64>("visible")? != 0,
            role_presets: Vec::new(),
            color: row.get("color")?,
        },
        role_presets_json,
    ))
}

fn export_scenes(conn: &Connection) -> RepoResult<Vec<Scene>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, order_index, visible, role_presets, color
         FROM scenes
         ORDER BY order_index ASC",
    )?;
    let raw = stmt
        .query_map([], scene_from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut out = Vec::with_capacity(raw.len());
    for (mut scene, presets_json) in raw {
        scene.role_presets = serde_json::from_str(&presets_json)?;
        out.push(scene);
    }
    Ok(out)
}

fn export_sub_stages(conn: &Connection) -> RepoResult<Vec<SubStage>> {
    let mut stmt = conn.prepare(
        "SELECT id, scene_id, name, order_index
         FROM sub_stages
         ORDER BY scene_id ASC, order_index ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(SubStage {
            id: row.get("id")?,
            scene_id: row.get("scene_id")?,
            name: row.get("name")?,
            order_index: row.get("order_index")?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn export_phrases(conn: &Connection) -> RepoResult<Vec<Phrase>> {
    let mut stmt = conn.prepare(
        "SELECT id, scene_id, name, content, usage_count, last_used_at, created_at,
                notes, deprecated, sub_stage_id, order_index
         FROM phrases
         ORDER BY scene_id ASC, order_index ASC, created_at ASC",
    )?;
    let raw = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>("id")?,
            row.get::<_, String>("scene_id")?,
            row.get::<_, String>("name")?,
            row.get::<_, String>("content")?,
            row.get::<_, i64>("usage_count")?,
            row.get::<_, Option<String>>("last_used_at")?,
            row.get::<_, String>("created_at")?,
            row.get::<_, Option<String>>("notes")?,
            row.get::<_, i64>("deprecated")? != 0,
            row.get::<_, Option<String>>("sub_stage_id")?,
            row.get::<_, i64>("order_index")?,
        ))
    })?;
    let mut out = Vec::new();
    for r in raw {
        let (id, scene_id, name, content, usage, last, created, notes, dep, sub_stage_id, oi) = r?;
        out.push(Phrase {
            id,
            scene_id,
            name,
            content,
            usage_count: usage,
            last_used_at: parse_ts_opt(last)?,
            created_at: parse_ts(created)?,
            notes,
            deprecated: dep,
            sub_stage_id,
            order_index: oi,
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn export_envelope_carries_version_and_seed_counts() {
        let conn = db::open_in_memory().expect("open db");
        let bundle = export_bundle(&conn).expect("export");
        assert_eq!(bundle.schema_version, DATA_SCHEMA_VERSION);
        // Seed fixtures: 8 phases, 8 default alignment phrases, 4 macros, 3 scenes.
        assert_eq!(bundle.phases.len(), 8);
        assert_eq!(bundle.alignment_phrases.len(), 8);
        assert_eq!(bundle.macros.len(), 4);
        assert_eq!(bundle.scenes.len(), 3);
    }

    #[test]
    fn export_includes_deprecated_rows_the_read_path_hides() {
        let conn = db::open_in_memory().expect("open db");
        // Deprecate a seeded macro: the filtered read path hides it, but a full
        // backup must still carry it or wipe-and-restore would lose the row.
        let id: String = conn
            .query_row("SELECT id FROM macros LIMIT 1", [], |r| r.get(0))
            .expect("a macro");
        conn.execute("UPDATE macros SET deprecated = 1 WHERE id = ?1", [&id])
            .expect("deprecate");

        let visible = crate::repo::list_macros(&conn).expect("read path");
        assert!(visible.iter().all(|m| m.id != id), "read path hides it");

        let bundle = export_bundle(&conn).expect("export");
        assert!(
            bundle.macros.iter().any(|m| m.id == id && m.deprecated),
            "export must retain the deprecated macro"
        );
    }

    #[test]
    fn export_json_is_valid_and_round_trips() {
        let conn = db::open_in_memory().expect("open db");
        let json = export_json(&conn).expect("to json");
        let back: ExportBundle = serde_json::from_str(&json).expect("parse back");
        assert_eq!(back.phases.len(), 8);
    }
}
