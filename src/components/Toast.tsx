import { useToastStore } from "../stores/toastStore";

import styles from "./Toast.module.css";

export function Toast() {
  const message = useToastStore((s) => s.message);
  const intent = useToastStore((s) => s.intent);
  const action = useToastStore((s) => s.action);
  const clear = useToastStore((s) => s.clear);
  if (!message) return null;
  const isError = intent === "error";
  return (
    <div
      className={isError ? `${styles.toast} ${styles.error}` : styles.toast}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      <span className={styles.message}>{message}</span>
      {action && (
        // The toast surface is pointer-events:none so it never blocks the
        // dashboard beneath; the undo button opts back in (CSS pointer-events
        // auto) so it stays clickable. Clicking runs the action then dismisses.
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            action.onClick();
            clear();
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
