import { type KeyboardEvent as ReactKeyboardEvent, useState } from "react";
import { ArrowLeft, ArrowRight, Plus, Trash2, X } from "lucide-react";

import type { AlignmentAxisValueWithRefs, AxisKind } from "../../ipc/types";
import { usePromptStore } from "../../stores/promptStore";
import { useToastStore } from "../../stores/toastStore";
import { AXIS_LABELS } from "../../utils/alignmentCopyText";
import { toUserMessage } from "../../utils/errorMessage";
import { ConfirmInline, IconButton } from "../primitives";

import styles from "./alignment.module.css";

/**
 * The delete confirmation's exact wording (03-product-spec 区域 2-bis
 * 「确认文案就是代价本身」). Two rules it must never lose:
 *
 * - `refCount` is printed even when it is 0. Omitting the clause when nothing
 *   references the value would read as "the app did not bother to count".
 * - `trashedRefCount` is appended whenever it is above zero, because
 *   `ON DELETE SET NULL` has never heard of `deletedAt`: trashed phrases lose
 *   their coordinate too, and that is precisely the half of the blast radius
 *   the user cannot see from here.
 */
function axisValueDeleteConfirmText(value: AlignmentAxisValueWithRefs): string {
  const base = `删除『${value.name}』？${value.refCount} 条话术的『${AXIS_LABELS[value.axis]}』坐标将被清空，删除后无法恢复`;
  return value.trashedRefCount > 0
    ? `${base}。废纸篓里另有 ${value.trashedRefCount} 条`
    : base;
}

interface AxisValueManagerProps {
  axis: AxisKind;
  onClose: () => void;
}

/**
 * In-place editing for one axis's value list, hosted INSIDE the anchored phrase
 * editor (03-product-spec 区域 2-bis 「轴取值就地可配」). Deliberately not a
 * second modal: the editing container contract's outside-click save and the
 * Escape ladder both stop working once panels stack.
 *
 * Delete is the one action here that keeps a confirmation. Everything else in
 * the app went one-click + undo under ADR-028, but this table has no trash and
 * no `deletedAt` (06-prd §6.6-bis) — an irreversible action has to ask first,
 * which is the delete-semantics contract's own wording, not an exception to it.
 */
export function AxisValueManager({ axis, onClose }: AxisValueManagerProps) {
  const all = usePromptStore((s) => s.alignmentAxisValues);
  const createValue = usePromptStore((s) => s.createAlignmentAxisValue);
  const deleteValue = usePromptStore((s) => s.deleteAlignmentAxisValue);
  const reorderValues = usePromptStore((s) => s.reorderAlignmentAxisValues);
  const showError = useToastStore((s) => s.showError);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftHint, setDraftHint] = useState("");

  const values = all
    .filter((v) => v.axis === axis)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const label = AXIS_LABELS[axis];

  // The row being confirmed can vanish under us (another axis value deleted,
  // a refetch): a stale id simply matches nothing, so drop it rather than keep
  // a confirmation pointed at a row that is gone.
  if (confirmingId != null && !values.some((v) => v.id === confirmingId)) {
    setConfirmingId(null);
  }

  const handleAdd = async () => {
    const name = draftName.trim();
    if (name.length === 0) return;
    const hint = draftHint.trim();
    try {
      await createValue({
        axis,
        name,
        hint: hint.length > 0 ? hint : undefined,
      });
      setDraftName("");
      setDraftHint("");
    } catch (err) {
      showError(toUserMessage(err, "新增取值失败"));
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmingId(null);
    try {
      await deleteValue(id);
    } catch (err) {
      showError(toUserMessage(err, "删除取值失败"));
    }
  };

  // ←/→ adjacent swap — the same vocabulary the chip row uses, and for the same
  // reason drag was rejected there (ADR-021 子决策 1).
  const handleMove = async (id: string, dir: -1 | 1) => {
    const idx = values.findIndex((v) => v.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= values.length) return;
    const ids = values.map((v) => v.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    try {
      await reorderValues(axis, ids);
    } catch (err) {
      showError(toUserMessage(err, "排序保存失败"));
    }
  };

  const onDraftKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    // A MODIFIED Enter is never ours. ⌘Enter means "save the phrase" everywhere
    // in the app (A1-08), and that muscle memory does not pause because the
    // caret happens to be in this sub-panel — claiming it here would add an
    // axis value at the exact moment the user asked to commit the draft.
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    // Plain Enter IS ours, and stops here: the shared form's fields treat it as
    // "advance to the body", which would jump the caret out of this panel.
    e.stopPropagation();
    void handleAdd();
  };

  return (
    <div
      className={styles.manager}
      role="group"
      aria-label={`管理${label}取值`}
    >
      <div className={styles.managerHead}>
        <span className={styles.managerTitle}>{`${label}取值`}</span>
        <IconButton aria-label={`收起${label}取值管理`} onClick={onClose}>
          <X size={12} aria-hidden strokeWidth={2} />
        </IconButton>
      </div>

      {values.map((value, idx) =>
        confirmingId === value.id ? (
          <ConfirmInline
            key={value.id}
            className={styles.managerConfirm}
            text={axisValueDeleteConfirmText(value)}
            confirmLabel="确认删除"
            cancelLabel="取消"
            onConfirm={() => void handleDelete(value.id)}
            onCancel={() => setConfirmingId(null)}
          />
        ) : (
          <AxisValueRow
            key={value.id}
            value={value}
            canMoveLeft={idx > 0}
            canMoveRight={idx < values.length - 1}
            onMove={(dir) => void handleMove(value.id, dir)}
            onDelete={() => setConfirmingId(value.id)}
          />
        ),
      )}

      <div className={styles.managerRow}>
        <input
          className={styles.managerInput}
          aria-label={`新增${label}取值名称`}
          placeholder="名称"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={onDraftKeyDown}
        />
        <input
          className={styles.managerInput}
          aria-label={`新增${label}取值说明`}
          placeholder="说明（可选）"
          value={draftHint}
          onChange={(e) => setDraftHint(e.target.value)}
          onKeyDown={onDraftKeyDown}
        />
        <IconButton
          aria-label={`添加${label}取值`}
          disabled={draftName.trim().length === 0}
          onClick={() => void handleAdd()}
        >
          <Plus size={12} aria-hidden strokeWidth={2} />
        </IconButton>
      </div>
    </div>
  );
}

