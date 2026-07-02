import { create } from "zustand";

import { ipc } from "../ipc";
import type {
  AlignmentPhrase,
  Composition,
  DraftPayload,
  DraftSummary,
  GroupKind,
  Macro,
  Modifier,
  Phase,
  RecentUsageEntry,
  RecordUsageInput,
  SceneWithChildren,
  UsageTargetType,
} from "../ipc/types";

export type LoadState = "idle" | "loading" | "ready" | "error";

interface PromptState {
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
  recordCopy: (input: RecordUsageInput) => Promise<void>;
  refreshDrafts: () => Promise<void>;
  promoteDraft: (args: { id: string; groupKind?: string }) => Promise<void>;
  // UI edit-save of a pending draft (PRD §10.3 update_draft). `payload` is the
  // FULL replacement body — callers hydrate via ipc.getDraft first so hidden
  // fields (schema_version / phase_id / scene_id / is_default) survive the edit.
  updateDraft: (args: { id: string; payload: DraftPayload }) => Promise<void>;
  discardDraft: (id: string) => Promise<void>;

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
  createSubStage: (args: { sceneId: string; name: string }) => Promise<void>;
  updateSubStage: (args: { id: string; name: string }) => Promise<void>;
  deleteSubStage: (id: string) => Promise<void>;
  reorderSubStages: (sceneId: string, orderedIds: string[]) => Promise<void>;
}

const RECENT_LIMIT = 5;

function indexByPhase(
  phrases: AlignmentPhrase[],
): Record<string, AlignmentPhrase[]> {
  return phrases.reduce<Record<string, AlignmentPhrase[]>>((acc, p) => {
    (acc[p.phaseId] ??= []).push(p);
    return acc;
  }, {});
}

function indexCompositionsByPhase(
  compositions: Composition[],
): Record<string, Composition[]> {
  return compositions.reduce<Record<string, Composition[]>>((acc, c) => {
    (acc[c.phaseId] ??= []).push(c);
    return acc;
  }, {});
}

// Client-side mirror of DraftPayload::preview() in repo-core (80 chars,
// char-boundary safe via the spread iterator, Composition summarizes its
// modifier count) so the optimistic inbox card matches what a refetch shows.
const DRAFT_PREVIEW_MAX = 80;
function draftPreview(payload: DraftPayload): string {
  const body =
    payload.target_type === "composition"
      ? `${payload.modifier_ids.length} modifiers`
      : payload.content;
  const chars = [...body];
  return chars.length > DRAFT_PREVIEW_MAX
    ? `${chars.slice(0, DRAFT_PREVIEW_MAX).join("")}…`
    : body;
}

// Mutate the matching asset list so the UI reflects the bump without a full
// refetch on every copy. Only Macro/Phrase/AlignmentPhrase carry a usage_count
// the dashboard cares about; Modifier is not surfaced in phase 1.
function bumpUsageCount(
  state: PromptState,
  targetType: UsageTargetType,
  targetId: string | null,
  nowIso: string,
): Partial<PromptState> {
  if (!targetId) return {};
  switch (targetType) {
    case "macro":
      return {
        macros: state.macros.map((m) =>
          m.id === targetId
            ? { ...m, usageCount: m.usageCount + 1, lastUsedAt: nowIso }
            : m,
        ),
      };
    case "phrase":
      return {
        scenes: state.scenes.map((sc) => ({
          ...sc,
          phrases: sc.phrases.map((p) =>
            p.id === targetId
              ? { ...p, usageCount: p.usageCount + 1, lastUsedAt: nowIso }
              : p,
          ),
        })),
      };
    case "alignment": {
      const next: Record<string, AlignmentPhrase[]> = {};
      for (const [phaseId, list] of Object.entries(
        state.alignmentPhrasesByPhase,
      )) {
        next[phaseId] = list.map((a) =>
          a.id === targetId
            ? { ...a, usageCount: a.usageCount + 1, lastUsedAt: nowIso }
            : a,
        );
      }
      return { alignmentPhrasesByPhase: next };
    }
    default:
      return {};
  }
}

