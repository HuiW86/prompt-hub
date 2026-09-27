import { invoke } from "@tauri-apps/api/core";

import { currentSessionStartedAt, noteLiveCue } from "../stores/sessionStore";

import type {
  AlignmentAxisValue,
  AlignmentAxisValueWithRefs,
  AlignmentPhrase,
  AlignmentPhraseCoordinates,
  AxisKind,
  Composition,
  Draft,
  DraftPayload,
  DraftStatus,
  DraftSummary,
  DraftTargetType,
  DriftLedger,
  GroupKind,
  ImportSummary,
  Macro,
  Modifier,
  MoveReceipt,
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
  WebsiteLibrary,
  WebsiteInput,
} from "./types";

// ── Trash types (ADR-028) ─────────────────────────────────────────────────────
// Declared here rather than in ./types because the trash is an ipc-only surface:
// no store or component models a trashed asset, they only render what
// `listTrash` returns. Mirrors `repo_core::trash` — keep the two in step.

/// The seven asset tables an entry can come from. Wire form is the snake_case
/// discriminant of the Rust `AssetKind` enum.
export type AssetKind =
  | "modifier"
  | "macro"
  | "alignment_phrase"
  | "composition"
  | "phrase"
  | "scene"
  | "sub_stage";

/// One row in the trash. `label` is the asset's name — enough to recognise it;
/// the body is deliberately not carried.
export interface TrashEntry {
  kind: AssetKind;
  id: string;
  label: string;
  deletedAt: string;
}

