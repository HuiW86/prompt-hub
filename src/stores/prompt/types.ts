import type {
  AlignmentPhrase,
  Composition,
  DraftPayload,
  DraftSummary,
  GroupKind,
  Macro,
  Modifier,
  MoveReceipt,
  Phase,
  PromoteResult,
  RecentUsageEntry,
  RecordUsageInput,
  SceneWithChildren,
  SubStage,
} from "../../ipc/types";

export type LoadState = "idle" | "loading" | "ready" | "error";

export interface PromptState {
  phases: Phase[];
  alignmentPhrasesByPhase: Record<string, AlignmentPhrase[]>;
  compositionsByPhase: Record<string, Composition[]>;
  macros: Macro[];
  modifiers: Modifier[];
  scenes: SceneWithChildren[];
  recentUsage: RecentUsageEntry[];
  // Real day-bounded count. Independent of recentUsage (which is capped at
  // RECENT_LIMIT) so the StatusBar reflects every copy across the local day.
  todayCount: number;
  // Drafts staged by the MCP pipeline, awaiting omar's promote/discard. The
  // list backs the Scene 📥 草稿 tab; pendingDraftCount backs the 顶部待审 badge
  // (shown only when > 0). Kept distinct from the StatusBar's "待沉淀" metric,
  // which is about the user's own high-use Compositions (PRD §5.7 vs §10.3).
  drafts: DraftSummary[];
  pendingDraftCount: number;
  loadState: LoadState;
  loadError: string | null;

  refreshAll: () => Promise<void>;
  // suppressHide=true keeps the window after the copy (D-0 整理态). usageCount is
  // bumped and recents refresh regardless — hiding and statistics are decoupled.
  recordCopy: (
    input: RecordUsageInput,
    suppressHide?: boolean,
  ) => Promise<void>;
  refreshDrafts: () => Promise<void>;
  // Returns the PromoteResult (new asset id + type) plus, for phase-scoped
  // assets (protocol-layer phrases), the phaseId the asset landed under — so the
  // caller can switch the PhaseBar to it before flashing (A1-03). Keeping the
  // phase lookup here confines the protocol-layer slice read to the store, off
  // the task-layer/cross-layer components (B2).
  promoteDraft: (args: {
    id: string;
    groupKind?: string;
  }) => Promise<PromoteResult & { phaseId: string | null }>;
  // UI edit-save of a pending draft (PRD §10.3 update_draft). `payload` is the
  // FULL replacement body — callers hydrate via ipc.getDraft first so hidden
  // fields (schema_version / phase_id / scene_id / is_default) survive the edit.
  updateDraft: (args: { id: string; payload: DraftPayload }) => Promise<void>;
  discardDraft: (id: string) => Promise<void>;
  // Reverse a discard (A1-04 / D-5 撤销). Re-pulls the inbox so the restored
  // draft rejoins the list + badge; rethrows so the caller can toast a failed
  // restore (e.g. the dedup slot was re-staged in the interim).
  restoreDraft: (id: string) => Promise<void>;

  // Direct macro editing (plan asset-editing §0 Q2/Q6). create awaits the
  // backend (needs the generated id + order_index); update/delete/reorder apply
  // optimistically and roll back to a pre-mutation snapshot if the IPC rejects.
  createMacro: (args: {
    name: string;
    content: string;
    sceneId?: string;
  }) => Promise<void>;
  updateMacro: (args: {
    id: string;
    name: string;
    content: string;
  }) => Promise<void>;
  deleteMacro: (id: string) => Promise<void>;
  reorderMacros: (orderedIds: string[]) => Promise<void>;

  // Direct modifier editing (plan asset-editing §0 Q2/Q6, decision D-a). Mirrors
  // the macro methods; reorder is scoped to one groupKind quadrant since
  // order_index restarts per quadrant. update's optional groupKind is the P3-6
  // quadrant-move remedy: the backend re-homes the row at the END of the target
  // quadrant, and the optimistic patch mirrors that append.
  createModifier: (args: {
    name: string;
    content: string;
    groupKind: GroupKind;
  }) => Promise<void>;
  updateModifier: (args: {
    id: string;
    name: string;
    content: string;
    groupKind?: GroupKind;
  }) => Promise<void>;
  deleteModifier: (id: string) => Promise<void>;
  reorderModifiers: (
    groupKind: GroupKind,
    orderedIds: string[],
  ) => Promise<void>;

