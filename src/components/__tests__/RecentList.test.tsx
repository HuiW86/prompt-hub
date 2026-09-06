import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AlignmentPhrase, RecentUsageEntry } from "../../ipc/types";

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

// The recents strip re-copies from a usage record, whose stored content is the
// bare `content` with no prefix. Resolving the live phrase and re-assembling is
// what keeps 「对齐坐标与漂移账契约」b true from this entry point too.
describe("RecentList — alignment re-copy carries the coordinate prefix", () => {
  const axisValue = {
    id: "axv-layer-path",
    axis: "layer" as const,
    name: "路径",
    hint: null,
    orderIndex: 0,
    refCount: 1,
    trashedRefCount: 0,
  };

  const phrase: AlignmentPhrase = {
    id: "ap-1",
    phaseId: "phase-explore",
    name: "进入发散",
    content: "我们做发散",
    isDefault: true,
    usageCount: 1,
    lastUsedAt: null,
    createdAt: "2026-05-23T00:00:00Z",
    notes: null,
    deprecated: false,
    orderIndex: 0,
    kind: "opening",
    layerId: "axv-layer-path",
    domainId: null,
    modeId: null,
    cueAxis: null,
    contentRevisedAt: null,
  };

  const entry: RecentUsageEntry = {
    record: {
      id: "rec-1",
      timestamp: "2026-09-05T10:00:00Z",
      targetType: "alignment",
      targetId: "ap-1",
      source: "phase_bar",
      modifierIds: null,
      sopId: null,
      sopStepOrder: null,
      phaseId: "phase-explore",
      sessionStartedAt: "2026-09-05T09:00:00Z",
    },
    targetName: "进入发散",
    targetContent: "我们做发散",
  };

  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "record_usage":
          return Promise.resolve({ ...entry.record, id: "rec-new" });
        case "list_recent_usage":
          return Promise.resolve([entry]);
        case "count_today_usage":
          return Promise.resolve(1);
        default:
          return Promise.resolve({ ok: true });
      }
    });
  });

  it("re-assembles the prefix from the live phrase", async () => {
    const writeText = vi.mocked(navigator.clipboard.writeText);
    writeText.mockClear();
    usePromptStore.setState({
      recentUsage: [entry],
      alignmentPhrasesByPhase: { "phase-explore": [phrase] },
      alignmentAxisValues: [axisValue],
      alignmentAxisValuesById: { "axv-layer-path": axisValue },
    });
    render(<RecentList />);
    fireEvent.click(screen.getByLabelText("进入发散"));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("本轮在路径层。\n我们做发散"),
    );
  });

  // A trashed phrase is not in the store, so nothing can be re-assembled. One
  // un-prefixed copy beats copying nothing at all.
  it("falls back to the record's stored content when the phrase is unresolvable", async () => {
    const writeText = vi.mocked(navigator.clipboard.writeText);
    writeText.mockClear();
    usePromptStore.setState({
      recentUsage: [entry],
      alignmentPhrasesByPhase: {},
      alignmentAxisValues: [axisValue],
      alignmentAxisValuesById: { "axv-layer-path": axisValue },
    });
    render(<RecentList />);
    fireEvent.click(screen.getByLabelText("进入发散"));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("我们做发散"));
  });
});
