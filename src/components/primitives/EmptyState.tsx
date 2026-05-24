import type { ReactNode } from "react";

import { Kbd } from "./Kbd";
import styles from "./primitives.module.css";

interface EmptyStateProps {
  children: ReactNode;
  hint?: string;
  hotkey?: string;
}

export function EmptyState({ children, hint, hotkey }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <div>{children}</div>
      {(hint || hotkey) && (
        <span className={styles.emptyHint}>
          {hint && <span>{hint}</span>}
          {hotkey && <Kbd>{hotkey}</Kbd>}
        </span>
      )}
    </div>
  );
}