  // Direct alignment-phrase editing (plan asset-editing §0 Q2/Q6, decision D-c).
  // Operates on the grouped alignmentPhrasesByPhase structure; reorder is scoped
  // to one phase bucket. delete throws if the backend rejects the phase default.
  createAlignmentPhrase: (args: {
    phaseId: string;
    name: string;
    content: string;
  }) => Promise<void>;
  updateAlignmentPhrase: (args: {
    id: string;
    name: string;
    content: string;
  }) => Promise<void>;
  deleteAlignmentPhrase: (id: string) => Promise<void>;
  reorderAlignmentPhrases: (
    phaseId: string,
    orderedIds: string[],
  ) => Promise<void>;
  // P3-6: swap the phase's protocol default. Optimistically flips isDefault
  // inside the phase bucket AND the phases[].defaultAlignmentPhraseId pointer
  // (both mirror the single backend transaction); rolls back both on rejection.
  setDefaultAlignmentPhrase: (phaseId: string, id: string) => Promise<void>;

  // Direct composition editing (plan asset-editing §0 Q2/Q6, decision A +
  // per-phase). Operates on the grouped compositionsByPhase structure; the body
  // is a modifierIds array (decision D-b). reorder is scoped to one phase bucket.
  createComposition: (args: {
    phaseId: string;
    name: string;
    modifierIds: string[];
    sceneId?: string;
  }) => Promise<void>;
  updateComposition: (args: {
    id: string;
    name: string;
    modifierIds: string[];
  }) => Promise<void>;
  deleteComposition: (id: string) => Promise<void>;
  reorderCompositions: (phaseId: string, orderedIds: string[]) => Promise<void>;

  // Direct scene-phrase editing (plan scene-phrase-editing). Operates on the
  // nested `scenes` structure; each mutation re-pulls listScenesWithChildren
  // rather than patching in place (the tree is deeply nested). reorder is scoped
  // to one (sceneId, subStageId) partition; subStageId null = ungrouped.
  createPhrase: (args: {
    sceneId: string;
    name: string;
    content: string;
    subStageId: string | null;
  }) => Promise<void>;
  updatePhrase: (args: {
    id: string;
    name: string;
    content: string;
    subStageId: string | null;
  }) => Promise<void>;
  deletePhrase: (id: string) => Promise<void>;
  reorderPhrases: (
    sceneId: string,
    subStageId: string | null,
    orderedIds: string[],
  ) => Promise<void>;
  // Cross-scene / cross-sub-stage move (ADR-022). Returns the MoveReceipt so the
  // caller can wire a short-lived 撤销 (re-invoke with the from* values). Like
  // the other phrase mutations it re-pulls the scenes tree; rethrows so a failed
  // move / undo surfaces an honest error toast. Passing targetOrderIndex refills
  // an exact slot (the undo path); omitting it appends at the target's end.
  movePhrase: (args: {
    id: string;
    targetSceneId: string;
    targetSubStageId: string | null;
    targetOrderIndex?: number | null;
  }) => Promise<MoveReceipt>;

  // Direct scene + sub-stage structure editing (plan scene-substage-editing).
  // Same nested `scenes` tree as phrases, so each mutation re-pulls
  // listScenesWithChildren. deleteScene rejects a non-empty Scene at the
  // backend (error propagates); deleteSubStage unbinds its phrases server-side.
  createScene: (args: {
    name: string;
    icon?: string;
    rolePresets: string[];
    color?: string;
  }) => Promise<void>;
  updateScene: (args: {
    id: string;
    name: string;
    icon?: string;
    rolePresets: string[];
    color?: string;
  }) => Promise<void>;
  deleteScene: (id: string) => Promise<void>;
  reorderScenes: (orderedIds: string[]) => Promise<void>;
  // Returns the created row so callers can chain writes against its id
  // (e.g. promoting the ungrouped bucket re-homes phrases into it).
  createSubStage: (args: {
    sceneId: string;
    name: string;
  }) => Promise<SubStage>;
  updateSubStage: (args: { id: string; name: string }) => Promise<void>;
  deleteSubStage: (id: string) => Promise<void>;
  reorderSubStages: (sceneId: string, orderedIds: string[]) => Promise<void>;
}

// Zustand slice signature. Each slice is a factory returning its portion of the
// combined PromptState; set/get are typed against the FULL state so a slice can
// read/write fields owned by another slice (e.g. bumpUsageCount touches macros +
// scenes + alignments at once). `refresh` carries the shared guarded re-pull
// helpers so scene/draft writers don't each re-implement the monotonic guard.
export type StateCreatorSlice<T> = (
  set: PromptSet,
  get: () => PromptState,
  refresh: RefreshHelpers,
) => T;

export type PromptSet = (
  partial:
    | PromptState
    | Partial<PromptState>
    | ((state: PromptState) => PromptState | Partial<PromptState>),
  replace?: false,
) => void;

// Shared guarded re-pull helpers. Both wrap a monotonic ticket so a slower
// earlier re-pull can't clobber a fresher later one (see guards.ts).
export interface RefreshHelpers {
  refreshScenes: () => Promise<void>;
  refreshDraftsGuarded: () => Promise<void>;
}
