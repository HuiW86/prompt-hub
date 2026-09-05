use chrono::{DateTime, Utc};
use rusqlite::{Connection, Row};
use serde::{Deserialize, Serialize};

use crate::error::RepoResult;
use crate::models::{
    AlignmentAxisValue, AlignmentPhrase, AxisKind, Composition, Macro, Modifier, Phase, Phrase,
    Scene, SubStage,
};
use crate::repo::{alignment_phrase_from_row, hydrate_alignment_phrase, parse_ts, parse_ts_opt};

// The data-layer schema version of the export envelope (PRD §6.9 / §7.7). This is
// the `major.minor` contract for the JSON file itself, NOT the SQLite migration
// `user_version` (currently 13). Bump it when the export shape changes; minor for
// backward-compatible additions, major for breaking changes.
//
// 1.1 → 1.2: every asset row gained the optional `deletedAt` field (ADR-028).
// Backward-compatible in both directions — a 1.1 file simply has no `deletedAt`
// and deserializes as alive; a 1.2 file read by a 1.1 build ignores the field.
//
// 1.2 → 1.3 (ADR-029): a new TOP-LEVEL key `alignment_axis_values`, six new
// fields on every `alignment_phrases` row, and `sessionStartedAt` on usage
// records (which this envelope does not carry). Compatibility is still judged
// on MAJOR only, so 1.1 and 1.2 backups restore unchanged: a phrase with no
// `kind` reads as an opening phrase and one with no coordinates reads as
// unconstrained. This is the first new top-level key since 1.0 → 1.1, which is
// why import.rs pins down what a MISSING key means as well as an empty one
// (06-prd §6.9 rules ① and ②).
pub const DATA_SCHEMA_VERSION: &str = "1.3";

// The full-fidelity backup envelope (PRD §6.9). Unlike the read paths in `repo`,
// every list here is UNFILTERED — deprecated assets, invisible phases/scenes AND
// soft-deleted (trashed) rows are included, so a wipe-and-restore round-trip never
// silently drops rows. Each query below carries the `soft-delete-gate: exempt`
// marker the seventh gate looks for; ADR-028 sub-decision 6 is the basis.
//
// Excluded vs PRD §6.9: `sops` (no SOP model/table writes shipped yet) and
// `usage_records` (D2 — usage history is non-portable churn; per-asset usage_count
// already round-trips). Both keys are simply absent rather than empty arrays.
//
// `settings` is excluded BY DESIGN, not by omission (ADR-027 sub-decision 1):
// it holds machine-local configuration — today the global wake chord — and the
// export exists so assets can leave with the user, not so one machine's key
// bindings can overwrite another's. Do not "fix" this by adding it.
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
    // ADR-029. Not an asset, but user content — the coordinate system the user
    // defined for themselves — so unlike `settings` it travels with the export
    // (06-prd §6.6-bis "与导出的关系"). `Option` is the wire contract, not
    // laziness: `None` means the key was absent (a 1.1 / 1.2 file), which the
    // import must treat as "leave this table alone", while `Some(vec![])` means
    // the user really does have no axis values and the table should be emptied.
    #[serde(default)]
    pub alignment_axis_values: Option<Vec<AlignmentAxisValue>>,
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
        alignment_axis_values: Some(export_alignment_axis_values(conn)?),
    })
}

/// Serialize the whole database to a pretty-printed JSON string (PRD §7.5
/// "导出全部数据" one-click backup).
pub fn export_json(conn: &Connection) -> RepoResult<String> {
    let bundle = export_bundle(conn)?;
    Ok(serde_json::to_string_pretty(&bundle)?)
}

