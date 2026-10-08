import type { ReactNode } from "react";

import { Kbd } from "./Kbd";
import styles from "./primitives.module.css";

interface RegionHeaderProps {
  title: string;
  count?: ReactNode;
  hint?: string;
  hotkey?: string;
  right?: ReactNode;
}

export function RegionHeader({
  title,
  count,
  hint,
  hotkey,
  right,
}: RegionHeaderProps) {
  return (
    <div className={styles.regionHeader}>
      <div className={styles.regionHeaderLeft}>
        <span className={styles.regionHeaderTitle}>{title}</span>
        {count != null && (
          <span className={styles.regionHeaderCount}>{count}</span>
        )}
      </div>
      <div className={styles.regionHeaderRight}>
        {right}
        {hint && <span className={styles.regionHeaderHint}>{hint}</span>}
        {hotkey && <Kbd>{hotkey}</Kbd>}
      </div>
    </div>
  );
}
