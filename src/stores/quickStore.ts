import { create } from "zustand";

// Quick view state (ADR-034). In a store, not component state, for the same
// reason as the panorama's: App's Esc handler must see the query, and a wake
// must be able to clear both.

interface QuickState {
  query: string;
  selectedKey: string | null;
  setQuery: (query: string) => void;
  select: (key: string | null) => void;
  /** Wake hygiene: every summon starts from an empty box, nothing selected. */
  resetView: () => void;
}

export const useQuickStore = create<QuickState>()((set) => ({
  query: "",
  selectedKey: null,
  setQuery: (query) => set({ query, selectedKey: null }),
  select: (selectedKey) => set({ selectedKey }),
  resetView: () => set({ query: "", selectedKey: null }),
}));
