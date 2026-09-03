import {
  ArrowDown,
  ArrowUp,
  Copy,
  FolderInput,
  Pencil,
  Trash2,
} from "lucide-react";
import { type MouseEvent as ReactMouseEvent, useState } from "react";

import type { Phrase } from "../../ipc/types";
import type { InteractionMode } from "../../stores/settingsStore";
import { ActionCluster, IconButton } from "../primitives";
import primitiveStyles from "../primitives/primitives.module.css";

import styles from "../ScenePanel.module.css";

export interface ViewPhraseCardProps {
  phrase: Phrase;
  /** Hands the card element up so its anchored editor can pin to it
   *  (ADR-025 子决策 1) — the card is also the focus-restore target. */
  anchorRef?: (el: HTMLElement | null) => void;
  flash: boolean;
  interactionMode: InteractionMode;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onMove: (dir: -1 | 1) => void;
  onMoveTo: () => void;
  onDelete: () => void;
}

// A view-mode phrase card. At rest it shows the TITLE ONLY — the prompt body
// stays off the card face (omar 2026-07-23: the name is the handle; content on
// every card burned the screen's carrying capacity). Whole-card click is
// mode-aware (D-0):
//  • 调用态 — the card copies (primary action, zero-regression T0), so every
//    action-cluster button stops propagation to never trigger a copy.
//  • 整理态 — the card toggles the full-content preview (the only moment the
//    body renders), so the user can read a phrase while organizing without
//    grabbing the clipboard; copy demotes to an explicit cluster button.
// Delete fires on the first click and is undone from the toast (ADR-028
// 子决策 3), so the card no longer swaps its cluster for a confirm row.
export function ViewPhraseCard({
  phrase,
  anchorRef,
  flash,
  interactionMode,
  canMoveUp,
  canMoveDown,
  onCopy,
  onEdit,
  onMove,
  onMoveTo,
  onDelete,
}: ViewPhraseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const organizing = interactionMode === "organize";
  const stop = (fn: () => void) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    fn();
  };
  // Whole-card primary action: copy in 调用态, expand/collapse preview in 整理态.
  const onCardActivate = organizing ? () => setExpanded((v) => !v) : onCopy;
  const cls = `${styles.phrase} ${flash ? `${primitiveStyles.task} ${primitiveStyles.flash}` : ""}`;
  const contentCls =
    organizing && expanded
      ? `${styles.phraseContent} ${styles.phraseContentExpanded}`
      : styles.phraseContent;
  return (
    <div
      ref={anchorRef}
      role="button"
      tabIndex={-1}
      className={cls}
      data-nav-item
      data-nav-id={`phrase-${phrase.id}`}
      aria-expanded={organizing ? expanded : undefined}
      onClick={onCardActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCardActivate();
        }
      }}
      aria-label={phrase.name}
    >
      <Copy
        size={13}
        className={styles.phraseIcon}
        aria-hidden
        strokeWidth={2}
      />
      <span className={styles.phraseBody}>
        <h4 className={styles.phraseTitle}>{phrase.name}</h4>
        <p className={contentCls}>{phrase.content}</p>
      </span>
      <ActionCluster className={styles.phraseActions} reveal>
        {/* 整理态 demotes copy from the whole-card gesture to an explicit
            button so the card click can preview instead. */}
        {organizing && (
          <IconButton
            aria-label={`复制 ${phrase.name}`}
            data-nav-item
            tabIndex={-1}
            onClick={stop(onCopy)}
          >
            <Copy size={13} aria-hidden strokeWidth={2} />
          </IconButton>
        )}
        <IconButton
          aria-label={`上移 ${phrase.name}`}
          data-nav-item
          tabIndex={-1}
          disabled={!canMoveUp}
          onClick={stop(() => onMove(-1))}
        >
          <ArrowUp size={13} aria-hidden strokeWidth={2} />
        </IconButton>
        <IconButton
          aria-label={`下移 ${phrase.name}`}
          data-nav-item
          tabIndex={-1}
          disabled={!canMoveDown}
          onClick={stop(() => onMove(1))}
        >
          <ArrowDown size={13} aria-hidden strokeWidth={2} />
        </IconButton>
        <IconButton
          aria-label={`编辑 ${phrase.name}`}
          data-nav-item
          tabIndex={-1}
          onClick={stop(onEdit)}
        >
          <Pencil size={13} aria-hidden strokeWidth={2} />
        </IconButton>
        {/* ADR-022: cross-scene / cross-sub-stage move — swaps the card for a
            layered Scene → SubStage selector. */}
        <IconButton
          aria-label={`移动 ${phrase.name} 到其他场景`}
          data-nav-item
          tabIndex={-1}
          onClick={stop(onMoveTo)}
        >
          <FolderInput size={13} aria-hidden strokeWidth={2} />
        </IconButton>
        <IconButton
          aria-label={`删除 ${phrase.name}`}
          data-nav-item
          tabIndex={-1}
          onClick={stop(onDelete)}
        >
          <Trash2 size={13} aria-hidden strokeWidth={2} />
        </IconButton>
      </ActionCluster>
    </div>
  );
}
