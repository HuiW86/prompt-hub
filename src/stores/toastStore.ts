import { create } from "zustand";

interface ToastState {
  message: string | null;
  flashTargetId: string | null;
  // Monotonic generation token. Each show() bumps it so stale 800ms timers
  // can detect they have been superseded. clear() also bumps it to invalidate
  // any pending timer that would otherwise wipe a fresh toast.
  seq: number;
  show: (message: string, flashTargetId?: string) => void;
  clear: () => void;
}

const VISIBLE_MS = 800;

export const useToastStore = create<ToastState>()((set, get) => ({
  message: null,
  flashTargetId: null,
  seq: 0,
  show: (message, flashTargetId) => {
    const my = get().seq + 1;
    set({ message, flashTargetId: flashTargetId ?? null, seq: my });
    setTimeout(() => {
      if (get().seq === my) {
        set({ message: null, flashTargetId: null });
      }
    }, VISIBLE_MS);
  },
  clear: () =>
    set((s) => ({ message: null, flashTargetId: null, seq: s.seq + 1 })),
}));
