import { ipc } from "../../ipc";
import { toUserMessage } from "../../utils/errorMessage";

import {
  RECENT_LIMIT,
  indexAxisValuesById,
  indexByPhase,
  indexCompositionsByPhase,
} from "./helpers";
import type { PromptState, StateCreatorSlice } from "./types";

// Static initial state for every field of the store (the load/error scalars plus
// every asset collection). Kept in the load slice since refreshAll — which owns
// the first full hydration — lives here too.
export const initialPromptState: Pick<
  PromptState,
  | "phases"
  | "alignmentPhrasesByPhase"
  | "alignmentAxisValues"
  | "alignmentAxisValuesById"
  | "compositionsByPhase"
  | "macros"
  | "modifiers"
  | "scenes"
  | "recentUsage"
  | "todayCount"
  | "drafts"
  | "pendingDraftCount"
  | "loadState"
  | "loadError"
> = {
  phases: [],
  alignmentPhrasesByPhase: {},
  alignmentAxisValues: [],
  alignmentAxisValuesById: {},
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
};

export const createLoadSlice: StateCreatorSlice<
  Pick<PromptState, "refreshAll">
> = (set) => ({
  refreshAll: async () => {
    set({ loadState: "loading", loadError: null });
    try {
      const [
        phases,
        alignments,
        axisValues,
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
        // Part of the first load, not lazily fetched when an editor opens: the
        // coordinate names are needed to assemble what a ⌘1-9 copy puts on the
        // clipboard, and that can fire before any editor has ever been opened.
        ipc.listAlignmentAxisValues(),
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
        alignmentAxisValues: axisValues,
        alignmentAxisValuesById: indexAxisValuesById(axisValues),
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
      // loadError renders verbatim in Dashboard's error state (which prefixes
      // "加载失败：" itself), so route it through the P1-3 funnel instead of
      // exposing the raw Rust/IPC string.
      set({
        loadState: "error",
        loadError: toUserMessage(err, "数据读取异常，请重试或重启应用"),
      });
    }
  },
});
