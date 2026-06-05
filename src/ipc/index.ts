import { invoke } from "@tauri-apps/api/core";

import type {
  AlignmentPhrase,
  Composition,
  DraftPayload,
  DraftStatus,
  DraftSummary,
  DraftTargetType,
  GroupKind,
  Macro,
  Modifier,
  OkAck,
  Phase,
  PromoteResult,
  RecentUsageEntry,
  RecordUsageInput,
  SceneWithChildren,
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
  updateModifier: (args: { id: string; name: string; content: string }) =>
    invoke<OkAck>("update_modifier", {
      id: args.id,
      name: args.name,
      content: args.content,
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
};

export type Ipc = typeof ipc;
