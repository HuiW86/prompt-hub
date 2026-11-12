import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AlignmentPhrase,
  Macro,
  PanoramaPlacement,
  Phase,
  SceneWithChildren,
} from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { usePanoramaStore } from "../../stores/panoramaStore";
import { usePromptStore } from "../../stores/promptStore";
import { useSessionStore } from "../../stores/sessionStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import { PanoramaView } from "../panorama/PanoramaView";

const promptInitial = usePromptStore.getState();
const panoramaInitial = usePanoramaStore.getState();

const recent = new Date().toISOString();
const OLD = "2025-01-01T00:00:00Z";

const phases: Phase[] = [
  {
    id: "phase-understand",
    name: "理解",
    orderIndex: 0,
    color: null,
    description: null,
    visible: true,
    defaultAlignmentPhraseId: "ap-understand",
  },
  {
    id: "phase-live",
    name: "中途",
    orderIndex: 1,
    color: null,
    description: null,
    visible: true,
    defaultAlignmentPhraseId: "ap-stop",
  },
];

function ap(
  over: Partial<AlignmentPhrase> &
    Pick<AlignmentPhrase, "id" | "phaseId" | "name">,
): AlignmentPhrase {
  return {
    content: `${over.name} 正文`,
    isDefault: false,
    usageCount: 3,
    lastUsedAt: recent,
    createdAt: OLD,
    notes: null,
    deprecated: false,
    orderIndex: 0,
    kind: "opening",
    layerId: null,
    domainId: null,
    modeId: null,
    cueAxis: null,
    contentRevisedAt: null,
    ...over,
  };
}

function macro(over: Partial<Macro> & Pick<Macro, "id" | "name">): Macro {
  return {
    content: `${over.name} 正文`,
    expandFrom: null,
    native: true,
    role: null,
    task: null,
    usageCount: 5,
    lastUsedAt: recent,
    createdAt: OLD,
    notes: null,
    sceneId: null,
    deprecated: false,
    orderIndex: 0,
    ...over,
  };
}

const alignment = {
  "phase-understand": [
    ap({ id: "ap-understand", phaseId: "phase-understand", name: "先对齐" }),
  ],
  "phase-live": [
    ap({
      id: "ap-stop",
      phaseId: "phase-live",
      name: "停",
      kind: "cue",
      usageCount: 0,
      lastUsedAt: null,
    }),
  ],
};

const macros = [
  macro({ id: "m-review", name: "审查改动", usageCount: 20 }),
  macro({ id: "m-test", name: "补测试", usageCount: 10 }),
  macro({ id: "m-old", name: "旧方法", usageCount: 1, lastUsedAt: OLD }),
];

const scenes: SceneWithChildren[] = [
  {
    scene: {
      id: "scene-1",
      name: "方案",
      icon: null,
      orderIndex: 0,
      visible: true,
      rolePresets: [],
      color: null,
    },
    subStages: [],
    phrases: [
      {
        id: "p-export",
        sceneId: "scene-1",
        name: "设计导出",
        content: "为项目设计导出模块。",
        usageCount: 2,
        lastUsedAt: recent,
        createdAt: OLD,
        notes: null,
        deprecated: false,
        subStageId: null,
        orderIndex: 0,
      },
    ],
  },
];

const placements: PanoramaPlacement[] = [
  { assetKind: "macro", assetId: "m-review", groupId: "execute", pinSlot: 1 },
  {
    assetKind: "phrase",
    assetId: "p-export",
    groupId: "converge",
    pinSlot: null,
  },
];

const writeText = () =>
  navigator.clipboard.writeText as ReturnType<typeof vi.fn>;
const recordInputs = () =>
  invokeMock.mock.calls
    .filter((c) => c[0] === "record_usage")
    .map((c) => (c[1] as { input: Record<string, unknown> }).input);

async function renderView() {
  render(<PanoramaView />);
  // Placements arrive asynchronously; wait for the pinned card.
  await screen.findByLabelText("常用位 1");
}

function row(name: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(name) });
}

