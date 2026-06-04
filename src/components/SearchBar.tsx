import { Inbox, Search } from "lucide-react";
import { useEffect, useRef } from "react";

import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import {
  SEARCH_LISTBOX_ID,
  searchOptionId,
  selectIsSearching,
  useSearchStore,
} from "../stores/searchStore";
import { isPrimaryModifier, primaryModifierLabel } from "../utils/platform";

import { Kbd } from "./primitives";
import styles from "./SearchBar.module.css";

// Implements the WAI-ARIA combobox half of the search pattern (SearchOverlay
// owns the listbox half). Virtual focus stays on this input; aria-activedescendant
// points at the option currently highlighted by ↑↓ navigation so screen
// readers announce selection changes without us moving DOM focus.
export function SearchBar() {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const isSearching = useSearchStore(selectIsSearching);
  const selectedIndex = useSearchStore((s) => s.selectedIndex);
  const pendingDraftCount = usePromptStore((s) => s.pendingDraftCount);
  const requestDraftsView = useAppStore((s) => s.requestDraftsView);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        !isPrimaryModifier(e) ||
        e.shiftKey ||
        e.altKey ||
        e.key.toLowerCase() !== "k"
      ) {
        return;
      }
      e.preventDefault();
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      // Pre-select existing text so the user's next keystroke overwrites it —
      // matches the standard ⌘K behavior in Linear / Slack / VSCode.
      el.select();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={styles.searchBar} role="search">
      <label className={styles.field}>
        <Search size={14} className={styles.icon} aria-hidden strokeWidth={2} />
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索 Macro / Phrase / SOP / 对齐话术…"
          aria-label="搜索"
          role="combobox"
          aria-expanded={isSearching}
          aria-controls={SEARCH_LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={
            isSearching ? searchOptionId(selectedIndex) : undefined
          }
        />
      </label>
      {pendingDraftCount > 0 && (
        <button
          type="button"
          className={styles.badge}
          onClick={requestDraftsView}
          tabIndex={-1}
          aria-label={`${pendingDraftCount} 条草稿待审，跳转收件箱`}
        >
          <Inbox size={13} aria-hidden strokeWidth={2} />
          {pendingDraftCount} 条待审
        </button>
      )}
      <Kbd sm>{primaryModifierLabel()}K</Kbd>
    </div>
  );
}
