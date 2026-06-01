use chrono::{DateTime, Utc};
use rusqlite::{params, Connection, OptionalExtension, Row};
use uuid::Uuid;

use crate::error::{RepoError, RepoResult};
use crate::models::{
    AlignmentPhrase, Macro, Phase, Phrase, RecentUsageEntry, RecordUsageInput, Scene,
    SceneWithChildren, SubStage, UsageRecord, UsageSource, UsageTargetType,
};

fn parse_ts(s: String) -> RepoResult<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(&s)
        .map(|d| d.with_timezone(&Utc))
        .map_err(|e| RepoError::Other(format!("invalid timestamp `{s}`: {e}")))
}

fn parse_ts_opt(s: Option<String>) -> RepoResult<Option<DateTime<Utc>>> {
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

pub fn list_alignment_phrases(conn: &Connection) -> RepoResult<Vec<AlignmentPhrase>> {
    let mut stmt = conn.prepare(
        "SELECT id, phase_id, name, content, is_default, usage_count, last_used_at,
                created_at, notes, deprecated
         FROM alignment_phrases
         WHERE deprecated = 0
         ORDER BY phase_id ASC, is_default DESC, usage_count DESC, created_at ASC",
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

pub fn list_macros(conn: &Connection) -> RepoResult<Vec<Macro>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, content, expand_from, native, role, task, usage_count,
                last_used_at, created_at, notes, scene_id, deprecated
         FROM macros
         WHERE deprecated = 0
         ORDER BY usage_count DESC, created_at ASC",
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
        });
    }
    Ok(out)
}

pub fn list_scenes_with_children(conn: &Connection) -> RepoResult<Vec<SceneWithChildren>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, icon, order_index, visible, role_presets, color
         FROM scenes
         WHERE visible = 1
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
         WHERE scene_id = ?1
         ORDER BY order_index ASC",
    )?;
    let rows = stmt.query_map(params![scene_id], |row| {
        Ok(SubStage {
            id: row.get("id")?,
            scene_id: row.get("scene_id")?,
            name: row.get("name")?,
            order_index: row.get("order_index")?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

fn list_phrases_by_scene(conn: &Connection, scene_id: &str) -> RepoResult<Vec<Phrase>> {
    let mut stmt = conn.prepare(
        "SELECT id, scene_id, name, content, usage_count, last_used_at, created_at,
                notes, deprecated, sub_stage_id
         FROM phrases
         WHERE scene_id = ?1 AND deprecated = 0
         ORDER BY usage_count DESC, created_at ASC",
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
             sop_id, sop_step_order, phase_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
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
    })
}

pub fn list_recent_usage(conn: &Connection, limit: i64) -> RepoResult<Vec<RecentUsageEntry>> {
    // LEFT JOIN each possible target table so a single query returns name/content
    // alongside the usage row. SQLite COALESCE picks the right column per row.
    let mut stmt = conn.prepare(
        "SELECT
            u.id, u.timestamp, u.target_type, u.target_id, u.source, u.modifier_ids,
            u.sop_id, u.sop_step_order, u.phase_id,
            COALESCE(m.name, p.name, a.name, mo.name) AS target_name,
            COALESCE(m.content, p.content, a.content, mo.content) AS target_content
         FROM usage_records u
         LEFT JOIN macros m
            ON u.target_type = 'macro' AND u.target_id = m.id
         LEFT JOIN phrases p
            ON u.target_type = 'phrase' AND u.target_id = p.id
         LEFT JOIN alignment_phrases a
            ON u.target_type = 'alignment' AND u.target_id = a.id
         LEFT JOIN modifiers mo
            ON u.target_type = 'modifier' AND u.target_id = mo.id
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
            target_name,
            target_content,
        ) = r?;
        let target_type = UsageTargetType::from_str(&target_type_s)
            .ok_or_else(|| RepoError::Other(format!("unknown target_type: {target_type_s}")))?;
        let source = match source_s.as_str() {
            "macro_area" => UsageSource::MacroArea,
            "scene" => UsageSource::Scene,
            "recent" => UsageSource::Recent,
            "sop" => UsageSource::Sop,
            "composition" => UsageSource::Composition,
            "phase_bar" => UsageSource::PhaseBar,
            other => return Err(RepoError::Other(format!("unknown source: {other}"))),
        };
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
            },
            target_name,
            target_content,
        });
    }
    Ok(out)
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
    fn seed_lists_eight_phases_in_order() {
        let conn = db::open_in_memory().expect("open db");
        let phases = list_phases(&conn).expect("list phases");
        assert_eq!(phases.len(), 8);
        let names: Vec<&str> = phases.iter().map(|p| p.name.as_str()).collect();
        assert_eq!(
            names,
            vec!["发散", "理解", "规划", "生成", "执行", "收敛", "沉淀", "迭代"]
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
    fn seed_lists_eight_default_alignment_phrases() {
        let conn = db::open_in_memory().expect("open db");
        let aps = list_alignment_phrases(&conn).expect("list ap");
        assert_eq!(aps.len(), 8);
        assert!(aps.iter().all(|a| a.is_default));
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
}
