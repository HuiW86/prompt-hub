use std::collections::HashMap;

use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::error::{RepoError, RepoResult};
use crate::models::{
    AlignmentAxisValue, AlignmentAxisValueWithRefs, AlignmentPhrase, AnchorDrift, AxisKind,
    AxisTally, Composition, CueAxis, DriftLedger, Macro, Modifier, Phase, Phrase, PhraseKind,
    RecentUsageEntry, RecordUsageInput, Scene, SceneWithChildren, SubStage, UsageRecord,
    UsageSource, UsageTargetType,
};

pub(crate) fn parse_ts(s: String) -> RepoResult<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(&s)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| RepoError::Other(format!("invalid timestamp `{s}`: {e}")))
}

pub(crate) fn parse_ts_opt(s: Option<String>) -> RepoResult<Option<DateTime<Utc>>> {
    s.map(parse_ts).transpose()
}

fn phase_from_row(row: &Row<'_>) -> rusqlite::Result<Phase> {
    Ok(Phase {
        id: row.get("id")?,
        name: row.get("name")?,
        order_index: row.get("order_index")?,
        color: row.get("color")?,
        description: row.get("description")?,
        visible: row.get::<_, i64>("visible")? != 0,
        default_alignment_phrase_id: row.get("default_alignment_phrase_id")?,
    })
}

pub fn list_phases(conn: &Connection) -> RepoResult<Vec<Phase>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, order_index, color, description, visible, default_alignment_phrase_id
         FROM phases
         WHERE visible = 1
         ORDER BY order_index ASC",
    )?;
    let rows = stmt.query_map([], phase_from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

// An alignment phrase as it comes off a row: the model plus the timestamp
// columns still in their stored string form, because parsing them needs
// RepoError and `query_map`'s closure may only return rusqlite::Error. Shared
// with the export path (repo-core/src/export.rs), which selects the same columns
// at full fidelity.
pub(crate) struct AlignmentPhraseRow {
    pub phrase: AlignmentPhrase,
    pub last_used_at: Option<String>,
    pub created_at: String,
    pub deleted_at: Option<String>,
    pub content_revised_at: Option<String>,
}

pub(crate) fn alignment_phrase_from_row(row: &Row<'_>) -> rusqlite::Result<AlignmentPhraseRow> {
    Ok(AlignmentPhraseRow {
        phrase: AlignmentPhrase {
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
            deleted_at: None,
            // An unrecognised enum string degrades to the safe default rather
            // than failing the whole read: the CHECK constraints make it
            // impossible today, and a list read that dies on one odd row is a
            // worse outcome than one that shows it as an ordinary phrase.
            kind: row
                .get::<_, String>("kind")
                .map(|k| PhraseKind::parse(&k).unwrap_or_default())?,
            layer_id: row.get("layer_id")?,
            domain_id: row.get("domain_id")?,
            mode_id: row.get("mode_id")?,
            cue_axis: row
                .get::<_, Option<String>>("cue_axis")?
                .and_then(|a| CueAxis::parse(&a)),
            content_revised_at: None,
        },
        last_used_at: row.get::<_, Option<String>>("last_used_at")?,
        created_at: row.get::<_, String>("created_at")?,
        deleted_at: row.get::<_, Option<String>>("deleted_at")?,
        content_revised_at: row.get::<_, Option<String>>("content_revised_at")?,
    })
}

pub(crate) fn hydrate_alignment_phrase(raw: AlignmentPhraseRow) -> RepoResult<AlignmentPhrase> {
    let AlignmentPhraseRow {
        mut phrase,
        last_used_at,
        created_at,
        deleted_at,
        content_revised_at,
    } = raw;
    phrase.last_used_at = parse_ts_opt(last_used_at)?;
    phrase.created_at = parse_ts(created_at)?;
    phrase.deleted_at = parse_ts_opt(deleted_at)?;
    phrase.content_revised_at = parse_ts_opt(content_revised_at)?;
    Ok(phrase)
}

pub fn list_alignment_phrases(conn: &Connection) -> RepoResult<Vec<AlignmentPhrase>> {
    let mut stmt = conn.prepare(
        "SELECT id, phase_id, name, content, is_default, usage_count, last_used_at,
                created_at, notes, deprecated, order_index, deleted_at,
                kind, layer_id, domain_id, mode_id, cue_axis, content_revised_at
         FROM alignment_phrases
         WHERE deprecated = 0 AND deleted_at IS NULL
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

/// Every coordinate axis value, ordered by axis then position, each carrying the
/// two read-only reference counts the delete confirmation needs (06-prd
/// §6.6-bis "查询模式"). They are computed here rather than stored: the table is
/// tens of rows, and a stored count is a second source of truth that drifts.
pub fn list_alignment_axis_values(conn: &Connection) -> RepoResult<Vec<AlignmentAxisValueWithRefs>> {
    // The `p.id IS NULL` arm below is load-bearing: a LEFT JOIN that matched
    // nothing still produces one row with every `p.*` column NULL, and
    // `NULL IS NULL` is true — without that arm an unreferenced axis value
    // would report a reference count of 1.
    //
    // soft-delete-gate: exempt — one of the two counts this read exists to
    // produce is precisely the number of TRASHED phrases pointing at each axis
    // value. `ON DELETE SET NULL` is a SQL-level action that cannot see
    // `deleted_at`, so a delete blanks their coordinates too; reporting only the
    // live count would hide the half of the blast radius the user cannot check
    // for themselves (06-prd §6.6-bis).
    let mut stmt = conn.prepare(
        "SELECT v.id, v.axis, v.name, v.hint, v.order_index,
                SUM(CASE WHEN p.id IS NULL THEN 0
                         WHEN p.deleted_at IS NULL THEN 1 ELSE 0 END) AS ref_count,
                SUM(CASE WHEN p.id IS NULL THEN 0
                         WHEN p.deleted_at IS NOT NULL THEN 1 ELSE 0 END) AS trashed_ref_count
         FROM alignment_axis_values v
         LEFT JOIN alignment_phrases p
                ON p.layer_id = v.id OR p.domain_id = v.id OR p.mode_id = v.id
         GROUP BY v.id, v.axis, v.name, v.hint, v.order_index
         ORDER BY v.axis ASC, v.order_index ASC",
    )?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>("id")?,
                row.get::<_, String>("axis")?,
                row.get::<_, String>("name")?,
                row.get::<_, Option<String>>("hint")?,
                row.get::<_, i64>("order_index")?,
                row.get::<_, i64>("ref_count")?,
                row.get::<_, i64>("trashed_ref_count")?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    let mut out = Vec::with_capacity(rows.len());
    for (id, axis, name, hint, order_index, ref_count, trashed_ref_count) in rows {
        // The CHECK constraint makes an unknown axis unreachable; if one ever
        // appears, say so instead of silently filing it under some other axis.
        let axis = AxisKind::parse(&axis).ok_or_else(|| {
            RepoError::Other(format!(
                "alignment_axis_values.axis holds unknown value `{axis}`"
            ))
        })?;
        out.push(AlignmentAxisValueWithRefs {
            value: AlignmentAxisValue {
                id,
                axis,
                name,
                hint,
                order_index,
            },
            ref_count,
            trashed_ref_count,
        });
    }
    Ok(out)
}

pub fn list_macros(conn: &Connection) -> RepoResult<Vec<Macro>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, content, expand_from, native, role, task, usage_count,
                last_used_at, created_at, notes, scene_id, deprecated, order_index
         FROM macros
         WHERE deprecated = 0 AND deleted_at IS NULL
         ORDER BY order_index ASC, created_at ASC",
    )?;
    let raw = stmt.query_map([], |row| {
        let expand_from_json: Option<String> = row.get("expand_from")?;
        Ok((
            row.get::<_, String>("id")?,
            row.get::<_, String>("name")?,
            row.get::<_, String>("content")?,
            expand_from_json,
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
            // Filtered out by the query above; a listed asset is alive.
            deleted_at: None,
        });
    }
    Ok(out)
}

pub fn list_modifiers(conn: &Connection) -> RepoResult<Vec<Modifier>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, content, group_kind, usage_count, last_used_at,
                created_at, notes, deprecated, order_index
         FROM modifiers
         WHERE deprecated = 0 AND deleted_at IS NULL
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
                // Filtered out by the query above; a listed asset is alive.
                deleted_at: None,
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

pub fn list_compositions(conn: &Connection) -> RepoResult<Vec<Composition>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, modifier_ids, phase_id, scene_id, usage_count,
                last_used_at, created_at, notes, deprecated, order_index
         FROM compositions
         WHERE deprecated = 0 AND deleted_at IS NULL
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
            order_index,
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
            order_index,
            // Filtered out by the query above; a listed asset is alive.
            deleted_at: None,
        });
    }
    Ok(out)
}

