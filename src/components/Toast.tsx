import { useToastStore } from "../stores/toastStore";

import styles from "./Toast.module.css";

export function Toast() {
  const message = useToastStore((s) => s.message);
  if (!message) return null;
  return (
    <div className={styles.toast} role="status" aria-live="polite">
      {message}
    </div>
  );
}
