import { invoke } from "@tauri-apps/api/core";

import type {
  AlignmentPhrase,
  DraftPayload,
  DraftStatus,
  DraftSummary,
  DraftTargetType,
  Macro,
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
};

export type Ipc = typeof ipc;
