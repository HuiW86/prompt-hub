import { beforeEach, describe, expect, it } from "vitest";

import { useSettingsStore } from "../settingsStore";

const initial = useSettingsStore.getState();

describe("settingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState(initial, true);
  });

  it("defaults globalHotkey to Alt+Space", () => {
    expect(useSettingsStore.getState().globalHotkey).toBe("Alt+Space");
  });

  it("setGlobalHotkey updates the binding", () => {
    useSettingsStore.getState().setGlobalHotkey("Ctrl+Shift+P");
    expect(useSettingsStore.getState().globalHotkey).toBe("Ctrl+Shift+P");
  });

  it("togglePhaseVisibility flips inclusion in hiddenPhaseIds", () => {
    const { togglePhaseVisibility } = useSettingsStore.getState();
    togglePhaseVisibility("phase-diverge");
    expect(useSettingsStore.getState().hiddenPhaseIds).toEqual([
      "phase-diverge",
    ]);
    togglePhaseVisibility("phase-diverge");
    expect(useSettingsStore.getState().hiddenPhaseIds).toEqual([]);
  });

  it("defaults interactionMode to invoke (D-0)", () => {
    expect(useSettingsStore.getState().interactionMode).toBe("invoke");
  });

  it("setInteractionMode / toggleInteractionMode switch the mode", () => {
    const { setInteractionMode, toggleInteractionMode } =
      useSettingsStore.getState();
    setInteractionMode("organize");
    expect(useSettingsStore.getState().interactionMode).toBe("organize");
    toggleInteractionMode();
    expect(useSettingsStore.getState().interactionMode).toBe("invoke");
    toggleInteractionMode();
    expect(useSettingsStore.getState().interactionMode).toBe("organize");
  });
});

// ADR-024 regression: theme mode classes on the document root. "system" must
// apply a real .system class (re-enabling the OS-preference media query) —
// a silent no-op regressed 跟随系统 to always-dark once during reshape v2.
import { describe as describe2, expect as expect2, it as it2 } from "vitest";
import { useSettingsStore as store } from "../settingsStore";

describe2("applyAppearance root classes (ADR-024)", () => {
  it2("system mode applies .system; light/dark apply their classes", () => {
    store.getState().setThemeMode("system");
    expect2(document.documentElement.classList.contains("system")).toBe(true);
    store.getState().setThemeMode("light");
    expect2(document.documentElement.classList.contains("light")).toBe(true);
    expect2(document.documentElement.classList.contains("system")).toBe(false);
    store.getState().setThemeMode("dark");
    expect2(document.documentElement.classList.contains("dark")).toBe(true);
    expect2(document.documentElement.classList.contains("light")).toBe(false);
  });
});
