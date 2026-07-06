import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { usePromptStore } from "../../stores/promptStore";
import { RecentList } from "../RecentList";

const promptInitial = usePromptStore.getState();

describe("RecentList — empty state", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({ recentUsage: [] });
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("shows copy-truthful empty copy (a single copy already lists — no 3-copy gate)", () => {
    // Fix 3: recordCopy has no threshold, so one copy already lands in Recent;
    // the empty state must not promise a 3-copy gate that never existed.
    render(<RecentList />);
    expect(screen.getByText("复制过的话术会在这里出现")).toBeInTheDocument();
    expect(screen.queryByText(/完成 3 次复制/)).not.toBeInTheDocument();
  });
});
