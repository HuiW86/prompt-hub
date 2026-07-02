import { useToastStore } from "../stores/toastStore";

import styles from "./Toast.module.css";

export function Toast() {
  const message = useToastStore((s) => s.message);
  const intent = useToastStore((s) => s.intent);
  if (!message) return null;
  const isError = intent === "error";
  return (
    <div
      className={isError ? `${styles.toast} ${styles.error}` : styles.toast}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      {message}
    </div>
  );
}
