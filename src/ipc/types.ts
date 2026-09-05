// Mirror of the serde models exposed by src-tauri/src/models.rs. Rust fields are
// snake_case in storage but serialized as camelCase over IPC (`#[serde(rename_all
// = "camelCase")]`), so the TS shape matches the wire format directly.

export type UsageTargetType =
  | "modifier"
  | "macro"
  | "phrase"
  | "composition"
  | "alignment";

export type UsageSource =
  | "macro_area"
  | "scene"
  | "recent"
  | "sop"
  | "composition"
  | "phase_bar"
  // ADR-029. The one value that names a phrase CLASS rather than an entry
  // point: a live cue records this wherever it was copied from, so "recent"
  // and "phase_bar" stop being the complete set of copies made from those
  // regions. Deliberate overload — 06-prd §6.8.
  | "live_cue";

// Which kind of alignment phrase (ADR-029). Both kinds belong to a phase and
// both obey the protocol/task separation; they differ in when they are used.
export type PhraseKind = "opening" | "cue";

// Which axis a live cue corrects. Includes "form", which has no coordinate
// column of its own — form is carried by phaseId.
export type CueAxis = "form" | "layer" | "domain" | "mode";

// The three coordinate axes. No "form": that would be a second source of truth
// for which phase a phrase belongs to.
export type AxisKind = "layer" | "domain" | "mode";

export interface Phase {
  id: string;
  name: string;
  orderIndex: number;
  color: string | null;
  description: string | null;
  visible: boolean;
  defaultAlignmentPhraseId: string | null;
}

export interface AlignmentPhrase {
  id: string;
  phaseId: string;
  name: string;
  content: string;
  isDefault: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  notes: string | null;
  deprecated: boolean;
  // Sort position WITHIN the phase (migration 0007, decision D-c).
  orderIndex: number;
  // ── ADR-029 ────────────────────────────────────────────────────────────────
  kind: PhraseKind;
  // null on an axis means "unconstrained", NOT an axis value named 不限.
  layerId: string | null;
  domainId: string | null;
  modeId: string | null;
  // Only meaningful when kind === "cue"; null covers openings and 「停」.
  cueAxis: CueAxis | null;
  // When `content` last actually changed. Untouched by rename, coordinate
  // edits and set-default, so the drift ledger's split point is not moved by
  // edits that are not revisions.
  contentRevisedAt: string | null;
}

// One value on one coordinate axis. Not an asset: no trash, no deprecation,
// hard delete only (06-prd §6.6-bis).
export interface AlignmentAxisValue {
  id: string;
  axis: AxisKind;
  name: string;
  hint: string | null;
  orderIndex: number;
}

// What listAlignmentAxisValues returns. The two counts are computed per query,
// never stored and never exported.
//
// `trashedRefCount` matters because ON DELETE SET NULL is a SQL-level action
// that cannot see `deletedAt`: deleting an axis value blanks the coordinates of
// TRASHED phrases too. Show it whenever it is greater than zero, or the delete
// confirmation under-reports exactly the part of the blast radius the user
// cannot check.
export interface AlignmentAxisValueWithRefs extends AlignmentAxisValue {
  refCount: number;
  trashedRefCount: number;
}

// The ADR-029 classification + coordinates, sent as one payload by the create
// and update commands. Omitting it entirely means "an opening phrase with no
// coordinates" — the pre-ADR-029 behaviour.
export interface AlignmentPhraseCoordinates {
  kind: PhraseKind;
  cueAxis: CueAxis | null;
  layerId: string | null;
  domainId: string | null;
  modeId: string | null;
}

// ── Drift ledger (ADR-029 子决策 4) ───────────────────────────────────────────
// Counts, never judgements. Do NOT render a threshold, a ranking or a verdict
// from these numbers — 01-spec §8.1 forbids the app from judging alignment.

export interface AxisTally {
  form: number;
  layer: number;
  domain: number;
  mode: number;
}

