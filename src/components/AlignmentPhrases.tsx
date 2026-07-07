import { type MouseEvent as ReactMouseEvent, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

import { useCopy } from "../hooks/useCopy";
import { useRegionNav } from "../hooks/useRegionNav";
import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { toUserMessage } from "../utils/errorMessage";
import type { AlignmentPhrase } from "../ipc/types";

import {
  ActionCluster,
  ConfirmInline,
  IconButton,
  PhraseFormEditor,
} from "./primitives";
import primitiveStyles from "./primitives/primitives.module.css";
import styles from "./AlignmentPhrases.module.css";

export function AlignmentPhrases() {
  const activePhaseId = useAppStore((s) => s.activePhaseId);
  const phrasesByPhase = usePromptStore((s) => s.alignmentPhrasesByPhase);
  const reorderAlignmentPhrases = usePromptStore(
    (s) => s.reorderAlignmentPhrases,
  );
  const deleteAlignmentPhrase = usePromptStore((s) => s.deleteAlignmentPhrase);
  const setDefaultAlignmentPhrase = usePromptStore(
    (s) => s.setDefaultAlignmentPhrase,
  );
  const createAlignmentPhrase = usePromptStore((s) => s.createAlignmentPhrase);
  const updateAlignmentPhrase = usePromptStore((s) => s.updateAlignmentPhrase);
  const copy = useCopy();
  const flashId = useToastStore((s) => s.flashTargetId);
  const showToast = useToastStore((s) => s.show);
  const showError = useToastStore((s) => s.showError);
  const onRegionKeyDown = useRegionNav();

  const phrases =
    activePhaseId != null ? (phrasesByPhase[activePhaseId] ?? []) : [];

  // In-place editing state (mirrors ScenePanel's view-mode clusters — ADR-021):
  // no global editMode. editingId swaps a chip for the inline editor; adding
  // opens the create editor; the store stays the single source of truth so a
  // phase switch resets these via the id/flag going stale, not a reset effect.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // A phase switch strands any open editor over a list the user can no longer
  // see; a stale editingId simply matches nothing, but adding/confirming must be
  // cleared explicitly. Derive the reset from activePhaseId via a render guard
  // rather than an effect: if the editing target vanished, drop the state.
  const editingExists =
    editingId != null && phrases.some((p) => p.id === editingId);
  if (editingId != null && !editingExists) setEditingId(null);
  const confirmingExists =
    confirmingId != null && phrases.some((p) => p.id === confirmingId);
  if (confirmingId != null && !confirmingExists) setConfirmingId(null);

  const handleDelete = async (id: string) => {
    setConfirmingId(null);
    try {
      await deleteAlignmentPhrase(id);
      showToast("已永久删除");
    } catch (err) {
      // Backend rejects deleting a phase's default phrase — surface the reason.
      showError(toUserMessage(err, "删除失败"));
    }
  };

  // P3-6: swap the phase's protocol default (create is always non-default and
  // delete refuses the default, so this is the only way it can ever change).
  const handleSetDefault = async (id: string) => {
    if (activePhaseId == null) return;
    try {
      await setDefaultAlignmentPhrase(activePhaseId, id);
      showToast("已设为默认");
    } catch (err) {
      showError(toUserMessage(err, "设为默认失败"));
    }
  };

  // ←→ swaps a phrase with its neighbour in the row, persisting the new order
  // through reorder_alignment_phrases. Buttons over drag: the chip's whole body
  // is the copy hot-zone (spec 复制即完成), so a drag handle would fight it
  // (ADR-021 子决策 1 — 拖拽 → 按钮移动).
  const handleMove = async (id: string, dir: -1 | 1) => {
    if (activePhaseId == null) return;
    const idx = phrases.findIndex((p) => p.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= phrases.length) return;
    const ids = phrases.map((p) => p.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    try {
      await reorderAlignmentPhrases(activePhaseId, ids);
    } catch (err) {
      showError(toUserMessage(err, "排序保存失败"));
    }
  };

  const handleCreate = async (name: string, content: string) => {
    if (activePhaseId == null) return;
    await createAlignmentPhrase({ phaseId: activePhaseId, name, content });
    setAdding(false);
  };

  const handleUpdate = async (id: string, name: string, content: string) => {
    await updateAlignmentPhrase({ id, name, content });
    setEditingId(null);
  };

  return (
    <section
      className={styles.phrases}
      aria-label="对齐话术"
      data-region="alignment-phrases"
      tabIndex={0}
      onKeyDown={onRegionKeyDown}
    >
      <span className={styles.label}>aligned</span>
      {phrases.length === 0 && !adding ? (
        <span className={styles.empty}>
          {activePhaseId == null ? "未选相位" : "暂无对齐话术"}
        </span>
      ) : (
        phrases.map((p, idx) =>
          editingId === p.id ? (
            <PhraseFormEditor
              key={p.id}
              layer="protocol"
              className={styles.inlineEditor}
              ariaLabel="编辑对齐话术"
              initialName={p.name}
              initialContent={p.content}
              submitLabel="保存"
              onSubmit={({ name, content }) =>
                handleUpdate(p.id, name, content)
              }
              onClose={() => setEditingId(null)}
            />
          ) : (
            <PhraseChip
              key={p.id}
              phrase={p}
              flash={flashId === p.id}
              confirming={confirmingId === p.id}
              canMoveLeft={idx > 0}
              canMoveRight={idx < phrases.length - 1}
              onCopy={() =>
                void copy(
                  p.content,
                  {
                    targetType: "alignment",
                    targetId: p.id,
                    source: "phase_bar",
                    modifierIds: null,
                    sopId: null,
                    sopStepOrder: null,
                    phaseId: p.phaseId,
                  },
                  p.id,
                )
              }
              onSetDefault={() => void handleSetDefault(p.id)}
              onEdit={() => setEditingId(p.id)}
              onMove={(dir) => void handleMove(p.id, dir)}
              onRequestDelete={() => setConfirmingId(p.id)}
              onCancelDelete={() => setConfirmingId(null)}
              onConfirmDelete={() => void handleDelete(p.id)}
            />
          ),
        )
      )}

      {/* Ghost add entry (ADR-021): opens the inline create editor in place. */}
      {activePhaseId != null &&
        (adding ? (
          <PhraseFormEditor
            layer="protocol"
            className={styles.inlineEditor}
            ariaLabel="新增对齐话术"
            submitLabel="新增"
            onSubmit={({ name, content }) => handleCreate(name, content)}
            onClose={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            className={styles.ghostAdd}
            aria-label="新增对齐话术"
            data-nav-item
            tabIndex={-1}
            onClick={() => setAdding(true)}
          >
            <Plus size={12} aria-hidden strokeWidth={2} />
            <span>新增</span>
          </button>
        ))}
    </section>
  );
}

interface PhraseChipProps {
  phrase: AlignmentPhrase;
  flash: boolean;
  confirming: boolean;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onCopy: () => void;
  onSetDefault: () => void;
  onEdit: () => void;
  onMove: (dir: -1 | 1) => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

// A view-mode alignment-phrase chip: the whole chip copies (primary action), so
// every action-cluster button stops propagation to never trigger a copy. The
// cluster (set-default / edit / move / delete) reveals on hover/focus-within,
// mirroring ScenePanel's ViewPhraseCard (ADR-021). Delete is a two-step inline
// confirm held by the parent so one chip's confirm never bleeds into another's.
function PhraseChip({
  phrase,
  flash,
  confirming,
  canMoveLeft,
  canMoveRight,
  onCopy,
  onSetDefault,
  onEdit,
  onMove,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: PhraseChipProps) {
  const stop = (fn: () => void) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    fn();
  };

  if (confirming) {
    return (
      <span className={styles.confirmSlot}>
        <span className={styles.rowName}>{phrase.name}</span>
        <ConfirmInline
          text="永久删除？"
          confirmLabel="确认永久删除"
          cancelLabel="取消删除"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      </span>
    );
  }

  // A chip-styled div (role="button") rather than the Chip <button> primitive:
  // the revealed action cluster nests IconButtons, and buttons can't nest in a
  // button. The whole chip copies; cluster buttons stop propagation.
  const cls = [
    styles.chip,
    // .protocol scopes --layer for the active fill (mirrors the Chip primitive).
    primitiveStyles.protocol,
    phrase.isDefault ? styles.chipActive : styles.chipDim,
    flash ? primitiveStyles.flash : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role="button"
      tabIndex={-1}
      className={cls}
      data-nav-item
      aria-label={phrase.name}
      onClick={onCopy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCopy();
        }
      }}
    >
      <span
        className={phrase.isDefault ? styles.dot : styles.dotDim}
        aria-hidden
      />
      <span className={styles.chipName}>{phrase.name}</span>
      <ActionCluster className={styles.chipActions}>
        {/* Only non-defaults offer the swap — the current default already shows
            the filled dot. */}
        {!phrase.isDefault && (
          <IconButton
            aria-label={`设为默认 ${phrase.name}`}
            data-nav-item
            tabIndex={-1}
            onClick={stop(onSetDefault)}
          >
            <Star size={12} aria-hidden strokeWidth={2} />
          </IconButton>
        )}
        <IconButton
          aria-label={`前移 ${phrase.name}`}
          data-nav-item
          tabIndex={-1}
          disabled={!canMoveLeft}
          onClick={stop(() => onMove(-1))}
        >
          <ArrowLeft size={12} aria-hidden strokeWidth={2} />
        </IconButton>
        <IconButton
          aria-label={`后移 ${phrase.name}`}
          data-nav-item
          tabIndex={-1}
          disabled={!canMoveRight}
          onClick={stop(() => onMove(1))}
        >
          <ArrowRight size={12} aria-hidden strokeWidth={2} />
        </IconButton>
        <IconButton
          aria-label={`编辑 ${phrase.name}`}
          data-nav-item
          tabIndex={-1}
          onClick={stop(onEdit)}
        >
          <Pencil size={12} aria-hidden strokeWidth={2} />
        </IconButton>
        <IconButton
          aria-label={`删除 ${phrase.name}`}
          data-nav-item
          tabIndex={-1}
          onClick={stop(onRequestDelete)}
        >
          <Trash2 size={12} aria-hidden strokeWidth={2} />
        </IconButton>
      </ActionCluster>
    </div>
  );
}
