import { create } from "zustand";
import { persist } from "zustand/middleware";

import { ipc } from "../ipc";

export type ThemeMode = "light" | "dark" | "system";
export type Accent = "neutral" | "blue" | "green" | "violet" | "amber";
// Density tier. 舒适 (comfortable): the default — keeps the reshape-v2
// acceptance baseline untouched. 紧凑 (compact): tightens structural tokens
// (anchor heights + region padding, tokens.css §3c) so a SMALL DISPLAY carries
// more assets per screen — the window is always the full monitor height, so
// there is no fixed baseline window to reason about; the constraint is the
// smallest screen in use. Full rationale in tokens.css §3c. Type sizes never
// change with density.
export type Density = "comfortable" | "compact";
// D-0 interaction mode. 调用态 (invoke): the default — whole-card click copies
// and the window hides after (T0 zero-regression). 整理态 (organize): whole-card
// click on a Scene phrase previews instead of copying, copy is an explicit
// action, and every copy/write keeps the window (suppressHide). Persisted so a
// user who lives in organize mode does not re-toggle every summon.
export type InteractionMode = "invoke" | "organize";

// Where a preference lives (ADR-027 sub-decision 1). The rule is mechanical —
// it asks WHEN the value is read, not how important it is:
//
//   localStorage  only the renderer needs it → theme, accent, density,
//                 interaction mode, layout splits
//   SQLite        Rust needs it BEFORE the webview mounts → globalHotkey, which
//                 is registered inside setup() where localStorage is
//                 unreachable
//
// Nothing else qualifies today. Adding a key to SQLite that the renderer could
// have owned splits the settings story for no gain.
//
// Appearance prefs persist to localStorage only (never SQLite, never uploaded —
// constitution A2). Theme + accent ride root classes consumed by tokens.css:
// `.light`/`.dark` flip the palette (system = neither, the @media guard decides),
// `.accent-*` swaps the NEUTRAL accent token (B2: never the protocol/task layers).
const ACCENTS: Accent[] = ["neutral", "blue", "green", "violet", "amber"];

function applyAppearance(
  themeMode: ThemeMode,
  accent: Accent,
  density: Density,
) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark", "system");
  // Dark is the identity default (ADR-024): bare root = dark. `.light` forces
  // light; `.system` re-enables the OS-preference media query in tokens.css.
  if (themeMode === "light") root.classList.add("light");
  else if (themeMode === "dark") root.classList.add("dark");
  else root.classList.add("system");
  for (const a of ACCENTS) root.classList.toggle(`accent-${a}`, a === accent);
  // Bare root = comfortable; `.compact` swaps in the §3c structure tokens.
  root.classList.toggle("compact", density === "compact");
}

interface SettingsState {
  // Mirror of the chord registered in Rust. Hydrated by loadGlobalHotkey at
  // App mount; never written directly — setGlobalHotkey goes through IPC and
  // only adopts the value the backend confirms is live, so the UI cannot show
  // a chord that does not actually wake the window.
  globalHotkey: string;
  hiddenPhaseIds: string[];
  themeMode: ThemeMode;
  accent: Accent;
  density: Density;
  interactionMode: InteractionMode;
  settingsOpen: boolean;
  loadGlobalHotkey: () => Promise<void>;
  setGlobalHotkey: (combo: string) => Promise<void>;
  togglePhaseVisibility: (phaseId: string) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setAccent: (accent: Accent) => void;
  setDensity: (density: Density) => void;
  setInteractionMode: (mode: InteractionMode) => void;
  toggleInteractionMode: () => void;
  openSettings: () => void;
  closeSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Matches the value seeded by migration 0012 so the settings row reads
      // correctly for the one frame before loadGlobalHotkey resolves.
      globalHotkey: "Alt+Space",
      hiddenPhaseIds: [],
      // Reshape v2: DARK is the cockpit identity — the summoned overlay
      // separates from whatever the desktop looks like (哲学三). Light stays a
      // user-selectable mode ("system" also resolves dark: tokens.css no
      // longer auto-follows the OS preference).
      themeMode: "dark",
      accent: "neutral",
      // Comfortable keeps the reshape-v2 baseline; compact is an explicit pick.
      density: "comfortable",
      // Default 调用态 so the tool opens as a launcher (D-0 / T0 zero-regression).
      interactionMode: "invoke",
      settingsOpen: false,
      // Hydrate from the live registration. A failure (dev/web shell with no
      // bridge) leaves the shipped default in place rather than blanking the
      // field — the settings row stays readable, it just isn't authoritative.
      loadGlobalHotkey: async () => {
        try {
          set({ globalHotkey: await ipc.getGlobalHotkey() });
        } catch {
          // Keep the current value.
        }
      },
      // Adopt only what the backend confirms. Errors propagate so the settings
      // UI can show why a chord was refused (already taken / no modifier);
      // swallowing them here would let the field display a chord that does
      // nothing.
      setGlobalHotkey: async (combo) => {
        const live = await ipc.setGlobalHotkey(combo);
        set({ globalHotkey: live });
      },
      togglePhaseVisibility: (phaseId) =>
        set((state) => ({
          hiddenPhaseIds: state.hiddenPhaseIds.includes(phaseId)
            ? state.hiddenPhaseIds.filter((id) => id !== phaseId)
            : [...state.hiddenPhaseIds, phaseId],
        })),
      setThemeMode: (themeMode) => {
        set({ themeMode });
        applyAppearance(themeMode, get().accent, get().density);
      },
      setAccent: (accent) => {
        set({ accent });
        applyAppearance(get().themeMode, accent, get().density);
      },
      setDensity: (density) => {
        set({ density });
        applyAppearance(get().themeMode, get().accent, density);
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
      // v2 identity migration: v1 defaulted themeMode to "light", so every
      // existing install carries a persisted "light" that was never an explicit
      // user pick. Bumping to v2 resets the theme to the dark identity ONCE;
      // choosing light in settings afterwards persists normally.
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as {
          themeMode: ThemeMode;
          accent: Accent;
          interactionMode: InteractionMode;
        };
        if (version < 2) return { ...state, themeMode: "dark" as ThemeMode };
        return state;
      },
      // globalHotkey is deliberately absent: it is durable, but SQLite owns it
      // (ADR-027) and a localStorage copy would be a second source of truth
      // that goes stale the moment a rebind fails. hiddenPhaseIds stays
      // in-memory MVP state; appearance prefs + the interaction mode are
      // durable here. settingsOpen is transient UI.
      partialize: (s) => ({
        themeMode: s.themeMode,
        accent: s.accent,
        density: s.density,
        interactionMode: s.interactionMode,
      }),
      // Persisted v2 states written before the density tier lack the key; the
      // persist default merge fills it from the initial state ("comfortable"),
      // so no version bump is needed.
      onRehydrateStorage: () => (state) => {
        if (state)
          applyAppearance(state.themeMode, state.accent, state.density);
      },
    },
  ),
);
