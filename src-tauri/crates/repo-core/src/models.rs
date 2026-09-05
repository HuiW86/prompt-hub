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

// Which kind of alignment phrase this is (ADR-029 子决策 3). Both kinds are
// alignment phrases, both belong to a phase, both obey the protocol/task
// separation of 02-constitution B2 — the difference is WHEN they are used and,
// consequently, which `source` their copy records.
//
// A column rather than an inference from `phase_id`: the six cues are seeded
// under 中途, but a phase is user-editable, so storing "this is a cue" in "which
// phase it happens to sit in" loses the fact the moment anyone moves it.
#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum PhraseKind {
    #[default]
    Opening,
    Cue,
}

impl PhraseKind {
    pub fn as_str(self) -> &'static str {
        match self {
            PhraseKind::Opening => "opening",
            PhraseKind::Cue => "cue",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "opening" => Some(PhraseKind::Opening),
            "cue" => Some(PhraseKind::Cue),
            _ => None,
        }
    }
}

// Which axis a live cue corrects, for the per-axis drift tally. Includes `Form`,
// which has no coordinate column at all (form is carried by phase_id) — that is
// half the reason this is its own column rather than a reuse of the three
// coordinates (ADR-029 口径 3).
#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum CueAxis {
    Form,
    Layer,
    Domain,
    Mode,
}

impl CueAxis {
    pub fn as_str(self) -> &'static str {
        match self {
            CueAxis::Form => "form",
            CueAxis::Layer => "layer",
            CueAxis::Domain => "domain",
            CueAxis::Mode => "mode",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "form" => Some(CueAxis::Form),
            "layer" => Some(CueAxis::Layer),
            "domain" => Some(CueAxis::Domain),
            "mode" => Some(CueAxis::Mode),
            _ => None,
        }
    }
}

// The three coordinate axes an AlignmentAxisValue can belong to. Deliberately
// NOT the same set as CueAxis: there is no `form` axis here because form is
// phase_id, and a `Form` row in this table would be a second source of truth
// for which phase a phrase belongs to (06-prd §6.6 字段设计理由).
#[derive(Debug, Serialize, Deserialize, Copy, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum AxisKind {
    Layer,
    Domain,
    Mode,
}

impl AxisKind {
    pub fn as_str(self) -> &'static str {
        match self {
            AxisKind::Layer => "layer",
            AxisKind::Domain => "domain",
            AxisKind::Mode => "mode",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "layer" => Some(AxisKind::Layer),
            "domain" => Some(AxisKind::Domain),
            "mode" => Some(AxisKind::Mode),
            _ => None,
        }
    }

    /// The `alignment_phrases` column this axis writes into. Used to validate
    /// that a coordinate id actually belongs to the axis it is being assigned to.
    pub fn phrase_column(self) -> &'static str {
        match self {
            AxisKind::Layer => "layer_id",
            AxisKind::Domain => "domain_id",
            AxisKind::Mode => "mode_id",
        }
    }
}

// One value on one coordinate axis (06-prd §6.6-bis). NOT an asset: no
// `deleted_at`, no `deprecated`, no `usage_count`. This is exactly the five
// columns of the table and exactly what the export carries — the read-only
// reference counts live on `AlignmentAxisValueWithRefs` instead, so they cannot
// leak into a backup file and become part of the import contract.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AlignmentAxisValue {
    pub id: String,
    pub axis: AxisKind,
    pub name: String,
    pub hint: Option<String>,
    pub order_index: i64,
}

// What `list_alignment_axis_values` returns: the row plus the two counts the
// delete confirmation needs. Both are computed per query, never stored.
//
// `trashed_ref_count` is not decoration. `ON DELETE SET NULL` is a SQL-level
// action and SQL has never heard of `deleted_at`, so deleting an axis value
// blanks the coordinates of trashed phrases too — reporting only the live count
// would under-report exactly the part of the blast radius the user cannot see
// (06-prd §6.6-bis).
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AlignmentAxisValueWithRefs {
    #[serde(flatten)]
    pub value: AlignmentAxisValue,
    pub ref_count: i64,
    pub trashed_ref_count: i64,
}