describe("PanoramaView", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({
      phases,
      macros,
      scenes,
      alignmentPhrasesByPhase: alignment,
      modifiers: [],
      compositionsByPhase: {},
      alignmentAxisValuesById: {},
      loadState: "ready",
    });
    usePanoramaStore.setState(panoramaInitial, true);
    useSettingsStore.setState({
      interactionMode: "invoke",
      settingsOpen: false,
    });
    useToastStore.getState().clear();
    writeText().mockClear();
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_panorama_placements":
          return Promise.resolve(placements);
        case "record_usage":
          return Promise.resolve({ id: "r", timestamp: recent });
        case "list_recent_usage":
          return Promise.resolve([]);
        case "count_today_usage":
          return Promise.resolve(0);
        default:
          return Promise.resolve(undefined);
      }
    });
  });

  // ── S1: one screen, everything visible, loudness by tier ─────────────────

  it("S1 renders the six intent columns in order, then 未分组, then the strip", async () => {
    await renderView();
    const titles = screen
      .getAllByRole("region")
      .map((r) => r.getAttribute("aria-label"));
    expect(titles).toEqual([
      "对齐与理解",
      "发散与调研",
      "收敛与方案",
      "执行与验收",
      "打磨与表达",
      "沉淀",
      "未分组",
      "中途口令",
      "工具",
    ]);
  });

  it("S1 places items by placement or default rule and shows every item at once", async () => {
    await renderView();
    const col = (label: string) => screen.getByRole("region", { name: label });
    expect(within(col("执行与验收")).getByText("审查改动")).toBeInTheDocument();
    expect(within(col("收敛与方案")).getByText("设计导出")).toBeInTheDocument();
    expect(within(col("对齐与理解")).getByText("先对齐")).toBeInTheDocument();
    expect(within(col("中途口令")).getByText("停")).toBeInTheDocument();
    expect(within(col("未分组")).getByText("补测试")).toBeInTheDocument();
    // Dormant is shown, just quieter — never hidden.
    expect(within(col("未分组")).getByText("旧方法")).toBeInTheDocument();
  });

  it("S1 renders each tier distinctly: pinned card with slot and bar, active with count, dormant without", async () => {
    await renderView();
    const pinned = row("审查改动");
    expect(pinned).toHaveAttribute("data-tier", "pinned");
    expect(within(pinned).getByLabelText("常用位 1")).toHaveTextContent("1");
    expect(within(pinned).getByText("20")).toBeInTheDocument();

    const active = row("补测试");
    expect(active).toHaveAttribute("data-tier", "active");
    expect(within(active).getByText("10")).toBeInTheDocument();

    const dormant = row("旧方法");
    expect(dormant).toHaveAttribute("data-tier", "dormant");
    expect(within(dormant).queryByText("1")).toBeNull();
  });

  it("S1 heads each column with active / total", async () => {
    await renderView();
    const col = screen.getByRole("region", { name: "未分组" });
    // 补测试 active, 旧方法 dormant.
    expect(within(col).getByText("1 / 2")).toBeInTheDocument();
  });

  it("S1 marks a never-used item created recently as 新", async () => {
    usePromptStore.setState({
      macros: [
        ...macros,
        macro({
          id: "m-new",
          name: "新方法",
          usageCount: 0,
          lastUsedAt: null,
          createdAt: recent,
        }),
      ],
    });
    await renderView();
    expect(within(row("新方法")).getByText("新")).toBeInTheDocument();
  });

  // ── S2: one key or one click, and it is counted ──────────────────────────

  it("S2 a bare digit copies that pin slot and records the usage", async () => {
    await renderView();
    fireEvent.keyDown(document.body, { key: "1" });
    await waitFor(() =>
      expect(writeText()).toHaveBeenCalledWith("审查改动 正文"),
    );
    await waitFor(() =>
      expect(recordInputs()).toEqual([
        expect.objectContaining({
          targetType: "macro",
          targetId: "m-review",
          source: "macro_area",
        }),
      ]),
    );
  });

  it("S2 a digit with an empty slot does nothing", async () => {
    await renderView();
    fireEvent.keyDown(document.body, { key: "5" });
    await act(async () => {});
    expect(writeText()).not.toHaveBeenCalled();
  });

  it("S2 clicking a row copies it with its own usage source", async () => {
    await renderView();
    fireEvent.click(row("设计导出"));
    await waitFor(() =>
      expect(writeText()).toHaveBeenCalledWith("为项目设计导出模块。"),
    );
    await waitFor(() =>
      expect(recordInputs()[0]).toMatchObject({
        targetType: "phrase",
        targetId: "p-export",
        source: "scene",
      }),
    );
  });

  it("S2 a live cue records live_cue, never phase_bar", async () => {
    await renderView();
    fireEvent.click(row("停"));
    await waitFor(() =>
      expect(recordInputs()[0]).toMatchObject({
        targetId: "ap-stop",
        source: "live_cue",
      }),
    );
  });

  // ── S3: typing filters by dimming; nothing moves ─────────────────────────

  it("S3 typing dims non-matches without changing DOM order", async () => {
    await renderView();
    const before = Array.from(document.querySelectorAll("[data-item-key]")).map(
      (el) => el.getAttribute("data-item-key"),
    );
    fireEvent.change(screen.getByLabelText("筛选"), {
      target: { value: "测试" },
    });
    const after = Array.from(document.querySelectorAll("[data-item-key]")).map(
      (el) => el.getAttribute("data-item-key"),
    );
    expect(after).toEqual(before);
    expect(row("补测试")).not.toHaveAttribute("data-dimmed");
    expect(row("审查改动")).toHaveAttribute("data-dimmed", "true");
    expect(row("旧方法")).toHaveAttribute("data-dimmed", "true");
  });

  it("S3 ↵ copies the first match in reading order", async () => {
    await renderView();
    const input = screen.getByLabelText("筛选");
    // Matches 设计导出 (收敛与方案, column 3) and 补测试 (未分组, column 7);
    // 设计导出 comes first reading left to right.
    fireEvent.change(input, { target: { value: "正文" } });
    fireEvent.change(input, { target: { value: "设" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(writeText()).toHaveBeenCalledWith("为项目设计导出模块。"),
    );
  });

  it("S3 with a non-empty filter a digit is input, not a copy", async () => {
    await renderView();
    const input = screen.getByLabelText("筛选");
    fireEvent.change(input, { target: { value: "审" } });
    const notPrevented = fireEvent.keyDown(input, { key: "1" });
    expect(notPrevented).toBe(true);
    await act(async () => {});
    expect(writeText()).not.toHaveBeenCalled();
  });

  it("arrow keys move the selection and ↵ copies the selected item", async () => {
    await renderView();
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    // First visible item in reading order: 先对齐 in 对齐与理解.
    expect(row("先对齐")).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(row("设计导出")).toHaveAttribute("aria-current", "true");
    fireEvent.keyDown(document.body, { key: "Enter" });
    await waitFor(() =>
      expect(writeText()).toHaveBeenCalledWith("为项目设计导出模块。"),
    );
  });

  // ── Keys the panorama must leave alone ───────────────────────────────────

  it("does not intercept ⌘1 (phase switch belongs to App)", async () => {
    await renderView();
    const notPrevented = fireEvent.keyDown(document.body, {
      key: "1",
      metaKey: true,
    });
    expect(notPrevented).toBe(true);
    await act(async () => {});
    expect(writeText()).not.toHaveBeenCalled();
  });

  it("ignores digits while an IME composition is in progress", async () => {
    await renderView();
    fireEvent.keyDown(screen.getByLabelText("筛选"), {
      key: "1",
      isComposing: true,
    });
    await act(async () => {});
    expect(writeText()).not.toHaveBeenCalled();
  });

  it("ignores keys while the settings dialog is open", async () => {
    await renderView();
    useSettingsStore.setState({ settingsOpen: true });
    fireEvent.keyDown(document.body, { key: "1" });
    await act(async () => {});
    expect(writeText()).not.toHaveBeenCalled();
  });

  // ── Wake hygiene ──────────────────────────────────────────────────────────

  it("a wake clears the filter and the selection", async () => {
    await renderView();
    fireEvent.change(screen.getByLabelText("筛选"), {
      target: { value: "审" },
    });
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    act(() => {
      useSessionStore.getState().setSessionStartedAt("2026-11-12T13:00:00Z");
    });
    expect(screen.getByLabelText("筛选")).toHaveValue("");
    expect(usePanoramaStore.getState().selectedKey).toBeNull();
    expect(screen.getByLabelText("筛选")).toHaveFocus();
  });

  it("still renders every item in its default column when the layout fails to load", async () => {
    invokeMock.mockImplementation((cmd: string) =>
      cmd === "list_panorama_placements"
        ? Promise.reject(new Error("boom"))
        : Promise.resolve(undefined),
    );
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PanoramaView />);
    await waitFor(() => expect(usePanoramaStore.getState().loaded).toBe(true));
    const col = screen.getByRole("region", { name: "未分组" });
    expect(within(col).getByText("审查改动")).toBeInTheDocument();
    err.mockRestore();
  });
});
