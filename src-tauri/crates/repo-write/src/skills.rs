//! Writes for the skill index (ADR-033): import the index file, log a use, set
//! a pin. There is no in-app editing of a skill's text — the index is
//! maintained where the skills are catalogued and arrives here as a file.

use std::collections::HashSet;

use chrono::Utc;
use repo_core::skills::{
    list_skills, to_column, Skill, SkillSource, SkillStage, SkillStatus, SkillTrigger,
};
use repo_core::{RepoError, RepoResult};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

/// `kind` of a skill index file; anything else is some other JSON.
pub const SKILL_INDEX_KIND: &str = "prompt-hub-skill-index";
pub const SKILL_INDEX_VERSION: u32 = 1;

const MAX_ID_CHARS: usize = 64;
const MAX_NAME_CHARS: usize = 120;
const MAX_TEXT_CHARS: usize = 4000;
const MAX_SKILLS: usize = 500;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillIndexFile {
    kind: String,
    version: u32,
    skills: Vec<SkillIndexEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillIndexEntry {
    id: String,
    name: String,
    #[serde(default)]
    purpose: String,
    #[serde(default)]
    when_to_use: String,
    #[serde(default)]
    not_for: String,
    #[serde(default)]
    invocation: String,
    #[serde(default)]
    stage: Option<SkillStage>,
    #[serde(default)]
    trigger: SkillTrigger,
    #[serde(default)]
    source: SkillSource,
    #[serde(default)]
    source_url: String,
    #[serde(default)]
    status: SkillStatus,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillImportSummary {
    pub total: usize,
    pub added: usize,
    pub updated: usize,
    pub removed: usize,
}

fn invalid(message: impl Into<String>) -> RepoError {
    RepoError::Other(message.into())
}

fn check_text(name: &str, field: &str, value: &str) -> RepoResult<()> {
    if value.chars().count() > MAX_TEXT_CHARS {
        return Err(invalid(format!(
            "技能「{name}」的{field}超过 {MAX_TEXT_CHARS} 个字符"
        )));
    }
    Ok(())
}

fn parse_index(json: &str) -> RepoResult<Vec<SkillIndexEntry>> {
    let file: SkillIndexFile =
        serde_json::from_str(json).map_err(|e| invalid(format!("这不是一份技能索引文件：{e}")))?;
    if file.kind != SKILL_INDEX_KIND {
        return Err(invalid("这不是一份技能索引文件（kind 不匹配）"));
    }
    if file.version != SKILL_INDEX_VERSION {
        return Err(invalid(format!(
            "技能索引文件版本为 {}，当前应用只认版本 {SKILL_INDEX_VERSION}",
            file.version
        )));
    }
    // An empty index would delete every skill. A real index is never empty, so
    // an empty one is a broken export, not an instruction.
    if file.skills.is_empty() {
        return Err(invalid("技能索引文件里没有任何技能，未做任何改动"));
    }
    if file.skills.len() > MAX_SKILLS {
        return Err(invalid(format!("技能索引最多 {MAX_SKILLS} 条")));
    }
    let mut seen: HashSet<String> = HashSet::new();
    for entry in &file.skills {
        let id = entry.id.trim();
        if id.is_empty() || id != entry.id || id.chars().count() > MAX_ID_CHARS {
            return Err(invalid(format!(
                "技能「{}」的 id 无效（须为 1–{MAX_ID_CHARS} 个字符，首尾无空白）",
                entry.name
            )));
        }
        if !seen.insert(id.to_string()) {
            return Err(invalid(format!("技能索引里 id `{id}` 重复")));
        }
        let name = entry.name.trim();
        if name.is_empty() || name.chars().count() > MAX_NAME_CHARS {
            return Err(invalid(format!(
                "技能 `{id}` 的名称须为 1–{MAX_NAME_CHARS} 个字符"
            )));
        }
        check_text(name, "用途", &entry.purpose)?;
        check_text(name, "「什么时候用」", &entry.when_to_use)?;
        check_text(name, "「不用于」", &entry.not_for)?;
        check_text(name, "调用句", &entry.invocation)?;
        check_text(name, "源地址", &entry.source_url)?;
    }
    Ok(file.skills)
}

/// Make the table match the index file. The file is the whole index: rows it
/// lists are added or updated in file order, rows it no longer lists are
/// removed (with their usage log — retire a skill with `status`, not by
/// dropping it, to keep its history). Pins and usage of surviving rows are
/// untouched. All or nothing.
pub fn import_skill_index(conn: &Connection, json: &str) -> RepoResult<SkillImportSummary> {
    let entries = parse_index(json)?;
    let tx = conn.unchecked_transaction()?;
    let existing: HashSet<String> = tx
        .prepare("SELECT id FROM skills")?
        .query_map([], |r| r.get(0))?
        .collect::<rusqlite::Result<_>>()?;
    let now = Utc::now().to_rfc3339();
    let mut added = 0;
    let mut updated = 0;
    for (index, e) in entries.iter().enumerate() {
        let stage = e.stage.as_ref().map(to_column).transpose()?;
        let trigger = to_column(&e.trigger)?;
        let source = to_column(&e.source)?;
        let status = to_column(&e.status)?;
        if existing.contains(&e.id) {
            tx.execute(
                "UPDATE skills SET name=?2, purpose=?3, when_to_use=?4, not_for=?5,
                        invocation=?6, stage=?7, trigger_mode=?8, source=?9,
                        source_url=?10, status=?11, order_index=?12
                 WHERE id=?1",
                params![
                    e.id,
                    e.name.trim(),
                    e.purpose.trim(),
                    e.when_to_use.trim(),
                    e.not_for.trim(),
                    e.invocation.trim(),
                    stage,
                    trigger,
                    source,
                    e.source_url.trim(),
                    status,
                    index as i64,
                ],
            )?;
            updated += 1;
        } else {
            tx.execute(
                "INSERT INTO skills (id, name, purpose, when_to_use, not_for, invocation,
                        stage, trigger_mode, source, source_url, status, order_index, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    e.id,
                    e.name.trim(),
                    e.purpose.trim(),
                    e.when_to_use.trim(),
                    e.not_for.trim(),
                    e.invocation.trim(),
                    stage,
                    trigger,
                    source,
                    e.source_url.trim(),
                    status,
                    index as i64,
                    now,
                ],
            )?;
            added += 1;
        }
    }
    let listed: HashSet<&str> = entries.iter().map(|e| e.id.as_str()).collect();
    let mut removed = 0;
    for id in existing.iter().filter(|id| !listed.contains(id.as_str())) {
        removed += tx.execute("DELETE FROM skills WHERE id=?1", [id])?;
    }
    // A skill that is no longer on the board must not sit on a number key.
    tx.execute(
        "UPDATE skills SET pin_slot=NULL WHERE pin_slot IS NOT NULL AND status<>'installed'",
        [],
    )?;
    tx.commit()?;
    Ok(SkillImportSummary {
        total: entries.len(),
        added,
        updated,
        removed,
    })
}

/// Log one use. The count and last-used time are derived from the log.
pub fn record_skill_use(conn: &Connection, id: &str) -> RepoResult<()> {
    let known: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM skills WHERE id=?1)",
        [id],
        |r| r.get(0),
    )?;
    if !known {
        return Err(RepoError::TargetNotFound {
            table: "skills".into(),
            target_id: id.into(),
        });
    }
    conn.execute(
        "INSERT INTO skill_usage (skill_id, used_at) VALUES (?1, ?2)",
        params![id, Utc::now().to_rfc3339()],
    )?;
    Ok(())
}

