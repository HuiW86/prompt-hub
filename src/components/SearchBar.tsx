import { useSearchStore } from "../stores/searchStore";

import styles from "./SearchBar.module.css";

export function SearchBar() {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const clearQuery = useSearchStore((s) => s.clearQuery);

  return (
    <div className={styles.searchBar} role="search">
      <label className={styles.field}>
        <input
          className={styles.input}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && query.length > 0) {
              // Eat the first ESC so it just clears the query; the second ESC
              // bubbles to App and hides the window.
              clearQuery();
              e.stopPropagation();
            }
          }}
          placeholder="搜索 Macro / Phrase / SOP / 对齐话术…"
          aria-label="搜索"
        />
        <span className={styles.fallback}>兜底</span>
        <kbd className={styles.shortcut}>⌘K</kbd>
      </label>
    </div>
  );
}