export interface AnchorDrift {
  phraseId: string;
  name: string;
  revisedAt: string | null;
  // Cues stamped strictly before revisedAt; everything else is `after`. With
  // revisedAt === null there is no split point, so the whole tally is in
  // `after` and `before` is all zeros. before + after is always the total.
  before: AxisTally;
  after: AxisTally;
}

export interface DriftLedger {
  anchors: AnchorDrift[];
  // Every attributable cue copy. Deliberately NOT the sum of the anchor
  // tallies; every reason it can exceed them, so the gap is never read as a
  // rounding error:
  //   1. 「停」 — a halt, not a drift. No cueAxis, so it is filed nowhere.
  //   2. A cue fired before any opening phrase in its session — no anchor to
  //      attribute it to. Also in `unattributed`.
  //   3. A cue whose ANCHOR phrase is in the trash — the record still bounds
  //      the session, but an unlistable phrase cannot be shown as a row. Also
  //      in `unattributed`.
  //   4. A cue whose OWN phrase is in the trash — its axis cannot be resolved,
  //      so like 「停」 it is filed nowhere. NOT in `unattributed`: it did have
  //      an anchor.
  // Records with no sessionStartedAt (everything written before migration 0014)
  // are outside all of this and appear in no counter.
  liveCueTotal: number;
  unattributed: number;
}

export interface Macro {
  id: string;
  name: string;
  content: string;
  expandFrom: string[] | null;
  native: boolean;
  role: string | null;
  task: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  notes: string | null;
  sceneId: string | null;
  deprecated: boolean;
  orderIndex: number;
}

export interface Modifier {
  id: string;
  name: string;
  content: string;
  // CHECK-constrained to the four quadrants at the SQL layer; typed as GroupKind
  // here (see GROUP_KINDS below) since the wire value is always one of the four.
  groupKind: GroupKind;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  notes: string | null;
  deprecated: boolean;
  // Sort position WITHIN the groupKind quadrant (migration 0006, decision D-a).
  orderIndex: number;
}

export interface Composition {
  id: string;
  name: string;
  // The composition's body: an ordered set of modifier ids (decision D-b),
  // not free text. Stored as a JSON column at the SQL layer.
  modifierIds: string[];
  phaseId: string;
  sceneId: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  notes: string | null;
  deprecated: boolean;
  // Sort position WITHIN the phase (migration 0008, decision A + per-phase).
  orderIndex: number;
}

export interface Scene {
  id: string;
  name: string;
  icon: string | null;
  orderIndex: number;
  visible: boolean;
  rolePresets: string[];
  color: string | null;
}

export interface SubStage {
  id: string;
  sceneId: string;
  name: string;
  orderIndex: number;
}

export interface Phrase {
  id: string;
  sceneId: string;
  name: string;
  content: string;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  notes: string | null;
  deprecated: boolean;
  subStageId: string | null;
  orderIndex: number;
}

export interface SceneWithChildren {
  scene: Scene;
  subStages: SubStage[];
  phrases: Phrase[];
}

export interface UsageRecord {
  id: string;
  timestamp: string;
  targetType: UsageTargetType;
  targetId: string | null;
  source: UsageSource;
  modifierIds: string[] | null;
  sopId: string | null;
  sopStepOrder: number | null;
  phaseId: string | null;
  // The wake this copy belonged to (ADR-029). null on every row written before
  // migration 0014; the drift ledger skips those rather than inventing a
  // session boundary for them.
  sessionStartedAt: string | null;
}

// Callers leave sessionStartedAt off: the ipc layer stamps it from
// sessionStore, so no call site has to remember which wake it is in.
export interface RecordUsageInput {
  targetType: UsageTargetType;
  targetId: string | null;
  source: UsageSource;
  modifierIds: string[] | null;
  sopId: string | null;
  sopStepOrder: number | null;
  phaseId: string | null;
  sessionStartedAt?: string | null;
}

