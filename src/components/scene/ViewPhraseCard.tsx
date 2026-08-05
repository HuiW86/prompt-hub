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
import { ActionCluster, ConfirmInline, IconButton } from "../primitives";
import primitiveStyles from "../primitives/primitives.module.css";

import styles from "../ScenePanel.module.css";

export interface ViewPhraseCardProps {
  phrase: Phrase;
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

// A view-mode phrase card. Its whole-card click is mode-aware (D-0):
//  • 调用态 — the card copies (primary action, zero-regression T0), so every
//    action-cluster button stops propagation to never trigger a copy.
//  • 整理态 — the card toggles a full-content preview (line-clamp off) instead
//    of copying, so the user can read a phrase while organizing without grabbing
//    the clipboard or being hidden; copy demotes to an explicit cluster button.
// Delete is a two-step inline confirm held in local state so one card's confirm
// never bleeds into another's.
export function ViewPhraseCard({
  phrase,
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
  const [confirming, setConfirming] = useState(false);
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
      {confirming ? (
        <div
          className={styles.phraseActions}
          onClick={(e) => e.stopPropagation()}
        >
          <ConfirmInline
            text="永久删除？"
            confirmLabel="确认永久删除"
            cancelLabel="取消删除"
            onConfirm={onDelete}
            onCancel={() => setConfirming(false)}
          />
        </div>
      ) : (
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
            onClick={stop(() => setConfirming(true))}
          >
            <Trash2 size={13} aria-hidden strokeWidth={2} />
          </IconButton>
        </ActionCluster>
      )}
    </div>
  );
}
