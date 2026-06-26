import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type Accent = "neutral" | "blue" | "green" | "violet" | "amber";

// Appearance prefs persist to localStorage only (never SQLite, never uploaded —
// constitution A2). Theme + accent ride root classes consumed by tokens.css:
// `.light`/`.dark` flip the palette (system = neither, the @media guard decides),
// `.accent-*` swaps the NEUTRAL accent token (B2: never the protocol/task layers).
const ACCENTS: Accent[] = ["neutral", "blue", "green", "violet", "amber"];

function applyAppearance(themeMode: ThemeMode, accent: Accent) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (themeMode === "light") root.classList.add("light");
  else if (themeMode === "dark") root.classList.add("dark");
  for (const a of ACCENTS) root.classList.toggle(`accent-${a}`, a === accent);
}

interface SettingsState {
  globalHotkey: string;
  hiddenPhaseIds: string[];
  themeMode: ThemeMode;
  accent: Accent;
  settingsOpen: boolean;
  setGlobalHotkey: (combo: string) => void;
  togglePhaseVisibility: (phaseId: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAccent: (accent: Accent) => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      globalHotkey: "Alt+Space",
      hiddenPhaseIds: [],
      // Default light to match the Promptscape design (ADR-018 补遗): the
      // light palette is the reference look; dark stays a user-selectable mode.
      themeMode: "light",
      accent: "neutral",
      settingsOpen: false,
      setGlobalHotkey: (globalHotkey) => set({ globalHotkey }),
      togglePhaseVisibility: (phaseId) =>
        set((state) => ({
          hiddenPhaseIds: state.hiddenPhaseIds.includes(phaseId)
            ? state.hiddenPhaseIds.filter((id) => id !== phaseId)
            : [...state.hiddenPhaseIds, phaseId],
        })),
      setThemeMode: (themeMode) => {
        set({ themeMode });
        applyAppearance(themeMode, get().accent);
      },
      setAccent: (accent) => {
        set({ accent });
        applyAppearance(get().themeMode, accent);
      },
      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),
    }),
    {
      name: "prompt-hub-settings",
      // globalHotkey + hiddenPhaseIds stay in-memory MVP state; only the
      // appearance prefs are durable. settingsOpen is transient UI.
      partialize: (s) => ({ themeMode: s.themeMode, accent: s.accent }),
      onRehydrateStorage: () => (state) => {
        if (state) applyAppearance(state.themeMode, state.accent);
      },
    },
  ),
);
