import { ipc } from "../../ipc";
import type { AssetKind } from "../../ipc";

import {
  RECENT_LIMIT,
  indexByPhase,
  indexCompositionsByPhase,
} from "./helpers";
import type { PromptState, StateCreatorSlice } from "./types";

// The undo half of ADR-028. `delete_*` now stamps `deleted_at` in place rather
// than removing the row, so putting an asset back is a single backend UPDATE —
// id, created_at, order_index and usage history were never disturbed, which is
// exactly why Option A was chosen over a trash table (ADR-028 §4).
//
// The only frontend work is re-syncing the collection the row rejoined. This
// deliberately does NOT call refreshAll(): that flips loadState to "loading"
// and flashes the dashboard skeleton over an undo the user just clicked. It
// re-pulls rather than patching optimistically because the restored row lands
// back at its original order_index, which the frontend does not know.
export const createTrashSlice: StateCreatorSlice<
  Pick<PromptState, "restoreAsset" | "syncRecentUsage">
> = (set, _get, { refreshScenes }) => ({
  // The Recent list is the one surface derived from OTHER tables' liveness: it
  // reads usage_records and resolves each row against its asset. ADR-028
  // 子决策 5 made the backend drop rows whose target no longer resolves, so a
  // trashed asset leaves no 「（未知话术）」 tombstone — but that only reaches the
  // screen once this collection is re-pulled. Deleting an asset does not
  // otherwise touch it, so every path that flips an asset between alive and
  // trashed has to call this or the promise holds only until the next reload.
  // todayCount is deliberately not re-pulled: usage_records itself is untouched
  // by a delete (子决策 5), so the day's count cannot have changed.
  syncRecentUsage: async () => {
    const recentUsage = await ipc.listRecentUsage(RECENT_LIMIT);
    set({ recentUsage });
  },

  restoreAsset: async (kind: AssetKind, id: string) => {
    await ipc.restoreAsset(kind, id);
    switch (kind) {
      case "macro": {
        const macros = await ipc.listMacros();
        set({ macros });
        break;
      }
      case "modifier": {
        const modifiers = await ipc.listModifiers();
        set({ modifiers });
        break;
      }
      case "alignment_phrase": {
        const alignments = await ipc.listAlignmentPhrases();
        set({ alignmentPhrasesByPhase: indexByPhase(alignments) });
        break;
      }
      case "composition": {
        const compositions = await ipc.listCompositions();
        set({ compositionsByPhase: indexCompositionsByPhase(compositions) });
        break;
      }
      // phrase / scene / sub_stage all live in the nested `scenes` tree, whose
      // only sanctioned refresh path is the ticket-guarded re-pull (guards.ts).
      // A restored sub-stage needs no extra bookkeeping: ADR-028 子决策 7 stopped
      // delete_sub_stage from unbinding its phrases, so they are still pointing
      // at it and re-group on their own.
      case "phrase":
      case "scene":
      case "sub_stage":
        await refreshScenes();
        break;
    }
    // Restoring revives the asset's own history too — usage_records was never
    // touched and the id never changed, so its Recent lines resolve again.
    const recentUsage = await ipc.listRecentUsage(RECENT_LIMIT);
    set({ recentUsage });
  },
});
