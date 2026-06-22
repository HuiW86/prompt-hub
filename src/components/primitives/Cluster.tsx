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
