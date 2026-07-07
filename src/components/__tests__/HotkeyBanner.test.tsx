import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { HotkeyBanner } from "../HotkeyBanner";

describe("HotkeyBanner — ⌥Space registration warning", () => {
  beforeEach(() => {
    invokeMock.mockReset();
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
    expect(alert).toHaveTextContent(/⌥Space/);
    expect(alert).toHaveTextContent(/其他应用占用/);
    expect(screen.getByRole("button", { name: "关闭" })).toBeInTheDocument();
  });

  it("removes itself after dismiss", async () => {
    invokeMock.mockResolvedValue(false);
    render(<HotkeyBanner />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
