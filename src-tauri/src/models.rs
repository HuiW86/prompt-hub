use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// Rust struct fields use snake_case to match SQL columns directly (rusqlite reads
// by column name). The JSON wire format toward the React client uses camelCase
// via `#[serde(rename_all = "camelCase")]`.

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Phase {
    pub id: String,
    pub name: String,
    pub order_index: i64,
    pub color: Option<String>,
    pub description: Option<String>,
    pub visible: bool,
    pub default_alignment_phrase_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AlignmentPhrase {
    pub id: String,
    pub phase_id: String,
    pub name: String,
    pub content: String,
    pub is_default: bool,
    pub usage_count: i64,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub deprecated: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Macro {
    pub id: String,
    pub name: String,
    pub content: String,
    pub expand_from: Option<Vec<String>>,
    pub native: bool,
    pub role: Option<String>,
    pub task: Option<String>,
    pub usage_count: i64,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub scene_id: Option<String>,
    pub deprecated: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Scene {
    pub id: String,
    pub name: String,
    pub icon: Option<String>,
    pub order_index: i64,
    pub visible: bool,
    pub role_presets: Vec<String>,
    pub color: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SubStage {
    pub id: String,
    pub scene_id: String,
    pub name: String,
    pub order_index: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Phrase {
    pub id: String,
    pub scene_id: String,
    pub name: String,
    pub content: String,
    pub usage_count: i64,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub deprecated: bool,
    pub sub_stage_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SceneWithChildren {
    pub scene: Scene,
    pub sub_stages: Vec<SubStage>,
    pub phrases: Vec<Phrase>,
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UsageTargetType {
    Modifier,
    Macro,
    Phrase,
    Composition,
    Alignment,
}

impl UsageTargetType {
    pub fn as_str(self) -> &'static str {
        match self {
            UsageTargetType::Modifier => "modifier",
            UsageTargetType::Macro => "macro",
            UsageTargetType::Phrase => "phrase",
            UsageTargetType::Composition => "composition",
            UsageTargetType::Alignment => "alignment",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "modifier" => Some(UsageTargetType::Modifier),
            "macro" => Some(UsageTargetType::Macro),
            "phrase" => Some(UsageTargetType::Phrase),
            "composition" => Some(UsageTargetType::Composition),
            "alignment" => Some(UsageTargetType::Alignment),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum UsageSource {
    MacroArea,
    Scene,
    Recent,
    Sop,
    Composition,
    PhaseBar,
}

impl UsageSource {
    pub fn as_str(self) -> &'static str {
        match self {
            UsageSource::MacroArea => "macro_area",
            UsageSource::Scene => "scene",
            UsageSource::Recent => "recent",
            UsageSource::Sop => "sop",
            UsageSource::Composition => "composition",
            UsageSource::PhaseBar => "phase_bar",
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UsageRecord {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub target_type: UsageTargetType,
    pub target_id: Option<String>,
    pub source: UsageSource,
    pub modifier_ids: Option<Vec<String>>,
    pub sop_id: Option<String>,
    pub sop_step_order: Option<i64>,
    pub phase_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecordUsageInput {
    pub target_type: UsageTargetType,
    pub target_id: Option<String>,
    pub source: UsageSource,
    pub modifier_ids: Option<Vec<String>>,
    pub sop_id: Option<String>,
    pub sop_step_order: Option<i64>,
    pub phase_id: Option<String>,
}

// A recent usage entry enriched with the title/content of its target, so the UI
// can render the "最近使用" list without a second round-trip per row.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentUsageEntry {
    pub record: UsageRecord,
    pub target_name: Option<String>,
    pub target_content: Option<String>,
}
