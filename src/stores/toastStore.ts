import { create } from "zustand";

export type ToastIntent = "success" | "error";

// An optional single-shot undo affordance rendered as a button inside the toast
// (D-5: discard is reversible, and the toast is that reversal's only entry).
// The undo window IS the toast lifetime — an action toast dwells longer than a
// plain success flash so there is time to click. Clicking runs onClick and
// dismisses the toast; letting it time out is the "keep the discard" path.
export interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastState {
  message: string | null;
  intent: ToastIntent;
  flashTargetId: string | null;
  action: ToastAction | null;
  // Monotonic generation token. Each show() bumps it so stale visibility
  // timers can detect they have been superseded. clear() also bumps it to
  // invalidate any pending timer that would otherwise wipe a fresh toast.
  seq: number;
  show: (message: string, flashTargetId?: string, intent?: ToastIntent) => void;
  // Convenience action for failure feedback: error intent (4000ms dwell +
  // role=alert), no flash target. Keeps error call sites from threading the
  // unused flashTargetId slot everywhere.
  showError: (message: string) => void;
  // Success toast carrying an undo button (D-5 discard 撤销). Runs the toast's
  // action-length dwell so the user can click 撤销 before it clears.
  showWithAction: (message: string, action: ToastAction) => void;
  clear: () => void;
}

// Success is a quick flash; errors need enough dwell time to be read and acted
// on (e.g. clipboard write failed — the user must retry manually). An undo
// affordance needs the longest window so 撤销 stays clickable (D-5 撤销窗口 =
// toast 生命周期).
const VISIBLE_MS = {
  success: 800,
  error: 4000,
  action: 6000,
} as const;

export const useToastStore = create<ToastState>()((set, get) => {
  // Shared arm: set the toast payload, take a seq ticket, and schedule the
  // dwell clear. `dwell` is keyed off the presence of an action rather than the
  // intent alone so an undo toast lives long enough to be clicked.
  function arm(
    message: string,
    flashTargetId: string | null,
    intent: ToastIntent,
    action: ToastAction | null,
  ) {
    // ADR-028: since deletes became one-click, this toast's 撤销 button is the
    // ONLY route back from a delete — so a live action toast outranks any toast
    // that carries no action of its own. Without this guard the `set` below
    // silently destroyed a pending undo mid-window.
    //
    // The superseded toast is DROPPED, not queued. Queuing was rejected because
    // the payload includes flashTargetId, which flashes a specific card:
    // replaying it up to 6s late points the user at an action they already
    // finished, and stale feedback is worse than none. What a drop costs is a
    // confirmation of something already visible on screen; what it buys is that
    // an undo can never be lost.
    //
    // ERRORS ARE THE EXCEPTION and still take the surface. An unseen error tells
    // the user an operation succeeded when it failed, which is a correctness bug,
    // not a missing convenience. Losing the undo to one is survivable in a way
    // the reverse is not: the delete is durable in the trash either way, and
    // ADR-028 P1 surfaces it, so this button is a shortcut to a recoverable state
    // rather than the last line of defence.
    //
    // Explicit dismissal still works: clear() does not route through arm().
    //
    // A NEW action toast may replace a live one — one pending undo at a time is
    // the intended model (same as the ADR-022 MoveReceipt undo).
    if (action === null && intent !== "error" && get().action !== null) return;
    const my = get().seq + 1;
    set({ message, intent, flashTargetId, action, seq: my });
    const dwell = action ? VISIBLE_MS.action : VISIBLE_MS[intent];
    setTimeout(() => {
      if (get().seq === my) {
        set({
          message: null,
          intent: "success",
          flashTargetId: null,
          action: null,
        });
      }
    }, dwell);
  }

  return {
    message: null,
    intent: "success",
    flashTargetId: null,
    action: null,
    seq: 0,
    show: (message, flashTargetId, intent = "success") =>
      arm(message, flashTargetId ?? null, intent, null),
    showError: (message) => arm(message, null, "error", null),
    showWithAction: (message, action) => arm(message, null, "success", action),
    clear: () =>
      set((s) => ({
        message: null,
        intent: "success",
        flashTargetId: null,
        action: null,
        seq: s.seq + 1,
      })),
  };
});
