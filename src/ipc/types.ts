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
