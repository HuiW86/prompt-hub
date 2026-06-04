import { create } from "zustand";

import { ipc } from "../ipc";
import type {
  AlignmentPhrase,
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
  // order_index restarts per quadrant.
  createModifier: (args: {
    name: string;
    content: string;
    groupKind: GroupKind;
  }) => Promise<void>;
  updateModifier: (args: {
    id: string;
    name: string;
    content: string;
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
    const [macros, modifiers, scenes, alignments] = await Promise.all([
      ipc.listMacros(),
      ipc.listModifiers(),
      ipc.listScenesWithChildren(),
      ipc.listAlignmentPhrases(),
    ]);
    set({
      macros,
      modifiers,
      scenes,
      alignmentPhrasesByPhase: indexByPhase(alignments),
    });
    await get().refreshDrafts();
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

  updateModifier: async ({ id, name, content }) => {
    const snapshot = get().modifiers;
    set({
      modifiers: snapshot.map((m) =>
        m.id === id ? { ...m, name, content } : m,
      ),
    });
    try {
      await ipc.updateModifier({ id, name, content });
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
}));
