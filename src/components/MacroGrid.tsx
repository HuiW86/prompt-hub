import { useEffect, useMemo, useRef, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { Flame, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import { useCopy } from "../hooks/useCopy";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import type { Macro } from "../ipc/types";
import { relativeTime } from "../utils/time";

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
import styles from "./MacroGrid.module.css";

const HOT_TOP_N = 4;

type EditTarget = { mode: "create" } | { mode: "edit"; macro: Macro } | null;

export function MacroGrid() {
  const macros = usePromptStore((s) => s.macros);
  const reorderMacros = usePromptStore((s) => s.reorderMacros);
  const deleteMacro = usePromptStore((s) => s.deleteMacro);
  const showToast = useToastStore((s) => s.show);

  // Local render source during a drag (learnings 信条五: a single local array is
  // the source of truth while dragging; the store stays untouched until the drop
  // persists). Re-syncs whenever the store list changes (refresh / promote / edit).
  const [items, setItems] = useState<Macro[]>(macros);
  useEffect(() => setItems(macros), [macros]);

  const [editing, setEditing] = useState<EditTarget>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // "Hot" is a usage signal, not a position — compute the top-N by usageCount so
  // the flame survives the switch to user-controlled order (order_index ASC).
  const hotIds = useMemo(() => {
    return new Set(
      [...macros]
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, HOT_TOP_N)
        .filter((m) => m.usageCount > 0)
        .map((m) => m.id),
    );
  }, [macros]);

  const handleDelete = async (id: string) => {
    setConfirmingId(null);
    try {
      await deleteMacro(id);
      showToast("已永久删除");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <section
      className={styles.region}
      aria-label="Macro 快捷区"
      data-region="macro-grid"
      tabIndex={0}
    >
      <RegionHeader
        title="Macro"
        count={`${macros.length} 张`}
        right={
          <Button
            layer="task"
            aria-label="新增 Macro"
            onClick={() => setEditing({ mode: "create" })}
          >
            <Plus size={14} aria-hidden strokeWidth={2} />
            <span>新增</span>
          </Button>
        }
      />

      {editing && (
        <MacroEditor
          target={editing}
          onClose={() => setEditing(null)}
          onError={(msg) => showToast(msg)}
        />
      )}

      {macros.length === 0 ? (
        <EmptyState>暂无 Macro · 把高频组合保存下来吧</EmptyState>
      ) : (
        <DragDropProvider
          onDragOver={(event) => setItems((prev) => move(prev, event))}
          onDragEnd={(event) => {
            // Canceled (ESC or dropped outside): discard the local reorder and
            // snap back to the store's authoritative order.
            if (event.canceled) {
              setItems(macros);
              return;
            }
            const orderedIds = items.map((m) => m.id);
            void reorderMacros(orderedIds).catch((err) => {
              showToast(err instanceof Error ? err.message : "排序保存失败");
            });
          }}
        >
          <div className={styles.grid}>
            {items.map((m, idx) => (
              <SortableMacroCard
                key={m.id}
                macro={m}
                index={idx}
                isHot={hotIds.has(m.id)}
                isConfirming={confirmingId === m.id}
                onEdit={() => setEditing({ mode: "edit", macro: m })}
                onRequestDelete={() => setConfirmingId(m.id)}
                onCancelDelete={() => setConfirmingId(null)}
                onConfirmDelete={() => void handleDelete(m.id)}
              />
            ))}
          </div>
        </DragDropProvider>
      )}
    </section>
  );
}

interface CardProps {
  macro: Macro;
  index: number;
  isHot: boolean;
  isConfirming: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function SortableMacroCard({
  macro,
  index,
  isHot,
  isConfirming,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: CardProps) {
  const { ref, handleRef, isDragging } = useSortable({ id: macro.id, index });
  const copy = useCopy();
  const flashId = useToastStore((s) => s.flashTargetId);

  return (
    <CardSurface
      layer="task"
      ref={ref}
      flash={flashId === macro.id}
      dragging={isDragging}
      data-macro-id={macro.id}
    >
      <button
        type="button"
        className={styles.copyArea}
        aria-label={macro.name}
        onClick={() =>
          void copy(
            macro.content,
            {
              targetType: "macro",
              targetId: macro.id,
              source: "macro_area",
              modifierIds: null,
              sopId: null,
              sopStepOrder: null,
              phaseId: null,
            },
            macro.id,
          )
        }
      >
        <h3 className={styles.title}>
          {isHot && (
            <Flame
              size={12}
              className={styles.hotIc}
              aria-hidden
              strokeWidth={2}
            />
          )}
          <span>{macro.name}</span>
        </h3>
        <p className={styles.body}>{macro.content}</p>
        <div className={styles.meta}>
          <span>{macro.usageCount} 次</span>
          <span className={styles.sep}>·</span>
          <span>{relativeTime(macro.lastUsedAt)}</span>
        </div>
      </button>

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
            aria-label={`拖动排序 ${macro.name}`}
          >
            <GripVertical size={14} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton aria-label={`编辑 ${macro.name}`} onClick={onEdit}>
            <Pencil size={13} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton
            aria-label={`删除 ${macro.name}`}
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
  onClose: () => void;
  onError: (msg: string) => void;
}

function MacroEditor({ target, onClose, onError }: EditorProps) {
  const createMacro = usePromptStore((s) => s.createMacro);
  const updateMacro = usePromptStore((s) => s.updateMacro);
  const existing = target.mode === "edit" ? target.macro : null;

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
        await updateMacro({
          id: existing.id,
          name: name.trim(),
          content: content.trim(),
        });
      } else {
        await createMacro({ name: name.trim(), content: content.trim() });
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
      aria-label={existing ? "编辑 Macro" : "新增 Macro"}
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
          layer="task"
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
