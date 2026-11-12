import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import { useCopy } from "../../hooks/useCopy";
import { usePanoramaStore, panoramaKey } from "../../stores/panoramaStore";
import { usePromptStore } from "../../stores/promptStore";
import { useSessionStore } from "../../stores/sessionStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import {
  buildPanorama,
  itemsInReadingOrder,
  matchesFilter,
  type PanoramaColumn,
  type PanoramaItem,
} from "../../utils/panorama";

import styles from "./PanoramaView.module.css";

// The panorama workspace (I-03 / ADR-031): every item on one screen, loudness
// by tier, position by the user. A cross-layer display surface — like the
// search overlay it lists alignment phrases next to task-layer items without
// creating any data relation between them (constitution B2 v1.2).

export interface PanoramaViewProps {
  /** Rendered after each item's name in organize mode (I-04's placement button). */
  renderItemAction?: (item: PanoramaItem) => ReactNode;
  /** Extra keys the view hands to its owner (I-04's `M` / `⌥1–9`). Return true
   *  when handled. Only called when the view itself would otherwise react. */
  onExtraKey?: (e: KeyboardEvent, selected: PanoramaItem | null) => boolean;
  /** True while a popover owned by the caller is open: the view's keys pause. */
  suspended?: boolean;
}

function keyOf(item: PanoramaItem): string {
  return panoramaKey(item.kind, item.id);
}

