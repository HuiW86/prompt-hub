import { create } from "zustand";

// Window visibility is owned by the Tauri shell; this store only mirrors it so
// React can react (focus search input, dim background, etc.). Window control
// commands land in B4 — for now `setVisible` is the single source of truth in
// the renderer process.
// ADR-031: the panorama is where a wake lands. "prompts" is the organize
// workspace (the original dashboard), "websites" the site library.
export type Workspace = "panorama" | "prompts" | "websites";

interface AppState {
  isVisible: boolean;
  workspace: Workspace;
  setWorkspace: (workspace: Workspace) => void;
  activePhaseId: string | null;
  // Monotonic ping: bumped when the 待审 badge is clicked so ScenePanel jumps to
  // the 📥 草稿 tab. A counter (not a boolean) so repeated clicks re-fire even if
  // the panel is already showing the inbox (03-product-spec §13.3 区域 8).
  draftsViewRequestId: number;
  setVisible: (visible: boolean) => void;
  setActivePhase: (phaseId: string | null) => void;
  requestDraftsView: () => void;
}

export const useAppStore = create<AppState>()((set) => ({
  isVisible: true,
  workspace: "panorama",
  setWorkspace: (workspace) => set({ workspace }),
  activePhaseId: null,
  draftsViewRequestId: 0,
  setVisible: (isVisible) => set({ isVisible }),
  setActivePhase: (activePhaseId) => set({ activePhaseId }),
  requestDraftsView: () =>
    set((s) => ({ draftsViewRequestId: s.draftsViewRequestId + 1 })),
}));
