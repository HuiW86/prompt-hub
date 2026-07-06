import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { GripVertical, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { useCopy } from "../hooks/useCopy";
import { useRegionNav } from "../hooks/useRegionNav";
import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { toUserMessage } from "../utils/errorMessage";
import type { AlignmentPhrase } from "../ipc/types";

import {
  ActionCluster,
  Button,
  Chip,
  ConfirmInline,
  EditorActions,
  EditorInput,
  EditorPanel,
  IconButton,
  Input,
} from "./primitives";
import styles from "./AlignmentPhrases.module.css";

type EditTarget =
  | { mode: "create" }
  | { mode: "edit"; phrase: AlignmentPhrase }
  | null;

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
  const copy = useCopy();
  const flashId = useToastStore((s) => s.flashTargetId);
  const showToast = useToastStore((s) => s.show);
  const showError = useToastStore((s) => s.showError);
  const onRegionKeyDown = useRegionNav();

  const phrases = useMemo(
    () => (activePhaseId != null ? (phrasesByPhase[activePhaseId] ?? []) : []),
    [activePhaseId, phrasesByPhase],
  );

  const [editMode, setEditMode] = useState(false);
  // Local render source during a drag (mirrors MacroGrid): the store stays the
  // source of truth until the drop persists, then re-syncs on the store change.
  const [items, setItems] = useState<AlignmentPhrase[]>(phrases);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => setItems(phrases), [phrases]);
  // Leaving a phase mid-edit would mutate a list the user can no longer see —
  // reset edit state whenever the active phase changes.
  useEffect(() => {
    setEditMode(false);
    setEditing(null);
    setConfirmingId(null);
  }, [activePhaseId]);

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

  if (!editMode) {
    return (
      <section
        className={styles.phrases}
        aria-label="对齐话术"
        data-region="alignment-phrases"
        tabIndex={0}
        onKeyDown={onRegionKeyDown}
      >
        <span className={styles.label}>aligned</span>
        {phrases.length === 0 ? (
          <span className={styles.empty}>
            {activePhaseId == null ? "未选相位" : "暂无对齐话术"}
          </span>
        ) : (
          phrases.map((p) => (
            <Chip
              key={p.id}
              layer="protocol"
              active={p.isDefault}
              dim={!p.isDefault}
              flash={flashId === p.id}
              aria-label={p.name}
              data-nav-item
              tabIndex={-1}
              onClick={() =>
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
            >
              <span
                className={p.isDefault ? styles.dot : styles.dotDim}
                aria-hidden
              />
              {p.name}
            </Chip>
          ))
        )}
        {activePhaseId != null && (
          <IconButton
            className={styles.manageBtn}
            aria-label="管理对齐话术"
            data-nav-item
            tabIndex={-1}
            onClick={() => setEditMode(true)}
          >
            <Pencil size={12} aria-hidden strokeWidth={2} />
          </IconButton>
        )}
      </section>
    );
  }

  return (
    <section
      className={styles.editRegion}
      aria-label="对齐话术 · 编辑"
      data-region="alignment-phrases"
    >
      <div className={styles.editHeader}>
        <span className={styles.label}>aligned · 编辑</span>
        <div className={styles.editHeaderActions}>
          <Button
            layer="protocol"
            aria-label="新增对齐话术"
            onClick={() => setEditing({ mode: "create" })}
          >
            <Plus size={14} aria-hidden strokeWidth={2} />
            <span>新增</span>
          </Button>
          <Button
            onClick={() => {
              setEditMode(false);
              setEditing(null);
            }}
          >
            完成
          </Button>
        </div>
      </div>

      {editing && activePhaseId != null && (
        <PhraseEditor
          target={editing}
          phaseId={activePhaseId}
          onClose={() => setEditing(null)}
          onError={showError}
        />
      )}

      {items.length === 0 ? (
        <span className={styles.empty}>暂无对齐话术 · 点「新增」添加</span>
      ) : (
        <DragDropProvider
          onDragOver={(event) => setItems((prev) => move(prev, event))}
          onDragEnd={(event) => {
            if (event.canceled) {
              setItems(phrases);
              return;
            }
            if (activePhaseId == null) return;
            const orderedIds = items.map((p) => p.id);
            void reorderAlignmentPhrases(activePhaseId, orderedIds).catch(
              (err) => {
                showError(toUserMessage(err, "排序保存失败"));
              },
            );
          }}
        >
          <ul className={styles.list}>
            {items.map((p, idx) => (
              <SortablePhraseRow
                key={p.id}
                phrase={p}
                index={idx}
                isConfirming={confirmingId === p.id}
                onSetDefault={() => void handleSetDefault(p.id)}
                onEdit={() => setEditing({ mode: "edit", phrase: p })}
                onRequestDelete={() => setConfirmingId(p.id)}
                onCancelDelete={() => setConfirmingId(null)}
                onConfirmDelete={() => void handleDelete(p.id)}
              />
            ))}
          </ul>
        </DragDropProvider>
      )}
    </section>
  );
}

