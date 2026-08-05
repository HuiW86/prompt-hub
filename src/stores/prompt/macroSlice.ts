import { ipc } from "../../ipc";
import type { Macro } from "../../ipc/types";

import type { PromptState, StateCreatorSlice } from "./types";

export const createMacroSlice: StateCreatorSlice<
  Pick<
    PromptState,
    "createMacro" | "updateMacro" | "deleteMacro" | "reorderMacros"
  >
> = (set, get) => ({
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
});
