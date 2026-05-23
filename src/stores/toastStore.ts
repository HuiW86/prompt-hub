import { create } from "zustand";

interface ToastState {
  message: string | null;
  flashTargetId: string | null;
  show: (message: string, flashTargetId?: string) => void;
  clear: () => void;
}

const VISIBLE_MS = 800;

export const useToastStore = create<ToastState>()((set, get) => ({
  message: null,
  flashTargetId: null,
  show: (message, flashTargetId) => {
    set({ message, flashTargetId: flashTargetId ?? null });
    const token = message;
    setTimeout(() => {
      // Only clear if we still hold the same message (no newer toast supersedes).
      if (get().message === token) {
        set({ message: null, flashTargetId: null });
      }
    }, VISIBLE_MS);
  },
  clear: () => set({ message: null, flashTargetId: null }),
}));