/// What emptying the trash destroyed.
export interface PurgeSummary {
  assets: number;
  usageRecords: number;
}

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
  // suppressHide=true keeps the window after the copy (D-0 整理态); omitted /
  // false preserves 调用态 复制即隐藏.
  //
  // The session stamp (ADR-029) is applied HERE, not at the call sites: which
  // wake a copy belongs to is a property of the app's state, not of the button
  // that was pressed, and putting it in one place is what keeps the drift
  // ledger from silently losing records whenever a new copy path is added. A
  // caller that has already set it wins, which is what makes the behaviour
  // testable without a live wake event.
  //
  // The session-scoped cue counter is bumped here for the same reason and in
  // the same breath: the status bar's 「中途口令 N 次」 must count every cue copy
  // and only cue copies, and `source === "live_cue"` is exactly that predicate
  // (usageSource.ts owns the decision, so no call site has to repeat it). The
  // bump lands AFTER the invoke resolves — a rejected write must not leave a
  // number on screen that no record backs.
  recordUsage: async (input: RecordUsageInput, suppressHide?: boolean) => {
    const record = await invoke<UsageRecord>("record_usage", {
      input: {
        ...input,
        sessionStartedAt: input.sessionStartedAt ?? currentSessionStartedAt(),
      },
      suppressHide,
    });
    if (input.source === "live_cue") noteLiveCue();
    return record;
  },
  hideWindow: () => invoke<void>("hide_window"),
  showWindow: () => invoke<void>("show_window"),
  // True when the wake chord registered at startup (or at the last rebind).
  // Queried once at App mount; false drives a dismissible warning banner (the
  // chord is likely claimed by another app).
  hotkeyRegistered: () => invoke<boolean>("hotkey_registered"),
  // The chord currently registered with the OS (ADR-027). Read from Rust rather
  // than localStorage: this preference is registered in setup(), before any
  // renderer exists, so SQLite is the only store that can serve it in time —
  // and the live registration, not the renderer's copy, is the truth.
  getGlobalHotkey: () => invoke<string>("get_global_hotkey"),
  // Rebind. Rejects unparseable input and modifier-less chords, and rolls back
  // to the previous chord when the OS refuses the new one; resolves with the
  // accelerator that is now live.
  setGlobalHotkey: (accelerator: string) =>
    invoke<string>("set_global_hotkey", { accelerator }),

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
  // Reverse a discard (A1-04 / D-5): flips a discarded draft back to pending.
  restoreDraft: (id: string) => invoke<OkAck>("restore_draft", { id }),

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
  // `coordinates` omitted = an opening phrase with no coordinates, which is
  // exactly what every call site created before ADR-029.
  createAlignmentPhrase: (args: {
    phaseId: string;
    name: string;
    content: string;
    coordinates?: AlignmentPhraseCoordinates;
  }) =>
    invoke<AlignmentPhrase>("create_alignment_phrase", {
      phaseId: args.phaseId,
      name: args.name,
      content: args.content,
      coordinates: args.coordinates,
    }),
  // `notes` omitted = leave the existing note alone; it is the companion of a
  // content revision, not a field every edit rewrites. The backend stamps
  // `contentRevisedAt` only when `content` actually differs from what is
  // stored, so renaming or re-coordinating never moves the ledger's split
  // point (06-prd §6.6).
  updateAlignmentPhrase: (args: {
    id: string;
    name: string;
    content: string;
    notes?: string;
    coordinates?: AlignmentPhraseCoordinates;
  }) =>
    invoke<OkAck>("update_alignment_phrase", {
      id: args.id,
      name: args.name,
      content: args.content,
      notes: args.notes,
      coordinates: args.coordinates,
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

  // ── Alignment coordinate axes (ADR-029) — Tauri-only. The value lists behind
  // the three coordinate axes. Not assets: no trash, hard delete, and the
  // delete is irreversible, so it must be confirmed with both counts from
  // listAlignmentAxisValues shown. There is no separate count command on
  // purpose — needing the counts and needing the list are the same moment.
  listAlignmentAxisValues: () =>
    invoke<AlignmentAxisValueWithRefs[]>("list_alignment_axis_values"),
  createAlignmentAxisValue: (args: {
    axis: AxisKind;
    name: string;
    hint?: string;
  }) =>
    invoke<AlignmentAxisValue>("create_alignment_axis_value", {
      axis: args.axis,
      name: args.name,
      hint: args.hint,
    }),
  updateAlignmentAxisValue: (args: {
    id: string;
    name: string;
    hint?: string;
  }) =>
    invoke<OkAck>("update_alignment_axis_value", {
      id: args.id,
      name: args.name,
      hint: args.hint,
    }),
  // Irreversible. Phrases pointing at the value fall back to "unconstrained on
  // that axis", trashed ones included.
  deleteAlignmentAxisValue: (id: string) =>
    invoke<OkAck>("delete_alignment_axis_value", { id }),
  reorderAlignmentAxisValues: (axis: AxisKind, orderedIds: string[]) =>
    invoke<OkAck>("reorder_alignment_axis_values", { axis, orderedIds }),

  // The drift ledger (ADR-029 子决策 4): how many live cues followed each
  // opening phrase, per axis, split by that phrase's last content revision.
  // Counts only — never render a threshold, a ranking or a verdict from them
  // (01-spec §8.1).
  summarizeDriftLedger: () => invoke<DriftLedger>("summarize_drift_ledger"),

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
  // Cross-scene / cross-sub-stage move (ADR-022). Returns a MoveReceipt so the
  // caller can reverse it via the same command (fromOrderIndex →
  // targetOrderIndex refills the exact vacated slot). targetSubStageId null =
  // the ungrouped partition; targetOrderIndex omitted = append at the end.
  movePhrase: (args: {
    id: string;
    targetSceneId: string;
    targetSubStageId: string | null;
    targetOrderIndex?: number | null;
  }) =>
    invoke<MoveReceipt>("move_phrase", {
      id: args.id,
      targetSceneId: args.targetSceneId,
      targetSubStageId: args.targetSubStageId,
      targetOrderIndex: args.targetOrderIndex ?? null,
    }),

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

  // ── Trash (ADR-028 P0) — Tauri-only. Every delete above is now an in-place
  // `deletedAt` stamp rather than a row removal, so these three are the other
  // half: put one asset back, list what is in the trash, empty it for good. The
  // delete commands keep their signatures, which is why the callers above did
  // not have to change. `purgeTrash` is the one irreversible action in the set
  // and must stay behind a confirmation.
  restoreAsset: (kind: AssetKind, id: string) =>
    invoke<OkAck>("restore_asset", { kind, id }),
  listTrash: () => invoke<TrashEntry[]>("list_trash"),
  purgeTrash: () => invoke<PurgeSummary>("purge_trash"),

  // ── Data export/import (PRD §6.9/§7.5) — Tauri-only. The frontend picks a
  // path via the native dialog; Rust does the actual file read/write. Import is
  // full-replace (wipe-and-restore); usage_records are not exported (D2).
  exportData: (path: string) => invoke<void>("export_data", { path }),
  importData: (path: string) => invoke<ImportSummary>("import_data", { path }),

  listWebsites: () => invoke<WebsiteLibrary>("list_websites"),
  saveWebsite: (input: WebsiteInput) => invoke<void>("save_website", { input }),
  deleteWebsite: (id: string) => invoke<void>("delete_website", { id }),
  restoreWebsite: (id: string) => invoke<void>("restore_website", { id }),
  saveWebsiteGroup: (id: string | null, name: string) =>
    invoke<void>("save_website_group", { id, name }),
  deleteWebsiteGroup: (id: string) =>
    invoke<void>("delete_website_group", { id }),
  reorderWebsites: (groupId: string | null, orderedIds: string[]) =>
    invoke<void>("reorder_websites", { groupId, orderedIds }),
  reorderWebsiteGroups: (orderedIds: string[]) =>
    invoke<void>("reorder_website_groups", { orderedIds }),
  openWebsite: (id: string) => invoke<void>("open_website", { id }),
};

export type Ipc = typeof ipc;
