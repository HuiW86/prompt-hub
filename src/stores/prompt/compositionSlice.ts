import { ipc } from "../../ipc";
import type { Composition } from "../../ipc/types";

import type { PromptState, StateCreatorSlice } from "./types";

export const createCompositionSlice: StateCreatorSlice<
  Pick<
    PromptState,
    | "createComposition"
    | "updateComposition"
    | "deleteComposition"
    | "reorderCompositions"
  >
> = (set, get) => ({
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
});
