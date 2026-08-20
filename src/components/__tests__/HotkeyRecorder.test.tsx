import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useSettingsStore } from "../../stores/settingsStore";
import { HotkeyRecorder } from "../HotkeyRecorder";

// Recording mode is where the jsdom-verifiable half of ADR-027 lives: the
// capture semantics, the modifier rule, and the "adopt only what the backend
// confirms" contract. The registration itself (and the Reopen escape hatch)
// need a real OS and belong to the G3 manual gate.
describe("HotkeyRecorder", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useSettingsStore.setState({ globalHotkey: "Alt+Space" });
  });

  function arm() {
    fireEvent.click(screen.getByRole("button", { name: "更改" }));
  }

  it("shows the current chord in display form", () => {
    render(<HotkeyRecorder />);
    expect(screen.getByText("⌥ Space")).toBeInTheDocument();
  });

  it("records a chord and adopts what the backend confirms", async () => {
    invokeMock.mockResolvedValue("Control+Shift+KeyP");
    render(<HotkeyRecorder />);
    arm();

    fireEvent.keyDown(window, { code: "KeyP", ctrlKey: true, shiftKey: true });

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("set_global_hotkey", {
        accelerator: "Control+Shift+KeyP",
      }),
    );
    await waitFor(() =>
      expect(useSettingsStore.getState().globalHotkey).toBe(
        "Control+Shift+KeyP",
      ),
    );
  });

  it("stays armed through a modifier-only press", () => {
    render(<HotkeyRecorder />);
    arm();

    fireEvent.keyDown(window, { code: "ShiftLeft", shiftKey: true });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  // The unrecoverable case: a bare global chord swallows that key everywhere,
  // and the only way back is the window it was supposed to open.
  it("refuses a bare key without leaving recording mode", () => {
    render(<HotkeyRecorder />);
    arm();

    fireEvent.keyDown(window, { code: "KeyP" });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/至少一个修饰键/);
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
  });

  it("ESC cancels recording without changing the binding", () => {
    render(<HotkeyRecorder />);
    arm();

    fireEvent.keyDown(window, { code: "Escape" });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().globalHotkey).toBe("Alt+Space");
    expect(screen.getByRole("button", { name: "更改" })).toBeInTheDocument();
  });

  it("surfaces the backend's refusal and keeps the working chord", async () => {
    invokeMock.mockRejectedValue(
      "快捷键 Control+Space 已被其他应用占用，请换一组",
    );
    render(<HotkeyRecorder />);
    arm();

    fireEvent.keyDown(window, { code: "Space", ctrlKey: true });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/已被其他应用占用/),
    );
    expect(useSettingsStore.getState().globalHotkey).toBe("Alt+Space");
  });

  it("恢复默认 is unavailable while the default is already bound", async () => {
    render(<HotkeyRecorder />);
    expect(screen.getByRole("button", { name: "恢复默认" })).toBeDisabled();

    act(() => {
      useSettingsStore.setState({ globalHotkey: "Control+Shift+KeyP" });
    });
    expect(screen.getByRole("button", { name: "恢复默认" })).toBeEnabled();
  });
});
