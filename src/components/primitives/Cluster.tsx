import type { ComponentPropsWithRef } from "react";
import { Check, X } from "lucide-react";

import { IconButton } from "./Button";
import { cx } from "./cx";
import styles from "./primitives.module.css";

interface ActionClusterProps extends ComponentPropsWithRef<"div"> {
  reveal?: boolean;
}

export function ActionCluster({
  reveal,
  className,
  ...rest
}: ActionClusterProps) {
  return (
    <div
      className={cx(
        styles.actionCluster,
        reveal && styles.actionClusterReveal,
        className,
      )}
      {...rest}
    />
  );
}

// ADR-028 子决策 3 removed all six of this primitive's original call sites:
// delete became reversible, so「撤销优于确认」(ADR-025 `:125`) retired the confirm
// step everywhere it applied.
//
// TWO consumers remain, and the rule admitting them is the same one that
// evicted the other six — a confirmation is for actions that are genuinely
// irreversible, and only for those:
//   1. 清空废纸篓 (TrashSection, ADR-028 P1);
//   2. deleting a coordinate axis value (AxisValueManager, ADR-029) —
//      `alignment_axis_values` has no `deleted_at` and no trash (06-prd
//      §6.6-bis), so the delete is a hard one.
// A third consumer needs the same test: if the action can be undone, it gets a
// toast with 撤销 instead.
interface ConfirmInlineProps {
  text?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  className?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmInline({
  text,
  confirmLabel = "确认",
  cancelLabel = "取消",
  className,
  onConfirm,
  onCancel,
}: ConfirmInlineProps) {
  return (
    <div
      className={cx(styles.confirmInline, className)}
      role="alertdialog"
      aria-label={text ?? confirmLabel}
    >
      {text && <span className={styles.confirmText}>{text}</span>}
      <IconButton onClick={onConfirm} aria-label={confirmLabel}>
        <Check size={14} />
      </IconButton>
      <IconButton onClick={onCancel} aria-label={cancelLabel}>
        <X size={14} />
      </IconButton>
    </div>
  );
}
