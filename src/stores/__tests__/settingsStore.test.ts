import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSettingsStore } from "../settingsStore";

vi.mock("../../ipc", () => ({
  ipc: {
    getGlobalHotkey: vi.fn(),
    setGlobalHotkey: vi.fn(),
  },
}));

const { ipc } = await import("../../ipc");
const getGlobalHotkey = vi.mocked(ipc.getGlobalHotkey);
const setGlobalHotkeyIpc = vi.mocked(ipc.setGlobalHotkey);

const initial = useSettingsStore.getState();

describe("settingsStore", () => {
  beforeEach(() => {
    useSettingsStore.setState(initial, true);
    vi.clearAllMocks();
  });

  it("defaults globalHotkey to Alt+Space (the value migration 0012 seeds)", () => {
    expect(useSettingsStore.getState().globalHotkey).toBe("Alt+Space");
  });

  // ADR-027: SQLite owns this one preference, so the store is a mirror of the
  // live registration — never an independent source of truth.
  it("loadGlobalHotkey hydrates from the backend", async () => {
    getGlobalHotkey.mockResolvedValue("Ctrl+Shift+P");
    await useSettingsStore.getState().loadGlobalHotkey();
    expect(useSettingsStore.getState().globalHotkey).toBe("Ctrl+Shift+P");
  });

  it("loadGlobalHotkey keeps the current value when the bridge is absent", async () => {
    getGlobalHotkey.mockRejectedValue(new Error("no ipc bridge"));
    await useSettingsStore.getState().loadGlobalHotkey();
    expect(useSettingsStore.getState().globalHotkey).toBe("Alt+Space");
  });

  it("setGlobalHotkey adopts the accelerator the backend confirms is live", async () => {
    setGlobalHotkeyIpc.mockResolvedValue("Ctrl+Shift+P");
    await useSettingsStore.getState().setGlobalHotkey("Ctrl+Shift+P");
    expect(setGlobalHotkeyIpc).toHaveBeenCalledWith("Ctrl+Shift+P");
    expect(useSettingsStore.getState().globalHotkey).toBe("Ctrl+Shift+P");
  });

  // The failure that matters: a rejected rebind (chord already claimed) must
  // leave the store showing the chord that still works. Displaying the
  // requested-but-refused chord would send the user pressing a dead key.
  it("setGlobalHotkey leaves the binding untouched when the backend refuses", async () => {
    setGlobalHotkeyIpc.mockRejectedValue(
      new Error("快捷键 Ctrl+Space 已被其他应用占用，请换一组"),
    );
    await expect(
      useSettingsStore.getState().setGlobalHotkey("Ctrl+Space"),
    ).rejects.toThrow(/已被其他应用占用/);
    expect(useSettingsStore.getState().globalHotkey).toBe("Alt+Space");
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

  it("defaults density to comfortable (reshape-v2 baseline)", () => {
    expect(useSettingsStore.getState().density).toBe("comfortable");
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

  it2(
    "compact density rides .compact on the root; comfortable removes it",
    () => {
      store.getState().setDensity("compact");
      expect2(document.documentElement.classList.contains("compact")).toBe(
        true,
      );
      // Theme/accent switches must not drop the density class.
      store.getState().setThemeMode("light");
      expect2(document.documentElement.classList.contains("compact")).toBe(
        true,
      );
      store.getState().setDensity("comfortable");
      expect2(document.documentElement.classList.contains("compact")).toBe(
        false,
      );
    },
  );
});
