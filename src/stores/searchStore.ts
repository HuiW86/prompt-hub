import { create } from "zustand";

// Filtered results land in B5 as a selector that reads from promptStore.
// For now the store only owns the query string itself.
interface SearchState {
  query: string;
  setQuery: (q: string) => void;
  clearQuery: () => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  query: "",
  setQuery: (query) => set({ query }),
  clearQuery: () => set({ query: "" }),
}));

export const selectIsSearching = (s: SearchState): boolean =>
  s.query.trim().length > 0;