// The ADR-029 classification + coordinate fields, as one payload shared by the
// create and update write paths (and therefore by their two Tauri commands).
// Grouped rather than spread over five more positional parameters: they are
// edited together in one form and validated together against the axis table.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AlignmentPhraseCoordinates {
    #[serde(default)]
    pub kind: PhraseKind,
    #[serde(default)]
    pub cue_axis: Option<CueAxis>,
    #[serde(default)]
    pub layer_id: Option<String>,
    #[serde(default)]
    pub domain_id: Option<String>,
    #[serde(default)]
    pub mode_id: Option<String>,
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
    // Sort position WITHIN the phase (migration 0007, decision D-c).
    pub order_index: i64,
    // ADR-028 soft delete: NULL = alive, Some(ts) = in the trash. Every list
    // read filters it out, so a model built by a read path always carries None;
    // only the export (full fidelity) and the trash surfaces ever see Some.
    #[serde(default)]
    pub deleted_at: Option<DateTime<Utc>>,
    // ── ADR-029 ──────────────────────────────────────────────────────────────
    // All six default when absent, which is what lets a 1.1 / 1.2 backup file
    // deserialize into this struct: a phrase with no `kind` is an opening
    // phrase, and a phrase with no coordinates is unconstrained on every axis
    // (06-prd §6.9 compatibility clause).
    #[serde(default)]
    pub kind: PhraseKind,
    // NULL on any axis means "unconstrained", NOT a row named 不限.
    #[serde(default)]
    pub layer_id: Option<String>,
    #[serde(default)]
    pub domain_id: Option<String>,
    #[serde(default)]
    pub mode_id: Option<String>,
    // Only meaningful when `kind == Cue`; NULL covers both openings and 「停」.
    #[serde(default)]
    pub cue_axis: Option<CueAxis>,
    // When `content` last actually changed — the ledger's before/after split
    // point. Untouched by rename, coordinate edits and set-default.
    #[serde(default)]
    pub content_revised_at: Option<DateTime<Utc>>,
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
    // ADR-028 soft delete: NULL = alive, Some(ts) = in the trash. Every list
    // read filters it out, so a model built by a read path always carries None;
    // only the export (full fidelity) and the trash surfaces ever see Some.
    #[serde(default)]
    pub deleted_at: Option<DateTime<Utc>>,
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
    // Sort position WITHIN the group_kind quadrant (migration 0006, decision D-a).
    pub order_index: i64,
    // ADR-028 soft delete: NULL = alive, Some(ts) = in the trash. Every list
    // read filters it out, so a model built by a read path always carries None;
    // only the export (full fidelity) and the trash surfaces ever see Some.
    #[serde(default)]
    pub deleted_at: Option<DateTime<Utc>>,
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
    // Sort position WITHIN the phase (migration 0008, decision A + per-phase).
    pub order_index: i64,
    // ADR-028 soft delete: NULL = alive, Some(ts) = in the trash. Every list
    // read filters it out, so a model built by a read path always carries None;
    // only the export (full fidelity) and the trash surfaces ever see Some.
    #[serde(default)]
    pub deleted_at: Option<DateTime<Utc>>,
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
    // ADR-028 soft delete: NULL = alive, Some(ts) = in the trash. Every list
    // read filters it out, so a model built by a read path always carries None;
    // only the export (full fidelity) and the trash surfaces ever see Some.
    #[serde(default)]
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SubStage {
    pub id: String,
    pub scene_id: String,
    pub name: String,
    pub order_index: i64,
    // ADR-028 soft delete: NULL = alive, Some(ts) = in the trash. Every list
    // read filters it out, so a model built by a read path always carries None;
    // only the export (full fidelity) and the trash surfaces ever see Some.
    #[serde(default)]
    pub deleted_at: Option<DateTime<Utc>>,
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
    pub order_index: i64,
    // ADR-028 soft delete: NULL = alive, Some(ts) = in the trash. Every list
    // read filters it out, so a model built by a read path always carries None;
    // only the export (full fidelity) and the trash surfaces ever see Some.
    #[serde(default)]
    pub deleted_at: Option<DateTime<Utc>>,
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
    // ADR-029: the one value that is a phrase CLASS rather than an entry point.
    // A cue copied from the recents strip records this, not `Recent`; ⌘9 from
    // the phase bar records this, not `PhaseBar`. Judged purely by the phrase's
    // `kind`, never by where the user clicked (06-prd §6.8). The cost is that
    // `Recent` / `PhaseBar` stop being the complete set of copies made from
    // those regions; the gain is that the 中途 phase can never be mistaken for
    // an opening anchor, since anchors are `PhaseBar` records.
    LiveCue,
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
            UsageSource::LiveCue => "live_cue",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "macro_area" => Some(UsageSource::MacroArea),
            "scene" => Some(UsageSource::Scene),
            "recent" => Some(UsageSource::Recent),
            "sop" => Some(UsageSource::Sop),
            "composition" => Some(UsageSource::Composition),
            "phase_bar" => Some(UsageSource::PhaseBar),
            "live_cue" => Some(UsageSource::LiveCue),
            _ => None,
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
    // ADR-029: the wake this copy belonged to. Identical for every record made
    // during one summon; NULL for everything written before migration 0014 and
    // for any caller that does not know its session. Stored on the record
    // rather than in a sessions table because a session here has no attributes
    // — GROUP BY this column is the whole concept (06-prd §6.8).
    #[serde(default)]
    pub session_started_at: Option<DateTime<Utc>>,
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
    // Absent = "no session known", which the ledger skips rather than guesses.
    #[serde(default)]
    pub session_started_at: Option<DateTime<Utc>>,
}

