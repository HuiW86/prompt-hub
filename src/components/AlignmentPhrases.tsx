import {
  Fragment,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useRef,
  useState,
} from "react";
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

// Anchor key for the create form. Phrase ids are uuids, so a reserved literal
// cannot collide with one.
const GHOST_ADD_ANCHOR = "__ghost_add__";

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
  const showWithAction = useToastStore((s) => s.showWithAction);
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
  // A discarded creation draft, restored by the undo toast (ADR-025 子决策 2).
  // Edits need no equivalent — the original row is still in the DB.
  const [restoredDraft, setRestoredDraft] = useState<{
    name: string;
    content: string;
  } | null>(null);

  // ADR-025 子决策 1: the editor now floats above its trigger instead of
  // replacing it, so the chip has to stay mounted and hand over its element.
  // Anchors are keyed by phrase id; the ghost-add button anchors the create
  // form. Re-render alone must not lose them, hence a ref map rather than state
  // — but the panel needs a render to position against a freshly mounted
  // anchor, so registering one bumps a tick.
  const anchorsRef = useRef(new Map<string, HTMLElement>());
  const [, setAnchorTick] = useState(0);
  // Ref callbacks are memoised per key. An inline `el => register(id, el)` would
  // be a fresh function every render, and React detaches then re-attaches a ref
  // whose identity changed — with a setState inside, that is an update loop.
  const anchorCbsRef = useRef(
    new Map<string, (el: HTMLElement | null) => void>(),
  );
  const anchorRef = useCallback((key: string) => {
    let cb = anchorCbsRef.current.get(key);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if ((anchorsRef.current.get(key) ?? null) === el) return;
        if (el) anchorsRef.current.set(key, el);
        else anchorsRef.current.delete(key);
        // The panel can only measure an anchor that is already in the DOM, so
        // a newly registered one has to trigger one more render to be seen.
        setAnchorTick((n) => n + 1);
      };
      anchorCbsRef.current.set(key, cb);
    }
    return cb;
  }, []);
  const anchorFor = (key: string) => anchorsRef.current.get(key) ?? null;

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
    // Confirm the save with the same feedback strength as delete (A1-07).
    showToast("已新增对齐话术");
    setRestoredDraft(null);
    setAdding(false);
  };

  // Escape on a dirty create form throws away text that exists nowhere else,
  // so the toast carries the only route back to it (ADR-025 子决策 2).
  const handleDiscardDraft = (draft: { name: string; content: string }) => {
    showWithAction("已放弃草稿", {
      label: "撤销",
      onClick: () => {
        setRestoredDraft(draft);
        setAdding(true);
      },
    });
  };

  const handleUpdate = async (id: string, name: string, content: string) => {
    await updateAlignmentPhrase({ id, name, content });
    showToast("已保存对齐话术");
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
        phrases.map((p, idx) => (
          // The chip stays mounted while editing — it is the anchor, and the
          // row must not collapse a slot out from under the floating panel.
          <Fragment key={p.id}>
            {editingId === p.id && (
              <PhraseFormEditor
                layer="protocol"
                anchor={anchorFor(p.id)}
                ariaLabel="编辑对齐话术"
                initialName={p.name}
                initialContent={p.content}
                submitLabel="保存"
                onSubmit={({ name, content }) =>
                  handleUpdate(p.id, name, content)
                }
                onClose={() => setEditingId(null)}
              />
            )}
            <PhraseChip
              phrase={p}
              anchorRef={anchorRef(p.id)}
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
          </Fragment>
        ))
      )}

      {/* Ghost add entry (ADR-021): the create editor anchors to this button,
          which stays put so the row's trailing slot never jumps. */}
      {activePhaseId != null && (
        <>
          {adding && (
            <PhraseFormEditor
              layer="protocol"
              anchor={anchorFor(GHOST_ADD_ANCHOR)}
              ariaLabel="新增对齐话术"
              initialName={restoredDraft?.name}
              initialContent={restoredDraft?.content}
              submitLabel="新增"
              onSubmit={({ name, content }) => handleCreate(name, content)}
              onClose={() => {
                setRestoredDraft(null);
                setAdding(false);
              }}
              onDiscard={handleDiscardDraft}
            />
          )}
          <button
            type="button"
            ref={anchorRef(GHOST_ADD_ANCHOR)}
            className={styles.ghostAdd}
            aria-label="新增对齐话术"
            data-nav-item
            tabIndex={-1}
            onClick={() => setAdding(true)}
          >
            <Plus size={12} aria-hidden strokeWidth={2} />
            <span>新增</span>
          </button>
        </>
      )}
    </section>
  );
}

interface PhraseChipProps {
  phrase: AlignmentPhrase;
  /** Hands the chip element up so the anchored editor can pin to it. */
  anchorRef: (el: HTMLElement | null) => void;
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
  anchorRef,
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
      <span ref={anchorRef} className={styles.confirmSlot}>
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
      ref={anchorRef}
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
