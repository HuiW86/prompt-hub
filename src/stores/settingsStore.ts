import { create } from "zustand";

// Settings live in memory for MVP — persistence to SQLite lands in phase 4 when
// the config panel is built. Defaults match docs/design/03-product-spec §13.4.
interface SettingsState {
  globalHotkey: string;
  hiddenPhaseIds: string[];
  setGlobalHotkey: (combo: string) => void;
  togglePhaseVisibility: (phaseId: string) => void;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  globalHotkey: "Alt+Space",
  hiddenPhaseIds: [],
  setGlobalHotkey: (globalHotkey) => set({ globalHotkey }),
  togglePhaseVisibility: (phaseId) =>
    set((state) => ({
      hiddenPhaseIds: state.hiddenPhaseIds.includes(phaseId)
        ? state.hiddenPhaseIds.filter((id) => id !== phaseId)
        : [...state.hiddenPhaseIds, phaseId],
    })),
}));