function formatDate(iso: string | null): string {
  if (!iso) return "未用过";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "未用过";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

/** Columns as the keyboard sees them: what is on screen, in reading order. */
type NavGrid = string[][];

export function PanoramaView({
  renderItemAction,
  onExtraKey,
  suspended = false,
}: PanoramaViewProps = {}) {
  const phases = usePromptStore((s) => s.phases);
  const macros = usePromptStore((s) => s.macros);
  const modifiers = usePromptStore((s) => s.modifiers);
  const scenes = usePromptStore((s) => s.scenes);
  const alignmentByPhase = usePromptStore((s) => s.alignmentPhrasesByPhase);
  const compositionsByPhase = usePromptStore((s) => s.compositionsByPhase);
  const axisById = usePromptStore((s) => s.alignmentAxisValuesById);

  const placements = usePanoramaStore((s) => s.placements);
  const load = usePanoramaStore((s) => s.load);
  const query = usePanoramaStore((s) => s.query);
  const setQuery = usePanoramaStore((s) => s.setQuery);
  const selectedKey = usePanoramaStore((s) => s.selectedKey);
  const select = usePanoramaStore((s) => s.select);
  const resetView = usePanoramaStore((s) => s.resetView);

  const sessionStartedAt = useSessionStore((s) => s.sessionStartedAt);
  const flashId = useToastStore((s) => s.flashTargetId);
  const copy = useCopy();

  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const model = useMemo(() => {
    // Phase order first, so alignment phrases enter in the order the phase
    // bar shows them; buckets for phases the store no longer lists come last.
    const order = [
      ...phases.map((p) => p.id),
      ...Object.keys(alignmentByPhase).filter(
        (id) => !phases.some((p) => p.id === id),
      ),
    ];
    const compOrder = [
      ...phases.map((p) => p.id),
      ...Object.keys(compositionsByPhase).filter(
        (id) => !phases.some((p) => p.id === id),
      ),
    ];
    return buildPanorama({
      macros,
      modifiers,
      phrases: scenes.flatMap((s) => s.phrases),
      alignmentPhrases: order.flatMap((id) => alignmentByPhase[id] ?? []),
      compositions: compOrder.flatMap((id) => compositionsByPhase[id] ?? []),
      placements,
      now: new Date(),
      alignmentAxisValuesById: axisById,
    });
  }, [
    phases,
    macros,
    modifiers,
    scenes,
    alignmentByPhase,
    compositionsByPhase,
    placements,
    axisById,
  ]);

  const filtering = query.trim() !== "";

  // ── Fit to one screen ──────────────────────────────────────────────────────
  // Dormant rows are cut, longest column first, until nothing overflows; the
  // cut rows collapse into 「还有 N 条」. pinned/active rows are never cut. Reset
  // whenever the model or the frame size changes, then re-measured.
  const [layoutEpoch, setLayoutEpoch] = useState(0);
  // A cut belongs to one (model, frame size) generation; a new generation
  // starts from nothing cut and is measured again.
  const generation = useMemo(
    () => ({ model, layoutEpoch }),
    [model, layoutEpoch],
  );
  const [cutState, setCutState] = useState<{
    generation: typeof generation | null;
    hidden: Record<string, number>;
  }>({ generation: null, hidden: {} });
  const hidden = useMemo(
    () => (cutState.generation === generation ? cutState.hidden : {}),
    [cutState, generation],
  );

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const bump = () => setLayoutEpoch((n) => n + 1);
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(bump);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", bump);
    return () => window.removeEventListener("resize", bump);
  }, []);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    // Columns share one height, so each overflows on its own account; cutting
    // every overflowing column in the same pass is the same result as working
    // down from the longest one. The cut is measured, not counted: drop the
    // dormant rows whose bottom edge falls below the column's visible limit,
    // with room left for the 「还有 N 条」 line. A frame normally settles in one
    // pass; if the estimate of that line's height was short, the next pass
    // takes one more row. Bounded: never more than the column's dormant rows.
    let next: Record<string, number> | null = null;
    for (const body of grid.querySelectorAll<HTMLElement>(
      "[data-column-body]",
    )) {
      const id = body.dataset.columnBody ?? "";
      if (body.scrollHeight - body.clientHeight <= 0) continue;
      const column = model.columns.find((c) => c.id === id);
      const dormant =
        column?.items.filter((i) => i.tier === "dormant").length ?? 0;
      const already = hidden[id] ?? 0;
      if (already >= dormant) continue;
      const rows = Array.from(
        body.querySelectorAll<HTMLElement>('[data-tier="dormant"]'),
      );
      const more = body.querySelector<HTMLElement>("[data-more]");
      const moreHeight = more
        ? more.getBoundingClientRect().height
        : (rows[rows.length - 1]?.getBoundingClientRect().height ?? 0);
      const box = body.getBoundingClientRect();
      const padBottom = parseFloat(getComputedStyle(body).paddingBottom) || 0;
      const limit = box.top + body.clientHeight - padBottom - moreHeight;
      const beyond = rows.filter(
        (r) => r.getBoundingClientRect().bottom > limit,
      ).length;
      next ??= { ...hidden };
      next[id] = Math.min(dormant, already + Math.max(1, beyond));
    }
    if (next) setCutState({ generation, hidden: next });
  }, [hidden, model, generation]);

  // What is actually on screen per column, after the cut.
  const visibleColumns = useMemo(() => {
    const cut = (c: PanoramaColumn) => {
      const n = hidden[c.id] ?? 0;
      if (n === 0) return { column: c, items: c.items, cut: [] };
      const keep = c.items.length - n;
      return {
        column: c,
        items: c.items.slice(0, keep),
        cut: c.items.slice(keep),
      };
    };
    return {
      columns: model.columns.map(cut),
      strip: model.strip.map((c) => ({ column: c, items: c.items, cut: [] })),
    };
  }, [model, hidden]);

  const navGrid: NavGrid = useMemo(
    () =>
      [...visibleColumns.columns, ...visibleColumns.strip]
        .map((c) => c.items.map(keyOf))
        .filter((keys) => keys.length > 0),
    [visibleColumns],
  );

  const allItems = useMemo(() => itemsInReadingOrder(model), [model]);
  const itemByKey = useMemo(
    () => new Map(allItems.map((i) => [keyOf(i), i])),
    [allItems],
  );

  const selected = selectedKey ? (itemByKey.get(selectedKey) ?? null) : null;
  const firstMatch = useMemo(() => {
    if (!filtering) return null;
    return (
      navGrid
        .flat()
        .map((k) => itemByKey.get(k))
        .find((i): i is PanoramaItem => !!i && matchesFilter(i, query)) ?? null
    );
  }, [filtering, navGrid, itemByKey, query]);

  const copyItem = useCallback(
    (item: PanoramaItem) => {
      void copy(item.content, item.usage, keyOf(item));
    },
    [copy],
  );

  // Every summon starts clean: no filter, nothing selected, caret in the box.
  const firstSession = useRef(sessionStartedAt);
  useEffect(() => {
    if (sessionStartedAt !== firstSession.current) {
      firstSession.current = sessionStartedAt;
      resetView();
    }
    inputRef.current?.focus();
  }, [sessionStartedAt, resetView]);

  // A new query invalidates the old selection: ↵ then means "first match".
  const onQueryChange = (value: string) => {
    setQuery(value);
    if (selectedKey) select(null);
  };

  const move = useCallback(
    (key: string) => {
      const pos = (() => {
        if (!selectedKey) return null;
        for (let c = 0; c < navGrid.length; c++) {
          const r = navGrid[c].indexOf(selectedKey);
          if (r !== -1) return { c, r };
        }
        return null;
      })();
      if (!pos) {
        const first = navGrid[0]?.[0];
        if (first) select(first);
        return;
      }
      let { c, r } = pos;
      if (key === "ArrowDown") r = Math.min(r + 1, navGrid[c].length - 1);
      if (key === "ArrowUp") r = Math.max(r - 1, 0);
      if (key === "ArrowRight" || key === "ArrowLeft") {
        c = key === "ArrowRight" ? c + 1 : c - 1;
        if (c < 0 || c >= navGrid.length) return;
        r = Math.min(r, navGrid[c].length - 1);
      }
      select(navGrid[c][r]);
    },
    [navGrid, selectedKey, select],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (suspended || e.defaultPrevented || e.isComposing) return;
      if (useSettingsStore.getState().settingsOpen) return;
      // ⌘/Ctrl combos belong to the app (⌘1–9 phase switch, ⌘K, ⌘,).
      if (e.metaKey || e.ctrlKey) return;
      const inFilter = e.target === inputRef.current;
      // Only keys aimed at the panorama: the filter box, the body (nothing
      // focused) or something inside the view. A focused header button or a
      // field elsewhere keeps its own keys.
      const target = e.target instanceof Node ? e.target : null;
      const inside =
        inFilter ||
        target === document.body ||
        (target != null && !!rootRef.current?.contains(target));
      if (!inside || (!inFilter && isEditable(e.target))) return;

      if (onExtraKey?.(e, selected)) {
        e.preventDefault();
        return;
      }
      if (e.altKey) return;

      const q = usePanoramaStore.getState().query;
      if (/^[1-9]$/.test(e.key) && q === "") {
        e.preventDefault();
        const item = model.bySlot[Number(e.key)];
        if (item) copyItem(item);
        return;
      }
      if (e.key === "Enter") {
        const target = selected ?? firstMatch;
        if (target) {
          e.preventDefault();
          copyItem(target);
        }
        return;
      }
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        // ←/→ inside a non-empty filter box keep moving the caret.
        if (
          inFilter &&
          q !== "" &&
          (e.key === "ArrowLeft" || e.key === "ArrowRight")
        ) {
          return;
        }
        e.preventDefault();
        move(e.key);
        return;
      }
      // Printable keys typed while focus sits elsewhere still feed the filter.
      if (!inFilter && e.key.length === 1) {
        e.preventDefault();
        setQuery(q + e.key);
        if (selectedKey) select(null);
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    suspended,
    onExtraKey,
    selected,
    selectedKey,
    select,
    firstMatch,
    model,
    copyItem,
    move,
    setQuery,
  ]);

  const maxUsage = model.maxUsageCount;
  const preview = selected ?? firstMatch;

  const renderItem = (item: PanoramaItem) => {
    const key = keyOf(item);
    const dimmed = filtering && !matchesFilter(item, query);
    const isSelected = key === selectedKey;
    const cls = [
      styles.item,
      styles[item.tier],
      dimmed ? styles.dimmed : "",
      isSelected ? styles.selected : "",
      flashId === key ? styles.flash : "",
    ]
      .filter(Boolean)
      .join(" ");
    const ratio = maxUsage > 0 ? item.usageCount / maxUsage : 0;
    return (
      <li key={key} className={styles.row} data-item-key={key}>
        <button
          type="button"
          className={cls}
          data-tier={item.tier}
          data-dimmed={dimmed ? "true" : undefined}
          aria-current={isSelected ? "true" : undefined}
          title={item.content}
          tabIndex={-1}
          // Keep the caret in the filter box: a click copies, it doesn't move focus.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            select(key);
            copyItem(item);
          }}
        >
          {item.tier === "pinned" ? (
            <>
              <span
                className={styles.slot}
                aria-label={`常用位 ${item.pinSlot}`}
              >
                {item.pinSlot}
              </span>
              <span className={styles.name}>{item.name}</span>
              <span className={styles.count}>{item.usageCount}</span>
              <span
                className={styles.bar}
                aria-hidden
                style={{ "--usage": ratio } as CSSProperties}
              />
            </>
          ) : (
            <>
              <span className={styles.name}>{item.name}</span>
              {item.tier === "active" &&
                (item.isNew ? (
                  <span className={styles.newTag}>新</span>
                ) : (
                  <span className={styles.count}>{item.usageCount}</span>
                ))}
            </>
          )}
        </button>
        {renderItemAction?.(item)}
      </li>
    );
  };

  const renderColumn = (
    entry: {
      column: PanoramaColumn;
      items: PanoramaItem[];
      cut: PanoramaItem[];
    },
    variant: "column" | "strip",
  ) => {
    const { column, items, cut } = entry;
    const live = items.filter((i) => i.tier !== "dormant");
    const dormant = items.filter((i) => i.tier === "dormant");
    const cutMatches = filtering
      ? cut.filter((i) => matchesFilter(i, query)).length
      : 0;
    return (
      <section
        key={column.id}
        className={variant === "column" ? styles.column : styles.stripGroup}
        aria-label={column.title}
        data-column={column.id}
      >
        <header className={styles.columnHeader}>
          <span className={styles.columnTitle}>{column.title}</span>
          <span className={styles.columnCount}>
            {column.activeCount} / {column.items.length}
          </span>
        </header>
        <div
          className={
            variant === "column" ? styles.columnBody : styles.stripBody
          }
          data-column-body={variant === "column" ? column.id : undefined}
        >
          <ul className={styles.list}>{live.map(renderItem)}</ul>
          {dormant.length > 0 && (
            <ul className={`${styles.list} ${styles.dormantList}`}>
              {dormant.map(renderItem)}
            </ul>
          )}
          {cut.length > 0 && (
            <p className={styles.more} data-more>
              还有 {cut.length} 条
              {cutMatches > 0 ? `，其中 ${cutMatches} 条匹配` : ""}
            </p>
          )}
        </div>
      </section>
    );
  };

  return (
    <div className={styles.panorama} ref={rootRef} aria-label="全景">
      <div className={styles.filterRow}>
        <input
          ref={inputRef}
          className={styles.filter}
          type="text"
          value={query}
          placeholder="按 1–9 贴出常用位，打字筛选"
          aria-label="筛选"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onQueryChange(e.target.value)}
        />
      </div>
      <div className={styles.grid} ref={gridRef}>
        {visibleColumns.columns.map((c) => renderColumn(c, "column"))}
      </div>
      <div className={styles.strip}>
        {visibleColumns.strip.map((c) => renderColumn(c, "strip"))}
      </div>
      <footer className={styles.preview} aria-live="polite">
        {preview ? (
          <>
            <span className={styles.previewName}>{preview.name}</span>
            <span className={styles.previewContent}>{preview.content}</span>
            <span className={styles.previewMeta}>
              {preview.usageCount} 次 · {formatDate(preview.lastUsedAt)}
            </span>
          </>
        ) : (
          <span className={styles.previewHint}>
            {filtering ? "没有匹配的条目" : "↑↓←→ 选择，↵ 贴出，Esc 清空或收起"}
          </span>
        )}
      </footer>
    </div>
  );
}
