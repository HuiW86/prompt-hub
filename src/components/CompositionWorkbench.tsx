import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import type { Composition, Modifier } from "../ipc/types";

import {
  ActionCluster,
  Button,
  ConfirmInline,
  EditorActions,
  EditorPanel,
  EmptyState,
  IconButton,
  Input,
  ListRowSurface,
  RegionHeader,
} from "./primitives";
import styles from "./CompositionWorkbench.module.css";

type EditTarget =
  | { mode: "create" }
  | { mode: "edit"; composition: Composition }
  | null;

export function CompositionWorkbench() {
  const activePhaseId = useAppStore((s) => s.activePhaseId);
  const compositionsByPhase = usePromptStore((s) => s.compositionsByPhase);
  const reorderCompositions = usePromptStore((s) => s.reorderCompositions);
  const deleteComposition = usePromptStore((s) => s.deleteComposition);
  const showToast = useToastStore((s) => s.show);

  const compositions = useMemo(
    () =>
      activePhaseId != null ? (compositionsByPhase[activePhaseId] ?? []) : [],
    [activePhaseId, compositionsByPhase],
  );

  // Drag-local copy: the store stays authoritative until the drop persists.
  const [items, setItems] = useState<Composition[]>(compositions);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => setItems(compositions), [compositions]);
  // Switching phase mid-edit would mutate a list the user no longer sees.
  useEffect(() => {
    setEditing(null);
    setConfirmingId(null);
  }, [activePhaseId]);

  const handleDelete = async (id: string) => {
    setConfirmingId(null);
    try {
      await deleteComposition(id);
      showToast("已永久删除");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <section
      className={styles.region}
      aria-label="Composition 工作台"
      data-region="composition-workbench"
      tabIndex={0}
    >
      <RegionHeader
        title="Composition"
        count={`${compositions.length} 件`}
        right={
          <Button
            layer="task"
            aria-label="新增 Composition"
            disabled={activePhaseId == null}
            onClick={() => setEditing({ mode: "create" })}
          >
            <Plus size={14} aria-hidden strokeWidth={2} />
            <span>新增</span>
          </Button>
        }
      />

      {editing && activePhaseId != null && (
        <CompositionEditor
          target={editing}
          phaseId={activePhaseId}
          onClose={() => setEditing(null)}
          onError={(msg) => showToast(msg)}
        />
      )}

      {activePhaseId == null ? (
        <EmptyState>未选相位</EmptyState>
      ) : items.length === 0 ? (
        <EmptyState>暂无 Composition · 把常用材料组合拼成成品</EmptyState>
      ) : (
        <DragDropProvider
          onDragOver={(event) => setItems((prev) => move(prev, event))}
          onDragEnd={(event) => {
            if (event.canceled) {
              setItems(compositions);
              return;
            }
            const orderedIds = items.map((c) => c.id);
            void reorderCompositions(activePhaseId, orderedIds).catch((err) => {
              showToast(err instanceof Error ? err.message : "排序保存失败");
            });
          }}
        >
          <div className={styles.list}>
            {items.map((c, idx) => (
              <SortableCompositionRow
                key={c.id}
                composition={c}
                index={idx}
                isConfirming={confirmingId === c.id}
                onEdit={() => setEditing({ mode: "edit", composition: c })}
                onRequestDelete={() => setConfirmingId(c.id)}
                onCancelDelete={() => setConfirmingId(null)}
                onConfirmDelete={() => void handleDelete(c.id)}
              />
            ))}
          </div>
        </DragDropProvider>
      )}
    </section>
  );
}

interface RowProps {
  composition: Composition;
  index: number;
  isConfirming: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function SortableCompositionRow({
  composition,
  index,
  isConfirming,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: RowProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: composition.id,
    index,
  });

  return (
    <ListRowSurface
      layer="task"
      ref={ref}
      dragging={isDragging}
      className={styles.row}
      data-composition-id={composition.id}
    >
      <IconButton
        ref={handleRef}
        plain
        dragHandle
        aria-label={`拖动排序 ${composition.name}`}
      >
        <GripVertical size={14} aria-hidden strokeWidth={2} />
      </IconButton>
      <span className={styles.rowName}>{composition.name}</span>
      <span className={styles.rowCount}>
        {composition.modifierIds.length} 材料
      </span>

      {isConfirming ? (
        <ConfirmInline
          className={styles.rowActions}
          text="永久删除？"
          confirmLabel="确认永久删除"
          cancelLabel="取消删除"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      ) : (
        <ActionCluster className={styles.rowActions} reveal>
          <IconButton aria-label={`编辑 ${composition.name}`} onClick={onEdit}>
            <Pencil size={13} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton
            aria-label={`删除 ${composition.name}`}
            onClick={onRequestDelete}
          >
            <Trash2 size={13} aria-hidden strokeWidth={2} />
          </IconButton>
        </ActionCluster>
      )}
    </ListRowSurface>
  );
}