fn export_modifiers(conn: &Connection) -> RepoResult<Vec<Modifier>> {
    // soft-delete-gate: exempt — the export is a full-fidelity local backup
    // (ADR-028 sub-decision 6): trashed rows travel with it, `deleted_at` and
    // all, so that export-then-import is never a silent permanent delete.
    let mut stmt = conn.prepare(
        "SELECT id, name, content, group_kind, usage_count, last_used_at,
                created_at, notes, deprecated, order_index, deleted_at
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
                deleted_at: None,
            },
            row.get::<_, Option<String>>("last_used_at")?,
            row.get::<_, String>("created_at")?,
            row.get::<_, Option<String>>("deleted_at")?,
        ))
    })?;
    let mut out = Vec::new();
    for r in raw {
        let (mut m, last, created, deleted) = r?;
        m.last_used_at = parse_ts_opt(last)?;
        m.created_at = parse_ts(created)?;
        m.deleted_at = parse_ts_opt(deleted)?;
        out.push(m);
    }
    Ok(out)
}

fn export_macros(conn: &Connection) -> RepoResult<Vec<Macro>> {
    // soft-delete-gate: exempt — the export is a full-fidelity local backup
    // (ADR-028 sub-decision 6): trashed rows travel with it, `deleted_at` and
    // all, so that export-then-import is never a silent permanent delete.
    let mut stmt = conn.prepare(
        "SELECT id, name, content, expand_from, native, role, task, usage_count,
                last_used_at, created_at, notes, scene_id, deprecated, order_index,
                deleted_at
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
            row.get::<_, Option<String>>("deleted_at")?,
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
            deleted,
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
            deleted_at: parse_ts_opt(deleted)?,
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
    // soft-delete-gate: exempt — the export is a full-fidelity local backup
    // (ADR-028 sub-decision 6): trashed rows travel with it, `deleted_at` and
    // all, so that export-then-import is never a silent permanent delete.
    let mut stmt = conn.prepare(
        "SELECT id, phase_id, name, content, is_default, usage_count, last_used_at,
                created_at, notes, deprecated, order_index, deleted_at,
                kind, layer_id, domain_id, mode_id, cue_axis, content_revised_at
         FROM alignment_phrases
         ORDER BY phase_id ASC, order_index ASC, created_at ASC",
    )?;
    let raw = stmt
        .query_map([], alignment_phrase_from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut out = Vec::with_capacity(raw.len());
    for r in raw {
        out.push(hydrate_alignment_phrase(r)?);
    }
    Ok(out)
}

// The axis values, exactly five columns wide (06-prd §6.6-bis).
//
// This does NOT go through `repo::list_alignment_axis_values`, and the reason is
// the whole point of `AlignmentAxisValue` being a separate struct from
// `AlignmentAxisValueWithRefs`: `refCount` / `trashedRefCount` are computed per
// query, so writing them into a backup file would freeze one machine's counts
// into the import contract, where they would be wrong on every other machine.
//
// No soft-delete exemption marker: this table has no `deleted_at` column at all,
// which is why it is not on the seventh gate's list of seven.
fn export_alignment_axis_values(conn: &Connection) -> RepoResult<Vec<AlignmentAxisValue>> {
    let mut stmt = conn.prepare(
        "SELECT id, axis, name, hint, order_index
         FROM alignment_axis_values
         ORDER BY axis ASC, order_index ASC",
    )?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>("id")?,
                row.get::<_, String>("axis")?,
                row.get::<_, String>("name")?,
                row.get::<_, Option<String>>("hint")?,
                row.get::<_, i64>("order_index")?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut out = Vec::with_capacity(rows.len());
    for (id, axis, name, hint, order_index) in rows {
        let axis = AxisKind::parse(&axis).ok_or_else(|| {
            crate::error::RepoError::Other(format!(
                "alignment_axis_values.axis holds unknown value `{axis}`"
            ))
        })?;
        out.push(AlignmentAxisValue {
            id,
            axis,
            name,
            hint,
            order_index,
        });
    }
    Ok(out)
}

fn export_compositions(conn: &Connection) -> RepoResult<Vec<Composition>> {
    // soft-delete-gate: exempt — the export is a full-fidelity local backup
    // (ADR-028 sub-decision 6): trashed rows travel with it, `deleted_at` and
    // all, so that export-then-import is never a silent permanent delete.
    let mut stmt = conn.prepare(
        "SELECT id, name, modifier_ids, phase_id, scene_id, usage_count,
                last_used_at, created_at, notes, deprecated, order_index, deleted_at
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
            row.get::<_, Option<String>>("deleted_at")?,
        ))
    })?;
    let mut out = Vec::new();
    for r in raw {
        let (
            id,
            name,
            modifier_ids_json,
            phase_id,
            scene_id,
            usage,
            last,
            created,
            notes,
            dep,
            oi,
            deleted,
        ) = r?;
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
            deleted_at: parse_ts_opt(deleted)?,
        });
    }
    Ok(out)
}

