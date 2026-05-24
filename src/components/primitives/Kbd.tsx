import type { ReactNode } from "react";

import styles from "./primitives.module.css";

interface KbdProps {
  children: ReactNode;
  sm?: boolean;
}

export function Kbd({ children, sm }: KbdProps) {
  return (
    <kbd className={sm ? `${styles.kbd} ${styles.kbdSm}` : styles.kbd}>
      {children}
    </kbd>
  );
}
