import { ipc } from "../../ipc";
import type { Modifier } from "../../ipc/types";

import type { PromptState, StateCreatorSlice } from "./types";

export const createModifierSlice: StateCreatorSlice<
  Pick<
    PromptState,
    "createModifier" | "updateModifier" | "deleteModifier" | "reorderModifiers"
  >
> = (set, get) => ({
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
});