pub fn list_scenes_with_children(conn: &Connection) -> RepoResult<Vec<SceneWithChildren>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, order_index, visible, role_presets, color
         FROM scenes
         WHERE visible = 1 AND deleted_at IS NULL
         ORDER BY order_index ASC",
    )?;
    let scenes_raw = stmt
        .query_map([], |row| {
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
                    // Filtered out by the query above; a listed scene is alive.
                    deleted_at: None,
                },
                role_presets_json,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    let mut out = Vec::with_capacity(scenes_raw.len());
    for (mut scene, presets_json) in scenes_raw {
        scene.role_presets = serde_json::from_str(&presets_json)?;
        let sub_stages = list_sub_stages_by_scene(conn, &scene.id)?;
        let phrases = list_phrases_by_scene(conn, &scene.id)?;
        out.push(SceneWithChildren {
            scene,
            sub_stages,
            phrases,
        });
    }
    Ok(out)
}

fn list_sub_stages_by_scene(conn: &Connection, scene_id: &str) -> RepoResult<Vec<SubStage>> {
    let mut stmt = conn.prepare(
        "SELECT id, scene_id, name, order_index
         FROM sub_stages
         WHERE scene_id = ?1 AND deleted_at IS NULL
         ORDER BY order_index ASC",
    )?;
    let rows = stmt.query_map(params![scene_id], |row| {
        Ok(SubStage {
            id: row.get("id")?,
            scene_id: row.get("scene_id")?,
            name: row.get("name")?,
            order_index: row.get("order_index")?,
            // Filtered out by the query above; a listed sub-stage is alive.
            deleted_at: None,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn list_phrases_by_scene(conn: &Connection, scene_id: &str) -> RepoResult<Vec<Phrase>> {
    let mut stmt = conn.prepare(
        // The CASE re-homes a phrase whose sub-stage is in the trash into the
        // ungrouped partition, exactly as if the column were NULL. Deleting a
        // sub-stage no longer nulls its children (ADR-028 sub-decision 7), so
        // "ungrouped" has to be decided here, on read, which is also what makes
        // restoring a sub-stage a pure single-row UPDATE.
        "SELECT id, scene_id, name, content, usage_count, last_used_at, created_at,
                notes, deprecated, order_index,
                CASE WHEN sub_stage_id IN
                        (SELECT id FROM sub_stages WHERE deleted_at IS NULL)
                     THEN sub_stage_id END AS sub_stage_id
         FROM phrases
         WHERE scene_id = ?1 AND deprecated = 0 AND deleted_at IS NULL
         ORDER BY order_index ASC, created_at ASC, rowid ASC",
    )?;
    let raw = stmt.query_map(params![scene_id], |row| {
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
        let (
            id,
            scene_id,
            name,
            content,
            usage_count,
            last_used,
            created,
            notes,
            deprecated,
            sub_stage_id,
            order_index,
        ) = r?;
        out.push(Phrase {
            id,
            scene_id,
            name,
            content,
            usage_count,
            last_used_at: parse_ts_opt(last_used)?,
            created_at: parse_ts(created)?,
            notes,
            deprecated,
            sub_stage_id,
            order_index,
            // Filtered out by the query above; a listed phrase is alive.
            deleted_at: None,
        });
    }
    Ok(out)
}

pub fn record_usage(conn: &Connection, input: RecordUsageInput) -> RepoResult<UsageRecord> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now();
    let modifier_ids_json = input
        .modifier_ids
        .as_ref()
        .map(serde_json::to_string)
        .transpose()?;

    // Map target_type -> underlying asset table. Composition has no row to
    // bump; everything else MUST resolve to a concrete table and a real row.
    // SAFETY: `table` comes from this closed Rust enum, never user input —
    // no SQL injection surface even though we format! it into UPDATE below.
    let table = match input.target_type {
        UsageTargetType::Macro => Some("macros"),
        UsageTargetType::Phrase => Some("phrases"),
        UsageTargetType::Alignment => Some("alignment_phrases"),
        UsageTargetType::Modifier => Some("modifiers"),
        UsageTargetType::Composition => None,
    };

    let tx = conn.unchecked_transaction()?;

    // Validate target_id BEFORE writing the usage_records row, so a buggy
    // or malicious invoke can't poison recents with dangling references.
    // usage_records has no FK on target_id (target table varies by
    // target_type), so this check is the only line of defense.
    if let Some(table) = table {
        let target_id = input
            .target_id
            .as_deref()
            .ok_or_else(|| RepoError::TargetIdRequired(input.target_type.as_str().to_string()))?;
        let exists: i64 = tx
            .query_row(
                &format!("SELECT 1 FROM {table} WHERE id = ?1"),
                params![target_id],
                |row| row.get(0),
            )
            .optional()?
            .unwrap_or(0);
        if exists == 0 {
            return Err(RepoError::TargetNotFound {
                table: table.to_string(),
                target_id: target_id.to_string(),
            });
        }
    }

    tx.execute(
        "INSERT INTO usage_records
            (id, timestamp, target_type, target_id, source, modifier_ids,
             sop_id, sop_step_order, phase_id, session_started_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            id,
            now.to_rfc3339(),
            input.target_type.as_str(),
            input.target_id,
            input.source.as_str(),
            modifier_ids_json,
            input.sop_id,
            input.sop_step_order,
            input.phase_id,
            input.session_started_at.map(|t| t.to_rfc3339()),
        ],
    )?;

    // Bump usage_count / last_used_at on the underlying asset so the dashboard
    // can reflect heat without recomputing from usage_records on every render.
    let now_str = now.to_rfc3339();
    if let Some(table) = table {
        let target_id = input.target_id.as_deref().expect("validated above");
        let affected = tx.execute(
            &format!(
                "UPDATE {table} SET usage_count = usage_count + 1, last_used_at = ?1 WHERE id = ?2"
            ),
            params![now_str, target_id],
        )?;
        // Belt-and-suspenders: SELECT 1 above already guarantees the row
        // exists in this transaction. If the UPDATE somehow misses, abort
        // before commit rather than silently producing a stale record.
        if affected != 1 {
            return Err(RepoError::TargetNotFound {
                table: table.to_string(),
                target_id: target_id.to_string(),
            });
        }
    }
    tx.commit()?;

    Ok(UsageRecord {
        id,
        timestamp: now,
        target_type: input.target_type,
        target_id: input.target_id,
        source: input.source,
        modifier_ids: input.modifier_ids,
        sop_id: input.sop_id,
        sop_step_order: input.sop_step_order,
        phase_id: input.phase_id,
        session_started_at: input.session_started_at,
    })
}

// The wake shows DISTINCT assets, so the dedupe has to happen before LIMIT:
// copying one Macro 40 times in a row must not evict every other asset from the
// list. ROW_NUMBER keeps each asset's latest touch and drops the rest, which
// makes LIMIT count assets rather than raw rows.
//
// Partition key mirrors the identity rule the wake needs:
//   - target_type scopes the id (ids are unique per table, not across tables);
//   - `target_id IS NULL` is a discriminator bit so rows carrying no target id
//     (composition usages have no asset row to point at) fall back to their own
//     record id. SQLite's PARTITION BY groups all NULLs together, which would
//     collapse unrelated composition uses into one; the bit also keeps a real
//     target_id from ever colliding with the record id used as fallback.
//
// Performance caveat (same budget as count_today_usage below): the window
// function scans every usage row instead of walking idx_usage_records_timestamp
// for `limit` rows. Fine while usage_records < 10k; revisit when a wake refresh
// shows up in a profile. Do NOT "fix" it by bounding the inner scan to the last
// N rows — that just moves the eviction bug further out.
pub fn list_recent_usage(conn: &Connection, limit: i64) -> RepoResult<Vec<RecentUsageEntry>> {
    // LEFT JOIN each possible target table so a single query returns name/content
    // alongside the usage row. SQLite COALESCE picks the right column per row.
    let mut stmt = conn.prepare(
        "WITH ranked AS (
            SELECT usage_records.*, ROW_NUMBER() OVER (
                PARTITION BY target_type, target_id IS NULL, COALESCE(target_id, id)
                ORDER BY timestamp DESC, id DESC
            ) AS rn
            FROM usage_records
         )
         SELECT
            u.id, u.timestamp, u.target_type, u.target_id, u.source, u.modifier_ids,
            u.sop_id, u.sop_step_order, u.phase_id, u.session_started_at,
            COALESCE(m.name, p.name, a.name, mo.name) AS target_name,
            COALESCE(m.content, p.content, a.content, mo.content) AS target_content
         FROM ranked u
         LEFT JOIN macros m
            ON u.target_type = 'macro' AND u.target_id = m.id
                AND m.deleted_at IS NULL
         LEFT JOIN phrases p
            ON u.target_type = 'phrase' AND u.target_id = p.id
                AND p.deleted_at IS NULL
         LEFT JOIN alignment_phrases a
            ON u.target_type = 'alignment' AND u.target_id = a.id
                AND a.deleted_at IS NULL
         LEFT JOIN modifiers mo
            ON u.target_type = 'modifier' AND u.target_id = mo.id
                AND mo.deleted_at IS NULL
         WHERE u.rn = 1
           -- ADR-028 sub-decision 5 (closes G4 observation O3). A usage row whose
           -- target no longer resolves is dropped instead of surfacing as a
           -- 「（未知话术）」 tombstone. Two kinds of row hit this: an asset now in
           -- the trash, and one hard-deleted before this ADR shipped. Both are
           -- un-recopyable, which is the only thing this list is for.
           --
           -- The filter has to sit HERE, above LIMIT: filtering in the renderer
           -- would let tombstones consume slots and hand the wake a short list.
           -- Restoring an asset brings its history straight back, because
           -- usage_records was never touched and the id never changed.
           --
           -- Scope is deliberately narrow: only rows that POINT AT something and
           -- miss. Composition usages carry no target_id at all and so can never
           -- resolve; they are left alone here because dropping them would be a
           -- separate product change, not the O3 fix. That they render nameless
           -- is the pre-existing gap ADR-028 sub-decision 5 records as 同批可修.
           AND (u.target_id IS NULL
                OR m.id IS NOT NULL
                OR p.id IS NOT NULL
                OR a.id IS NOT NULL
                OR mo.id IS NOT NULL)
         ORDER BY u.timestamp DESC
         LIMIT ?1",
    )?;
    let raw = stmt.query_map(params![limit], |row| {
        Ok((
            row.get::<_, String>("id")?,
            row.get::<_, String>("timestamp")?,
            row.get::<_, String>("target_type")?,
            row.get::<_, Option<String>>("target_id")?,
            row.get::<_, String>("source")?,
            row.get::<_, Option<String>>("modifier_ids")?,
            row.get::<_, Option<String>>("sop_id")?,
            row.get::<_, Option<i64>>("sop_step_order")?,
            row.get::<_, Option<String>>("phase_id")?,
            row.get::<_, Option<String>>("session_started_at")?,
            row.get::<_, Option<String>>("target_name")?,
            row.get::<_, Option<String>>("target_content")?,
        ))
    })?;

    let mut out = Vec::new();
    for r in raw {
        let (
            id,
            ts,
            target_type_s,
            target_id,
            source_s,
            modifier_ids_json,
            sop_id,
            sop_step_order,
            phase_id,
            session_started_at,
            target_name,
            target_content,
        ) = r?;
        let target_type = UsageTargetType::from_str(&target_type_s)
            .ok_or_else(|| RepoError::Other(format!("unknown target_type: {target_type_s}")))?;
        let source = UsageSource::parse(&source_s)
            .ok_or_else(|| RepoError::Other(format!("unknown source: {source_s}")))?;
        let modifier_ids = match modifier_ids_json {
            Some(j) => Some(serde_json::from_str::<Vec<String>>(&j)?),
            None => None,
        };
        out.push(RecentUsageEntry {
            record: UsageRecord {
                id,
                timestamp: parse_ts(ts)?,
                target_type,
                target_id,
                source,
                modifier_ids,
                sop_id,
                sop_step_order,
                phase_id,
                session_started_at: parse_ts_opt(session_started_at)?,
            },
            target_name,
            target_content,
        });
    }
    Ok(out)
}

/// The drift ledger (ADR-029 子决策 4, algorithm in 06-prd §6.8).
///
/// Five steps, each of which only counts:
///   1. group by `session_started_at`, skipping rows where it is NULL — those
///      predate migration 0014 and have no session boundary to honour;
///   2. order within the group by timestamp;
///   3. every `source = 'live_cue'` row attributes to the nearest PRECEDING
///      `target_type = 'alignment' AND source = 'phase_bar'` row in the same
///      session. A cue with no anchor before it is unattributed;
///   4. it lands in the column named by the cue phrase's `cue_axis`; a NULL
///      `cue_axis` (「停」) is counted in the total and in no column;
///   5. the anchor's tally is split by its `content_revised_at`.
///
/// Step 3 separates anchors from cues by `source`, NOT by `target_type` — both
/// are `alignment` rows, because a cue IS an alignment phrase. And the anchor is
/// a phase_bar RECORD rather than "whichever phase is highlighted": clicking a
/// phase only switches, it never copies and never writes a record, so a record
/// is the only proof a phrase was actually sent.
///
/// This is bookkeeping and nothing else. No threshold, no ranking, no verdict —
/// 01-spec §8.1 forbids the app from judging alignment, permanently.
pub fn summarize_drift_ledger(conn: &Connection) -> RepoResult<DriftLedger> {
    // The phrase side of the ledger: name + axis + split point, for live phrases
    // only. A cue or anchor whose phrase is in the trash still exists in
    // usage_records — it keeps its place in the ordering and still absorbs the
    // cues that follow it — but it contributes no axis column and no row of its
    // own, the same way 「停」 does not. The gap is reported in `live_cue_total`.
    let mut phrases = conn.prepare(
        "SELECT id, name, cue_axis, content_revised_at
         FROM alignment_phrases
         WHERE deleted_at IS NULL",
    )?;
    let phrase_rows = phrases
        .query_map([], |row| {
            Ok((
                row.get::<_, String>("id")?,
                row.get::<_, String>("name")?,
                row.get::<_, Option<String>>("cue_axis")?,
                row.get::<_, Option<String>>("content_revised_at")?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    struct PhraseFacts {
        name: String,
        cue_axis: Option<CueAxis>,
        revised_at: Option<DateTime<Utc>>,
    }
    let mut facts: HashMap<String, PhraseFacts> = HashMap::new();
    for (id, name, cue_axis, revised) in phrase_rows {
        facts.insert(
            id,
            PhraseFacts {
                name,
                cue_axis: cue_axis.as_deref().and_then(CueAxis::parse),
                revised_at: parse_ts_opt(revised)?,
            },
        );
    }

    // Only the two record shapes the algorithm looks at, already grouped and
    // ordered by SQL. `rowid` breaks ties so two records stamped in the same
    // millisecond still pair deterministically.
    let mut stmt = conn.prepare(
        "SELECT session_started_at, timestamp, target_id, source
         FROM usage_records
         WHERE session_started_at IS NOT NULL
           AND target_id IS NOT NULL
           AND (source = 'live_cue'
                OR (target_type = 'alignment' AND source = 'phase_bar'))
         ORDER BY session_started_at ASC, timestamp ASC, rowid ASC",
    )?;
    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>("session_started_at")?,
                row.get::<_, String>("timestamp")?,
                row.get::<_, String>("target_id")?,
                row.get::<_, String>("source")?,
            ))
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;

    // Insertion-ordered so the report lists anchors in the order they were first
    // used, which is stable across runs and needs no arbitrary sort key.
    let mut order: Vec<String> = Vec::new();
    let mut anchors: HashMap<String, AnchorDrift> = HashMap::new();
    let mut live_cue_total: i64 = 0;
    let mut unattributed: i64 = 0;

    let mut current_session: Option<String> = None;
    let mut current_anchor: Option<String> = None;

    for (session, timestamp, target_id, source) in rows {
        // A new session wipes the anchor: attribution never reaches across
        // wakes (step 1 groups, it does not concatenate).
        if current_session.as_deref() != Some(session.as_str()) {
            current_session = Some(session);
            current_anchor = None;
        }
        if source == "phase_bar" {
            current_anchor = Some(target_id);
            continue;
        }
        // Everything left is a live_cue row.
        live_cue_total += 1;
        let Some(anchor_id) = current_anchor.clone() else {
            unattributed += 1;
            continue;
        };
        // A trashed anchor still marks the boundary — the record is there and
        // later cues belong to it, not to whatever came before — but it cannot
        // be named, so nothing can be shown under it. Counted as unattributed
        // rather than dropped: a cue that vanishes from both the anchor rows and
        // the counters is a number nobody can reconcile.
        let Some(anchor_facts) = facts.get(&anchor_id) else {
            unattributed += 1;
            continue;
        };
        // No axis (「停」, or a cue phrase now in the trash) — counted in the
        // total, filed in no column. 06-prd §6.8 step 4 calls this out as
        // deliberate for 「停」; the trashed case behaves the same way because a
        // phrase nobody can list has no axis to file under.
        let Some(axis) = facts.get(&target_id).and_then(|f| f.cue_axis) else {
            continue;
        };
        let at = parse_ts(timestamp)?;
        let entry = anchors.entry(anchor_id.clone()).or_insert_with(|| {
            order.push(anchor_id.clone());
            AnchorDrift {
                phrase_id: anchor_id,
                name: anchor_facts.name.clone(),
                revised_at: anchor_facts.revised_at,
                before: AxisTally::default(),
                after: AxisTally::default(),
            }
        });
        entry.count(axis, at);
    }

    Ok(DriftLedger {
        anchors: order
            .into_iter()
            .filter_map(|id| anchors.remove(&id))
            .collect(),
        live_cue_total,
        unattributed,
    })
}

// B5-6: StatusBar's "今日复制 N 次" needs the real day-bounded count, not the
// length of the (capped) recent list. SQLite's date(...,'localtime') projects
// both the stored UTC timestamp and "now" into the user's local date so the
// counter rolls over at local midnight without us having to plumb timezone
// info through every call.
//
// Timezone semantics (B-P1-3): "today" is always evaluated against the CURRENT
// system timezone. If the user changes their OS timezone between two calls
// (e.g., laptop crosses ZN/DST boundary mid-day), the count will jump — that's
// intentional. We respect "wall clock now" rather than freezing the timezone
// at record-insertion time. Don't normalize to UTC here unless we ship an
// explicit "always-UTC day boundary" setting.
//
// Performance caveat (B-P1-1, deferred): date(timestamp,'localtime') is not
// sargable so idx_usage_records_timestamp gets a full COVERING-INDEX SCAN
// instead of SEARCH. Fine while usage_records < 10k; revisit when StatusBar
// refresh shows up in a profile.
pub fn count_today_usage(conn: &Connection) -> RepoResult<i64> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM usage_records
         WHERE date(timestamp, 'localtime') = date('now', 'localtime')",
        [],
        |row| row.get(0),
    )?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[test]
    fn seed_lists_nine_phases_in_order() {
        let conn = db::open_in_memory().expect("open db");
        let phases = list_phases(&conn).expect("list phases");
        // 中途 is the 9th (ADR-029 子决策 3): a real phase rather than a nullable
        // phase_id, because "every alignment phrase belongs to a phase" is
        // written in the human-authored 01-spec §3.5 and adding a seed row needs
        // nobody's signature while relaxing that constraint would.
        assert_eq!(phases.len(), 9);
        let names: Vec<&str> = phases.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(
            names,
            vec!["发散", "理解", "规划", "生成", "执行", "收敛", "沉淀", "迭代", "中途"]
        );
        // Every phase must have a default AlignmentPhrase pointer.
        for p in &phases {
            assert!(
                p.default_alignment_phrase_id.is_some(),
                "{} has no default",
                p.name
            );
        }
    }

    #[test]
    fn seed_lists_twenty_alignment_phrases_nine_of_them_defaults() {
        let conn = db::open_in_memory().expect("open db");
        let aps = list_alignment_phrases(&conn).expect("list ap");
        // 8 original defaults + 6 form phrases + 6 live cues (ADR-029 子决策 1/3).
        assert_eq!(aps.len(), 20);
        assert_eq!(
            aps.iter().filter(|a| a.is_default).count(),
            9,
            "one default per phase, 中途 included"
        );
        assert_eq!(
            aps.iter()
                .filter(|a| a.kind == crate::models::PhraseKind::Cue)
                .count(),
            6
        );
        // The eight pre-ADR-029 defaults are untouched: still opening phrases,
        // still uncoordinated.
        let diverge = aps
            .iter()
            .find(|a| a.id == "ap-diverge-default")
            .expect("seed default survives");
        assert_eq!(diverge.kind, crate::models::PhraseKind::Opening);
        assert_eq!(diverge.layer_id, None);
        assert_eq!(diverge.domain_id, None);
        assert_eq!(diverge.mode_id, None);
        assert_eq!(diverge.cue_axis, None);
        assert_eq!(diverge.content_revised_at, None);
    }

    #[test]
    fn seed_lists_four_macros_active() {
        let conn = db::open_in_memory().expect("open db");
        let macros = list_macros(&conn).expect("list macros");
        assert_eq!(macros.len(), 4);
        assert!(macros.iter().all(|m| m.native));
    }

    #[test]
    fn seed_lists_three_scenes_each_with_phrases() {
        let conn = db::open_in_memory().expect("open db");
        let scenes = list_scenes_with_children(&conn).expect("list scenes");
        assert_eq!(scenes.len(), 3);
        for s in &scenes {
            assert!(
                !s.phrases.is_empty(),
                "scene {} has no phrases",
                s.scene.name
            );
        }
    }

    #[test]
    fn record_usage_bumps_macro_usage_count_and_returns_record() {
        let conn = db::open_in_memory().expect("open db");
        let before = list_macros(&conn).expect("before");
        let target = &before[0];
        let initial = target.usage_count;

        let rec = record_usage(
            &conn,
            RecordUsageInput {
                target_type: UsageTargetType::Macro,
                target_id: Some(target.id.clone()),
                source: UsageSource::MacroArea,
                modifier_ids: None,
                sop_id: None,
                sop_step_order: None,
                phase_id: None,
                session_started_at: None,
            },
        )
        .expect("record");
        assert_eq!(rec.target_type, UsageTargetType::Macro);
        assert_eq!(rec.target_id.as_deref(), Some(target.id.as_str()));

        let after = list_macros(&conn).expect("after");
        let bumped = after
            .iter()
            .find(|m| m.id == target.id)
            .expect("same macro");
        assert_eq!(bumped.usage_count, initial + 1);
        assert!(bumped.last_used_at.is_some());
    }

    #[test]
    fn record_usage_rejects_dangling_target_id() {
        let conn = db::open_in_memory().expect("open db");
        let result = record_usage(
            &conn,
            RecordUsageInput {
                target_type: UsageTargetType::Macro,
                target_id: Some("nonexistent-id".to_string()),
                source: UsageSource::MacroArea,
                modifier_ids: None,
                sop_id: None,
                sop_step_order: None,
                phase_id: None,
                session_started_at: None,
            },
        );
        assert!(
            matches!(result, Err(RepoError::TargetNotFound { .. })),
            "expected TargetNotFound, got {result:?}"
        );
        // The usage_records row must NOT have been inserted (transaction rolled back).
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM usage_records", [], |r| r.get(0))
            .expect("count");
        assert_eq!(count, 0);
    }

    #[test]
    fn record_usage_rejects_missing_target_id_for_concrete_type() {
        let conn = db::open_in_memory().expect("open db");
        let result = record_usage(
            &conn,
            RecordUsageInput {
                target_type: UsageTargetType::Macro,
                target_id: None,
                source: UsageSource::MacroArea,
                modifier_ids: None,
                sop_id: None,
                sop_step_order: None,
                phase_id: None,
                session_started_at: None,
            },
        );
        assert!(
            matches!(result, Err(RepoError::TargetIdRequired(_))),
            "expected TargetIdRequired, got {result:?}"
        );
    }

    // Cross-midnight boundary test (review B-P1-2). record_usage always stamps
    // Utc::now(), so any test routed through it would only ever see "today".
    // Bypass it with raw INSERTs at hand-picked local times around midnight to
    // verify date(...,'localtime') actually filters by local day, not UTC day,
    // and won't silently swallow yesterday's records if the SQL ever drops the
    // 'localtime' modifier. Times picked outside the DST 02:00 danger window.
    #[test]
    fn count_today_usage_filters_records_on_local_day_boundary() {
        use chrono::{Duration as ChronoDuration, Local, TimeZone};

        let conn = db::open_in_memory().expect("open db");
        let macros = list_macros(&conn).expect("list");
        let mid = macros[0].id.clone();

        let today = Local::now().date_naive();
        let yesterday = today - ChronoDuration::days(1);

        let to_utc_rfc3339 = |d: chrono::NaiveDate, h: u32| {
            let naive = d.and_hms_opt(h, 0, 0).expect("valid hms");
            Local
                .from_local_datetime(&naive)
                .single()
                .expect("non-DST hour never ambiguous")
                .with_timezone(&Utc)
                .to_rfc3339()
        };

        // 2 outside today's local window + 3 inside.
        let fixtures = [
            ("rec-y-noon", to_utc_rfc3339(yesterday, 12), false),
            ("rec-y-2300", to_utc_rfc3339(yesterday, 23), false),
            ("rec-t-0100", to_utc_rfc3339(today, 1), true),
            ("rec-t-noon", to_utc_rfc3339(today, 12), true),
            ("rec-t-2300", to_utc_rfc3339(today, 23), true),
        ];
        for (id, ts, _) in &fixtures {
            conn.execute(
                "INSERT INTO usage_records (id, timestamp, target_type, target_id, source)
                 VALUES (?1, ?2, 'macro', ?3, 'macro_area')",
                params![id, ts, mid],
            )
            .expect("raw insert");
        }

        let expected: i64 = fixtures.iter().filter(|(_, _, in_today)| *in_today).count() as i64;
        assert_eq!(count_today_usage(&conn).expect("count"), expected);
    }

    #[test]
    fn count_today_usage_zero_on_empty_then_increments_after_record() {
        let conn = db::open_in_memory().expect("open db");
        assert_eq!(count_today_usage(&conn).expect("count empty"), 0);

        let macros = list_macros(&conn).expect("list");
        let target = &macros[0];
        record_usage(
            &conn,
            RecordUsageInput {
                target_type: UsageTargetType::Macro,
                target_id: Some(target.id.clone()),
                source: UsageSource::MacroArea,
                modifier_ids: None,
                sop_id: None,
                sop_step_order: None,
                phase_id: None,
                session_started_at: None,
            },
        )
        .expect("record");
        assert_eq!(count_today_usage(&conn).expect("count after 1"), 1);

        record_usage(
            &conn,
            RecordUsageInput {
                target_type: UsageTargetType::Macro,
                target_id: Some(target.id.clone()),
                source: UsageSource::MacroArea,
                modifier_ids: None,
                sop_id: None,
                sop_step_order: None,
                phase_id: None,
                session_started_at: None,
            },
        )
        .expect("record");
        assert_eq!(count_today_usage(&conn).expect("count after 2"), 2);
    }

    #[test]
    fn list_recent_usage_returns_descending_with_target_name() {
        let conn = db::open_in_memory().expect("open db");
        let macros = list_macros(&conn).expect("list");
        // Record three usages on three different macros so timestamps differ.
        for m in macros.iter().take(3) {
            record_usage(
                &conn,
                RecordUsageInput {
                    target_type: UsageTargetType::Macro,
                    target_id: Some(m.id.clone()),
                    source: UsageSource::MacroArea,
                    modifier_ids: None,
                    sop_id: None,
                    sop_step_order: None,
                    phase_id: None,
                    session_started_at: None,
                },
            )
            .expect("record");
            std::thread::sleep(std::time::Duration::from_millis(2));
        }
        let recent = list_recent_usage(&conn, 5).expect("recent");
        assert_eq!(recent.len(), 3);
        // Timestamps strictly descending.
        for w in recent.windows(2) {
            assert!(w[0].record.timestamp >= w[1].record.timestamp);
        }
        // Every entry has the target name populated by the JOIN.
        assert!(recent.iter().all(|e| e.target_name.is_some()));
    }

    // Raw inserts (not record_usage) so timestamps are exact and the fixture can
    // express duplicates without sleeping between writes.
    fn insert_usage(conn: &Connection, id: &str, ts: &str, ty: &str, target_id: Option<&str>) {
        conn.execute(
            "INSERT INTO usage_records (id, timestamp, target_type, target_id, source)
             VALUES (?1, ?2, ?3, ?4, 'macro_area')",
            params![id, ts, ty, target_id],
        )
        .expect("raw insert");
    }

    #[test]
    fn list_recent_usage_collapses_repeats_so_limit_counts_distinct_assets() {
        let conn = db::open_in_memory().expect("open db");
        let macros = list_macros(&conn).expect("list");
        let (a, b) = (&macros[0].id, &macros[1].id);
        // B once, then four copies of A stacked on top. The repeats MUST be the
        // newest rows: with B newest, a row-counting LIMIT 2 would keep it by
        // accident and the fixture would pass against the unfixed query. Here
        // the pre-fix result is two identical A lines and B — a distinct asset
        // the wake should show — evicted by A's own history.
        insert_usage(&conn, "b0", "2026-08-10T00:00:01Z", "macro", Some(b));
        for (i, ts) in ["00:00:02", "00:00:03", "00:00:04", "00:00:05"]
            .iter()
            .enumerate()
        {
            insert_usage(
                &conn,
                &format!("a{i}"),
                &format!("2026-08-10T{ts}Z"),
                "macro",
                Some(a),
            );
        }

        let recent = list_recent_usage(&conn, 2).expect("recent");
        let ids: Vec<Option<&str>> = recent
            .iter()
            .map(|e| e.record.target_id.as_deref())
            .collect();
        assert_eq!(ids, vec![Some(a.as_str()), Some(b.as_str())]);
        // A survives as its LATEST touch, not the first one seen.
        assert_eq!(recent[0].record.id, "a3");
    }

    #[test]
    fn list_recent_usage_keeps_rows_without_target_id_distinct() {
        let conn = db::open_in_memory().expect("open db");
        // Composition usages carry no target_id. SQLite groups NULLs together,
        // so without the discriminator bit these two collapse into one row.
        insert_usage(&conn, "c1", "2026-08-10T00:00:01Z", "composition", None);
        insert_usage(&conn, "c2", "2026-08-10T00:00:02Z", "composition", None);

        let recent = list_recent_usage(&conn, 5).expect("recent");
        assert_eq!(recent.len(), 2);
    }

    #[test]
    fn list_recent_usage_scopes_identity_by_target_type() {
        let conn = db::open_in_memory().expect("open db");
        let shared = list_macros(&conn).expect("list")[0].id.clone();
        // Ids are unique per table, not across tables: the same string under two
        // target types is two different assets and must keep two slots. Both
        // assets really exist here — a phrase deliberately given the macro's id
        // string — because ADR-028 made the query drop usage rows whose target
        // does not resolve, so a fixture pointing at a non-existent phrase would
        // now be filtered out and stop testing the partition key at all.
        conn.execute(
            "INSERT INTO phrases (id, scene_id, name, content, created_at, order_index)
             VALUES (?1, 'scene-plan', 'Shared id', 'body', '2026-08-01T00:00:00Z', 99)",
            params![shared],
        )
        .expect("phrase sharing the macro id");
        insert_usage(&conn, "t1", "2026-08-10T00:00:01Z", "macro", Some(&shared));
        insert_usage(&conn, "t2", "2026-08-10T00:00:02Z", "phrase", Some(&shared));

        let recent = list_recent_usage(&conn, 5).expect("recent");
        assert_eq!(recent.len(), 2);
    }

    #[test]
    fn list_recent_usage_drops_a_trashed_asset_and_brings_it_back_on_restore() {
        // ADR-028 sub-decision 5 / G4 observation O3: before this, deleting an
        // asset left its usage row behind as an un-recopyable 「（未知话术）」 line.
        let conn = db::open_in_memory().expect("open db");
        let macros = list_macros(&conn).expect("list");
        let (doomed, keeper) = (macros[0].id.clone(), macros[1].id.clone());
        insert_usage(&conn, "k1", "2026-08-10T00:00:01Z", "macro", Some(&keeper));
        insert_usage(&conn, "d1", "2026-08-10T00:00:02Z", "macro", Some(&doomed));
        assert_eq!(list_recent_usage(&conn, 5).expect("before").len(), 2);

        conn.execute(
            "UPDATE macros SET deleted_at = '2026-09-03T00:00:00Z' WHERE id = ?1",
            params![doomed],
        )
        .expect("trash");
        let after = list_recent_usage(&conn, 5).expect("after");
        assert_eq!(after.len(), 1, "the trashed asset leaves no tombstone");
        assert_eq!(after[0].record.target_id.as_deref(), Some(keeper.as_str()));

        // The usage row itself was never touched, so restore reconnects by id.
        conn.execute(
            "UPDATE macros SET deleted_at = NULL WHERE id = ?1",
            params![doomed],
        )
        .expect("restore");
        assert_eq!(
            list_recent_usage(&conn, 5).expect("restored").len(),
            2,
            "history returns with the asset"
        );
    }

    // ── Drift ledger (ADR-029 子决策 4 / 06-prd §6.8) ────────────────────────

    /// Raw insert so the fixture controls the exact timestamp and session, which
    /// `record_usage` (which always stamps `now`) cannot do.
    fn insert_ledger_row(
        conn: &Connection,
        id: &str,
        session: Option<&str>,
        ts: &str,
        target_id: &str,
        source: &str,
    ) {
        conn.execute(
            "INSERT INTO usage_records
                (id, timestamp, target_type, target_id, source, session_started_at)
             VALUES (?1, ?2, 'alignment', ?3, ?4, ?5)",
            params![id, ts, target_id, source, session],
        )
        .expect("insert usage row");
    }

    const S1: &str = "2026-09-05T09:00:00+00:00";
    const S2: &str = "2026-09-05T14:00:00+00:00";

    #[test]
    fn drift_ledger_attributes_cues_to_the_opening_phrase_that_preceded_them() {
        let conn = db::open_in_memory().expect("open db");
        // 发散's default is sent, then two layer cues and one domain cue follow.
        insert_ledger_row(&conn, "u1", Some(S1), "2026-09-05T09:00:01Z", "ap-diverge-default", "phase_bar");
        insert_ledger_row(&conn, "u2", Some(S1), "2026-09-05T09:05:00Z", "ap-live-shift-layer", "live_cue");
        insert_ledger_row(&conn, "u3", Some(S1), "2026-09-05T09:06:00Z", "ap-live-back-to-pos", "live_cue");
        insert_ledger_row(&conn, "u4", Some(S1), "2026-09-05T09:07:00Z", "ap-live-domain-only", "live_cue");

        let ledger = summarize_drift_ledger(&conn).expect("summarize");
        assert_eq!(ledger.anchors.len(), 1);
        let anchor = &ledger.anchors[0];
        assert_eq!(anchor.phrase_id, "ap-diverge-default");
        // No revision, so nothing can be "before" it and the whole tally is after.
        assert_eq!(anchor.revised_at, None);
        assert_eq!(anchor.before, AxisTally::default());
        assert_eq!(anchor.after.layer, 2);
        assert_eq!(anchor.after.domain, 1);
        assert_eq!(anchor.after.form, 0);
        assert_eq!(ledger.live_cue_total, 3);
        assert_eq!(ledger.unattributed, 0);
    }

    #[test]
    fn drift_ledger_skips_rows_with_no_session_and_never_pairs_across_sessions() {
        let conn = db::open_in_memory().expect("open db");
        // Pre-0014 history: no session, so it is not part of any group.
        insert_ledger_row(&conn, "old1", None, "2026-08-01T09:00:00Z", "ap-diverge-default", "phase_bar");
        insert_ledger_row(&conn, "old2", None, "2026-08-01T09:05:00Z", "ap-live-shift-layer", "live_cue");
        // A later wake anchors on 规划; the cue in it must not reach back to the
        // anchor of the earlier session either.
        insert_ledger_row(&conn, "u1", Some(S1), "2026-09-05T09:00:00Z", "ap-plan-default", "phase_bar");
        insert_ledger_row(&conn, "u2", Some(S2), "2026-09-05T14:01:00Z", "ap-live-shift-layer", "live_cue");

        let ledger = summarize_drift_ledger(&conn).expect("summarize");
        assert_eq!(
            ledger.live_cue_total, 1,
            "the NULL-session cue is not counted at all"
        );
        assert_eq!(
            ledger.unattributed, 1,
            "session 2 opened with a cue, so it has no anchor"
        );
        assert!(ledger.anchors.is_empty());
    }

    #[test]
    fn drift_ledger_counts_a_cue_fired_before_any_anchor_as_unattributed() {
        let conn = db::open_in_memory().expect("open db");
        insert_ledger_row(&conn, "u1", Some(S1), "2026-09-05T09:00:00Z", "ap-live-shift-layer", "live_cue");
        insert_ledger_row(&conn, "u2", Some(S1), "2026-09-05T09:01:00Z", "ap-diverge-default", "phase_bar");
        insert_ledger_row(&conn, "u3", Some(S1), "2026-09-05T09:02:00Z", "ap-live-shift-form", "live_cue");

        let ledger = summarize_drift_ledger(&conn).expect("summarize");
        assert_eq!(ledger.live_cue_total, 2);
        assert_eq!(ledger.unattributed, 1);
        assert_eq!(ledger.anchors.len(), 1);
        assert_eq!(ledger.anchors[0].after.form, 1);
        assert_eq!(ledger.anchors[0].after.layer, 0);
    }

    /// 「停」 records `live_cue` like every other cue but has no `cue_axis`, so it
    /// is counted in the total and filed in no column. This is the one place the
    /// ledger deliberately does not add up (ADR-029 子决策 4).
    #[test]
    fn drift_ledger_counts_stop_in_the_total_but_in_no_axis() {
        let conn = db::open_in_memory().expect("open db");
        insert_ledger_row(&conn, "u1", Some(S1), "2026-09-05T09:00:00Z", "ap-diverge-default", "phase_bar");
        insert_ledger_row(&conn, "u2", Some(S1), "2026-09-05T09:05:00Z", "ap-live-stop", "live_cue");

        let ledger = summarize_drift_ledger(&conn).expect("summarize");
        assert_eq!(ledger.live_cue_total, 1);
        assert_eq!(ledger.unattributed, 0);
        assert!(
            ledger.anchors.is_empty(),
            "an anchor followed only by 停 has nothing to tally"
        );
    }

    /// A cue whose anchor is in the trash. The anchor record still bounds the
    /// session — the cue belongs to it, not to whatever came before — but a
    /// phrase nobody can list cannot be rendered as a row, so the cue lands in
    /// `unattributed` rather than disappearing from every counter.
    #[test]
    fn drift_ledger_counts_a_cue_whose_anchor_is_trashed_as_unattributed() {
        let conn = db::open_in_memory().expect("open db");
        conn.execute(
            "UPDATE alignment_phrases SET deleted_at = '2026-09-05T08:00:00+00:00'
             WHERE id = 'ap-form-explore'",
            [],
        )
        .expect("trash the anchor phrase");
        insert_ledger_row(&conn, "u1", Some(S1), "2026-09-05T09:00:00Z", "ap-form-explore", "phase_bar");
        insert_ledger_row(&conn, "u2", Some(S1), "2026-09-05T09:05:00Z", "ap-live-shift-layer", "live_cue");
        // A live anchor later in the same session still works normally.
        insert_ledger_row(&conn, "u3", Some(S1), "2026-09-05T09:10:00Z", "ap-diverge-default", "phase_bar");
        insert_ledger_row(&conn, "u4", Some(S1), "2026-09-05T09:11:00Z", "ap-live-converge", "live_cue");

        let ledger = summarize_drift_ledger(&conn).expect("summarize");
        assert_eq!(ledger.live_cue_total, 2);
        assert_eq!(
            ledger.unattributed, 1,
            "the cue under the trashed anchor must be counted somewhere"
        );
        assert_eq!(ledger.anchors.len(), 1);
        assert_eq!(ledger.anchors[0].phrase_id, "ap-diverge-default");
        assert_eq!(ledger.anchors[0].after.mode, 1);
    }

    /// The fourth reason `live_cue_total` exceeds the axis sums: the CUE's own
    /// phrase is trashed, so its axis cannot be resolved. Counted in the total,
    /// filed in no column — and NOT unattributed, because it did have an anchor.
    #[test]
    fn drift_ledger_counts_a_cue_whose_own_phrase_is_trashed_in_the_total_only() {
        let conn = db::open_in_memory().expect("open db");
        conn.execute(
            "UPDATE alignment_phrases SET deleted_at = '2026-09-05T08:00:00+00:00'
             WHERE id = 'ap-live-shift-layer'",
            [],
        )
        .expect("trash the cue phrase");
        insert_ledger_row(&conn, "u1", Some(S1), "2026-09-05T09:00:00Z", "ap-diverge-default", "phase_bar");
        insert_ledger_row(&conn, "u2", Some(S1), "2026-09-05T09:05:00Z", "ap-live-shift-layer", "live_cue");

        let ledger = summarize_drift_ledger(&conn).expect("summarize");
        assert_eq!(ledger.live_cue_total, 1);
        assert_eq!(ledger.unattributed, 0);
        assert!(ledger.anchors.is_empty());
    }

    #[test]
    fn drift_ledger_splits_an_anchors_tally_at_its_content_revision() {
        let conn = db::open_in_memory().expect("open db");
        conn.execute(
            "UPDATE alignment_phrases SET content_revised_at = '2026-09-05T09:30:00+00:00'
             WHERE id = 'ap-diverge-default'",
            [],
        )
        .expect("stamp a revision");
        insert_ledger_row(&conn, "u1", Some(S1), "2026-09-05T09:00:00Z", "ap-diverge-default", "phase_bar");
        insert_ledger_row(&conn, "u2", Some(S1), "2026-09-05T09:05:00Z", "ap-live-shift-layer", "live_cue");
        insert_ledger_row(&conn, "u3", Some(S1), "2026-09-05T09:06:00Z", "ap-live-converge", "live_cue");
        insert_ledger_row(&conn, "u4", Some(S2), "2026-09-05T14:00:00Z", "ap-diverge-default", "phase_bar");
        insert_ledger_row(&conn, "u5", Some(S2), "2026-09-05T14:05:00Z", "ap-live-shift-layer", "live_cue");

        let ledger = summarize_drift_ledger(&conn).expect("summarize");
        assert_eq!(ledger.anchors.len(), 1);
        let anchor = &ledger.anchors[0];
        assert!(anchor.revised_at.is_some());
        assert_eq!(anchor.before.layer, 1);
        assert_eq!(anchor.before.mode, 1);
        assert_eq!(anchor.after.layer, 1);
        assert_eq!(anchor.after.mode, 0);
        // before + after is always the full attributed total, split or not.
        assert_eq!(ledger.live_cue_total, 3);
    }

    /// Anchors are `source = 'phase_bar'` RECORDS, not "whichever phase is
    /// highlighted": clicking a phase switches without copying and writes no
    /// record. A cue copy is therefore never itself an anchor, even though both
    /// are `target_type = 'alignment'` rows.
    #[test]
    fn drift_ledger_separates_anchors_from_cues_by_source_not_target_type() {
        let conn = db::open_in_memory().expect("open db");
        insert_ledger_row(&conn, "u1", Some(S1), "2026-09-05T09:00:00Z", "ap-diverge-default", "phase_bar");
        // ⌘9 on 中途 copies 停 — and records live_cue, NOT phase_bar, which is
        // what stops 中途 from ever becoming an opening anchor (06-prd §6.8).
        insert_ledger_row(&conn, "u2", Some(S1), "2026-09-05T09:01:00Z", "ap-live-stop", "live_cue");
        insert_ledger_row(&conn, "u3", Some(S1), "2026-09-05T09:02:00Z", "ap-live-shift-layer", "live_cue");

        let ledger = summarize_drift_ledger(&conn).expect("summarize");
        assert_eq!(ledger.anchors.len(), 1);
        assert_eq!(ledger.anchors[0].phrase_id, "ap-diverge-default");
        assert_eq!(
            ledger.anchors[0].after.layer, 1,
            "the cue after 停 still belongs to the opening phrase, not to 停"
        );
    }

    #[test]
    fn record_usage_round_trips_a_session_stamp_and_the_live_cue_source() {
        let conn = db::open_in_memory().expect("open db");
        let rec = record_usage(
            &conn,
            RecordUsageInput {
                target_type: UsageTargetType::Alignment,
                target_id: Some("ap-live-stop".to_string()),
                source: UsageSource::LiveCue,
                modifier_ids: None,
                sop_id: None,
                sop_step_order: None,
                phase_id: Some("phase-live".to_string()),
                session_started_at: Some(parse_ts(S1.to_string()).expect("ts")),
            },
        )
        .expect("record");
        assert_eq!(rec.source, UsageSource::LiveCue);
        assert!(rec.session_started_at.is_some());

        let stored: Option<String> = conn
            .query_row(
                "SELECT session_started_at FROM usage_records WHERE id = ?1",
                params![rec.id],
                |r| r.get(0),
            )
            .expect("read back");
        assert_eq!(
            parse_ts_opt(stored).expect("parse"),
            rec.session_started_at,
            "the stamp must survive the round trip so GROUP BY it works"
        );

        let recents = list_recent_usage(&conn, 5).expect("recents");
        assert_eq!(recents[0].record.source, UsageSource::LiveCue);
        assert!(recents[0].record.session_started_at.is_some());
    }

    // ── Axis values (06-prd §6.6-bis) ───────────────────────────────────────

    #[test]
    fn axis_value_ref_counts_separate_live_phrases_from_trashed_ones() {
        let conn = db::open_in_memory().expect("open db");
        conn.execute(
            "UPDATE alignment_phrases SET layer_id = 'axv-layer-path'
             WHERE id IN ('ap-form-explore', 'ap-form-path')",
            [],
        )
        .expect("coordinate two phrases");
        conn.execute(
            "UPDATE alignment_phrases SET deleted_at = '2026-09-05T00:00:00+00:00'
             WHERE id = 'ap-form-path'",
            [],
        )
        .expect("trash one of them");

        let values = list_alignment_axis_values(&conn).expect("list");
        let path = values
            .iter()
            .find(|v| v.value.id == "axv-layer-path")
            .expect("the layer value");
        assert_eq!(path.ref_count, 1);
        // The count that would otherwise be invisible: SQL's ON DELETE SET NULL
        // cannot see `deleted_at`, so deleting this value blanks the trashed
        // phrase's coordinate too.
        assert_eq!(path.trashed_ref_count, 1);

        let untouched = values
            .iter()
            .find(|v| v.value.id == "axv-mode-recon")
            .expect("an unreferenced value");
        assert_eq!((untouched.ref_count, untouched.trashed_ref_count), (0, 0));
    }

    #[test]
    fn axis_values_are_ordered_by_axis_then_position() {
        let conn = db::open_in_memory().expect("open db");
        let values = list_alignment_axis_values(&conn).expect("list");
        assert_eq!(values.len(), 16);
        let axes: Vec<&str> = values.iter().map(|v| v.value.axis.as_str()).collect();
        let mut sorted = axes.clone();
        sorted.sort_unstable();
        assert_eq!(axes, sorted, "grouped by axis");
        // "domain" < "layer" < "mode" as strings, and within an axis the sort is
        // order_index, so the first row is the domain axis's position 0.
        assert_eq!(values[0].value.axis, AxisKind::Domain);
        assert_eq!(values[0].value.name, "技术");
        assert_eq!(values.last().expect("last").value.name, "侦察");
    }
}
