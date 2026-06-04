import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AlignmentPhrase,
  Macro,
  Phase,
  SceneWithChildren,
} from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { usePromptStore } from "../../stores/promptStore";
import { useSearchStore } from "../../stores/searchStore";
import { SearchOverlay } from "../SearchOverlay";

const fakePhase: Phase = {
  id: "phase-explore",
  name: "发散",
  orderIndex: 0,
  color: null,
  description: null,
  visible: true,
  defaultAlignmentPhraseId: "ap-1",
};

const fakeAp: AlignmentPhrase = {
  id: "ap-1",
  phaseId: "phase-explore",
  name: "进入发散",
  content: "我们做发散，铺开可能性",
  isDefault: true,
  usageCount: 3,
  lastUsedAt: null,
  createdAt: "2026-05-23T00:00:00Z",
  notes: null,
  deprecated: false,
};

const fakeMacro: Macro = {
  id: "macro-leverage",
  name: "借力最优解",
  content: "调研外部成熟方案",
  expandFrom: null,
  native: true,
  role: null,
  task: null,
  usageCount: 9,
  lastUsedAt: null,
  createdAt: "2026-05-23T00:00:00Z",
  notes: null,
  sceneId: null,
  deprecated: false,
  orderIndex: 0,
};

const fakeScene: SceneWithChildren = {
  scene: {
    id: "scene-plan",
    name: "方案设计",
    icon: "📐",
    orderIndex: 0,
    visible: true,
    rolePresets: [],
    color: null,
  },
  subStages: [],
  phrases: [
    {
      id: "phrase-export",
      sceneId: "scene-plan",
      name: "设计导出模块",
      content: "为项目设计数据导出模块",
      usageCount: 1,
      lastUsedAt: null,
      createdAt: "2026-05-23T00:00:00Z",
      notes: null,
      deprecated: false,
      subStageId: null,
    },
  ],
};

const initialPrompt = usePromptStore.getState();
const initialSearch = useSearchStore.getState();

beforeEach(() => {
  usePromptStore.setState(initialPrompt, true);
  useSearchStore.setState(initialSearch, true);
  usePromptStore.setState({
    phases: [fakePhase],
    alignmentPhrasesByPhase: { "phase-explore": [fakeAp] },
    macros: [fakeMacro],
    scenes: [fakeScene],
    recentUsage: [],
    loadState: "ready",
  });
  invokeMock.mockReset();
  invokeMock.mockImplementation((cmd: string) => {
    switch (cmd) {
      case "record_usage":
        return Promise.resolve({
          id: "rec-x",
          timestamp: "2026-05-23T10:00:00Z",
          targetType: "macro",
          targetId: null,
          source: "macro_area",
          modifierIds: null,
          sopId: null,
          sopStepOrder: null,
          phaseId: null,
        });
      case "list_recent_usage":
        return Promise.resolve([]);
      default:
        return Promise.reject(new Error(`unexpected ${cmd}`));
    }
  });
});

describe("SearchOverlay", () => {
  it("does not render when query is empty", () => {
    const { container } = render(<SearchOverlay />);
    expect(
      container.querySelector("[data-region='search-overlay']"),
    ).toBeNull();
  });

  it("renders overlay with header and total count when query matches", () => {
    useSearchStore.setState({ query: "借力" });
    render(<SearchOverlay />);
    expect(screen.getByLabelText("搜索结果")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "借力最优解" }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 条")).toBeInTheDocument();
  });

  it("matches Phrase by content (case-insensitive substring)", () => {
    useSearchStore.setState({ query: "导出" });
    render(<SearchOverlay />);
    expect(screen.getByText("设计导出模块")).toBeInTheDocument();
    // Phrase result is scoped under its scene
    expect(screen.getByText("方案设计")).toBeInTheDocument();
  });

  it("matches AlignmentPhrase and labels with its Phase name", () => {
    useSearchStore.setState({ query: "发散" });
    render(<SearchOverlay />);
    expect(screen.getByText("进入发散")).toBeInTheDocument();
    expect(screen.getByText("发散")).toBeInTheDocument();
  });

  it("shows empty-state copy when query matches nothing", () => {
    useSearchStore.setState({ query: "xyz-no-match" });
    render(<SearchOverlay />);
    expect(screen.getByText(/没有匹配的资产/)).toBeInTheDocument();
  });

  it("clicking a Macro hit records usage with macro_area source", async () => {
    useSearchStore.setState({ query: "借力" });
    render(<SearchOverlay />);
    fireEvent.click(screen.getByRole("option", { name: "借力最优解" }));
    await waitFor(() =>
      expect(invokeMock.mock.calls.some((c) => c[0] === "record_usage")).toBe(
        true,
      ),
    );
    const call = invokeMock.mock.calls.find((c) => c[0] === "record_usage");
    const input = (
      call?.[1] as { input: { targetType: string; source: string } }
    ).input;
    expect(input.targetType).toBe("macro");
    expect(input.source).toBe("macro_area");
  });
});

