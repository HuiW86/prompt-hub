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

  // The 数据 page also mounts the ADR-028 trash section, which reads list_trash
  // on mount — so these cases can no longer answer every command with a single
  // mockResolvedValue. Script the one command under test and let list_trash
  // default to an empty trash.
  function scriptInvoke(script: Record<string, unknown> = {}) {
    const full: Record<string, unknown> = { list_trash: [], ...script };
    invokeMock.mockImplementation((cmd: string) =>
      Promise.resolve(cmd in full ? full[cmd] : undefined),
    );
  }

  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useSettingsStore.setState(settingsInitial, true);
    refreshAllMock = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    usePromptStore.setState({ refreshAll: refreshAllMock });
    useSettingsStore.setState({ settingsOpen: true });
    invokeMock.mockReset();
    scriptInvoke();
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
    expect(invokeMock).not.toHaveBeenCalledWith(
      "export_data",
      expect.anything(),
    );
  });

  it("import runs only after the confirm gate, then reloads stores", async () => {
    openMock.mockResolvedValue("/tmp/backup.json");
    confirmMock.mockResolvedValue(true);
    scriptInvoke({ import_data: SUMMARY });
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
    expect(invokeMock).not.toHaveBeenCalledWith(
      "import_data",
      expect.anything(),
    );
    expect(refreshAllMock).not.toHaveBeenCalled();
  });
});

describe("SettingsModal — appearance density", () => {
  beforeEach(() => {
    useSettingsStore.setState(settingsInitial, true);
    useSettingsStore.setState({ settingsOpen: true });
  });

  it("紧凑 pick updates the store and marks the segment active", () => {
    render(<SettingsModal />);
    const compactBtn = screen.getByRole("button", { name: "紧凑" });
    expect(compactBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(compactBtn);
    expect(useSettingsStore.getState().density).toBe("compact");
    expect(compactBtn).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.classList.contains("compact")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "舒适" }));
    expect(useSettingsStore.getState().density).toBe("comfortable");
    expect(document.documentElement.classList.contains("compact")).toBe(false);
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

  it("Escape closes the modal and never reaches bubble-phase listeners (G4 D2)", () => {
    useSettingsStore.setState({ settingsOpen: true });
    render(<SettingsModal />);
    const dialog = screen.getByRole("dialog");

    // Stand-in for App's document-level hide listener: bubble phase, which
    // fires after the modal's capture-phase claim on the key.
    const leaked = vi.fn();
    document.addEventListener("keydown", leaked);
    fireEvent.keyDown(dialog, { key: "Escape" });
    document.removeEventListener("keydown", leaked);

    expect(useSettingsStore.getState().settingsOpen).toBe(false);
    expect(leaked).not.toHaveBeenCalled();
  });

  it("Escape while a hotkey is being recorded cancels the capture, not the modal (G4 D2)", () => {
    useSettingsStore.setState({ settingsOpen: true });
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "快捷键" }));
    fireEvent.click(screen.getByRole("button", { name: "更改" }));
    const dialog = screen.getByRole("dialog");

    // Both listeners sit in the capture phase — the recorder on window, the
    // modal on document — and the recorder wins only by propagation order.
    // A real keydown carries both fields; the recorder keys on `code`, the
    // modal on `key`, so a synthetic event with one field would silently
    // skip one of them and prove nothing.
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(screen.getByRole("button", { name: "更改" })).toBeInTheDocument();
    expect(useSettingsStore.getState().settingsOpen).toBe(true);

    // Recording is off, so the second Escape reaches the modal and closes it.
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    expect(useSettingsStore.getState().settingsOpen).toBe(false);
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

// A whole-table replace is running behind the dialog: import_json truncates
// every asset table and refreshAll() reloads on top of it. Dismissing the modal
// mid-flight sends the user back to a dashboard whose next edit the import is
// about to erase without a trace, so every dismissal path is held shut until
// the data page goes idle again.
describe("SettingsModal — dismissal while the data page is busy", () => {
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

  // Starts an import that never settles on its own and hands back the resolver,
  // so a case can hold the modal in the busy state for as long as it needs.
  async function startPendingImport() {
    openMock.mockResolvedValue("/tmp/backup.json");
    confirmMock.mockResolvedValue(true);
    let release!: (summary: ImportSummary) => void;
    const pending = new Promise<ImportSummary>((res) => {
      release = res;
    });
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "import_data") return pending;
      if (cmd === "list_trash") return Promise.resolve([]);
      return Promise.resolve(undefined);
    });

    openDataTab();
    fireEvent.click(screen.getByRole("button", { name: /导入备份/ }));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("import_data", {
        path: "/tmp/backup.json",
      }),
    );
    return release;
  }

  it("Escape neither closes the modal nor reaches App's hide listener mid-import", async () => {
    await startPendingImport();
    const dialog = screen.getByRole("dialog");

    // Stand-in for App's document hide listener (bubble phase, App.tsx:60).
    // The modal must keep claiming Escape while busy — falling through would
    // hide the entire dashboard behind the running import.
    const leaked = vi.fn();
    document.addEventListener("keydown", leaked);
    fireEvent.keyDown(dialog, { key: "Escape" });
    document.removeEventListener("keydown", leaked);

    expect(useSettingsStore.getState().settingsOpen).toBe(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(leaked).not.toHaveBeenCalled();
    expect(invokeMock.mock.calls.some(([cmd]) => cmd === "hide_window")).toBe(
      false,
    );
  });

  it("overlay click and the close button are both inert mid-import", async () => {
    await startPendingImport();
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement as HTMLElement;

    fireEvent.click(overlay);
    expect(useSettingsStore.getState().settingsOpen).toBe(true);
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "关闭" })).toBeDisabled();
  });

  it("releases the guard once the import settles", async () => {
    const release = await startPendingImport();
    const dialog = screen.getByRole("dialog");

    release(SUMMARY);
    expect(await screen.findByText("已导入 7 条记录")).toBeInTheDocument();
    expect(refreshAllMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "关闭" })).toBeEnabled();

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(useSettingsStore.getState().settingsOpen).toBe(false);
  });

  it("overlay click still closes the dialog when the data page is idle", () => {
    invokeMock.mockImplementation((cmd: string) =>
      Promise.resolve(cmd === "list_trash" ? [] : undefined),
    );
    openDataTab();

    const overlay = screen.getByRole("dialog").parentElement as HTMLElement;
    fireEvent.click(overlay);

    expect(useSettingsStore.getState().settingsOpen).toBe(false);
  });
});
