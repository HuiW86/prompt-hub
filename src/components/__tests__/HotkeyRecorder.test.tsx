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

  // The common conflict never reaches us — the OS hands the chord to whoever
  // registered it first and consumes the event. Without this hint the user
  // presses, nothing happens here, and another app reacts with no explanation
  // on screen (reproduced in the ADR-027 G3 walkthrough).
  it("explains a chord that was swallowed by another app", () => {
    render(<HotkeyRecorder />);
    arm();

    // What the OS actually delivers when ⌥Space belongs to someone else: the
    // modifier goes down and comes back up, the main key never arrives.
    fireEvent.keyDown(window, { code: "AltLeft", altKey: true });
    fireEvent.keyUp(window, { code: "AltLeft" });

    expect(screen.getByRole("alert")).toHaveTextContent(/可能已被其他应用占用/);
    // Still armed: the user's next move is to try a different chord, not to
    // re-enter the mode.
    expect(screen.getByRole("button", { name: "取消" })).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("stays quiet when the chord did arrive", async () => {
    invokeMock.mockResolvedValue("Alt+KeyK");
    render(<HotkeyRecorder />);
    arm();

    fireEvent.keyDown(window, { code: "AltLeft", altKey: true });
    fireEvent.keyDown(window, { code: "KeyK", altKey: true });
    fireEvent.keyUp(window, { code: "AltLeft" });

    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // A bare key IS received, so the modifier rule is the accurate diagnosis —
  // the swallow hint would send the user hunting for a conflict that isn't
  // there.
  it("does not mistake a bare key for a swallowed chord", () => {
    render(<HotkeyRecorder />);
    arm();

    fireEvent.keyDown(window, { code: "ShiftLeft", shiftKey: true });
    fireEvent.keyDown(window, { code: "KeyP" });
    fireEvent.keyUp(window, { code: "ShiftLeft" });

    expect(screen.getByRole("alert")).toHaveTextContent(/至少一个修饰键/);
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
