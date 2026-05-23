import { create } from "zustand";

// Filtered results are derived in useSearchResults. The store owns the query
// string and the keyboard-navigated selectedIndex into the flattened result
// list, so SearchBar (which renders the input) and SearchOverlay (which
// renders the list) can share state and SearchBar can expose the proper
// combobox + aria-activedescendant ARIA contract to assistive tech.
interface SearchState {
  query: string;
  selectedIndex: number;
  setQuery: (q: string) => void;
  clearQuery: () => void;
  setSelectedIndex: (n: number) => void;
}

export const useSearchStore = create<SearchState>()((set) => ({
  query: "",
  selectedIndex: 0,
  // Setting a new query always resets the selection so the first hit of the
  // new result set is preselected.
  setQuery: (query) => set({ query, selectedIndex: 0 }),
  clearQuery: () => set({ query: "", selectedIndex: 0 }),
  setSelectedIndex: (selectedIndex) => set({ selectedIndex }),
}));

export const selectIsSearching = (s: SearchState): boolean =>
  s.query.trim().length > 0;

// Shared id namespace for combobox aria-activedescendant linkage between
// SearchBar (input) and SearchOverlay (listbox options).
export const SEARCH_LISTBOX_ID = "search-overlay-listbox";

export function searchOptionId(index: number): string {
  return `search-option-${index}`;
}
