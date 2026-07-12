import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecordUsageInput } from "../../ipc/types";
import { usePromptStore } from "../../stores/promptStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import { writeClipboard } from "../useClipboard";
import { useCopy } from "../useCopy";

vi.mock("../useClipboard", () => ({
  writeClipboard: vi.fn(),
}));

const writeClipboardMock = vi.mocked(writeClipboard);

const promptInitial = usePromptStore.getState();
const toastInitial = useToastStore.getState();
const settingsInitial = useSettingsStore.getState();

const input: RecordUsageInput = {
  targetType: "macro",
  targetId: "macro-1",
  source: "macro_area",
  modifierIds: null,
  sopId: null,
  sopStepOrder: null,
  phaseId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  usePromptStore.setState(promptInitial, true);
  useToastStore.setState(toastInitial, true);
  useSettingsStore.setState(settingsInitial, true);
});

describe("useCopy", () => {
  it("copies, shows a success toast with flash target, then records usage", async () => {
    writeClipboardMock.mockResolvedValue(undefined);
    const recordCopy = vi.fn().mockResolvedValue(undefined);
    usePromptStore.setState({ recordCopy });

    const { result } = renderHook(() => useCopy());
    await result.current("hello", input, "card-1");

    expect(writeClipboardMock).toHaveBeenCalledWith("hello");
    const toast = useToastStore.getState();
    expect(toast.message).toBe("已复制");
    expect(toast.intent).toBe("success");
    expect(toast.flashTargetId).toBe("card-1");
    // Default 调用态: hide is NOT suppressed (复制即隐藏).
    expect(recordCopy).toHaveBeenCalledWith(input, false);
  });

  it("suppresses hide in 整理态 (organize mode)", async () => {
    writeClipboardMock.mockResolvedValue(undefined);
    const recordCopy = vi.fn().mockResolvedValue(undefined);
    usePromptStore.setState({ recordCopy });
    useSettingsStore.setState({ interactionMode: "organize" });

    const { result } = renderHook(() => useCopy());
    await result.current("hello", input, "card-1");

    // Organize mode keeps the window: suppressHide=true.
    expect(recordCopy).toHaveBeenCalledWith(input, true);
    // usage is still recorded — statistics are decoupled from hiding.
    expect(recordCopy).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast and skips record_usage when the clipboard write fails", async () => {
    writeClipboardMock.mockRejectedValue(new Error("denied"));
    const recordCopy = vi.fn().mockResolvedValue(undefined);
    usePromptStore.setState({ recordCopy });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result } = renderHook(() => useCopy());
    // Must resolve (not reject) so call sites can keep fire-and-forget `void copy(...)`.
    await expect(result.current("hello", input, "card-1")).resolves.toBe(
      undefined,
    );

    const toast = useToastStore.getState();
    expect(toast.message).toBe("复制失败");
    expect(toast.intent).toBe("error");
    // No card flash on failure — flash signals a successful copy only.
    expect(toast.flashTargetId).toBeNull();
    expect(recordCopy).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("still reports copy success when record_usage fails afterwards", async () => {
    writeClipboardMock.mockResolvedValue(undefined);
    const recordCopy = vi.fn().mockRejectedValue(new Error("ipc down"));
    usePromptStore.setState({ recordCopy });
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result } = renderHook(() => useCopy());
    await expect(result.current("hello", input)).resolves.toBe(undefined);

    const toast = useToastStore.getState();
    expect(toast.message).toBe("已复制");
    expect(toast.intent).toBe("success");
    consoleError.mockRestore();
  });
});
