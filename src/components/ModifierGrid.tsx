import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { GROUP_KINDS } from "../ipc/types";
import type { GroupKind, Modifier } from "../ipc/types";

import {
  ActionCluster,
  Button,
  CardSurface,
  ConfirmInline,
  EditorActions,
  EditorInput,
  EditorPanel,
  EmptyState,
  IconButton,
  Input,
  RegionHeader,
} from "./primitives";
import styles from "./ModifierGrid.module.css";

// Mirrors DraftInbox's promote popover labels — keep the two in sync.
const GROUP_KIND_LABELS: Record<GroupKind, string> = {
  cognition: "认知",
  action: "行动",
  delivery: "交付",
  constraint: "约束",
};

type EditTarget =
  | { mode: "create"; groupKind: GroupKind }
  | { mode: "edit"; modifier: Modifier }
  | null;

export function ModifierGrid() {
  const modifiers = usePromptStore((s) => s.modifiers);
  const deleteModifier = usePromptStore((s) => s.deleteModifier);
  const showToast = useToastStore((s) => s.show);

  const [editing, setEditing] = useState<EditTarget>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Group into the four quadrants up front. order_index restarts per quadrant,
  // so each group is rendered and reordered in isolation — the flat store order
  // is never read directly (which is what keeps reorderModifiers' append-to-tail
  // write harmless).
  const byQuadrant = useMemo(() => {
    const acc: Record<GroupKind, Modifier[]> = {
      cognition: [],
      action: [],
      delivery: [],
      constraint: [],
    };
    for (const m of modifiers) acc[m.groupKind].push(m);
    return acc;
  }, [modifiers]);

  const handleDelete = async (id: string) => {
    setConfirmingId(null);
    try {
      await deleteModifier(id);
      showToast("已永久删除");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <section
      className={styles.region}
      aria-label="Modifier 材料库"
      data-region="modifier-grid"
      tabIndex={0}
    >
      <RegionHeader title="Modifier" count={`${modifiers.length} 张`} />

      {editing && (
        <ModifierEditor
          target={editing}
          label={
            GROUP_KIND_LABELS[
              editing.mode === "create"
                ? editing.groupKind
                : editing.modifier.groupKind
            ]
          }
          onClose={() => setEditing(null)}
          onError={(msg) => showToast(msg)}
        />
      )}

      {modifiers.length === 0 ? (
        <EmptyState>暂无 Modifier · 沉淀方法论原子材料</EmptyState>
      ) : (
        <div className={styles.quadrants}>
          {GROUP_KINDS.map((gk) => (
            <ModifierQuadrant
              key={gk}
              groupKind={gk}
              label={GROUP_KIND_LABELS[gk]}
              modifiers={byQuadrant[gk]}
              confirmingId={confirmingId}
              onAdd={() => setEditing({ mode: "create", groupKind: gk })}
              onEdit={(m) => setEditing({ mode: "edit", modifier: m })}
              onRequestDelete={(id) => setConfirmingId(id)}
              onCancelDelete={() => setConfirmingId(null)}
              onConfirmDelete={(id) => void handleDelete(id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface QuadrantProps {
  groupKind: GroupKind;
  label: string;
  modifiers: Modifier[];
  confirmingId: string | null;
  onAdd: () => void;
  onEdit: (m: Modifier) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}

function ModifierQuadrant({
  groupKind,
  label,
  modifiers,
  confirmingId,
  onAdd,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: QuadrantProps) {
  const reorderModifiers = usePromptStore((s) => s.reorderModifiers);
  const showToast = useToastStore((s) => s.show);

  // Each quadrant owns its own drag-local array and DragDropProvider, so a drag
  // can never cross a quadrant boundary (which would silently change groupKind).
  const [items, setItems] = useState<Modifier[]>(modifiers);
  useEffect(() => setItems(modifiers), [modifiers]);

  return (
    <div className={styles.quadrant}>
      <div className={styles.quadrantHeader}>
        <span className={styles.quadrantTitle}>{label}</span>
        <span className={styles.quadrantCount}>{modifiers.length}</span>
        <Button
          layer="protocol"
          className={styles.addBtn}
          aria-label={`新增${label} Modifier`}
          onClick={onAdd}
        >
          <Plus size={13} aria-hidden strokeWidth={2} />
          <span>新增</span>
        </Button>
      </div>

      {items.length === 0 ? (
        <p className={styles.quadrantEmpty}>暂无</p>
      ) : (
        <DragDropProvider
          onDragOver={(event) => setItems((prev) => move(prev, event))}
          onDragEnd={(event) => {
            if (event.canceled) {
              setItems(modifiers);
              return;
            }
            const orderedIds = items.map((m) => m.id);
            void reorderModifiers(groupKind, orderedIds).catch((err) => {
              showToast(err instanceof Error ? err.message : "排序保存失败");
            });
          }}
        >
          <div className={styles.cards}>
            {items.map((m, idx) => (
              <SortableModifierCard
                key={m.id}
                modifier={m}
                index={idx}
                isConfirming={confirmingId === m.id}
                onEdit={() => onEdit(m)}
                onRequestDelete={() => onRequestDelete(m.id)}
                onCancelDelete={onCancelDelete}
                onConfirmDelete={() => onConfirmDelete(m.id)}
              />
            ))}
          </div>
        </DragDropProvider>
      )}
    </div>
  );
}

interface CardProps {
  modifier: Modifier;
  index: number;
  isConfirming: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function SortableModifierCard({
  modifier,
  index,
  isConfirming,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: CardProps) {
  const { ref, handleRef, isDragging } = useSortable({
    id: modifier.id,
    index,
  });

  return (
    <CardSurface
      layer="protocol"
      ref={ref}
      dragging={isDragging}
      data-modifier-id={modifier.id}
    >
      <div className={styles.cardBody}>
        <h4 className={styles.title}>{modifier.name}</h4>
        <p className={styles.body}>{modifier.content}</p>
      </div>

      {isConfirming ? (
        <ConfirmInline
          className={styles.cardActions}
          text="永久删除？"
          confirmLabel="确认永久删除"
          cancelLabel="取消删除"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      ) : (
        <ActionCluster className={styles.cardActions} reveal>
          <IconButton
            ref={handleRef}
            dragHandle
            aria-label={`拖动排序 ${modifier.name}`}
          >
            <GripVertical size={14} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton aria-label={`编辑 ${modifier.name}`} onClick={onEdit}>
            <Pencil size={13} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton
            aria-label={`删除 ${modifier.name}`}
            onClick={onRequestDelete}
          >
            <Trash2 size={13} aria-hidden strokeWidth={2} />
          </IconButton>
        </ActionCluster>
      )}
    </CardSurface>
  );
}

interface EditorProps {
  target: Exclude<EditTarget, null>;
  label: string;
  onClose: () => void;
  onError: (msg: string) => void;
}

function ModifierEditor({ target, label, onClose, onError }: EditorProps) {
  const createModifier = usePromptStore((s) => s.createModifier);
  const updateModifier = usePromptStore((s) => s.updateModifier);
  const existing = target.mode === "edit" ? target.modifier : null;

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
      if (target.mode === "edit") {
        await updateModifier({
          id: target.modifier.id,
          name: name.trim(),
          content: content.trim(),
        });
      } else {
        // groupKind is fixed by the quadrant that opened the editor — there is
        // no cross-quadrant move (updateModifier can't change groupKind anyway).
        await createModifier({
          name: name.trim(),
          content: content.trim(),
          groupKind: target.groupKind,
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
      layer="protocol"
      className={styles.editor}
      role="group"
      aria-label={existing ? "编辑 Modifier" : "新增 Modifier"}
    >
      <span className={styles.editorQuadrant}>{label}</span>
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
      <EditorInput
        placeholder="内容"
        value={content}
        rows={3}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
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
