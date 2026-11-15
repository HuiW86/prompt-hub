import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
} from "react";

import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FileUp, Search } from "lucide-react";

import { writeClipboard } from "../../hooks/useClipboard";
import { hoverPreviewHandlers } from "../../stores/hoverPreviewStore";
import { useSessionStore } from "../../stores/sessionStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useSkillStore } from "../../stores/skillStore";
import { useToastStore } from "../../stores/toastStore";
import { toUserMessage } from "../../utils/errorMessage";
import {
  buildSkillBoard,
  matchesSkill,
  SKILL_SOURCE_LABELS,
  SKILL_STAGES,
  skillPreviewText,
  skillsInReadingOrder,
  type SkillColumn,
  type SkillItem,
} from "../../utils/skills";

import board from "../panorama/PanoramaView.module.css";
import styles from "./SkillPanel.module.css";

// The skill workspace (ADR-033): the panorama's board, filled from the skill
// index. Same tiers, same keys — 1–9 copies a pinned skill's invocation, arrows
// select, ↵ copies, typing filters — so there is nothing new to learn. The one
// extra key is ⇧↵, which copies the selected skill's source address: the hand-
// off to whoever maintains it. Pins are edited in organize mode (⌥1–9 / ⌥0);
// which column a skill sits in comes from the index, not from this view.