interface EditorProps {
  target: Exclude<EditTarget, null>;
  phaseId: string;
  onClose: () => void;
  onError: (msg: string) => void;
}

function CompositionEditor({ target, phaseId, onClose, onError }: EditorProps) {
  const allModifiers = usePromptStore((s) => s.modifiers);
  const createComposition = usePromptStore((s) => s.createComposition);
  const updateComposition = usePromptStore((s) => s.updateComposition);
  const existing = target.mode === "edit" ? target.composition : null;

  const [name, setName] = useState(existing?.name ?? "");
  // The body is an ordered modifierIds list (decision D-b): selection order IS
  // the assembly order, so we keep it as an explicit array, not a Set.
  const [selectedIds, setSelectedIds] = useState<string[]>(
    existing?.modifierIds ?? [],
  );
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const modifierById = useMemo(
    () => new Map(allModifiers.map((m) => [m.id, m] as const)),
    [allModifiers],
  );
  const pool = useMemo(
    () => allModifiers.filter((m) => !selectedIds.includes(m.id)),
    [allModifiers, selectedIds],
  );

  const add = (id: string) => setSelectedIds((prev) => [...prev, id]);
  const remove = (id: string) =>
    setSelectedIds((prev) => prev.filter((x) => x !== id));
  const swap = (i: number, j: number) =>
    setSelectedIds((prev) => {
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const canSave = name.trim().length > 0 && selectedIds.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (target.mode === "edit") {
        await updateComposition({
          id: target.composition.id,
          name: name.trim(),
          modifierIds: selectedIds,
        });
      } else {
        await createComposition({
          phaseId,
          name: name.trim(),
          modifierIds: selectedIds,
        });
      }
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : "保存失败");
      setSaving(false);
    }
  };

  return (
    <EditorPanel
      layer="task"
      className={styles.editor}
      role="group"
      aria-label={existing ? "编辑 Composition" : "新增 Composition"}
    >
      <Input
        ref={nameRef}
        placeholder="名称"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter") {
            e.preventDefault();
            void handleSave();
          }
        }}
      />

      <div className={styles.pickerGroup} aria-label="已选材料（按拼接顺序）">
        <span className={styles.pickerLabel}>已选 · 拼接顺序</span>
        {selectedIds.length === 0 ? (
          <p className={styles.pickerEmpty}>从下方材料库挑选</p>
        ) : (
          <ol className={styles.selected}>
            {selectedIds.map((id, i) => {
              const m = modifierById.get(id);
              return (
                <li key={id} className={styles.selectedChip}>
                  <span className={styles.selectedName}>
                    {m?.name ?? "(已删除)"}
                  </span>
                  <button
                    type="button"
                    className={styles.chipBtn}
                    aria-label="上移"
                    disabled={i === 0}
                    onClick={() => swap(i, i - 1)}
                  >
                    <ArrowUp size={12} aria-hidden strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className={styles.chipBtn}
                    aria-label="下移"
                    disabled={i === selectedIds.length - 1}
                    onClick={() => swap(i, i + 1)}
                  >
                    <ArrowDown size={12} aria-hidden strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className={styles.chipBtn}
                    aria-label={`移除 ${m?.name ?? "材料"}`}
                    onClick={() => remove(id)}
                  >
                    <X size={12} aria-hidden strokeWidth={2} />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className={styles.pickerGroup} aria-label="可选材料库">
        <span className={styles.pickerLabel}>材料库</span>
        {pool.length === 0 ? (
          <p className={styles.pickerEmpty}>
            {allModifiers.length === 0 ? "暂无 Modifier" : "已全部选入"}
          </p>
        ) : (
          <div className={styles.pool}>
            {pool.map((m: Modifier) => (
              <button
                key={m.id}
                type="button"
                className={styles.poolChip}
                aria-label={`加入 ${m.name}`}
                onClick={() => add(m.id)}
              >
                <Plus size={12} aria-hidden strokeWidth={2} />
                {m.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <EditorActions>
        <Button intent="subtle" onClick={onClose}>
          取消
        </Button>
        <Button
          layer="task"
          intent="primary"
          onClick={() => void handleSave()}
          disabled={!canSave}
        >
          {existing ? "保存" : "新增"}
        </Button>
      </EditorActions>
    </EditorPanel>
  );
}
