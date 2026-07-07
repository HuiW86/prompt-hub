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
  // Download progress in [0, 1] while status === "downloading", or null when the
  // total byte count is unknown (server sent no Content-Length). Transient.
  downloadProgress: number | null;
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
      downloadProgress: null,
      update: null,

      acceptOptIn: () => {
        set({ enabled: true, optInDecided: true });
        // The opt-in button is an explicit user gesture — treat the kicked-off
        // check as manual so a failure right after enabling is not silent.
        void get().check(true);
      },
      declineOptIn: () => set({ enabled: false, optInDecided: true }),
      reopenOptIn: () => set({ optInDecided: false }),
      dismiss: () => set({ status: "idle", downloadProgress: null }),

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
          if (manual) {
            // Manual trigger (设置页「检查更新」/ opt-in accept): surface the
            // failure — error status drives the banner + settings status line.
            set({ status: "error", error: String(e) });
            useToastStore.getState().showError("检查更新失败");
          } else {
            // Auto startup check: auto-check failures are intentionally
            // silent (console.warn only) — a persistent "更新失败" banner
            // pushing the whole dashboard down on every offline launch is
            // worse than a missed update; the user never asked for this
            // check at that moment. Manual checks surface errors via
            // status="error".
            console.warn("[updater] auto check failed:", e);
            set({ status: "idle", error: null });
          }
        }
      },

      downloadAndInstall: async () => {
        const update = get().update;
        if (!update) return;
        // Guard against a double click while a download is already running.
        if (get().status === "downloading") return;
        set({ status: "downloading", downloadProgress: null });
        // The plugin streams DownloadEvent: Started (optional contentLength) →
        // Progress (per-chunk byte length) → Finished. Accumulate chunks into a
        // ratio so the banner can show a bar; if contentLength is missing we
        // keep progress null and the UI falls back to an indeterminate label.
        let total = 0;
        let downloaded = 0;
        try {
          await update.downloadAndInstall((event) => {
            switch (event.event) {
              case "Started":
                total = event.data.contentLength ?? 0;
                downloaded = 0;
                set({ downloadProgress: total > 0 ? 0 : null });
                break;
              case "Progress":
                downloaded += event.data.chunkLength;
                if (total > 0) {
                  set({ downloadProgress: Math.min(downloaded / total, 1) });
                }
                break;
              case "Finished":
                set({ downloadProgress: total > 0 ? 1 : null });
                break;
            }
          });
          // Restart into the freshly installed version. relaunch() needs the
          // process plugin + process:default capability (plugins-workspace
          // #2273), both wired in Phase 1.
          await relaunch();
        } catch (e) {
          set({ status: "error", error: String(e), downloadProgress: null });
          useToastStore.getState().showError("更新安装失败");
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
