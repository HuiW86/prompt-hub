import { useCallback, useEffect, useMemo, useRef } from "react";

import { Globe, MessageSquareText, Search, Sparkles } from "lucide-react";

import { useCopy } from "../../hooks/useCopy";
import { writeClipboard } from "../../hooks/useClipboard";
import { usePanoramaModel } from "../../hooks/usePanoramaModel";
import { ipc } from "../../ipc";
import { useAppStore } from "../../stores/appStore";
import { usePanoramaStore } from "../../stores/panoramaStore";
import { useQuickStore } from "../../stores/quickStore";
import { useSessionStore } from "../../stores/sessionStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useSkillStore } from "../../stores/skillStore";
import { useToastStore } from "../../stores/toastStore";
import { useWebsiteStore } from "../../stores/websiteStore";
import { toUserMessage } from "../../utils/errorMessage";
import { itemsInReadingOrder } from "../../utils/panorama";
import {
  orderQuickRows,
  toQuickRows,
  type QuickRow,
} from "../../utils/quickList";
import { buildSkillBoard, skillsInReadingOrder } from "../../utils/skills";
import { countPaste } from "../../utils/viewTrial";

import styles from "./QuickView.module.css";

// The quick view (ADR-034, issue #50): where a wake lands. One list, caret in
// the box, type to narrow, ↵ to paste. The panorama is one Tab away for when
// the question is "what do I have" rather than "give me that one".

const KIND_LABEL = { prompt: "话术", skill: "技能", website: "网站" } as const;

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

function KindIcon({ kind }: { kind: QuickRow["entry"]["kind"] }) {
  const props = { size: 14, strokeWidth: 2, "aria-hidden": true } as const;
  if (kind === "skill") return <Sparkles {...props} />;
  if (kind === "website") return <Globe {...props} />;
  return <MessageSquareText {...props} />;
}

