import { invoke } from "@tauri-apps/api/core";

import type {
  AlignmentPhrase,
  Composition,
  Draft,
  DraftPayload,
  DraftStatus,
  DraftSummary,
  DraftTargetType,
  GroupKind,
  ImportSummary,
  Macro,
  Modifier,
  OkAck,
  Phase,
  Phrase,
  PromoteResult,
  RecentUsageEntry,
  RecordUsageInput,
  Scene,
  SceneWithChildren,
  SubStage,
  UpdateAck,
  UsageRecord,
} from "./types";

export const ipc = {
  listPhases: () => invoke<Phase[]>("list_phases"),
  listAlignmentPhrases: () =>
    invoke<AlignmentPhrase[]>("list_alignment_phrases"),
  listMacros: () => invoke<Macro[]>("list_macros"),
  listModifiers: () => invoke<Modifier[]>("list_modifiers"),
  listCompositions: () => invoke<Composition[]>("list_compositions"),
  listScenesWithChildren: () =>
    invoke<SceneWithChildren[]>("list_scenes_with_children"),
  listRecentUsage: (limit: number) =>
    invoke<RecentUsageEntry[]>("list_recent_usage", { limit }),
  countTodayUsage: () => invoke<number>("count_today_usage"),
  recordUsage: (input: RecordUsageInput) =>
    invoke<UsageRecord>("record_usage", { input }),
  hideWindow: () => invoke<void>("hide_window"),
  showWindow: () => invoke<void>("show_window"),
  // True when the ⌥Space global shortcut registered at startup. Queried once at
  // App mount; false drives a dismissible warning banner (the wake hotkey is
  // likely claimed by another app).
  hotkeyRegistered: () => invoke<boolean>("hotkey_registered"),

  // ── Draft inbox (PRD §10.3) — Tauri-only, never via MCP ──
  listDrafts: (args?: {
    status?: DraftStatus;
    targetType?: DraftTargetType;
    limit?: number;
  }) =>
    invoke<DraftSummary[]>("list_drafts", {
      status: args?.status,
      targetType: args?.targetType,
      limit: args?.limit,
    }),
  countPendingDrafts: () => invoke<number>("count_pending_drafts"),
  // Full-payload read for the promote 前编辑 flow: update_draft is a
  // full-replacement write, so the editor hydrates the stored payload first.
  getDraft: (id: string) => invoke<Draft>("get_draft", { id }),
  promoteDraft: (args: {
    id: string;
    overridePayload?: DraftPayload;
    groupKind?: string;
  }) =>
    invoke<PromoteResult>("promote_draft", {
      id: args.id,
      overridePayload: args.overridePayload,
      groupKind: args.groupKind,
    }),
  updateDraft: (id: string, payload: DraftPayload) =>
    invoke<UpdateAck>("update_draft", { id, payload }),
  discardDraft: (id: string) => invoke<OkAck>("discard_draft", { id }),

  // ── Macro direct editing (plan asset-editing §0 Q2/Q6) — Tauri-only ──
  createMacro: (args: { name: string; content: string; sceneId?: string }) =>
    invoke<Macro>("create_macro", {
      name: args.name,
      content: args.content,
      sceneId: args.sceneId,
    }),
  updateMacro: (args: { id: string; name: string; content: string }) =>
    invoke<OkAck>("update_macro", {
      id: args.id,
      name: args.name,
      content: args.content,
    }),
  deleteMacro: (id: string) => invoke<OkAck>("delete_macro", { id }),
  reorderMacros: (orderedIds: string[]) =>
    invoke<OkAck>("reorder_macros", { orderedIds }),

  // ── Modifier direct editing (plan asset-editing §0 Q2/Q6, decision D-a) ──
  // reorder is scoped to one groupKind quadrant.
  createModifier: (args: {
    name: string;
    content: string;
    groupKind: GroupKind;
  }) =>
    invoke<Modifier>("create_modifier", {
      name: args.name,
      content: args.content,
      groupKind: args.groupKind,
    }),
  // Optional groupKind = P3-6 quadrant-move remedy (fixes a wrong promote-time
  // pick); omitted = name/content-only edit, quadrant untouched.
  updateModifier: (args: {
    id: string;
    name: string;
    content: string;
    groupKind?: GroupKind;
  }) =>
    invoke<OkAck>("update_modifier", {
      id: args.id,
      name: args.name,
      content: args.content,
      groupKind: args.groupKind,
    }),
  deleteModifier: (id: string) => invoke<OkAck>("delete_modifier", { id }),
  reorderModifiers: (groupKind: GroupKind, orderedIds: string[]) =>
    invoke<OkAck>("reorder_modifiers", { groupKind, orderedIds }),

  // ── AlignmentPhrase direct editing (plan asset-editing §0 Q2/Q6, decision
  // D-c) — Tauri-only. reorder is scoped to one phase; delete refuses the
  // phase default at the backend.
  createAlignmentPhrase: (args: {
    phaseId: string;
    name: string;
    content: string;
  }) =>
    invoke<AlignmentPhrase>("create_alignment_phrase", {
      phaseId: args.phaseId,
      name: args.name,
      content: args.content,
    }),
  updateAlignmentPhrase: (args: {
    id: string;
    name: string;
    content: string;
  }) =>
    invoke<OkAck>("update_alignment_phrase", {
      id: args.id,
      name: args.name,
      content: args.content,
    }),
  deleteAlignmentPhrase: (id: string) =>
    invoke<OkAck>("delete_alignment_phrase", { id }),
  reorderAlignmentPhrases: (phaseId: string, orderedIds: string[]) =>
    invoke<OkAck>("reorder_alignment_phrases", { phaseId, orderedIds }),
  // P3-6: swap the phase's protocol default — the only mutation path for
  // is_default (create is always non-default, delete refuses the default).
  setDefaultAlignmentPhrase: (args: { phaseId: string; id: string }) =>
    invoke<OkAck>("set_default_alignment_phrase", {
      phaseId: args.phaseId,
      id: args.id,
    }),

  // ── Composition direct editing (plan asset-editing §0 Q2/Q6, decision A +
  // per-phase) — Tauri-only. The body is a modifierIds array (decision D-b);
  // reorder is scoped to one phase.
  createComposition: (args: {
    phaseId: string;
    name: string;
    modifierIds: string[];
    sceneId?: string;
  }) =>
    invoke<Composition>("create_composition", {
      phaseId: args.phaseId,
      name: args.name,
      modifierIds: args.modifierIds,
      sceneId: args.sceneId,
    }),
  updateComposition: (args: {
    id: string;
    name: string;
    modifierIds: string[];
  }) =>
    invoke<OkAck>("update_composition", {
      id: args.id,
      name: args.name,
      modifierIds: args.modifierIds,
    }),
  deleteComposition: (id: string) =>
    invoke<OkAck>("delete_composition", { id }),
  reorderCompositions: (phaseId: string, orderedIds: string[]) =>
    invoke<OkAck>("reorder_compositions", { phaseId, orderedIds }),

  // ── Scene phrase direct editing (plan scene-phrase-editing) — Tauri-only. A
  // phrase is bound to a scene + OPTIONAL sub-stage; reorder is scoped to one
  // (sceneId, subStageId) partition. subStageId null = the ungrouped partition.
  createPhrase: (args: {
    sceneId: string;
    name: string;
    content: string;
    subStageId: string | null;
  }) =>
    invoke<Phrase>("create_phrase", {
      sceneId: args.sceneId,
      name: args.name,
      content: args.content,
      subStageId: args.subStageId,
    }),
  updatePhrase: (args: {
    id: string;
    name: string;
    content: string;
    subStageId: string | null;
  }) =>
    invoke<OkAck>("update_phrase", {
      id: args.id,
      name: args.name,
      content: args.content,
      subStageId: args.subStageId,
    }),
  deletePhrase: (id: string) => invoke<OkAck>("delete_phrase", { id }),
  reorderPhrases: (
    sceneId: string,
    subStageId: string | null,
    orderedIds: string[],
  ) => invoke<OkAck>("reorder_phrases", { sceneId, subStageId, orderedIds }),

  // ── Scene container direct editing (plan scene-substage-editing) —
  // Tauri-only. reorder is a single global order; delete refuses a non-empty
  // Scene (has phrases or sub-stages) at the backend.
  createScene: (args: {
    name: string;
    icon?: string;
    rolePresets: string[];
    color?: string;
  }) =>
    invoke<Scene>("create_scene", {
      name: args.name,
      icon: args.icon,
      rolePresets: args.rolePresets,
      color: args.color,
    }),
  updateScene: (args: {
    id: string;
    name: string;
    icon?: string;
    rolePresets: string[];
    color?: string;
  }) =>
    invoke<OkAck>("update_scene", {
      id: args.id,
      name: args.name,
      icon: args.icon,
      rolePresets: args.rolePresets,
      color: args.color,
    }),
  deleteScene: (id: string) => invoke<OkAck>("delete_scene", { id }),
  reorderScenes: (orderedIds: string[]) =>
    invoke<OkAck>("reorder_scenes", { orderedIds }),

  // ── SubStage direct editing (plan scene-substage-editing) — Tauri-only. A
  // sub-stage is bound to a scene; reorder is scoped to one scene; delete
  // unbinds its phrases (sub_stage_id → NULL) and keeps them.
  createSubStage: (args: { sceneId: string; name: string }) =>
    invoke<SubStage>("create_sub_stage", {
      sceneId: args.sceneId,
      name: args.name,
    }),
  updateSubStage: (args: { id: string; name: string }) =>
    invoke<OkAck>("update_sub_stage", { id: args.id, name: args.name }),
  deleteSubStage: (id: string) => invoke<OkAck>("delete_sub_stage", { id }),
  reorderSubStages: (sceneId: string, orderedIds: string[]) =>
    invoke<OkAck>("reorder_sub_stages", { sceneId, orderedIds }),

  // ── Data export/import (PRD §6.9/§7.5) — Tauri-only. The frontend picks a
  // path via the native dialog; Rust does the actual file read/write. Import is
  // full-replace (wipe-and-restore); usage_records are not exported (D2).
  exportData: (path: string) => invoke<void>("export_data", { path }),
  importData: (path: string) => invoke<ImportSummary>("import_data", { path }),
};

export type Ipc = typeof ipc;
