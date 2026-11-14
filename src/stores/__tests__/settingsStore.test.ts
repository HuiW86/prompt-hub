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

// Text size (issue: 字号偏小). One root class per non-default step, the ladder
// clamps at both ends, and the value survives a reload via localStorage.
describe2("fontScale (字号)", () => {
  const root = () => document.documentElement.classList;

  it2("defaults to standard with no text-size class on the root", () => {
    store.getState().setFontScale("standard");
    expect2(store.getState().fontScale).toBe("standard");
    expect2(root().contains("text-large")).toBe(false);
    expect2(root().contains("text-xlarge")).toBe(false);
  });

  it2("each step rides exactly one root class", () => {
    store.getState().setFontScale("large");
    expect2(root().contains("text-large")).toBe(true);
    expect2(root().contains("text-xlarge")).toBe(false);
    store.getState().setFontScale("xlarge");
    expect2(root().contains("text-large")).toBe(false);
    expect2(root().contains("text-xlarge")).toBe(true);
    store.getState().setFontScale("standard");
    expect2(root().contains("text-xlarge")).toBe(false);
  });

  it2("theme / accent / density switches keep the text-size class", () => {
    store.getState().setFontScale("large");
    store.getState().setThemeMode("light");
    store.getState().setAccent("blue");
    store.getState().setDensity("compact");
    expect2(root().contains("text-large")).toBe(true);
    store.getState().setDensity("comfortable");
    store.getState().setAccent("neutral");
    store.getState().setThemeMode("dark");
    store.getState().setFontScale("standard");
  });

  it2("stepFontScale walks the ladder and clamps at both ends", () => {
    const s = () => store.getState();
    s().setFontScale("standard");
    s().stepFontScale(-1);
    expect2(s().fontScale).toBe("standard");
    s().stepFontScale(1);
    expect2(s().fontScale).toBe("large");
    s().stepFontScale(1);
    expect2(s().fontScale).toBe("xlarge");
    s().stepFontScale(1);
    expect2(s().fontScale).toBe("xlarge");
    s().stepFontScale(-1);
    expect2(s().fontScale).toBe("large");
    s().setFontScale("standard");
  });

  it2("persists to localStorage with the other appearance prefs", () => {
    store.getState().setFontScale("xlarge");
    const saved = JSON.parse(
      localStorage.getItem("prompt-hub-settings") ?? "{}",
    );
    expect2(saved.state.fontScale).toBe("xlarge");
    store.getState().setFontScale("standard");
  });

  it2("rehydrates the saved step and applies its class", async () => {
    localStorage.setItem(
      "prompt-hub-settings",
      JSON.stringify({
        state: {
          themeMode: "dark",
          accent: "neutral",
          density: "comfortable",
          fontScale: "large",
          interactionMode: "invoke",
        },
        version: 2,
      }),
    );
    await store.persist.rehydrate();
    expect2(store.getState().fontScale).toBe("large");
    expect2(root().contains("text-large")).toBe(true);
    store.getState().setFontScale("standard");
  });

  it2("an unknown stored step falls back to standard", async () => {
    localStorage.setItem(
      "prompt-hub-settings",
      JSON.stringify({
        state: { themeMode: "dark", fontScale: "huge" },
        version: 2,
      }),
    );
    await store.persist.rehydrate();
    expect2(store.getState().fontScale).toBe("standard");
    expect2(root().contains("text-large")).toBe(false);
    expect2(root().contains("text-xlarge")).toBe(false);
  });

  it2("an older saved state without the key reads as standard", async () => {
    localStorage.setItem(
      "prompt-hub-settings",
      JSON.stringify({ state: { themeMode: "dark" }, version: 2 }),
    );
    await store.persist.rehydrate();
    expect2(store.getState().fontScale).toBe("standard");
  });
});
