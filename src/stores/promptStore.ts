import { create } from "zustand";

import { ipc } from "../ipc";
import type {
  AlignmentPhrase,
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
  loadState: LoadState;
  loadError: string | null;

  refreshAll: () => Promise<void>;
  recordCopy: (input: RecordUsageInput) => Promise<void>;
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
  loadState: "idle",
  loadError: null,

  refreshAll: async () => {
    set({ loadState: "loading", loadError: null });
    try {
      const [phases, alignments, macros, scenes, recent] = await Promise.all([
        ipc.listPhases(),
        ipc.listAlignmentPhrases(),
        ipc.listMacros(),
        ipc.listScenesWithChildren(),
        ipc.listRecentUsage(RECENT_LIMIT),
      ]);
      set({
        phases,
        alignmentPhrasesByPhase: indexByPhase(alignments),
        macros,
        scenes,
        recentUsage: recent,
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
    // Refresh recent list so the new copy lands at the top with the right
    // target_name JOIN data. Cheap enough — bounded by RECENT_LIMIT rows.
    const recent = await ipc.listRecentUsage(RECENT_LIMIT);
    set({ recentUsage: recent });
    void get; // unused — kept for future selectors
  },
}));
