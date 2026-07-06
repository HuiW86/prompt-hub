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

  // Focus the search box on window wake (03-product-spec §13.4: "唤起即已默认
  // 聚焦搜索框"). We key off `visibilitychange`→visible rather than an OS focus
  // event because macOS wakes the window via orderFrontRegardless (non-
  // activating), so the OS focus event is unreliable; the Rust side sends no
  // custom event, making the document visibility flip the most stable wake
  // signal. Mount also fires this once for first paint.
  useEffect(() => {
    function grabFocus() {
      const el = inputRef.current;
      if (!el) return;
      // Guard: only steal focus when nothing meaningful is focused, so an open
      // edit form / settings modal keeps the caret it already owns.
      const active = document.activeElement;
      if (active && active !== document.body) return;
      el.focus();
      el.select();
    }
    grabFocus();
    function onVisibility() {
      if (document.visibilityState === "visible") grabFocus();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
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