export interface RecentUsageEntry {
  record: UsageRecord;
  targetName: string | null;
  targetContent: string | null;
}

// ── Draft inbox (PRD §10.3) ──────────────────────────────────────────────────

export type DraftTargetType =
  | "modifier"
  | "composition"
  | "macro"
  | "alignment_phrase";

export type DraftStatus = "pending" | "discarded";

export const GROUP_KINDS = [
  "cognition",
  "action",
  "delivery",
  "constraint",
] as const;
export type GroupKind = (typeof GROUP_KINDS)[number];

// NOTE: unlike the other models, DraftPayload's inner fields stay snake_case on
// the wire. Its Rust enum is `#[serde(tag = "target_type", rename_all =
// "snake_case")]` — rename_all renames the *variants* (→ the target_type tag),
// not the fields. So `schema_version` / `phase_id` / `scene_id` / `modifier_ids`
// / `is_default` are sent verbatim. serde deserializes this object directly (it
// is not a top-level Tauri command arg, so Tauri's camelCase conversion does not
// touch it).
export type DraftPayload =
  | {
      target_type: "modifier";
      schema_version: number;
      name: string;
      content: string;
      phase_id: string;
      scene_id: string | null;
    }
  | {
      target_type: "composition";
      schema_version: number;
      name: string;
      modifier_ids: string[];
      phase_id: string;
      scene_id: string | null;
    }
  | {
      target_type: "macro";
      schema_version: number;
      name: string;
      content: string;
      phase_id: string;
      scene_id: string | null;
    }
  | {
      target_type: "alignment_phrase";
      schema_version: number;
      name: string;
      content: string;
      phase_id: string;
      is_default: boolean;
    };

export interface Provenance {
  sourceApp: string;
  conversationRef: string;
  toolName: string;
  modelHint: string | null;
  confidence: number | null;
}

// get_draft hydration — the full stored row (payload included), fetched right
// before the inbox edit flow opens so update_draft's full-replacement write
// never starts from the lossy list preview. Outer fields are camelCase
// (`#[serde(rename_all = "camelCase")]` on the Rust Draft struct); the nested
// payload keeps its own snake_case wire shape (see DraftPayload note above).
export interface Draft {
  id: string;
  targetType: DraftTargetType;
  schemaVersion: number;
  payload: DraftPayload;
  payloadHash: string;
  provenance: Provenance;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
}

// list_drafts projection — metadata + short preview, never the full payload.
export interface DraftSummary {
  id: string;
  targetType: DraftTargetType;
  name: string;
  preview: string;
  toolName: string;
  status: DraftStatus;
  createdAt: string;
}

export interface PromoteResult {
  insertedAssetId: string;
  insertedAssetType: DraftTargetType;
}

// move_phrase undo receipt (ADR-022): the phrase's position BEFORE the move.
// Re-invoking move_phrase with these as the target_* args (fromOrderIndex →
// targetOrderIndex) reverses the move to its exact original slot. camelCase over
// the wire via the Rust MoveReceipt's #[serde(rename_all = "camelCase")].
export interface MoveReceipt {
  phraseId: string;
  fromSceneId: string;
  fromSubStageId: string | null;
  fromOrderIndex: number;
}

export interface UpdateAck {
  ok: boolean;
  updatedAt: string;
}

export interface OkAck {
  ok: boolean;
}

// Per-table row counts restored by a wipe-and-restore import (PRD §7.5).
export interface ImportSummary {
  modifiers: number;
  macros: number;
  scenes: number;
  subStages: number;
  phrases: number;
  phases: number;
  alignmentPhrases: number;
  compositions: number;
  // null when the backup carried no `alignment_axis_values` key at all (a 1.1 /
  // 1.2 file): the table did not take part in the restore, which is not the
  // same statement as "restored zero rows".
  alignmentAxisValues: number | null;
}
