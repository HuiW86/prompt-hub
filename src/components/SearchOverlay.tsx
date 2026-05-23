import { useCallback, useEffect, useMemo, useRef } from "react";

import { useCopy } from "../hooks/useCopy";
import { useSearchResults } from "../hooks/useSearchResults";
import type { AlignmentPhrase, Macro, Phrase } from "../ipc/types";
import {
  SEARCH_LISTBOX_ID,
  searchOptionId,
  selectIsSearching,
  useSearchStore,
} from "../stores/searchStore";

import styles from "./SearchOverlay.module.css";

type FlatItem =
  | { kind: "macro"; macro: Macro }
  | { kind: "phrase"; phrase: Phrase; sceneName: string }
  | { kind: "alignment"; ap: AlignmentPhrase; phaseName: string };

// PRD §5.0 — search overlay covers the main work area when the query is
// non-empty. Implements the WAI-ARIA combobox-listbox pattern: SearchBar owns
// the input (role="combobox"), this component owns the result list
// (role="listbox") and each hit (role="option" with aria-selected). Virtual
// focus stays on the input; aria-activedescendant points here.
//
// UsageSource attribution: search-driven copies currently reuse the underlying
// kind's source (macro_area / scene / phase_bar) instead of a dedicated
// 'search' value. This pollutes 入口效率 analytics; tracked as ADR-011 debt.
// See HANDOFF.md "未做" list.
export function SearchOverlay() {
  const isSearching = useSearchStore(selectIsSearching);
  const selectedIndex = useSearchStore((s) => s.selectedIndex);
  const setSelectedIndex = useSearchStore((s) => s.setSelectedIndex);
  const clearQuery = useSearchStore((s) => s.clearQuery);
  const results = useSearchResults();
  const copy = useCopy();
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const flatItems = useMemo<FlatItem[]>(() => {
    const out: FlatItem[] = [];
    for (const m of results.macros) out.push({ kind: "macro", macro: m });
    for (const p of results.phrases)
      out.push({ kind: "phrase", phrase: p.phrase, sceneName: p.sceneName });
    for (const a of results.alignments)
      out.push({ kind: "alignment", ap: a.ap, phaseName: a.phaseName });
    return out;
  }, [results]);

  // Keep the ref array in lockstep with the rendered list so a future
  // shrink-then-grow doesn't read stale element references at the same global
  // index (relevant for React 19 strict-mode double invocation and any
  // future reordering of result groups).
  useEffect(() => {
    itemRefs.current.length = flatItems.length;
  }, [flatItems.length]);

  // setQuery in the store resets selectedIndex to 0; this effect only catches
  // the case where the user has navigated past the new end after a shrinking
  // edit (e.g., 5 hits selected #4, types more chars → 2 hits → clamp to #1).
  useEffect(() => {
    if (flatItems.length === 0) return;
    if (selectedIndex >= flatItems.length) {
      setSelectedIndex(Math.max(0, flatItems.length - 1));
    }
  }, [flatItems.length, selectedIndex, setSelectedIndex]);

  const triggerCopy = useCallback(
    (item: FlatItem) => {
      if (item.kind === "macro") {
        void copy(
          item.macro.content,
          {
            targetType: "macro",
            targetId: item.macro.id,
            // TODO(ADR-011): set source: "search" once enum + migration land
            source: "macro_area",
            modifierIds: null,
            sopId: null,
            sopStepOrder: null,
            phaseId: null,
          },
          item.macro.id,
        );
      } else if (item.kind === "phrase") {
        void copy(
          item.phrase.content,
          {
            targetType: "phrase",
            targetId: item.phrase.id,
            // TODO(ADR-011): set source: "search"
            source: "scene",
            modifierIds: null,
            sopId: null,
            sopStepOrder: null,
            phaseId: null,
          },
          item.phrase.id,
        );
      } else {
        void copy(
          item.ap.content,
          {
            targetType: "alignment",
            targetId: item.ap.id,
            // TODO(ADR-011): set source: "search"
            source: "phase_bar",
            modifierIds: null,
            sopId: null,
            sopStepOrder: null,
            phaseId: item.ap.phaseId,
          },
          item.ap.id,
        );
      }
    },
    [copy],
  );

  useEffect(() => {
    if (!isSearching) return;
    function onKey(e: KeyboardEvent) {
      // Don't hijack ↑↓⏎ while an IME (Pinyin / Sogou / etc.) is composing —
      // those keys belong to the IME candidate picker. e.isComposing is the
      // standard signal; keyCode 229 covers older webviews that report it
      // without setting isComposing.
      if (e.isComposing || e.keyCode === 229) return;
      // ESC always handled here when overlay is up — App.tsx defers to us via
      // an isSearching check so the window doesn't hide on the first ESC.
      if (e.key === "Escape") {
        e.preventDefault();
        clearQuery();
        return;
      }
      // Otherwise require zero modifiers so Shift-arrow text selection, ⌘K,
      // and Cmd/Ctrl shortcuts on other handlers continue to work.
      if (e.metaKey || e.shiftKey || e.altKey || e.ctrlKey) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const cur = useSearchStore.getState().selectedIndex;
        setSelectedIndex(Math.min(flatItems.length - 1, cur + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const cur = useSearchStore.getState().selectedIndex;
        setSelectedIndex(Math.max(0, cur - 1));
      } else if (e.key === "Enter") {
        if (flatItems.length === 0) return;
        e.preventDefault();
        const sel = useSearchStore.getState().selectedIndex;
        triggerCopy(flatItems[sel] ?? flatItems[0]);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isSearching, flatItems, triggerCopy, setSelectedIndex, clearQuery]);

  // Keep the selected row in view as ↑↓ moves past the visible window.
  useEffect(() => {
    if (!isSearching) return;
    const el = itemRefs.current[selectedIndex];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, isSearching]);

  if (!isSearching) return null;

  const macroOffset = 0;
  const phraseOffset = results.macros.length;
  const alignmentOffset = phraseOffset + results.phrases.length;

  function optionClass(globalIndex: number) {
    return [styles.item, globalIndex === selectedIndex ? styles.selected : ""]
      .filter(Boolean)
      .join(" ");
  }

  function setRef(globalIndex: number) {
    return (el: HTMLDivElement | null) => {
      itemRefs.current[globalIndex] = el;
    };
  }

  function handleClick(globalIndex: number, item: FlatItem) {
    return () => {
      setSelectedIndex(globalIndex);
      triggerCopy(item);
    };
  }

  return (
    <div
      className={styles.overlay}
      role="region"
      aria-label="搜索结果"
      data-region="search-overlay"
    >
      <header className={styles.header}>
        <span className={styles.title}>
          搜索结果: &ldquo;{results.query}&rdquo;
        </span>
        <span className={styles.count}>{results.total} 条</span>
      </header>

      {results.total === 0 ? (
        <p className={styles.empty}>
          没有匹配的资产 · 试试更短的关键词，或检查拼写
        </p>
      ) : (
        <div
          role="listbox"
          id={SEARCH_LISTBOX_ID}
          aria-label="搜索结果列表"
          className={styles.groups}
        >
          {results.macros.length > 0 && (
            <div
              role="group"
              aria-labelledby="search-grp-macro"
              className={styles.group}
            >
              <h3 id="search-grp-macro" className={styles.groupHead}>
                Macro{" "}
                <span className={styles.groupCount}>
                  ({results.macros.length})
                </span>
              </h3>
              {results.macros.map((m, idx) => {
                const gi = macroOffset + idx;
                return (
                  <div
                    key={m.id}
                    ref={setRef(gi)}
                    role="option"
                    id={searchOptionId(gi)}
                    aria-selected={gi === selectedIndex}
                    aria-label={m.name}
                    className={optionClass(gi)}
                    onClick={handleClick(gi, { kind: "macro", macro: m })}
                  >
                    <span className={styles.itemName}>{m.name}</span>
                    <span className={styles.itemMeta}>{m.usageCount} 次</span>
                  </div>
                );
              })}
            </div>
          )}

          {results.phrases.length > 0 && (
            <div
              role="group"
              aria-labelledby="search-grp-phrase"
              className={styles.group}
            >
              <h3 id="search-grp-phrase" className={styles.groupHead}>
                Phrase{" "}
                <span className={styles.groupCount}>
                  ({results.phrases.length})
                </span>
              </h3>
              {results.phrases.map(({ phrase, sceneName }, idx) => {
                const gi = phraseOffset + idx;
                return (
                  <div
                    key={phrase.id}
                    ref={setRef(gi)}
                    role="option"
                    id={searchOptionId(gi)}
                    aria-selected={gi === selectedIndex}
                    aria-label={`${sceneName} · ${phrase.name}`}
                    className={optionClass(gi)}
                    onClick={handleClick(gi, {
                      kind: "phrase",
                      phrase,
                      sceneName,
                    })}
                  >
                    <span className={styles.itemName}>
                      <span className={styles.itemScope}>{sceneName}</span>
                      {phrase.name}
                    </span>
                    <span className={styles.itemMeta}>
                      {phrase.usageCount} 次
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {results.alignments.length > 0 && (
            <div
              role="group"
              aria-labelledby="search-grp-ap"
              className={styles.group}
            >
              <h3 id="search-grp-ap" className={styles.groupHead}>
                AlignmentPhrase{" "}
                <span className={styles.groupCount}>
                  ({results.alignments.length})
                </span>
              </h3>
              {results.alignments.map(({ ap, phaseName }, idx) => {
                const gi = alignmentOffset + idx;
                return (
                  <div
                    key={ap.id}
                    ref={setRef(gi)}
                    role="option"
                    id={searchOptionId(gi)}
                    aria-selected={gi === selectedIndex}
                    aria-label={`${phaseName} · ${ap.name}`}
                    className={optionClass(gi)}
                    onClick={handleClick(gi, {
                      kind: "alignment",
                      ap,
                      phaseName,
                    })}
                  >
                    <span className={styles.itemName}>
                      <span className={styles.itemScope}>{phaseName}</span>
                      {ap.name}
                    </span>
                    <span className={styles.itemMeta}>{ap.usageCount} 次</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* SOP placeholder — hidden from AT until phase 3 data ships. */}
          <div aria-hidden="true" className={styles.group}>
            <h3 className={styles.groupHead}>
              SOP <span className={styles.groupCount}>(0)</span>
            </h3>
            <p className={styles.groupEmpty}>第三阶段开放</p>
          </div>
        </div>
      )}
    </div>
  );
}
