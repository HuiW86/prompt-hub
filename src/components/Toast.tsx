import { useEffect, useState } from "react";

import { type ToastAction, useToastStore } from "../stores/toastStore";

import styles from "./Toast.module.css";

interface Shown {
  message: string;
  isError: boolean;
  action: ToastAction | null;
  seq: number;
}

// Exit length mirrors --d-fast. Only a fallback: the exit normally ends on
// animationend; this covers environments that never fire it (reduced-motion
// engines that skip the event, jsdom, a backgrounded window).
const EXIT_FALLBACK_MS = 160;

export function Toast() {
  const message = useToastStore((s) => s.message);
  const intent = useToastStore((s) => s.intent);
  const action = useToastStore((s) => s.action);
  const seq = useToastStore((s) => s.seq);
  const clear = useToastStore((s) => s.clear);

  // The store drops the payload the moment the dwell ends; the toast keeps
  // the last one on screen for its short exit so it leaves instead of
  // vanishing. While leaving it takes no input (pointer-events: none on the
  // whole surface, undo button included), so the exit never costs a click.
  const [shown, setShown] = useState<Shown | null>(null);
  const [leaving, setLeaving] = useState(false);

  if (message && (shown?.seq !== seq || leaving)) {
    setShown({ message, isError: intent === "error", action, seq });
    setLeaving(false);
  } else if (!message && shown && !leaving) {
    setLeaving(true);
  }

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => {
      setShown(null);
      setLeaving(false);
    }, EXIT_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [leaving]);

  if (!shown) return null;
  const { isError } = shown;
  return (
    <div
      className={[
        styles.toast,
        isError ? styles.error : "",
        leaving ? styles.leaving : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-hidden={leaving || undefined}
      // Inert while leaving: an expired undo must not fire from the keyboard
      // either (pointer-events alone only stops the mouse).
      inert={leaving || undefined}
      onAnimationEnd={(e) => {
        if (leaving && e.target === e.currentTarget) {
          setShown(null);
          setLeaving(false);
        }
      }}
    >
      {/* Keyed by seq: a new toast arriving while one is up keeps the surface
          (no second pop) and only cross-fades its text, so rapid repeats
          read as "updated", not as a flicker. */}
      <span key={shown.seq} className={styles.message}>
        {shown.message}
      </span>
      {shown.action && (
        // The toast surface is pointer-events:none so it never blocks the
        // dashboard beneath; the undo button opts back in (CSS pointer-events
        // auto) so it stays clickable. Clicking runs the action then dismisses.
        <button
          type="button"
          className={styles.action}
          disabled={leaving}
          onClick={() => {
            shown.action?.onClick();
            clear();
          }}
        >
          {shown.action.label}
        </button>
      )}
    </div>
  );
}
