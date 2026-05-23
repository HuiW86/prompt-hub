import { create } from "zustand";

// Window visibility is owned by the Tauri shell; this store only mirrors it so
// React can react (focus search input, dim background, etc.). Window control
// commands land in B4 — for now `setVisible` is the single source of truth in
// the renderer process.
interface AppState {
  isVisible: boolean;
  activePhaseId: string | null;
  setVisible: (visible: boolean) => void;
  setActivePhase: (phaseId: string | null) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  isVisible: true,
  activePhaseId: null,
  setVisible: (isVisible) => set({ isVisible }),
  setActivePhase: (activePhaseId) => set({ activePhaseId }),
}));