/// Give a skill one of the nine pin slots, or `None` to unpin. Taking an
/// occupied slot hands it over in the same transaction. Returns the full list
/// so the caller sees who lost the slot.
pub fn set_skill_pin(conn: &Connection, id: &str, pin_slot: Option<i64>) -> RepoResult<Vec<Skill>> {
    if let Some(slot) = pin_slot {
        if !(1..=9).contains(&slot) {
            return Err(invalid("常用位须为 1–9"));
        }
    }
    let tx = conn.unchecked_transaction()?;
    if let Some(slot) = pin_slot {
        tx.execute(
            "UPDATE skills SET pin_slot=NULL WHERE pin_slot=?1 AND id<>?2",
            params![slot, id],
        )?;
    }
    let changed = tx.execute(
        "UPDATE skills SET pin_slot=?2 WHERE id=?1 AND status='installed'",
        params![id, pin_slot],
    )?;
    if changed == 0 {
        return Err(invalid("技能不存在或不是已装状态，请刷新后重试"));
    }
    let skills = list_skills(&tx)?;
    tx.commit()?;
    Ok(skills)
}

#[cfg(test)]
mod tests {
    use super::*;
    use repo_core::db;
    use serde_json::{json, Value};

    fn conn() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().unwrap();
        let c = db::open_and_migrate(&dir.path().join("test.db")).unwrap();
        (dir, c)
    }

    fn index(skills: Value) -> String {
        json!({ "kind": SKILL_INDEX_KIND, "version": 1, "skills": skills }).to_string()
    }

    fn base() -> Value {
        json!([
            {
                "id": "edl", "name": "EDL", "purpose": "借还是造",
                "whenToUse": "我想做一个 X", "invocation": "用 EDL",
                "stage": "plan", "trigger": "manual", "source": "own",
                "sourceUrl": "ai-colab 仓库 skills/", "status": "installed"
            },
            {
                "id": "deep", "name": "deep-research", "invocation": "用 deep-research 调研 ___",
                "stage": "diverge", "source": "anthropic"
            },
            { "id": "verify", "name": "verify_deliverable_report", "trigger": "auto" }
        ])
    }

    fn by_id<'a>(skills: &'a [Skill], id: &str) -> &'a Skill {
        skills.iter().find(|s| s.id == id).unwrap()
    }

    #[test]
    fn import_adds_in_file_order_with_defaults() {
        let (_dir, c) = conn();
        let summary = import_skill_index(&c, &index(base())).unwrap();
        assert_eq!(
            summary,
            SkillImportSummary {
                total: 3,
                added: 3,
                updated: 0,
                removed: 0
            }
        );
        let skills = list_skills(&c).unwrap();
        assert_eq!(
            skills.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec!["edl", "deep", "verify"]
        );
        let edl = by_id(&skills, "edl");
        assert_eq!(edl.stage, Some(SkillStage::Plan));
        assert_eq!(edl.when_to_use, "我想做一个 X");
        assert_eq!(edl.source_url, "ai-colab 仓库 skills/");
        let verify = by_id(&skills, "verify");
        assert_eq!(verify.stage, None);
        assert_eq!(verify.trigger, SkillTrigger::Auto);
        assert_eq!(verify.source, SkillSource::Own);
        assert_eq!(verify.status, SkillStatus::Installed);
        assert_eq!((verify.usage_count, verify.last_used_at), (0, None));
    }

    #[test]
    fn reimport_updates_text_and_keeps_pins_and_usage() {
        let (_dir, c) = conn();
        import_skill_index(&c, &index(base())).unwrap();
        set_skill_pin(&c, "edl", Some(1)).unwrap();
        record_skill_use(&c, "edl").unwrap();
        record_skill_use(&c, "edl").unwrap();
        record_skill_use(&c, "verify").unwrap();
        let created = by_id(&list_skills(&c).unwrap(), "edl").created_at;

        // New wording for EDL, `verify` dropped from the index, one new skill.
        let mut next = base();
        next[0]["invocation"] = json!("用 EDL 判断：我想做 ___");
        next.as_array_mut().unwrap().remove(2);
        next.as_array_mut()
            .unwrap()
            .insert(0, json!({ "id": "new", "name": "skill-creator" }));
        let summary = import_skill_index(&c, &index(next)).unwrap();
        assert_eq!(
            summary,
            SkillImportSummary {
                total: 3,
                added: 1,
                updated: 2,
                removed: 1
            }
        );

        let skills = list_skills(&c).unwrap();
        assert_eq!(
            skills.iter().map(|s| s.id.as_str()).collect::<Vec<_>>(),
            vec!["new", "edl", "deep"],
            "file order is board order"
        );
        let edl = by_id(&skills, "edl");
        assert_eq!(edl.invocation, "用 EDL 判断：我想做 ___");
        assert_eq!(edl.pin_slot, Some(1), "pin survives");
        assert_eq!(edl.usage_count, 2, "usage survives");
        assert!(edl.last_used_at.is_some());
        assert_eq!(edl.created_at, created, "an update is not a re-creation");
        let orphans: i64 = c
            .query_row("SELECT COUNT(*) FROM skill_usage", [], |r| r.get(0))
            .unwrap();
        assert_eq!(orphans, 2, "the removed skill's usage went with it");
    }

    #[test]
    fn retiring_a_pinned_skill_frees_its_number_key() {
        let (_dir, c) = conn();
        import_skill_index(&c, &index(base())).unwrap();
        set_skill_pin(&c, "edl", Some(3)).unwrap();
        record_skill_use(&c, "edl").unwrap();
        let mut next = base();
        next[0]["status"] = json!("retired");
        import_skill_index(&c, &index(next)).unwrap();
        let skills = list_skills(&c).unwrap();
        let edl = by_id(&skills, "edl");
        assert_eq!(edl.status, SkillStatus::Retired);
        assert_eq!(edl.pin_slot, None);
        assert_eq!(edl.usage_count, 1, "a retired skill keeps its history");
        assert!(
            set_skill_pin(&c, "edl", Some(3)).is_err(),
            "only installed skills take a pin"
        );
    }

    #[test]
    fn a_bad_index_changes_nothing() {
        let (_dir, c) = conn();
        import_skill_index(&c, &index(base())).unwrap();
        let before = list_skills(&c).unwrap();

        let mut dup = base();
        dup[1]["id"] = json!("edl");
        let mut bad_stage = base();
        bad_stage[0]["stage"] = json!("execute");
        let mut no_name = base();
        no_name[0]["name"] = json!("  ");
        let mut padded_id = base();
        padded_id[0]["id"] = json!(" edl ");
        let mut long = base();
        long[0]["purpose"] = json!("字".repeat(MAX_TEXT_CHARS + 1));
        let wrong_kind = json!({ "kind": "backup", "version": 1, "skills": base() }).to_string();
        let future =
            json!({ "kind": SKILL_INDEX_KIND, "version": 2, "skills": base() }).to_string();

        for bad in [
            index(dup),
            index(bad_stage),
            index(no_name),
            index(padded_id),
            index(long),
            index(json!([])),
            wrong_kind,
            future,
            "not json".to_string(),
            // A whole-library backup is not a skill index.
            repo_core::export_json(&c).unwrap(),
        ] {
            assert!(import_skill_index(&c, &bad).is_err(), "accepted {bad:.80}");
            assert_eq!(list_skills(&c).unwrap(), before);
        }
    }

    #[test]
    fn a_pin_slot_changes_hands_and_unpins() {
        let (_dir, c) = conn();
        import_skill_index(&c, &index(base())).unwrap();
        set_skill_pin(&c, "edl", Some(1)).unwrap();
        let after = set_skill_pin(&c, "deep", Some(1)).unwrap();
        assert_eq!(by_id(&after, "deep").pin_slot, Some(1));
        assert_eq!(
            by_id(&after, "edl").pin_slot,
            None,
            "previous holder cleared"
        );
        // Re-pinning the holder to its own slot is a no-op, not an error.
        set_skill_pin(&c, "deep", Some(1)).unwrap();
        let after = set_skill_pin(&c, "deep", None).unwrap();
        assert_eq!(by_id(&after, "deep").pin_slot, None);
        assert!(set_skill_pin(&c, "deep", Some(0)).is_err());
        assert!(set_skill_pin(&c, "deep", Some(10)).is_err());
        assert!(set_skill_pin(&c, "missing", Some(2)).is_err());
        // A failed pin must not have evicted the holder of that slot.
        set_skill_pin(&c, "edl", Some(2)).unwrap();
        assert!(set_skill_pin(&c, "missing", Some(2)).is_err());
        assert_eq!(by_id(&list_skills(&c).unwrap(), "edl").pin_slot, Some(2));
    }

    #[test]
    fn usage_is_logged_per_use_and_unknown_ids_are_refused() {
        let (_dir, c) = conn();
        import_skill_index(&c, &index(base())).unwrap();
        assert!(record_skill_use(&c, "missing").is_err());
        record_skill_use(&c, "deep").unwrap();
        record_skill_use(&c, "deep").unwrap();
        record_skill_use(&c, "deep").unwrap();
        let skills = list_skills(&c).unwrap();
        assert_eq!(by_id(&skills, "deep").usage_count, 3);
        assert_eq!(by_id(&skills, "edl").usage_count, 0);
    }

    /// The index file shipped in the repo — generated from the Notion skill
    /// index — must import cleanly, so the file handed to the user is known
    /// good before it ever reaches the app.
    #[test]
    fn the_shipped_skill_index_imports() {
        let (_dir, c) = conn();
        let json = include_str!("../../../../docs/skill-index/skill-index.json");
        let summary = import_skill_index(&c, json).unwrap();
        assert_eq!(summary.added, summary.total);
        let skills = list_skills(&c).unwrap();
        let installed_manual = skills
            .iter()
            .filter(|s| s.status == SkillStatus::Installed && s.trigger == SkillTrigger::Manual);
        for s in installed_manual {
            assert!(
                s.stage.is_some(),
                "{} is called by hand but has no stage",
                s.name
            );
            assert!(!s.invocation.is_empty(), "{} has no invocation", s.name);
        }
    }

    #[test]
    fn a_backup_restore_leaves_the_skill_index_alone() {
        let (_dir, c) = conn();
        let backup = repo_core::export_json(&c).unwrap();
        import_skill_index(&c, &index(base())).unwrap();
        set_skill_pin(&c, "edl", Some(1)).unwrap();
        record_skill_use(&c, "edl").unwrap();
        let before = list_skills(&c).unwrap();
        crate::import::import_json(&c, &backup).unwrap();
        assert_eq!(
            list_skills(&c).unwrap(),
            before,
            "the index is not part of a backup; a restore neither wipes nor rewinds it"
        );
    }
}
