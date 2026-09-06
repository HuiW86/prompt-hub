import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
// The updater store imports the Tauri updater plugin at module load; stub it so
// StatusBar renders under jsdom without a real Tauri host.
vi.mock("@tauri-apps/plugin-updater", () => ({
  check: vi.fn().mockResolvedValue(null),
}));

import { useAppStore } from "../../stores/appStore";
import { usePromptStore } from "../../stores/promptStore";
import { useSessionStore } from "../../stores/sessionStore";
import { StatusBar } from "../StatusBar";

const promptInitial = usePromptStore.getState();
const appInitial = useAppStore.getState();

const EMPTY_LEDGER = { anchors: [], liveCueTotal: 0, unattributed: 0 };

describe("StatusBar — keycap hints", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("no longer advertises the unhandled ⌘N 新建 shortcut", () => {
    // Fix 4: ⌘N had no handler anywhere (Composition workbench is post-P0-2),
    // so the fake keycap is removed. Real shortcuts (⌘K / ⏎ / ⌘,) stay.
    render(<StatusBar />);
    expect(screen.queryByText("新建")).not.toBeInTheDocument();
    expect(screen.queryByText("⌘N")).not.toBeInTheDocument();
    // The still-real hints remain visible.
    expect(screen.getByText("搜索")).toBeInTheDocument();
    expect(screen.getByText("复制")).toBeInTheDocument();
    expect(screen.getByText("设置")).toBeInTheDocument();
  });
});

// 03-product-spec 区域 7 「中途口令计数」 + 「归因明细不在首屏」.
describe("StatusBar — 中途口令 cell (ADR-029 子决策 4)", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    useSessionStore.setState({ liveCueCount: 0 });
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(EMPTY_LEDGER);
  });

  // 「N = 0 时这一格不渲染」 — not an empty cell, not a zero. Nothing that has
  // not happened gets to occupy a slot, and nothing implies the user ought to
  // have needed a cue by now.
  it("renders neither the cell nor its separator at zero", () => {
    const { container } = render(<StatusBar />);

    expect(screen.queryByText(/中途口令/)).not.toBeInTheDocument();
    // One separator only — the one before 今日复制.
    expect(
      container.querySelectorAll("footer > span[aria-hidden]").length,
    ).toBe(1);
  });

  it("reads 「中途口令 N 次」 once the wake has recorded some", () => {
    useSessionStore.setState({ liveCueCount: 3 });
    render(<StatusBar />);

    expect(screen.getByText("中途口令 3 次")).toBeInTheDocument();
  });

  // The detail is on demand and nowhere else: no new region, no resident panel.
  it("opens the detail dialog on click and closes it on Escape, focus returning to the cell", async () => {
    useSessionStore.setState({ liveCueCount: 2 });
    render(<StatusBar />);

    const cell = screen.getByRole("button", { name: /查看明细/ });
    fireEvent.click(cell);

    const dialog = await screen.findByRole("dialog", { name: "中途口令明细" });
    expect(dialog).toBeInTheDocument();
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("summarize_drift_ledger"),
    );

    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(cell).toHaveFocus();
  });

  it("closes on the × button and on an outside click", async () => {
    useSessionStore.setState({ liveCueCount: 1 });
    render(<StatusBar />);

    const cell = screen.getByRole("button", { name: /查看明细/ });
    fireEvent.click(cell);
    fireEvent.click(await screen.findByRole("button", { name: "关闭" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    fireEvent.click(cell);
    const dialog = await screen.findByRole("dialog");
    // The scrim is the dialog's parent; a click that lands on it and not on the
    // panel is a dismissal.
    fireEvent.click(dialog.parentElement!);
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  // §13.4's Tab cycle is region-level and the status bar is not a region — the
  // same opt-out the updater link beside it takes.
  it("stays out of the region Tab cycle", () => {
    useSessionStore.setState({ liveCueCount: 1 });
    render(<StatusBar />);

    expect(screen.getByRole("button", { name: /查看明细/ })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });
});