function formatDate(iso: string | null): string {
  if (!iso) return "未用过";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "未用过";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function ordinal(id: string): string | null {
  const i = (SKILL_STAGES as readonly string[]).indexOf(id);
  return i === -1 ? null : String(i + 1).padStart(2, "0");
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

export function SkillPanel() {
  const skills = useSkillStore((s) => s.skills);
  const loaded = useSkillStore((s) => s.loaded);
  const error = useSkillStore((s) => s.error);
  const load = useSkillStore((s) => s.load);
  const importIndex = useSkillStore((s) => s.importIndex);
  const recordUse = useSkillStore((s) => s.recordUse);
  const setPin = useSkillStore((s) => s.setPin);
  const query = useSkillStore((s) => s.query);
  const setQuery = useSkillStore((s) => s.setQuery);
  const selectedId = useSkillStore((s) => s.selectedId);
  const select = useSkillStore((s) => s.select);
  const resetView = useSkillStore((s) => s.resetView);

  const organizing = useSettingsStore((s) => s.interactionMode === "organize");
  const show = useToastStore((s) => s.show);
  const showError = useToastStore((s) => s.showError);
  const showWithAction = useToastStore((s) => s.showWithAction);
  const flashId = useToastStore((s) => s.flashTargetId);
  const sessionStartedAt = useSessionStore((s) => s.sessionStartedAt);

  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void load();
  }, [load]);

  const model = useMemo(() => buildSkillBoard(skills, new Date()), [skills]);
  const filtering = query.trim() !== "";
  const allItems = useMemo(() => skillsInReadingOrder(model), [model]);
  const itemById = useMemo(
    () => new Map(allItems.map((i) => [i.skill.id, i])),
    [allItems],
  );
  const navGrid = useMemo(
    () =>
      [...model.columns, ...model.strip]
        .map((c) => c.items.map((i) => i.skill.id))
        .filter((ids) => ids.length > 0),
    [model],
  );
  const selected = selectedId ? (itemById.get(selectedId) ?? null) : null;
  const firstMatch = useMemo(
    () =>
      filtering ? (allItems.find((i) => matchesSkill(i, query)) ?? null) : null,
    [filtering, allItems, query],
  );

  // A summon starts clean: no filter, nothing selected, caret in the box.
  const firstSession = useRef(sessionStartedAt);
  useEffect(() => {
    if (sessionStartedAt !== firstSession.current) {
      firstSession.current = sessionStartedAt;
      resetView();
    }
    inputRef.current?.focus();
  }, [sessionStartedAt, resetView]);

  const copySkill = useCallback(
    async (item: SkillItem) => {
      try {
        await writeClipboard(item.copyText);
      } catch (err) {
        console.error("writeClipboard failed", err);
        showError("复制失败");
        return;
      }
      show("已复制", item.skill.id);
      // Organize mode keeps the window (D-0), exactly as for prompts.
      const suppressHide =
        useSettingsStore.getState().interactionMode === "organize";
      try {
        await recordUse(item.skill.id, suppressHide);
      } catch (err) {
        console.error("recordSkillUse failed", err);
      }
    },
    [recordUse, show, showError],
  );

  // Maintenance, not use: copies the address, records nothing, keeps the window.
  const copySource = useCallback(
    async (item: SkillItem) => {
      const url = item.skill.sourceUrl.trim();
      if (!url) {
        showError(`「${item.skill.name}」没有登记源地址`);
        return;
      }
      try {
        await writeClipboard(url);
        show("已复制源地址", item.skill.id);
      } catch {
        showError("复制失败");
      }
    },
    [show, showError],
  );

  const pin = useCallback(
    async (item: SkillItem, slot: number | null) => {
      if (item.skill.pinSlot === slot) return;
      const holder = slot != null ? model.bySlot[slot] : undefined;
      const displaced =
        holder && holder.skill.id !== item.skill.id ? holder : undefined;
      const before = item.skill.pinSlot;
      try {
        await setPin(item.skill.id, slot);
      } catch (err) {
        showError(toUserMessage(err, "调整常用位失败"));
        return;
      }
      if (!displaced) return;
      showWithAction(
        `常用位 ${slot} 已从「${displaced.skill.name}」让给「${item.skill.name}」`,
        {
          label: "撤销",
          onClick: () => {
            void (async () => {
              try {
                await setPin(item.skill.id, before);
                await setPin(displaced.skill.id, slot);
              } catch (err) {
                showError(toUserMessage(err, "撤销失败"));
              }
            })();
          },
        },
      );
    },
    [model, setPin, showError, showWithAction],
  );

  const onImport = useCallback(async () => {
    try {
      const picked = await openDialog({
        multiple: false,
        directory: false,
        filters: [{ name: "技能索引", extensions: ["json"] }],
      });
      const path = Array.isArray(picked) ? picked[0] : picked;
      if (!path) return;
      const r = await importIndex(path);
      show(
        `已导入 ${r.total} 个技能：新增 ${r.added}，更新 ${r.updated}，移除 ${r.removed}`,
      );
    } catch (err) {
      showError(toUserMessage(err, "导入技能索引失败"));
    }
  }, [importIndex, show, showError]);

  const move = useCallback(
    (key: string) => {
      const pos = (() => {
        if (!selectedId) return null;
        for (let c = 0; c < navGrid.length; c++) {
          const r = navGrid[c].indexOf(selectedId);
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
    [navGrid, selectedId, select],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return;
      if (useSettingsStore.getState().settingsOpen) return;
      if (e.metaKey || e.ctrlKey) return;
      const inFilter = e.target === inputRef.current;
      const target = e.target instanceof Node ? e.target : null;
      const inside =
        inFilter ||
        target === document.body ||
        (target != null && !!rootRef.current?.contains(target));
      if (!inside || (!inFilter && isEditable(e.target))) return;

      // Organize mode: ⌥1–⌥9 pins the selection, ⌥0 unpins. `code`, not
      // `key`: on macOS ⌥ turns digits into symbols.
      if (organizing && selected && e.altKey && !e.shiftKey) {
        const digit = /^Digit([0-9])$/.exec(e.code);
        if (digit) {
          e.preventDefault();
          const n = Number(digit[1]);
          void pin(selected, n === 0 ? null : n);
          return;
        }
      }
      if (e.altKey) return;

      const q = useSkillStore.getState().query;
      if (/^[1-9]$/.test(e.key) && q === "") {
        e.preventDefault();
        const item = model.bySlot[Number(e.key)];
        if (item) void copySkill(item);
        return;
      }
      if (e.key === "Enter") {
        const item = selected ?? firstMatch;
        if (item) {
          e.preventDefault();
          void (e.shiftKey ? copySource(item) : copySkill(item));
        }
        return;
      }
      if (
        e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
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
      if (!inFilter && e.key.length === 1) {
        e.preventDefault();
        setQuery(q + e.key);
        if (selectedId) select(null);
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [
    organizing,
    selected,
    selectedId,
    firstMatch,
    model,
    copySkill,
    copySource,
    pin,
    move,
    select,
    setQuery,
  ]);

  const preview = selected ?? firstMatch;
  const maxUsage = model.maxUsageCount;

  const renderItem = (item: SkillItem) => {
    const { skill } = item;
    const dimmed = filtering && !matchesSkill(item, query);
    const isSelected = skill.id === selectedId;
    const cls = [
      board.item,
      board[item.tier],
      dimmed ? board.dimmed : "",
      isSelected ? board.selected : "",
      flashId === skill.id ? board.flash : "",
    ]
      .filter(Boolean)
      .join(" ");
    const ratio = maxUsage > 0 ? skill.usageCount / maxUsage : 0;
    return (
      <li
        key={skill.id}
        className={board.row}
        data-skill-id={skill.id}
        data-selected={isSelected ? "true" : undefined}
      >
        <button
          type="button"
          className={cls}
          data-tier={item.tier}
          data-dimmed={dimmed ? "true" : undefined}
          aria-current={isSelected ? "true" : undefined}
          {...hoverPreviewHandlers({
            title: skill.name,
            content: skillPreviewText(skill),
            meta: `${SKILL_SOURCE_LABELS[skill.source]} · ${skill.usageCount} 次 · ${formatDate(skill.lastUsedAt)}`,
          })}
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            select(skill.id);
            void copySkill(item);
          }}
        >
          {item.tier === "pinned" ? (
            <>
              <span
                className={board.slot}
                aria-label={`常用位 ${skill.pinSlot}`}
              >
                {skill.pinSlot}
              </span>
              <span className={board.name}>{skill.name}</span>
              <span className={board.count}>{skill.usageCount}</span>
              <span
                className={board.bar}
                aria-hidden
                style={{ "--usage": ratio } as CSSProperties}
              />
            </>
          ) : (
            <>
              <span className={board.name}>{skill.name}</span>
              {item.tier === "active" &&
                (item.isNew ? (
                  <span className={board.newTag}>新</span>
                ) : (
                  <span className={board.count}>{skill.usageCount}</span>
                ))}
            </>
          )}
        </button>
      </li>
    );
  };

  const renderColumn = (column: SkillColumn, variant: "column" | "strip") => {
    const live = column.items.filter((i) => i.tier !== "dormant");
    const dormant = column.items.filter((i) => i.tier === "dormant");
    return (
      <section
        key={column.id}
        className={variant === "column" ? board.column : board.stripGroup}
        aria-label={column.title}
        data-column={column.id}
      >
        <header className={board.columnHeader}>
          {ordinal(column.id) && (
            <span className={board.ordinal} aria-hidden>
              {ordinal(column.id)}
            </span>
          )}
          <span className={board.columnTitle}>{column.title}</span>
          <span className={board.columnCount}>
            {column.activeCount} / {column.items.length}
          </span>
        </header>
        <div
          className={
            variant === "column"
              ? `${board.columnBody} ${styles.scrollable}`
              : board.stripBody
          }
        >
          <ul className={board.list}>{live.map(renderItem)}</ul>
          {dormant.length > 0 && (
            <ul className={`${board.list} ${board.dormantList}`}>
              {dormant.map(renderItem)}
            </ul>
          )}
        </div>
      </section>
    );
  };

  const importButton = (
    <button
      type="button"
      className={styles.importButton}
      onClick={() => void onImport()}
      title="从技能索引文件更新：文字以文件为准，常用位和次数保留"
    >
      <FileUp size={14} strokeWidth={2} aria-hidden />
      导入技能索引…
    </button>
  );

  if (loaded && model.total === 0) {
    return (
      <div className={board.panorama} ref={rootRef} aria-label="技能">
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>
            {error ?? "还没有技能。导入一份技能索引，就能在这里一眼看全。"}
          </p>
          <p className={styles.emptyHint}>
            索引文件由
            Notion「技能索引」生成；以后重新导入只更新文字，常用位和使用次数会保留。
          </p>
          {importButton}
        </div>
      </div>
    );
  }

  return (
    <div className={board.panorama} ref={rootRef} aria-label="技能">
      <div className={styles.topRow}>
        <label className={`${board.filterRow} ${styles.filterGrow}`}>
          <Search
            className={board.filterIcon}
            size={16}
            strokeWidth={2}
            aria-hidden
          />
          <input
            ref={inputRef}
            className={board.filter}
            type="text"
            value={query}
            placeholder="打字筛选技能：名称、用途、什么时候用"
            aria-label="筛选技能"
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              if (selectedId) select(null);
            }}
          />
        </label>
        {importButton}
      </div>
      <div className={board.grid}>
        {model.columns.map((c) => renderColumn(c, "column"))}
      </div>
      {model.strip.length > 0 && (
        <div
          className={board.strip}
          style={
            {
              gridTemplateColumns: `repeat(${model.strip.length}, minmax(0, 1fr))`,
            } as CSSProperties
          }
        >
          {model.strip.map((c) => renderColumn(c, "strip"))}
        </div>
      )}
      <footer className={board.preview} aria-live="polite">
        {preview ? (
          <>
            <span className={board.previewName}>{preview.skill.name}</span>
            <span className={board.previewContent}>
              {preview.skill.purpose || preview.copyText}
            </span>
            {preview.skill.sourceUrl && (
              <button
                type="button"
                className={styles.sourceButton}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void copySource(preview)}
                title={preview.skill.sourceUrl}
              >
                复制源地址 <kbd className={board.kbd}>⇧↵</kbd>
              </button>
            )}
            <span className={board.previewMeta}>
              {preview.skill.usageCount} 次 ·{" "}
              {formatDate(preview.skill.lastUsedAt)}
            </span>
          </>
        ) : (
          <span className={board.previewHint}>
            {filtering ? (
              "没有匹配的技能"
            ) : (
              <>
                <kbd className={board.kbd}>1–9</kbd> 贴出常用位
                <kbd className={board.kbd}>↑↓←→</kbd> 选择
                <kbd className={board.kbd}>↵</kbd> 贴出调用句
                <kbd className={board.kbd}>⇧↵</kbd> 复制源地址
                {organizing && (
                  <>
                    <kbd className={board.kbd}>⌥1–9</kbd> 设为常用位
                  </>
                )}
              </>
            )}
          </span>
        )}
      </footer>
    </div>
  );
}
