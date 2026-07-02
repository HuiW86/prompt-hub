import type { ReactNode } from "react";

import { cx } from "./cx";
import { Kbd } from "./Kbd";
import styles from "./primitives.module.css";

interface EmptyStateProps {
  /** Description / body copy (legacy single-slot usage stays valid). */
  children: ReactNode;
  /** Glyph rendered inside a muted bordered box (rich empty state, P3-5). */
  icon?: ReactNode;
  /** Headline above the description. */
  title?: ReactNode;
  /** CTA slot — callers wire an EXISTING create entry, never a new one. */
  action?: ReactNode;
  /** Dashed placeholder-card frame (Promptscape empty cards). */
  framed?: boolean;
  /** Horizontal compact strip layout (Promptscape empty Macro). */
  row?: boolean;
  hint?: string;
  hotkey?: string;
}

export function EmptyState({
  children,
  icon,
  title,
  action,
  framed,
  row,
  hint,
  hotkey,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        styles.empty,
        framed && styles.emptyFramed,
        row && styles.emptyRow,
      )}
    >
      {icon && (
        <span className={styles.emptyIcon} aria-hidden>
          {icon}
        </span>
      )}
      <div className={styles.emptyBody}>
        {title && <div className={styles.emptyTitle}>{title}</div>}
        <div>{children}</div>
        {(hint || hotkey) && (
          <span className={styles.emptyHint}>
            {hint && <span>{hint}</span>}
            {hotkey && <Kbd>{hotkey}</Kbd>}
          </span>
        )}
      </div>
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}
