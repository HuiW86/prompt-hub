import { create } from "zustand";

export type ToastIntent = "success" | "error";

interface ToastState {
  message: string | null;
  intent: ToastIntent;
  flashTargetId: string | null;
  // Monotonic generation token. Each show() bumps it so stale visibility
  // timers can detect they have been superseded. clear() also bumps it to
  // invalidate any pending timer that would otherwise wipe a fresh toast.
  seq: number;
  show: (message: string, flashTargetId?: string, intent?: ToastIntent) => void;
  // Convenience action for failure feedback: error intent (4000ms dwell +
  // role=alert), no flash target. Keeps error call sites from threading the
  // unused flashTargetId slot everywhere.
  showError: (message: string) => void;
  clear: () => void;
}

// Success is a quick flash; errors need enough dwell time to be read and
// acted on (e.g. clipboard write failed — the user must retry manually).
const VISIBLE_MS: Record<ToastIntent, number> = {
  success: 800,
  error: 4000,
};

export const useToastStore = create<ToastState>()((set, get) => ({
  message: null,
  intent: "success",
  flashTargetId: null,
  seq: 0,
  show: (message, flashTargetId, intent = "success") => {
    const my = get().seq + 1;
    set({ message, intent, flashTargetId: flashTargetId ?? null, seq: my });
    setTimeout(() => {
      if (get().seq === my) {
        set({ message: null, intent: "success", flashTargetId: null });
      }
    }, VISIBLE_MS[intent]);
  },
  showError: (message) => get().show(message, undefined, "error"),
  clear: () =>
    set((s) => ({
      message: null,
      intent: "success",
      flashTargetId: null,
      seq: s.seq + 1,
    })),
}));
