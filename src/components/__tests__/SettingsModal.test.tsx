import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportSummary } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// The data page drives the native file dialogs through plugin-dialog. Mock the
// three entry points so we can script the path selection + confirm gate.
const saveMock = vi.fn();
const openMock = vi.fn();
const confirmMock = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: (...args: unknown[]) => saveMock(...args) as unknown,
  open: (...args: unknown[]) => openMock(...args) as unknown,
  confirm: (...args: unknown[]) => confirmMock(...args) as unknown,
}));

import { usePromptStore } from "../../stores/promptStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { SettingsModal } from "../SettingsModal";

const promptInitial = usePromptStore.getState();
const settingsInitial = useSettingsStore.getState();

const SUMMARY: ImportSummary = {
  modifiers: 1,
  macros: 2,
  scenes: 1,
  subStages: 0,
  phrases: 3,
  phases: 0,
  alignmentPhrases: 0,
  compositions: 0,
};

describe("SettingsModal — data page export/import", () => {
  let refreshAllMock: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useSettingsStore.setState(settingsInitial, true);
    refreshAllMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    usePromptStore.setState({ refreshAll: refreshAllMock });
    useSettingsStore.setState({ settingsOpen: true });
    invokeMock.mockReset();
    saveMock.mockReset();
    openMock.mockReset();
    confirmMock.mockReset();
  });

  function openDataTab() {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
  }

  it("export writes to the chosen path and reports success", async () => {
    saveMock.mockResolvedValue("/tmp/backup.json");
    invokeMock.mockResolvedValue(undefined);
    openDataTab();

    fireEvent.click(screen.getByRole("button", { name: /导出备份/ }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("export_data", {
        path: "/tmp/backup.json",
      }),
    );
    expect(await screen.findByText("已导出备份")).toBeInTheDocument();
  });

  it("export is a no-op when the save dialog is cancelled", async () => {
    saveMock.mockResolvedValue(null);
    openDataTab();

    fireEvent.click(screen.getByRole("button", { name: /导出备份/ }));

    await waitFor(() => expect(saveMock).toHaveBeenCalled());
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("import runs only after the confirm gate, then reloads stores", async () => {
    openMock.mockResolvedValue("/tmp/backup.json");
    confirmMock.mockResolvedValue(true);
    invokeMock.mockResolvedValue(SUMMARY);
    openDataTab();

    fireEvent.click(screen.getByRole("button", { name: /导入备份/ }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("import_data", {
        path: "/tmp/backup.json",
      }),
    );
    expect(refreshAllMock).toHaveBeenCalledTimes(1);
    // 1 + 2 + 1 + 0 + 3 + 0 + 0 + 0 = 7
    expect(await screen.findByText("已导入 7 条记录")).toBeInTheDocument();
  });

  it("import aborts when the confirm gate is declined", async () => {
    openMock.mockResolvedValue("/tmp/backup.json");
    confirmMock.mockResolvedValue(false);
    openDataTab();

    fireEvent.click(screen.getByRole("button", { name: /导入备份/ }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(invokeMock).not.toHaveBeenCalled();
    expect(refreshAllMock).not.toHaveBeenCalled();
  });
});

describe("SettingsModal — focus domain", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useSettingsStore.setState(settingsInitial, true);
    invokeMock.mockReset();
    saveMock.mockReset();
    openMock.mockReset();
    confirmMock.mockReset();
  });

  it("moves initial focus into the dialog container on open", () => {
    useSettingsStore.setState({ settingsOpen: true });
    render(<SettingsModal />);

    const dialog = screen.getByRole("dialog");
    expect(document.activeElement).toBe(dialog);
  });

  it("wraps Tab from the last control back to the first (no escape)", () => {
    useSettingsStore.setState({ settingsOpen: true });
    render(<SettingsModal />);

    const dialog = screen.getByRole("dialog");
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>("button:not([disabled])"),
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    // Park focus on the last control, then Tab forward — the trap must land it
    // back on the first control, never on a node outside the dialog.
    last.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Shift+Tab from the first control wraps to the last.
    first.focus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it("returns focus to the opening trigger when closed", () => {
    // A stand-in trigger button that lives outside the modal.
    const trigger = document.createElement("button");
    trigger.textContent = "打开设置";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    useSettingsStore.setState({ settingsOpen: true });
    const { rerender } = render(<SettingsModal />);
    // Focus moved into the dialog on open.
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    // Close: the store flips settingsOpen off, the modal unmounts its content,
    // and the cleanup restores focus to the recorded trigger.
    useSettingsStore.setState({ settingsOpen: false });
    rerender(<SettingsModal />);
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});
