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
