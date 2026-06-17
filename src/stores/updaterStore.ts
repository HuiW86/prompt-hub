import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import { useToastStore } from "./toastStore";

export type UpdaterStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "uptodate"
  | "error";

interface UpdaterState {
  // Persisted across launches (localStorage, never SQLite / never uploaded —
  // constitution A2). `enabled` is the total egress switch (ADR-017 §5.3):
  // false = zero outbound, no check ever runs. `optInDecided` records whether
  // the one-time first-launch opt-in prompt has been answered.
  enabled: boolean;
  optInDecided: boolean;

  status: UpdaterStatus;
  availableVersion: string | null;
  error: string | null;
  // Handle returned by check(); transient (carries methods, never persisted).
  update: Update | null;

  acceptOptIn: () => void;
  declineOptIn: () => void;
  reopenOptIn: () => void;
  dismiss: () => void;
  check: (manual?: boolean) => Promise<void>;
  downloadAndInstall: () => Promise<void>;
}

export const useUpdaterStore = create<UpdaterState>()(
  persist(
    (set, get) => ({
      enabled: false,
      optInDecided: false,
      status: "idle",
      availableVersion: null,
      error: null,
      update: null,

      acceptOptIn: () => {
        set({ enabled: true, optInDecided: true });
        void get().check();
      },
      declineOptIn: () => set({ enabled: false, optInDecided: true }),
      reopenOptIn: () => set({ optInDecided: false }),
      dismiss: () => set({ status: "idle" }),

      check: async (manual = false) => {
        // The total switch governs ALL egress (ADR-017 §5.3). When off, never
        // reach the network — not even on an explicit manual trigger.
        if (!get().enabled) return;
        if (get().status === "checking" || get().status === "downloading") {
          return;
        }
        set({ status: "checking", error: null });
        try {
          // Downgrades stay disabled: we never set allowDowngrades / a custom
          // version comparator, so the plugin rejects older versions (§5.6).
          const update = await check();
          if (update) {
            set({
              status: "available",
              availableVersion: update.version,
              update,
            });
          } else {
            set({ status: "uptodate", availableVersion: null, update: null });
            if (manual) useToastStore.getState().show("已是最新版本");
          }
        } catch (e) {
          set({ status: "error", error: String(e) });
          if (manual) useToastStore.getState().show("检查更新失败");
        }
      },

      downloadAndInstall: async () => {
        const update = get().update;
        if (!update) return;
        set({ status: "downloading" });
        try {
          await update.downloadAndInstall();
          // Restart into the freshly installed version. relaunch() needs the
          // process plugin + process:default capability (plugins-workspace
          // #2273), both wired in Phase 1.
          await relaunch();
        } catch (e) {
          set({ status: "error", error: String(e) });
          useToastStore.getState().show("更新安装失败");
        }
      },
    }),
    {
      name: "prompt-hub-updater",
      // Only the user's decision is durable; runtime status is recomputed each
      // launch. Keeps the Update handle (methods) out of localStorage.
      partialize: (s) => ({ enabled: s.enabled, optInDecided: s.optInDecided }),
    },
  ),
);
