import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { Flame, GripVertical, Pencil, Plus, Trash2, Zap } from "lucide-react";

import { useAnchorRegistry } from "../hooks/useAnchorRegistry";
import { useCopy } from "../hooks/useCopy";
import { useRegionNav } from "../hooks/useRegionNav";
import { usePromptStore } from "../stores/promptStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";
import { toUserMessage } from "../utils/errorMessage";
import type { Macro } from "../ipc/types";

import {
  ActionCluster,
  Button,
  CardSurface,
  ConfirmInline,
  EmptyState,
  IconButton,
  PhraseFormEditor,
  type PhraseFormValues,
  RegionHeader,
} from "./primitives";
import styles from "./MacroGrid.module.css";

const HOT_TOP_N = 4;

// Anchor keys for the two create entry points. Both are on screen at once while
// the grid is empty, so they cannot share a key — the panel would then pin to
// whichever registered last rather than to the button the user pressed. Macro
// ids are uuids, so reserved literals cannot collide with an edit target's key.
const CREATE_ANCHOR_HEADER = "__create_header__";
const CREATE_ANCHOR_EMPTY = "__create_empty__";

// `anchorKey` rides the create target because the editor pins to its TRIGGER
// (ADR-025 子决策 1) and a create has no row of its own to pin to.
type EditTarget =
  | { mode: "create"; anchorKey: string }
  | { mode: "edit"; macro: Macro }
  | null;

