import { create } from "zustand";

import { ipc } from "../ipc";
import type {
  AlignmentPhrase,
  DraftSummary,
  Macro,
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
        scenes,
        recent,
        todayCount,
        drafts,
        pendingDraftCount,
      ] = await Promise.all([
        ipc.listPhases(),
        ipc.listAlignmentPhrases(),
        ipc.listMacros(),
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
    const [macros, scenes, alignments] = await Promise.all([
      ipc.listMacros(),
      ipc.listScenesWithChildren(),
      ipc.listAlignmentPhrases(),
    ]);
    set({
      macros,
      scenes,
      alignmentPhrasesByPhase: indexByPhase(alignments),
    });
    await get().refreshDrafts();
  },

  discardDraft: async (id) => {
    await ipc.discardDraft(id);
    await get().refreshDrafts();
  },
}));
