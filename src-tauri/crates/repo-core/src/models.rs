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
    pub order_index: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Modifier {
    pub id: String,
    pub name: String,
    pub content: String,
    // CHECK-constrained to cognition/action/delivery/constraint at the SQL layer;
    // kept as String here (no Rust enum) so a future seed value can't fail to
    // deserialize a read — validation lives in the schema.
    pub group_kind: String,
    pub usage_count: i64,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub notes: Option<String>,
    pub deprecated: bool,
}

// A persisted Composition (migration 0004). Distinct from the transient
// workbench Composition (PRD §6.2): this row exists only once Claude proposed it
// and omar promoted the draft (PRD §10.2).
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Composition {
    pub id: String,
    pub name: String,
    pub modifier_ids: Vec<String>,
    pub phase_id: String,
    pub scene_id: Option<String>,
    pub usage_count: i64,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub notes: Option<String>,
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

    #[allow(clippy::should_implement_trait)]
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

// ---------------------------------------------------------------------------
// Drafts staging inbox (ADR-015 / plan §4). The four target types here are NOT
// the same set as UsageTargetType: drafts use `alignment_phrase` (a first-class
// asset that Claude can propose) rather than `phrase`, and never `composition`
// usage rows. Keeping a separate enum avoids leaking usage-layer semantics.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DraftTargetType {
    Modifier,
    Composition,
    Macro,
    AlignmentPhrase,
}

impl DraftTargetType {
    pub fn as_str(self) -> &'static str {
        match self {
            DraftTargetType::Modifier => "modifier",
            DraftTargetType::Composition => "composition",
            DraftTargetType::Macro => "macro",
            DraftTargetType::AlignmentPhrase => "alignment_phrase",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "modifier" => Some(DraftTargetType::Modifier),
            "composition" => Some(DraftTargetType::Composition),
            "macro" => Some(DraftTargetType::Macro),
            "alignment_phrase" => Some(DraftTargetType::AlignmentPhrase),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DraftStatus {
    Pending,
    Discarded,
}

impl DraftStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            DraftStatus::Pending => "pending",
            DraftStatus::Discarded => "discarded",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "pending" => Some(DraftStatus::Pending),
            "discarded" => Some(DraftStatus::Discarded),
            _ => None,
        }
    }
}

// Where a draft came from, recorded verbatim for audit (plan §4.2). Stored as
// JSON in drafts.provenance.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Provenance {
    pub source_app: String,
    pub conversation_ref: String,
    pub tool_name: String,
    pub model_hint: Option<String>,
    pub confidence: Option<f32>,
}

// The typed body of a draft. Internally tagged by `target_type` so the JSON
// stored in drafts.payload_json is self-describing and round-trips through the
// same enum at promote time (plan §4.3).
//
// NOTE: serde does not support `deny_unknown_fields` on an internally-tagged
// enum (it's a compile error), so extra keys are silently ignored rather than
// rejected. Required-field / type drift is still caught by re-deserializing at
// promote time; rejecting *unknown* fields would need per-variant structs.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(tag = "target_type", rename_all = "snake_case")]
pub enum DraftPayload {
    Modifier {
        schema_version: u32,
        name: String,
        content: String,
        phase_id: String,
        scene_id: Option<String>,
    },
    Composition {
        schema_version: u32,
        name: String,
        modifier_ids: Vec<String>,
        phase_id: String,
        scene_id: Option<String>,
    },
    Macro {
        schema_version: u32,
        name: String,
        content: String,
        phase_id: String,
        scene_id: Option<String>,
    },
    // phase_id is REQUIRED (not Option) — [[02-constitution#B2]] forbids an
    // AlignmentPhrase that isn't bound to a protocol phase (R7).
    AlignmentPhrase {
        schema_version: u32,
        name: String,
        content: String,
        phase_id: String,
        is_default: bool,
    },
}

impl DraftPayload {
    pub fn target_type(&self) -> DraftTargetType {
        match self {
            DraftPayload::Modifier { .. } => DraftTargetType::Modifier,
            DraftPayload::Composition { .. } => DraftTargetType::Composition,
            DraftPayload::Macro { .. } => DraftTargetType::Macro,
            DraftPayload::AlignmentPhrase { .. } => DraftTargetType::AlignmentPhrase,
        }
    }

    pub fn schema_version(&self) -> u32 {
        match self {
            DraftPayload::Modifier { schema_version, .. }
            | DraftPayload::Composition { schema_version, .. }
            | DraftPayload::Macro { schema_version, .. }
            | DraftPayload::AlignmentPhrase { schema_version, .. } => *schema_version,
        }
    }

    pub fn name(&self) -> &str {
        match self {
            DraftPayload::Modifier { name, .. }
            | DraftPayload::Composition { name, .. }
            | DraftPayload::Macro { name, .. }
            | DraftPayload::AlignmentPhrase { name, .. } => name,
        }
    }

    // A short, list-safe preview so `list_drafts` never ships full payloads.
    // Composition has no free-text body, so we summarize its modifier count.
    pub fn preview(&self) -> String {
        const MAX: usize = 80;
        let body = match self {
            DraftPayload::Modifier { content, .. }
            | DraftPayload::Macro { content, .. }
            | DraftPayload::AlignmentPhrase { content, .. } => content.clone(),
            DraftPayload::Composition { modifier_ids, .. } => {
                format!("{} modifiers", modifier_ids.len())
            }
        };
        // Truncate on a char boundary so multi-byte (CJK) content never panics.
        if body.chars().count() > MAX {
            let truncated: String = body.chars().take(MAX).collect();
            format!("{truncated}…")
        } else {
            body
        }
    }
}

// A stored draft row, hydrated (payload + provenance parsed from their JSON
// columns) for the UI / promote path.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub id: String,
    pub target_type: DraftTargetType,
    pub schema_version: u32,
    pub payload: DraftPayload,
    pub payload_hash: String,
    pub provenance: Provenance,
    pub status: DraftStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

// Lightweight list projection: metadata + a short preview, never the full
// payload, so listing 100 drafts doesn't blow the MCP token budget (plan §5.1).
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DraftSummary {
    pub id: String,
    pub target_type: DraftTargetType,
    pub name: String,
    pub preview: String,
    pub tool_name: String,
    pub status: DraftStatus,
    pub created_at: DateTime<Utc>,
}
