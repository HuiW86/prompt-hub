import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";
export type Accent = "neutral" | "blue" | "green" | "violet" | "amber";
// D-0 interaction mode. 调用态 (invoke): the default — whole-card click copies
// and the window hides after (T0 zero-regression). 整理态 (organize): whole-card
// click on a Scene phrase previews instead of copying, copy is an explicit
// action, and every copy/write keeps the window (suppressHide). Persisted so a
// user who lives in organize mode does not re-toggle every summon.
export type InteractionMode = "invoke" | "organize";

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
  interactionMode: InteractionMode;
  settingsOpen: boolean;
  setGlobalHotkey: (combo: string) => void;
  togglePhaseVisibility: (phaseId: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAccent: (accent: Accent) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  toggleInteractionMode: () => void;
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
      // Default 调用态 so the tool opens as a launcher (D-0 / T0 zero-regression).
      interactionMode: "invoke",
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
      setInteractionMode: (interactionMode) => set({ interactionMode }),
      toggleInteractionMode: () =>
        set((s) => ({
          interactionMode:
            s.interactionMode === "invoke" ? "organize" : "invoke",
        })),
      openSettings: () => set({ settingsOpen: true }),
      closeSettings: () => set({ settingsOpen: false }),
    }),
    {
      name: "prompt-hub-settings",
      // globalHotkey + hiddenPhaseIds stay in-memory MVP state; appearance prefs
      // + the interaction mode are durable. settingsOpen is transient UI.
      partialize: (s) => ({
        themeMode: s.themeMode,
        accent: s.accent,
        interactionMode: s.interactionMode,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) applyAppearance(state.themeMode, state.accent);
      },
    },
  ),
);