export function MacroGrid() {
  const macros = usePromptStore((s) => s.macros);
  const reorderMacros = usePromptStore((s) => s.reorderMacros);
  const deleteMacro = usePromptStore((s) => s.deleteMacro);
  const createMacro = usePromptStore((s) => s.createMacro);
  const updateMacro = usePromptStore((s) => s.updateMacro);
  const showToast = useToastStore((s) => s.show);
  const showError = useToastStore((s) => s.showError);
  const showWithAction = useToastStore((s) => s.showWithAction);
  const onRegionKeyDown = useRegionNav();
  // Trigger elements the anchored editor pins to: each card by macro id, plus
  // the two create buttons (ADR-025 子决策 1).
  const anchors = useAnchorRegistry();

  // Local render source during a drag (learnings 信条五: a single local array is
  // the source of truth while dragging; the store stays untouched until the drop
  // persists). Re-syncs whenever the store list changes (refresh / promote / edit).
  const [items, setItems] = useState<Macro[]>(macros);
  useEffect(() => setItems(macros), [macros]);

  const [editing, setEditing] = useState<EditTarget>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // A discarded creation draft, restored by the undo toast (ADR-025 子决策 2).
  // Edits need no equivalent — the original row is still in the DB.
  const [restoredDraft, setRestoredDraft] = useState<PhraseFormValues | null>(
    null,
  );

  // Cockpit (invoke) mode sorts tiles by heat — the grab-and-go moment wants
  // the hottest entries in the first row (哲学四: usage data drives placement).
  // Organize mode keeps the user-controlled order_index so drag-reorder stays
  // meaningful (reshape v2 dual-layout).
  const interactionMode = useSettingsStore((s) => s.interactionMode);
  const displayItems = useMemo(
    () =>
      interactionMode === "invoke"
        ? [...items].sort((a, b) => b.usageCount - a.usageCount)
        : items,
    [items, interactionMode],
  );

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
      showError(toUserMessage(err, "删除失败"));
    }
  };

  const closeEditor = () => {
    setRestoredDraft(null);
    setEditing(null);
  };

  // Reports its own failure and re-throws: since ADR-025 子决策 2 an outside
  // click also saves, so the write lands after the user has looked away — an
  // unreported rejection is pixel-for-pixel a successful save. Re-throwing lets
  // the shared editor re-enable its button and hold the draft.
  const handleSave = async ({ name, content }: PhraseFormValues) => {
    if (!editing) return;
    try {
      if (editing.mode === "edit") {
        await updateMacro({ id: editing.macro.id, name, content });
      } else {
        await createMacro({ name, content });
      }
    } catch (err) {
      showError(toUserMessage(err, "保存失败"));
      throw err;
    }
    // Same feedback strength as the delete path (A1-07).
    showToast(editing.mode === "edit" ? "已保存 Macro" : "已新增 Macro");
    closeEditor();
  };

  // Abandoning a dirty create form (Esc or 取消) throws away text that exists
  // nowhere else, so the toast carries the only route back to it (ADR-025
  // 子决策 2 的规则表 last row).
  const handleDiscardDraft = (draft: PhraseFormValues) => {
    const anchorKey =
      editing?.mode === "create" ? editing.anchorKey : CREATE_ANCHOR_HEADER;
    showWithAction("已放弃草稿", {
      label: "撤销",
      onClick: () => {
        setRestoredDraft(draft);
        setEditing({ mode: "create", anchorKey });
      },
    });
  };

  return (
    <section
      className={styles.region}
      aria-label="Macro 快捷区"
      data-region="macro-grid"
      tabIndex={0}
      onKeyDown={onRegionKeyDown}
    >
      <RegionHeader
        title="Macro"
        subtitle="高频一键入口"
        count={`${macros.length} 张`}
        right={
          <Button
            layer="task"
            ref={anchors.ref(CREATE_ANCHOR_HEADER)}
            aria-label="新增 Macro"
            data-nav-item
            tabIndex={-1}
            onClick={() =>
              setEditing({ mode: "create", anchorKey: CREATE_ANCHOR_HEADER })
            }
          >
            <Plus size={14} aria-hidden strokeWidth={2} />
            <span>新增</span>
          </Button>
        }
      />

      {/* The trigger stays mounted underneath — it is the anchor, and the grid
          must not collapse a slot out from under the floating panel. */}
      {editing && (
        <PhraseFormEditor
          layer="task"
          presentation="anchored"
          anchor={anchors.get(
            editing.mode === "edit" ? editing.macro.id : editing.anchorKey,
          )}
          mode={editing.mode}
          ariaLabel={editing.mode === "edit" ? "编辑 Macro" : "新增 Macro"}
          initialName={
            editing.mode === "edit" ? editing.macro.name : restoredDraft?.name
          }
          initialContent={
            editing.mode === "edit"
              ? editing.macro.content
              : restoredDraft?.content
          }
          contentPlaceholder="内容"
          submitLabel={editing.mode === "edit" ? "保存" : "新增"}
          onSubmit={handleSave}
          onClose={closeEditor}
          onDiscard={editing.mode === "create" ? handleDiscardDraft : undefined}
        />
      )}

      {macros.length === 0 ? (
        /* Rich empty state (Promptscape empty Macro: dashed strip + in-place
           create wired to the same editor the header 新增 button opens). The
           illustration glyph follows the design draft's zapBig. */
        <EmptyState
          framed
          row
          icon={<Zap size={16} aria-hidden strokeWidth={2} />}
          title="还没有 Macro"
          action={
            <Button
              layer="task"
              ref={anchors.ref(CREATE_ANCHOR_EMPTY)}
              aria-label="新建 Macro"
              onClick={() =>
                setEditing({ mode: "create", anchorKey: CREATE_ANCHOR_EMPTY })
              }
            >
              <Plus size={14} aria-hidden strokeWidth={2} />
              <span>新建 Macro</span>
            </Button>
          }
        >
          把高频 Composition 固化成一键入口，常用动作一步直达
        </EmptyState>
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
              showError(toUserMessage(err, "排序保存失败"));
            });
          }}
        >
          <div className={styles.grid}>
            {displayItems.map((m, idx) => (
              <SortableMacroCard
                key={m.id}
                macro={m}
                anchorRef={anchors.ref(m.id)}
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
  /** Hands the card element up so its anchored editor can pin to it. */
  anchorRef: (el: HTMLElement | null) => void;
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
  anchorRef,
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

  // One element has to serve both the sortable and the anchor registry. Both
  // callbacks are reached through a ref so the composed one keeps a STABLE
  // identity: React detaches and re-attaches a ref whose identity changed, and
  // the registry bumps a render whenever an element is (de)registered — a
  // per-render identity would make those two chase each other forever.
  const nodeCbs = useRef({ ref, anchorRef });
  nodeCbs.current = { ref, anchorRef };
  const setCardNode = useCallback((el: HTMLDivElement | null) => {
    nodeCbs.current.ref(el);
    nodeCbs.current.anchorRef(el);
  }, []);

  return (
    <CardSurface
      layer="task"
      ref={setCardNode}
      className={styles.macroCard}
      flash={flashId === macro.id}
      dragging={isDragging}
      data-macro-id={macro.id}
    >
      <button
        type="button"
        className={styles.copyArea}
        aria-label={macro.name}
        title={macro.content}
        data-nav-item
        tabIndex={-1}
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
        {/* Filled accent box on every card (Promptscape); the Flame glyph is
            the design-spec §12.4 macro icon, rendered solid on hot macros so
            the usage signal survives the all-filled boxes (P3-5). */}
        <span className={styles.iconChip} aria-hidden>
          <Flame
            size={14}
            strokeWidth={2}
            fill={isHot ? "currentColor" : "none"}
          />
        </span>
        <span className={styles.name}>{macro.name}</span>
        <span className={styles.uses}>{macro.usageCount} 次</span>
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
            data-nav-item
            tabIndex={-1}
            aria-label={`拖动排序 ${macro.name}`}
          >
            <GripVertical size={14} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton
            data-nav-item
            tabIndex={-1}
            aria-label={`编辑 ${macro.name}`}
            onClick={onEdit}
          >
            <Pencil size={13} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton
            data-nav-item
            tabIndex={-1}
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