export const usePromptStore = create<PromptState>()((set, get) => ({
  phases: [],
  alignmentPhrasesByPhase: {},
  compositionsByPhase: {},
  macros: [],
  modifiers: [],
  scenes: [],
  recentUsage: [],
  todayCount: 0,
  drafts: [],
  pendingDraftCount: 0,
  loadState: "idle",
  loadError: null,

  refreshAll: async () => {
    set({ loadState: "loading", loadError: null });
    try {
      const [
        phases,
        alignments,
        compositions,
        macros,
        modifiers,
        scenes,
        recent,
        todayCount,
        drafts,
        pendingDraftCount,
      ] = await Promise.all([
        ipc.listPhases(),
        ipc.listAlignmentPhrases(),
        ipc.listCompositions(),
        ipc.listMacros(),
        ipc.listModifiers(),
        ipc.listScenesWithChildren(),
        ipc.listRecentUsage(RECENT_LIMIT),
        ipc.countTodayUsage(),
        ipc.listDrafts({ status: "pending" }),
        ipc.countPendingDrafts(),
      ]);
      set({
        phases,
        alignmentPhrasesByPhase: indexByPhase(alignments),
        compositionsByPhase: indexCompositionsByPhase(compositions),
        macros,
        modifiers,
        scenes,
        recentUsage: recent,
        todayCount,
        drafts,
        pendingDraftCount,
        loadState: "ready",
      });
    } catch (err) {
      set({
        loadState: "error",
        loadError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  recordCopy: async (input) => {
    const record = await ipc.recordUsage(input);
    set((state) =>
      bumpUsageCount(state, input.targetType, input.targetId, record.timestamp),
    );
    // Refresh recent list + today count in parallel so the new copy lands at
    // the top of recents with target_name JOINed AND the StatusBar increments
    // in lockstep. Both are bounded queries — cheap.
    const [recent, todayCount] = await Promise.all([
      ipc.listRecentUsage(RECENT_LIMIT),
      ipc.countTodayUsage(),
    ]);
    set({ recentUsage: recent, todayCount });
  },

  refreshDrafts: async () => {
    const [drafts, pendingDraftCount] = await Promise.all([
      ipc.listDrafts({ status: "pending" }),
      ipc.countPendingDrafts(),
    ]);
    set({ drafts, pendingDraftCount });
  },

  promoteDraft: async ({ id, groupKind }) => {
    await ipc.promoteDraft({ id, groupKind });
    // The draft left the inbox and a new asset landed in one of the four real
    // tables. Refresh the inbox (list + badge) and silently re-pull the asset
    // slices so the promoted item shows on this summon without a loadState flash.
    const [macros, modifiers, scenes, alignments, compositions] =
      await Promise.all([
        ipc.listMacros(),
        ipc.listModifiers(),
        ipc.listScenesWithChildren(),
        ipc.listAlignmentPhrases(),
        ipc.listCompositions(),
      ]);
    set({
      macros,
      modifiers,
      scenes,
      alignmentPhrasesByPhase: indexByPhase(alignments),
      compositionsByPhase: indexCompositionsByPhase(compositions),
    });
    await get().refreshDrafts();
  },

  // Optimistic like updateMacro: re-derive the card's name/preview from the new
  // payload immediately, roll back to the snapshot if the IPC rejects (payload
  // too large, draft no longer pending, schema drift...) and rethrow for toasts.
  updateDraft: async ({ id, payload }) => {
    const snapshot = get().drafts;
    set({
      drafts: snapshot.map((d) =>
        d.id === id
          ? { ...d, name: payload.name, preview: draftPreview(payload) }
          : d,
      ),
    });
    try {
      await ipc.updateDraft(id, payload);
    } catch (err) {
      set({ drafts: snapshot });
      throw err;
    }
  },

  discardDraft: async (id) => {
    await ipc.discardDraft(id);
    await get().refreshDrafts();
  },

  createMacro: async ({ name, content, sceneId }) => {
    const created = await ipc.createMacro({ name, content, sceneId });
    set((state) => ({ macros: [...state.macros, created] }));
  },

  updateMacro: async ({ id, name, content }) => {
    const snapshot = get().macros;
    set({
      macros: snapshot.map((m) => (m.id === id ? { ...m, name, content } : m)),
    });
    try {
      await ipc.updateMacro({ id, name, content });
    } catch (err) {
      set({ macros: snapshot });
      throw err;
    }
  },

  deleteMacro: async (id) => {
    const snapshot = get().macros;
    set({ macros: snapshot.filter((m) => m.id !== id) });
    try {
      await ipc.deleteMacro(id);
    } catch (err) {
      set({ macros: snapshot });
      throw err;
    }
  },

  reorderMacros: async (orderedIds) => {
    const snapshot = get().macros;
    const byId = new Map(snapshot.map((m) => [m.id, m]));
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((m): m is Macro => m !== undefined);
    set({ macros: reordered });
    try {
      await ipc.reorderMacros(orderedIds);
    } catch (err) {
      set({ macros: snapshot });
      throw err;
    }
  },

  createModifier: async ({ name, content, groupKind }) => {
    const created = await ipc.createModifier({ name, content, groupKind });
    set((state) => ({ modifiers: [...state.modifiers, created] }));
  },

  updateModifier: async ({ id, name, content, groupKind }) => {
    const snapshot = get().modifiers;
    // Quadrant move (groupKind set + actually different): the backend appends at
    // the END of the target quadrant, so the optimistic orderIndex mirrors that.
    const current = snapshot.find((m) => m.id === id);
    const moving =
      groupKind !== undefined &&
      current !== undefined &&
      current.groupKind !== groupKind;
    const nextOrderIndex = moving
      ? Math.max(
          -1,
          ...snapshot
            .filter((m) => m.groupKind === groupKind)
            .map((m) => m.orderIndex),
        ) + 1
      : undefined;
    set({
      modifiers: snapshot.map((m) =>
        m.id === id
          ? {
              ...m,
              name,
              content,
              ...(moving
                ? { groupKind, orderIndex: nextOrderIndex as number }
                : {}),
            }
          : m,
      ),
    });
    try {
      await ipc.updateModifier({ id, name, content, groupKind });
    } catch (err) {
      set({ modifiers: snapshot });
      throw err;
    }
  },

  deleteModifier: async (id) => {
    const snapshot = get().modifiers;
    set({ modifiers: snapshot.filter((m) => m.id !== id) });
    try {
      await ipc.deleteModifier(id);
    } catch (err) {
      set({ modifiers: snapshot });
      throw err;
    }
  },

  // Reorder is scoped to one quadrant: only the targeted groupKind's members are
  // resequenced (per orderedIds); modifiers in other quadrants keep their place.
  reorderModifiers: async (groupKind, orderedIds) => {
    const snapshot = get().modifiers;
    const byId = new Map(snapshot.map((m) => [m.id, m]));
    const reorderedGroup = orderedIds
      .map((id) => byId.get(id))
      .filter((m): m is Modifier => m !== undefined);
    const others = snapshot.filter((m) => m.groupKind !== groupKind);
    set({ modifiers: [...others, ...reorderedGroup] });
    try {
      await ipc.reorderModifiers(groupKind, orderedIds);
    } catch (err) {
      set({ modifiers: snapshot });
      throw err;
    }
  },

  createAlignmentPhrase: async ({ phaseId, name, content }) => {
    const created = await ipc.createAlignmentPhrase({ phaseId, name, content });
    set((state) => ({
      alignmentPhrasesByPhase: {
        ...state.alignmentPhrasesByPhase,
        [created.phaseId]: [
          ...(state.alignmentPhrasesByPhase[created.phaseId] ?? []),
          created,
        ],
      },
    }));
  },

  updateAlignmentPhrase: async ({ id, name, content }) => {
    const snapshot = get().alignmentPhrasesByPhase;
    const next: Record<string, AlignmentPhrase[]> = {};
    for (const [phaseId, list] of Object.entries(snapshot)) {
      next[phaseId] = list.map((a) =>
        a.id === id ? { ...a, name, content } : a,
      );
    }
    set({ alignmentPhrasesByPhase: next });
    try {
      await ipc.updateAlignmentPhrase({ id, name, content });
    } catch (err) {
      set({ alignmentPhrasesByPhase: snapshot });
      throw err;
    }
  },

  deleteAlignmentPhrase: async (id) => {
    const snapshot = get().alignmentPhrasesByPhase;
    const next: Record<string, AlignmentPhrase[]> = {};
    for (const [phaseId, list] of Object.entries(snapshot)) {
      next[phaseId] = list.filter((a) => a.id !== id);
    }
    set({ alignmentPhrasesByPhase: next });
    try {
      await ipc.deleteAlignmentPhrase(id);
    } catch (err) {
      set({ alignmentPhrasesByPhase: snapshot });
      throw err;
    }
  },

  // Reorder is scoped to one phase bucket: only the targeted phase's members are
  // resequenced (per orderedIds); other phases keep their place.
  reorderAlignmentPhrases: async (phaseId, orderedIds) => {
    const snapshot = get().alignmentPhrasesByPhase;
    const byId = new Map(
      (snapshot[phaseId] ?? []).map((a) => [a.id, a] as const),
    );
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((a): a is AlignmentPhrase => a !== undefined);
    set({
      alignmentPhrasesByPhase: { ...snapshot, [phaseId]: reordered },
    });
    try {
      await ipc.reorderAlignmentPhrases(phaseId, orderedIds);
    } catch (err) {
      set({ alignmentPhrasesByPhase: snapshot });
      throw err;
    }
  },

  setDefaultAlignmentPhrase: async (phaseId, id) => {
    const phrasesSnapshot = get().alignmentPhrasesByPhase;
    const phasesSnapshot = get().phases;
    set({
      alignmentPhrasesByPhase: {
        ...phrasesSnapshot,
        [phaseId]: (phrasesSnapshot[phaseId] ?? []).map((a) => ({
          ...a,
          isDefault: a.id === id,
        })),
      },
      phases: phasesSnapshot.map((p) =>
        p.id === phaseId ? { ...p, defaultAlignmentPhraseId: id } : p,
      ),
    });
    try {
      await ipc.setDefaultAlignmentPhrase({ phaseId, id });
    } catch (err) {
      set({
        alignmentPhrasesByPhase: phrasesSnapshot,
        phases: phasesSnapshot,
      });
      throw err;
    }
  },

  createComposition: async ({ phaseId, name, modifierIds, sceneId }) => {
    const created = await ipc.createComposition({
      phaseId,
      name,
      modifierIds,
      sceneId,
    });
    set((state) => ({
      compositionsByPhase: {
        ...state.compositionsByPhase,
        [created.phaseId]: [
          ...(state.compositionsByPhase[created.phaseId] ?? []),
          created,
        ],
      },
    }));
  },

  updateComposition: async ({ id, name, modifierIds }) => {
    const snapshot = get().compositionsByPhase;
    const next: Record<string, Composition[]> = {};
    for (const [phaseId, list] of Object.entries(snapshot)) {
      next[phaseId] = list.map((c) =>
        c.id === id ? { ...c, name, modifierIds } : c,
      );
    }
    set({ compositionsByPhase: next });
    try {
      await ipc.updateComposition({ id, name, modifierIds });
    } catch (err) {
      set({ compositionsByPhase: snapshot });
      throw err;
    }
  },

  deleteComposition: async (id) => {
    const snapshot = get().compositionsByPhase;
    const next: Record<string, Composition[]> = {};
    for (const [phaseId, list] of Object.entries(snapshot)) {
      next[phaseId] = list.filter((c) => c.id !== id);
    }
    set({ compositionsByPhase: next });
    try {
      await ipc.deleteComposition(id);
    } catch (err) {
      set({ compositionsByPhase: snapshot });
      throw err;
    }
  },

  // Reorder is scoped to one phase bucket: only the targeted phase's members are
  // resequenced (per orderedIds); other phases keep their place.
  reorderCompositions: async (phaseId, orderedIds) => {
    const snapshot = get().compositionsByPhase;
    const byId = new Map(
      (snapshot[phaseId] ?? []).map((c) => [c.id, c] as const),
    );
    const reordered = orderedIds
      .map((id) => byId.get(id))
      .filter((c): c is Composition => c !== undefined);
    set({
      compositionsByPhase: { ...snapshot, [phaseId]: reordered },
    });
    try {
      await ipc.reorderCompositions(phaseId, orderedIds);
    } catch (err) {
      set({ compositionsByPhase: snapshot });
      throw err;
    }
  },

  // Scene phrases live inside the deeply-nested `scenes` tree, so every mutation
  // re-pulls listScenesWithChildren (same path promoteDraft uses) instead of
  // patching the nested structure in place. No optimistic update.
  createPhrase: async ({ sceneId, name, content, subStageId }) => {
    await ipc.createPhrase({ sceneId, name, content, subStageId });
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  updatePhrase: async ({ id, name, content, subStageId }) => {
    await ipc.updatePhrase({ id, name, content, subStageId });
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  deletePhrase: async (id) => {
    await ipc.deletePhrase(id);
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  reorderPhrases: async (sceneId, subStageId, orderedIds) => {
    await ipc.reorderPhrases(sceneId, subStageId, orderedIds);
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  // Scene + sub-stage structure mutations share the phrase re-pull path: the
  // `scenes` tree is deeply nested (scene → sub_stages + phrases), so a full
  // re-pull is simpler and cheaper than patching in place. deleteScene lets the
  // backend's SceneNotEmpty error propagate so the UI can surface it.
  createScene: async ({ name, icon, rolePresets, color }) => {
    await ipc.createScene({ name, icon, rolePresets, color });
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  updateScene: async ({ id, name, icon, rolePresets, color }) => {
    await ipc.updateScene({ id, name, icon, rolePresets, color });
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  deleteScene: async (id) => {
    await ipc.deleteScene(id);
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  reorderScenes: async (orderedIds) => {
    await ipc.reorderScenes(orderedIds);
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  createSubStage: async ({ sceneId, name }) => {
    await ipc.createSubStage({ sceneId, name });
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  updateSubStage: async ({ id, name }) => {
    await ipc.updateSubStage({ id, name });
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  deleteSubStage: async (id) => {
    await ipc.deleteSubStage(id);
    set({ scenes: await ipc.listScenesWithChildren() });
  },

  reorderSubStages: async (sceneId, orderedIds) => {
    await ipc.reorderSubStages(sceneId, orderedIds);
    set({ scenes: await ipc.listScenesWithChildren() });
  },
}));