fn scene_from_row(row: &Row<'_>) -> rusqlite::Result<(Scene, String, Option<String>)> {
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
            deleted_at: None,
        },
        role_presets_json,
        row.get::<_, Option<String>>("deleted_at")?,
    ))
}

fn export_scenes(conn: &Connection) -> RepoResult<Vec<Scene>> {
    // soft-delete-gate: exempt — the export is a full-fidelity local backup
    // (ADR-028 sub-decision 6): trashed rows travel with it, `deleted_at` and
    // all, so that export-then-import is never a silent permanent delete.
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, order_index, visible, role_presets, color, deleted_at
         FROM scenes
         ORDER BY order_index ASC",
    )?;
    let raw = stmt
        .query_map([], scene_from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut out = Vec::with_capacity(raw.len());
    for (mut scene, presets_json, deleted) in raw {
        scene.role_presets = serde_json::from_str(&presets_json)?;
        scene.deleted_at = parse_ts_opt(deleted)?;
        out.push(scene);
    }
    Ok(out)
}

fn export_sub_stages(conn: &Connection) -> RepoResult<Vec<SubStage>> {
    // soft-delete-gate: exempt — the export is a full-fidelity local backup
    // (ADR-028 sub-decision 6): trashed rows travel with it, `deleted_at` and
    // all, so that export-then-import is never a silent permanent delete.
    let mut stmt = conn.prepare(
        "SELECT id, scene_id, name, order_index, deleted_at
         FROM sub_stages
         ORDER BY scene_id ASC, order_index ASC",
    )?;
    let raw = stmt.query_map([], |row| {
        Ok((
            SubStage {
                id: row.get("id")?,
                scene_id: row.get("scene_id")?,
                name: row.get("name")?,
                order_index: row.get("order_index")?,
                deleted_at: None,
            },
            row.get::<_, Option<String>>("deleted_at")?,
        ))
    })?;
    let mut out = Vec::new();
    for r in raw {
        let (mut ss, deleted) = r?;
        ss.deleted_at = parse_ts_opt(deleted)?;
        out.push(ss);
    }
    Ok(out)
}

fn export_phrases(conn: &Connection) -> RepoResult<Vec<Phrase>> {
    // soft-delete-gate: exempt — the export is a full-fidelity local backup
    // (ADR-028 sub-decision 6): trashed rows travel with it, `deleted_at` and
    // all, so that export-then-import is never a silent permanent delete.
    let mut stmt = conn.prepare(
        "SELECT id, scene_id, name, content, usage_count, last_used_at, created_at,
                notes, deprecated, sub_stage_id, order_index, deleted_at
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
            row.get::<_, Option<String>>("deleted_at")?,
        ))
    })?;
    let mut out = Vec::new();
    for r in raw {
        let (
            id,
            scene_id,
            name,
            content,
            usage,
            last,
            created,
            notes,
            dep,
            sub_stage_id,
            oi,
            deleted,
        ) = r?;
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
            deleted_at: parse_ts_opt(deleted)?,
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
        // Seed fixtures after 0014: 9 phases, 20 alignment phrases (8 defaults +
        // 6 form phrases + 6 live cues), 4 macros, 3 scenes, 16 axis values.
        assert_eq!(bundle.phases.len(), 9);
        assert_eq!(bundle.alignment_phrases.len(), 20);
        assert_eq!(
            bundle.alignment_axis_values.as_ref().map(Vec::len),
            Some(16)
        );
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
        assert_eq!(back.phases.len(), 9);
    }
}