// ── Drift ledger (ADR-029 子决策 4 / 06-prd §6.8) ─────────────────────────────
// Counts, never judgements. "This phrase was followed by 7 layer cues" is
// bookkeeping; "this phrase is weak on the layer axis" is a verdict, and
// 01-spec §8.1 forbids the app from reaching one. Nothing here carries a
// threshold, a rank or a recommendation, and the status dashboard must not
// render one either.

/// Per-axis cue tally for one segment of one anchor phrase.
#[derive(Debug, Serialize, Deserialize, Clone, Copy, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AxisTally {
    pub form: i64,
    pub layer: i64,
    pub domain: i64,
    pub mode: i64,
}

impl AxisTally {
    fn bump(&mut self, axis: CueAxis) {
        match axis {
            CueAxis::Form => self.form += 1,
            CueAxis::Layer => self.layer += 1,
            CueAxis::Domain => self.domain += 1,
            CueAxis::Mode => self.mode += 1,
        }
    }
}

/// One opening phrase and the cues that followed it inside the same wake.
///
/// `before` holds the cues whose timestamp is strictly earlier than
/// `revised_at`; everything else is `after`. When `revised_at` is None the
/// phrase's content has never changed, so there is no split point and nothing
/// can be earlier than it — the whole tally sits in `after`, and `before` is
/// all zeros. `before + after` is therefore always the phrase's full attributed
/// total, split or not.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AnchorDrift {
    pub phrase_id: String,
    pub name: String,
    pub revised_at: Option<DateTime<Utc>>,
    pub before: AxisTally,
    pub after: AxisTally,
}

/// The whole ledger: per-anchor tallies plus the two session-level totals.
///
/// `live_cue_total` counts every attributable cue copy. It is deliberately NOT
/// the sum of the anchor tallies, and every reason it can exceed them is listed
/// here so the gap is never mistaken for a rounding error (ADR-029 子决策 4):
///
///   1. **「停」** — a halt, not a drift. It has no `cue_axis`, so it is counted
///      and filed in no column (06-prd §6.8 step 4).
///   2. **A cue fired before any opening phrase in its session** — there is no
///      anchor to attribute it to. Also counted in `unattributed`.
///   3. **A cue whose ANCHOR phrase is in the trash** — the anchor record still
///      bounds the session, but a phrase nobody can list cannot be shown as a
///      row. Also counted in `unattributed`.
///   4. **A cue whose OWN phrase is in the trash** — its axis cannot be
///      resolved, so like 「停」 it is counted and filed nowhere. NOT counted in
///      `unattributed`: it did have an anchor.
///
/// Rows whose `session_started_at` is NULL (everything written before migration
/// 0014) are outside all of these — they never enter the algorithm at all and
/// appear in no counter.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DriftLedger {
    pub anchors: Vec<AnchorDrift>,
    pub live_cue_total: i64,
    pub unattributed: i64,
}

impl AnchorDrift {
    pub(crate) fn count(&mut self, axis: CueAxis, at: DateTime<Utc>) {
        match self.revised_at {
            Some(revised) if at < revised => self.before.bump(axis),
            _ => self.after.bump(axis),
        }
    }
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
