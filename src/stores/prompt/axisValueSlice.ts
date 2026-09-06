import { ipc } from "../../ipc";
import type { AlignmentAxisValueWithRefs } from "../../ipc/types";

import { indexByPhase, indexAxisValuesById } from "./helpers";
import type { PromptState, StateCreatorSlice } from "./types";

// The three coordinate axes' value lists (ADR-029 子决策 2). Not assets — no
// trash, no optimistic patching: every mutation re-pulls the whole list, which
// is 16 rows at seed and a few dozen at the §11 ceiling. The counts each row
// carries (`refCount` / `trashedRefCount`) are computed per query and are what
// the delete confirmation reports, so a patched-in-place list would show stale
// blast radii — the one number that must never be stale.
export const createAxisValueSlice: StateCreatorSlice<
  Pick<
    PromptState,
    | "refreshAlignmentAxisValues"
    | "createAlignmentAxisValue"
    | "updateAlignmentAxisValue"
    | "deleteAlignmentAxisValue"
    | "reorderAlignmentAxisValues"
  >
> = (set) => {
  const pull = async (): Promise<AlignmentAxisValueWithRefs[]> => {
    const values = await ipc.listAlignmentAxisValues();
    set({
      alignmentAxisValues: values,
      alignmentAxisValuesById: indexAxisValuesById(values),
    });
    return values;
  };

  return {
    refreshAlignmentAxisValues: async () => {
      await pull();
    },

    createAlignmentAxisValue: async ({ axis, name, hint }) => {
      await ipc.createAlignmentAxisValue({ axis, name, hint });
      await pull();
    },

    // `hint` is sent on every update, never omitted: the backend writes both
    // columns unconditionally, so leaving it out would silently blank the hint
    // of a value the user only renamed.
    updateAlignmentAxisValue: async ({ id, name, hint }) => {
      await ipc.updateAlignmentAxisValue({ id, name, hint });
      await pull();
    },

    // Irreversible, and it reaches further than this table: `ON DELETE SET NULL`
    // blanks the coordinate on every phrase that pointed here, trashed ones
    // included. So the phrase list is re-pulled too — without it the store would
    // keep handing out ids that no longer exist in the database, and the next
    // save of such a phrase would write one straight back at a dead foreign key.
    deleteAlignmentAxisValue: async (id) => {
      await ipc.deleteAlignmentAxisValue(id);
      await pull();
      const phrases = await ipc.listAlignmentPhrases();
      set({ alignmentPhrasesByPhase: indexByPhase(phrases) });
    },

    reorderAlignmentAxisValues: async (axis, orderedIds) => {
      await ipc.reorderAlignmentAxisValues(axis, orderedIds);
      await pull();
    },
  };
};
