import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useSettingsStore } from "../../stores/settingsStore";
import { HotkeyBanner } from "../HotkeyBanner";

describe("HotkeyBanner — wake-chord registration warning", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useSettingsStore.setState({
      globalHotkey: "Alt+Space",
      settingsOpen: false,
    });
  });

  it("stays silent while the probe is pending", () => {
    // Never-resolving probe: nothing must render before the answer arrives, so
    // a normal launch (hotkey ok) never flashes the warning.
    invokeMock.mockReturnValue(new Promise(() => {}));
    render(<HotkeyBanner />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("hotkey_registered");
  });

  it("stays silent when the hotkey registered", async () => {
    invokeMock.mockResolvedValue(true);
    render(<HotkeyBanner />);
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("stays silent when the bridge is absent (probe rejects)", async () => {
    // Dev/web shell with no Tauri bridge: a rejection must be treated as "ok"
    // so we never show a false warning off-desktop.
    invokeMock.mockRejectedValue(new Error("no bridge"));
    render(<HotkeyBanner />);
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a dismissible warning when registration failed", async () => {
    invokeMock.mockResolvedValue(false);
    render(<HotkeyBanner />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/⌥ Space/);
    expect(alert).toHaveTextContent(/其他应用占用/);
    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
  });

  // ADR-027: the banner must name the chord that is actually bound. Hardcoding
  // ⌥Space here (as the copy did before the chord became configurable) would
  // send a user who rebound to Ctrl+Shift+P hunting for the wrong conflict.
  it("names the currently configured chord, not the shipped default", async () => {
    useSettingsStore.setState({ globalHotkey: "Control+Shift+KeyP" });
    invokeMock.mockResolvedValue(false);
    render(<HotkeyBanner />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/⌃ ⇧ P/);
    expect(alert).not.toHaveTextContent(/Space/);
  });

  // The conflict is now fixable from inside the app, so the banner offers the
  // fix rather than only telling the user to go quit some other application.
  it("opens settings from the banner and then removes itself", async () => {
    invokeMock.mockResolvedValue(false);
    render(<HotkeyBanner />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "更改快捷键" }));
    expect(useSettingsStore.getState().settingsOpen).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("removes itself after dismiss", async () => {
    invokeMock.mockResolvedValue(false);
    render(<HotkeyBanner />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