interface AxisValueRowProps {
  value: AlignmentAxisValueWithRefs;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}

// One editable row. Name and hint commit on blur (and on Enter, which blurs),
// never on every keystroke: each commit is an IPC round trip plus a full
// re-pull, and a per-keystroke write would also renumber nothing but burn the
// reference counts' freshness for no gain.
function AxisValueRow({
  value,
  canMoveLeft,
  canMoveRight,
  onMove,
  onDelete,
}: AxisValueRowProps) {
  const updateValue = usePromptStore((s) => s.updateAlignmentAxisValue);
  const showError = useToastStore((s) => s.showError);
  const [name, setName] = useState(value.name);
  const [hint, setHint] = useState(value.hint ?? "");

  const commit = async (nextName: string, nextHint: string) => {
    const trimmedName = nextName.trim();
    // An empty name is not a rename, it is a half-typed one. Put the stored
    // value back rather than write a nameless row that nothing could label.
    if (trimmedName.length === 0) {
      setName(value.name);
      setHint(value.hint ?? "");
      return;
    }
    const trimmedHint = nextHint.trim();
    if (trimmedName === value.name && trimmedHint === (value.hint ?? ""))
      return;
    try {
      // Both columns go on every write: the backend sets them unconditionally,
      // so sending only the name would blank the hint of a renamed value.
      await updateValue({
        id: value.id,
        name: trimmedName,
        hint: trimmedHint.length > 0 ? trimmedHint : undefined,
      });
    } catch (err) {
      setName(value.name);
      setHint(value.hint ?? "");
      showError(toUserMessage(err, "保存取值失败"));
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    // Same rule as the add row above: ⌘Enter belongs to the phrase editor, not
    // to this field. Only a plain Enter commits the row.
    if (e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    // Never let a plain Enter bubble to the phrase form, whose name field
    // treats it as "advance to the body".
    e.stopPropagation();
    e.currentTarget.blur();
  };

  return (
    <div className={styles.managerRow}>
      <input
        className={styles.managerInput}
        aria-label={`${value.name} 名称`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void commit(name, hint)}
        onKeyDown={onKeyDown}
      />
      <input
        className={styles.managerInput}
        aria-label={`${value.name} 说明`}
        placeholder="说明（可选）"
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        onBlur={() => void commit(name, hint)}
        onKeyDown={onKeyDown}
      />
      <IconButton
        aria-label={`前移 ${value.name}`}
        disabled={!canMoveLeft}
        onClick={() => onMove(-1)}
      >
        <ArrowLeft size={12} aria-hidden strokeWidth={2} />
      </IconButton>
      <IconButton
        aria-label={`后移 ${value.name}`}
        disabled={!canMoveRight}
        onClick={() => onMove(1)}
      >
        <ArrowRight size={12} aria-hidden strokeWidth={2} />
      </IconButton>
      <IconButton aria-label={`删除 ${value.name}`} onClick={onDelete}>
        <Trash2 size={12} aria-hidden strokeWidth={2} />
      </IconButton>
    </div>
  );
}