export function QuickView() {
  const model = usePanoramaModel();
  const loadPlacements = usePanoramaStore((s) => s.load);

  const skills = useSkillStore((s) => s.skills);
  const skillsLoaded = useSkillStore((s) => s.loaded);
  const loadSkills = useSkillStore((s) => s.load);
  const recordSkillUse = useSkillStore((s) => s.recordUse);

  const websites = useWebsiteStore((s) => s.library.websites);
  const websitesLoaded = useWebsiteStore((s) => s.loaded);
  const refreshWebsites = useWebsiteStore((s) => s.refresh);

  const query = useQuickStore((s) => s.query);
  const setQuery = useQuickStore((s) => s.setQuery);
  const selectedKey = useQuickStore((s) => s.selectedKey);
  const select = useQuickStore((s) => s.select);
  const resetView = useQuickStore((s) => s.resetView);

  const sessionStartedAt = useSessionStore((s) => s.sessionStartedAt);
  const flashId = useToastStore((s) => s.flashTargetId);
  const show = useToastStore((s) => s.show);
  const showError = useToastStore((s) => s.showError);
  const copy = useCopy();

  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Pins live in the panorama store; skills and websites in their own. All
  // three load after the first paint — the wake path only needs the input.
  useEffect(() => {
    void loadPlacements();
  }, [loadPlacements]);
  useEffect(() => {
    if (!skillsLoaded) void loadSkills();
  }, [skillsLoaded, loadSkills]);
  useEffect(() => {
    if (!websitesLoaded) void refreshWebsites().catch(() => {});
  }, [websitesLoaded, refreshWebsites]);

  const allRows = useMemo(
    () =>
      toQuickRows({
        prompts: itemsInReadingOrder(model),
        skills: skillsInReadingOrder(buildSkillBoard(skills, new Date())),
        websites,
      }),
    [model, skills, websites],
  );
  const rows = useMemo(() => orderQuickRows(allRows, query), [allRows, query]);
  const rowByKey = useMemo(
    () => new Map(allRows.map((r) => [r.key, r])),
    [allRows],
  );
  const pinned = useMemo(() => {
    const bySlot: Record<number, QuickRow> = {};
    for (const r of allRows) if (r.pinSlot != null) bySlot[r.pinSlot] = r;
    return bySlot;
  }, [allRows]);

  const selected =
    (selectedKey ? rowByKey.get(selectedKey) : undefined) ?? rows[0] ?? null;

  // Every summon starts clean: empty box, nothing selected, caret in the box.
  const firstSession = useRef(sessionStartedAt);
  useEffect(() => {
    if (sessionStartedAt !== firstSession.current) {
      firstSession.current = sessionStartedAt;
      resetView();
    }
    inputRef.current?.focus();
  }, [sessionStartedAt, resetView]);

  // Keep the selected row in view while arrowing through a long list.
  useEffect(() => {
    if (!selected) return;
    const rowEls =
      listRef.current?.querySelectorAll<HTMLElement>("[data-row-key]") ?? [];
    for (const el of rowEls) {
      if (el.dataset.rowKey === selected.key) {
        el.scrollIntoView?.({ block: "nearest" });
        break;
      }
    }
  }, [selected]);

  const activate = useCallback(
    async (row: QuickRow) => {
      const { entry } = row;
      if (entry.kind === "prompt") {
        // useCopy counts the paste for the trial (workspace = quick).
        void copy(entry.item.content, entry.item.usage, row.key);
        return;
      }
      if (entry.kind === "skill") {
        try {
          await writeClipboard(entry.item.copyText);
        } catch (err) {
          console.error("writeClipboard failed", err);
          showError("复制失败");
          return;
        }
        show("已复制", row.key);
        countPaste("quick");
        const suppressHide =
          useSettingsStore.getState().interactionMode === "organize";
        try {
          await recordSkillUse(entry.item.skill.id, suppressHide);
        } catch (err) {
          console.error("recordSkillUse failed", err);
        }
        return;
      }
      try {
        await ipc.openWebsite(entry.site.id);
        show("已交给默认浏览器打开", row.key);
      } catch (err) {
        showError(toUserMessage(err, "浏览器未能打开网址"));
      }
    },
    [copy, recordSkillUse, show, showError],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return;
      if (useSettingsStore.getState().settingsOpen) return;
      // ⌘/Ctrl combos belong to the app (⌘1–9 phase, ⌘, settings).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const inFilter = e.target === inputRef.current;
      const target = e.target instanceof Node ? e.target : null;
      const inside =
        inFilter ||
        target === document.body ||
        (target != null && !!rootRef.current?.contains(target));
      if (!inside || (!inFilter && isEditable(e.target))) return;

      const q = useQuickStore.getState().query;
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        useAppStore.getState().setWorkspace("panorama");
        return;
      }
      if (/^[1-9]$/.test(e.key) && q === "") {
        e.preventDefault();
        const row = pinned[Number(e.key)];
        if (row) void activate(row);
        return;
      }
      if (e.key === "Enter") {
        if (selected) {
          e.preventDefault();
          void activate(selected);
        }
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (rows.length === 0) return;
        const i = selected ? rows.findIndex((r) => r.key === selected.key) : -1;
        const next =
          e.key === "ArrowDown"
            ? Math.min(i + 1, rows.length - 1)
            : Math.max(i - 1, 0);
        select(rows[next].key);
        return;
      }
      // Printable keys typed while focus sits elsewhere still feed the box.
      if (!inFilter && e.key.length === 1) {
        e.preventDefault();
        setQuery(q + e.key);
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activate, pinned, rows, selected, select, setQuery]);

  const filtering = query.trim() !== "";

  return (
    <div className={styles.quick} ref={rootRef} aria-label="快取">
      <label className={styles.filterRow}>
        <Search
          className={styles.filterIcon}
          size={18}
          strokeWidth={2}
          aria-hidden
        />
        <input
          ref={inputRef}
          className={styles.filter}
          type="text"
          value={query}
          placeholder="打字找话术、技能、网站"
          aria-label="快取筛选"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className={styles.body}>
        {rows.length === 0 ? (
          <p className={styles.empty}>
            {filtering ? "没有匹配的条目" : "还没有条目"}
          </p>
        ) : (
          <ul className={styles.list} ref={listRef} role="listbox">
            {rows.map((row) => {
              const isSelected = row.key === selected?.key;
              const cls = [
                styles.row,
                isSelected ? styles.selected : "",
                flashId === row.key ? styles.flash : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <li
                  key={row.key}
                  data-row-key={row.key}
                  role="option"
                  aria-selected={isSelected}
                >
                  <button
                    type="button"
                    className={cls}
                    tabIndex={-1}
                    // Keep the caret in the box: a click pastes, focus stays.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => {
                      if (!isSelected) select(row.key);
                    }}
                    onClick={() => {
                      select(row.key);
                      void activate(row);
                    }}
                  >
                    <span className={styles.slot} aria-hidden={!row.pinSlot}>
                      {row.pinSlot ?? ""}
                    </span>
                    <span
                      className={styles.kind}
                      title={KIND_LABEL[row.entry.kind]}
                    >
                      <KindIcon kind={row.entry.kind} />
                    </span>
                    <span className={styles.name}>{row.name}</span>
                    <span className={styles.firstLine}>{row.firstLine}</span>
                    {row.usageCount != null && row.usageCount > 0 && (
                      <span className={styles.count}>{row.usageCount}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <aside className={styles.preview} aria-live="polite">
          {selected ? (
            <>
              <div className={styles.previewHead}>
                <span className={styles.previewKind}>
                  {KIND_LABEL[selected.entry.kind]}
                </span>
                <span className={styles.previewName}>{selected.name}</span>
              </div>
              <p className={styles.previewBody}>{selected.body}</p>
            </>
          ) : null}
        </aside>
      </div>
      <footer className={styles.hint}>
        <kbd className={styles.kbd}>1–9</kbd> 常用位
        <kbd className={styles.kbd}>↑↓</kbd> 选择
        <kbd className={styles.kbd}>↵</kbd> 贴出
        <kbd className={styles.kbd}>Tab</kbd> 全景
        <kbd className={styles.kbd}>Esc</kbd> 清空或收起
      </footer>
    </div>
  );
}
