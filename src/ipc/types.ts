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
  | "phase_bar";

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
}

export interface RecordUsageInput {
  targetType: UsageTargetType;
  targetId: string | null;
  source: UsageSource;
  modifierIds: string[] | null;
  sopId: string | null;
  sopStepOrder: number | null;
  phaseId: string | null;
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

export interface UpdateAck {
  ok: boolean;
  updatedAt: string;
}

export interface OkAck {
  ok: boolean;
}
