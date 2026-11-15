//! The skill index (ADR-033): which skills exist, what each is for, and the
//! sentence that calls it. An independent library like `websites` — not a
//! prompt asset, so outside the three-layer model and the trash.
//!
//! Ownership is split by column. The descriptive fields belong to the imported
//! index file and are replaced on every import; `pin_slot` and the usage log
//! belong to this app and are never touched by an import.

use chrono::{DateTime, Utc};
use rusqlite::Connection;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};

use crate::{RepoError, RepoResult};

/// The stage columns of the skill board: the panorama's stage words (ADR-032)
/// minus `converge` and `execute`, which hold no skill a person calls by hand.
/// A skill sits in exactly one — the step at which it is called.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum SkillStage {
    Understand,
    Diverge,
    Plan,
    Generate,
    Iterate,
    Distill,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum SkillTrigger {
    /// Called by the user with an invocation sentence.
    #[default]
    Manual,
    /// Picked up by the agent on its own; listed so it can be seen, not fetched.
    Auto,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum SkillSource {
    #[default]
    Own,
    Anthropic,
    Muse,
    Community,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum SkillStatus {
    #[default]
    Installed,
    /// Not installed yet; worth a try.
    Candidate,
    Retired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub purpose: String,
    pub when_to_use: String,
    pub not_for: String,
    pub invocation: String,
    pub stage: Option<SkillStage>,
    pub trigger: SkillTrigger,
    pub source: SkillSource,
    pub source_url: String,
    pub status: SkillStatus,
    pub pin_slot: Option<i64>,
    pub order_index: i64,
    pub usage_count: i64,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// The wire spelling of an enum value, which is also its column spelling.
pub fn to_column<T: Serialize>(value: &T) -> RepoResult<String> {
    match serde_json::to_value(value)? {
        serde_json::Value::String(s) => Ok(s),
        other => Err(RepoError::Other(format!(
            "expected a string enum, got {other}"
        ))),
    }
}

fn from_column<T: DeserializeOwned>(column: &str, raw: String) -> RepoResult<T> {
    serde_json::from_value(serde_json::Value::String(raw.clone()))
        .map_err(|_| RepoError::Other(format!("skills.{column} holds an unknown value `{raw}`")))
}

struct RawSkill {
    skill: Skill,
    stage: Option<String>,
    trigger: String,
    source: String,
    status: String,
    last_used_at: Option<String>,
    created_at: String,
}

/// Every row, retired and candidate ones included: the view decides what to
/// show, and a review needs the retired rows' counts.
pub fn list_skills(conn: &Connection) -> RepoResult<Vec<Skill>> {
    let raw = conn
        .prepare(
            "SELECT s.id, s.name, s.purpose, s.when_to_use, s.not_for, s.invocation,
                    s.stage, s.trigger_mode, s.source, s.source_url, s.status,
                    s.pin_slot, s.order_index, s.created_at,
                    (SELECT COUNT(*) FROM skill_usage u WHERE u.skill_id = s.id),
                    (SELECT MAX(u.used_at) FROM skill_usage u WHERE u.skill_id = s.id)
             FROM skills s
             ORDER BY s.order_index, s.id",
        )?
        .query_map([], |r| {
            Ok(RawSkill {
                skill: Skill {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    purpose: r.get(2)?,
                    when_to_use: r.get(3)?,
                    not_for: r.get(4)?,
                    invocation: r.get(5)?,
                    stage: None,
                    trigger: SkillTrigger::default(),
                    source: SkillSource::default(),
                    source_url: r.get(9)?,
                    status: SkillStatus::default(),
                    pin_slot: r.get(11)?,
                    order_index: r.get(12)?,
                    usage_count: r.get(14)?,
                    last_used_at: None,
                    created_at: Utc::now(),
                },
                stage: r.get(6)?,
                trigger: r.get(7)?,
                source: r.get(8)?,
                status: r.get(10)?,
                created_at: r.get(13)?,
                last_used_at: r.get(15)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    raw.into_iter()
        .map(|row| {
            let mut skill = row.skill;
            skill.stage = row.stage.map(|s| from_column("stage", s)).transpose()?;
            skill.trigger = from_column("trigger_mode", row.trigger)?;
            skill.source = from_column("source", row.source)?;
            skill.status = from_column("status", row.status)?;
            skill.created_at = crate::repo::parse_ts(row.created_at)?;
            skill.last_used_at = crate::repo::parse_ts_opt(row.last_used_at)?;
            Ok(skill)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn enum_columns_use_the_wire_spelling() {
        assert_eq!(to_column(&SkillStage::Understand).unwrap(), "understand");
        assert_eq!(to_column(&SkillTrigger::Auto).unwrap(), "auto");
        assert_eq!(to_column(&SkillSource::Anthropic).unwrap(), "anthropic");
        assert_eq!(to_column(&SkillStatus::Candidate).unwrap(), "candidate");
        let stage: SkillStage = from_column("stage", "distill".into()).unwrap();
        assert_eq!(stage, SkillStage::Distill);
        // `converge` and `execute` are panorama stages, not skill columns.
        assert!(from_column::<SkillStage>("stage", "execute".into()).is_err());
    }
}