interface RowProps {
  phrase: AlignmentPhrase;
  index: number;
  isConfirming: boolean;
  onSetDefault: () => void;
  onEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function SortablePhraseRow({
  phrase,
  index,
  isConfirming,
  onSetDefault,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: RowProps) {
  const { ref, handleRef, isDragging } = useSortable({ id: phrase.id, index });

  const classes = [styles.row, isDragging ? styles.dragging : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <li ref={ref} className={classes} data-phrase-id={phrase.id}>
      <IconButton
        ref={handleRef}
        plain
        dragHandle
        aria-label={`拖动排序 ${phrase.name}`}
      >
        <GripVertical size={14} aria-hidden strokeWidth={2} />
      </IconButton>
      <span className={styles.rowDot} aria-hidden />
      <span className={styles.rowName}>{phrase.name}</span>
      {phrase.isDefault && <span className={styles.rowBadge}>默认</span>}

      {isConfirming ? (
        <ConfirmInline
          text="永久删除？"
          confirmLabel="确认永久删除"
          cancelLabel="取消删除"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      ) : (
        <ActionCluster>
          {/* P3-6: only non-defaults offer the swap — the current default is
              already marked by the 默认 badge. */}
          {!phrase.isDefault && (
            <IconButton
              aria-label={`设为默认 ${phrase.name}`}
              onClick={onSetDefault}
            >
              <Star size={13} aria-hidden strokeWidth={2} />
            </IconButton>
          )}
          <IconButton aria-label={`编辑 ${phrase.name}`} onClick={onEdit}>
            <Pencil size={13} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton
            aria-label={`删除 ${phrase.name}`}
            onClick={onRequestDelete}
          >
            <Trash2 size={13} aria-hidden strokeWidth={2} />
          </IconButton>
        </ActionCluster>
      )}
    </li>
  );
}

interface EditorProps {
  target: Exclude<EditTarget, null>;
  phaseId: string;
  onClose: () => void;
  onError: (msg: string) => void;
}

function PhraseEditor({ target, phaseId, onClose, onError }: EditorProps) {
  const createAlignmentPhrase = usePromptStore((s) => s.createAlignmentPhrase);
  const updateAlignmentPhrase = usePromptStore((s) => s.updateAlignmentPhrase);
  const existing = target.mode === "edit" ? target.phrase : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSave = name.trim().length > 0 && content.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      if (existing) {
        await updateAlignmentPhrase({
          id: existing.id,
          name: name.trim(),
          content: content.trim(),
        });
      } else {
        await createAlignmentPhrase({
          phaseId,
          name: name.trim(),
          content: content.trim(),
        });
      }
      onClose();
    } catch (err) {
      onError(toUserMessage(err, "保存失败"));
      setSaving(false);
    }
  };

  return (
    <EditorPanel
      layer="protocol"
      role="group"
      aria-label={existing ? "编辑对齐话术" : "新增对齐话术"}
    >
      <Input
        ref={nameRef}
        placeholder="名称"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter") {
            // IME guard: committing a pinyin/kana candidate fires Enter while
            // isComposing is still true — swallowing it would eat the
            // composition instead of saving.
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            void handleSave();
          }
        }}
      />
      <EditorInput
        placeholder="话术内容"
        value={content}
        rows={3}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            // IME guard: skip the commit-Enter of an in-flight composition.
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            void handleSave();
          }
        }}
      />
      <EditorActions>
        <Button intent="subtle" onClick={onClose}>
          取消
        </Button>
        <Button
          layer="protocol"
          intent="primary"
          onClick={() => void handleSave()}
          disabled={!canSave || saving}
        >
          {existing ? "保存" : "新增"}
        </Button>
      </EditorActions>
    </EditorPanel>
  );
}
