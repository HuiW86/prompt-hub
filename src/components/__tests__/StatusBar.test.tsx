import { render, screen } from "@testing-library/react";
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
import { StatusBar } from "../StatusBar";

const promptInitial = usePromptStore.getState();
const appInitial = useAppStore.getState();

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