describe("SearchOverlay keyboard navigation", () => {
  function setupTwoMacros() {
    usePromptStore.setState({
      phases: [],
      alignmentPhrasesByPhase: {},
      macros: [
        {
          ...fakeMacro,
          id: "a",
          name: "Alpha Macro",
          content: "foo",
          usageCount: 5,
        },
        {
          ...fakeMacro,
          id: "b",
          name: "Beta Macro",
          content: "foo",
          usageCount: 3,
        },
      ],
      scenes: [],
      recentUsage: [],
      loadState: "ready",
    });
    useSearchStore.setState({ query: "Macro" });
  }

  it("selects the first item by default", () => {
    setupTwoMacros();
    render(<SearchOverlay />);
    const buttons = screen.getAllByRole("option");
    expect(buttons[0].getAttribute("aria-selected")).toBe("true");
    expect(buttons[1].getAttribute("aria-selected")).toBe("false");
  });

  it("ArrowDown moves selection to the next item", () => {
    setupTwoMacros();
    render(<SearchOverlay />);
    fireEvent.keyDown(document, { key: "ArrowDown" });
    const buttons = screen.getAllByRole("option");
    expect(buttons[0].getAttribute("aria-selected")).toBe("false");
    expect(buttons[1].getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowUp at the first item clamps (does not wrap)", () => {
    setupTwoMacros();
    render(<SearchOverlay />);
    fireEvent.keyDown(document, { key: "ArrowUp" });
    const buttons = screen.getAllByRole("option");
    expect(buttons[0].getAttribute("aria-selected")).toBe("true");
  });

  it("ArrowDown past the last item clamps to the last", () => {
    setupTwoMacros();
    render(<SearchOverlay />);
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "ArrowDown" });
    const buttons = screen.getAllByRole("option");
    expect(buttons[1].getAttribute("aria-selected")).toBe("true");
  });

  it("Enter triggers record_usage for the currently selected item", async () => {
    setupTwoMacros();
    render(<SearchOverlay />);
    fireEvent.keyDown(document, { key: "ArrowDown" });
    fireEvent.keyDown(document, { key: "Enter" });
    await waitFor(() =>
      expect(invokeMock.mock.calls.some((c) => c[0] === "record_usage")).toBe(
        true,
      ),
    );
    const call = invokeMock.mock.calls.find((c) => c[0] === "record_usage");
    const input = (call?.[1] as { input: { targetId: string } }).input;
    expect(input.targetId).toBe("b");
  });

  it("Enter with empty results is a no-op", () => {
    useSearchStore.setState({ query: "xyz-no-match" });
    render(<SearchOverlay />);
    fireEvent.keyDown(document, { key: "Enter" });
    expect(invokeMock.mock.calls.some((c) => c[0] === "record_usage")).toBe(
      false,
    );
  });

  it("ArrowDown during IME composition is ignored (no selection change)", () => {
    setupTwoMacros();
    render(<SearchOverlay />);
    // Simulate Pinyin IME selecting candidate: e.isComposing === true.
    fireEvent.keyDown(document, { key: "ArrowDown", isComposing: true });
    const options = screen.getAllByRole("option");
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[1].getAttribute("aria-selected")).toBe("false");
  });

  it("Enter during IME composition does NOT trigger record_usage", () => {
    setupTwoMacros();
    render(<SearchOverlay />);
    fireEvent.keyDown(document, { key: "Enter", isComposing: true });
    expect(invokeMock.mock.calls.some((c) => c[0] === "record_usage")).toBe(
      false,
    );
  });

  it("Escape clears the query (overlay self-dismisses)", () => {
    setupTwoMacros();
    render(<SearchOverlay />);
    expect(useSearchStore.getState().query).toBe("Macro");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(useSearchStore.getState().query).toBe("");
  });
});

describe("SearchOverlay ARIA combobox + listbox contract", () => {
  it("uses role='listbox' and role='option' (not buttons)", () => {
    usePromptStore.setState({
      phases: [],
      alignmentPhrasesByPhase: {},
      macros: [fakeMacro],
      scenes: [],
      recentUsage: [],
      loadState: "ready",
    });
    useSearchStore.setState({ query: "借力" });
    render(<SearchOverlay />);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option").length).toBe(1);
    // Items are NOT buttons under the new pattern; they're role="option".
    expect(screen.queryAllByRole("button").length).toBe(0);
  });

  it("each option exposes a stable id for aria-activedescendant linkage", () => {
    usePromptStore.setState({
      phases: [],
      alignmentPhrasesByPhase: {},
      macros: [
        { ...fakeMacro, id: "a", name: "Alpha", content: "x", usageCount: 5 },
        { ...fakeMacro, id: "b", name: "Beta", content: "x", usageCount: 3 },
      ],
      scenes: [],
      recentUsage: [],
      loadState: "ready",
    });
    useSearchStore.setState({ query: "Alpha" });
    render(<SearchOverlay />);
    const option = screen.getByRole("option", { name: "Alpha" });
    expect(option.id).toBe("search-option-0");
  });
});
