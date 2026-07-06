import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DraftSummary, SceneWithChildren } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useAppStore } from "../../stores/appStore";
import { usePromptStore } from "../../stores/promptStore";
import { ScenePanel } from "../ScenePanel";

const promptInitial = usePromptStore.getState();
const appInitial = useAppStore.getState();

// One scene with a non-empty sub-stage (生成) and an empty one (评审) so we can
// assert that edit mode surfaces empty sub-stages the view mode would drop.
const scenes: SceneWithChildren[] = [
  {
    scene: {
      id: "scene-plan",
      name: "方案设计",
      icon: "drafting-compass",
      orderIndex: 0,
      visible: true,
      rolePresets: ["架构师"],
      color: null,
    },
    subStages: [
      { id: "ss-generate", sceneId: "scene-plan", name: "生成", orderIndex: 0 },
      { id: "ss-review", sceneId: "scene-plan", name: "评审", orderIndex: 1 },
    ],
    phrases: [
      {
        id: "phrase-1",
        sceneId: "scene-plan",
        name: "设计导出模块",
        content: "为项目设计数据导出模块。",
        usageCount: 0,
        lastUsedAt: null,
        createdAt: "2026-05-23T00:00:00Z",
        notes: null,
        deprecated: false,
        subStageId: "ss-generate",
        orderIndex: 0,
      },
    ],
  },
];

describe("ScenePanel edit mode — Scene / SubStage structure", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    usePromptStore.setState({ scenes, pendingDraftCount: 0 });
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  function enterEditMode() {
    fireEvent.click(screen.getByLabelText("管理话术"));
  }

  it("view mode drops the empty sub-stage", () => {
    render(<ScenePanel />);
    // 生成 has a phrase → shown; 评审 is empty → hidden in view mode.
    expect(screen.getByText("生成")).toBeInTheDocument();
    expect(screen.queryByText("评审")).not.toBeInTheDocument();
  });

  it("edit mode reveals Scene controls + new-scene action", () => {
    render(<ScenePanel />);
    enterEditMode();
    expect(screen.getByText("场景 · 方案设计")).toBeInTheDocument();
    expect(screen.getByLabelText("重命名场景")).toBeInTheDocument();
    expect(screen.getByLabelText("删除场景")).toBeInTheDocument();
    expect(screen.getByLabelText("新建场景")).toBeInTheDocument();
  });

  it("edit mode surfaces the empty sub-stage in the manager", () => {
    render(<ScenePanel />);
    enterEditMode();
    // Both sub-stages are now manageable, including the empty 评审.
    expect(screen.getByLabelText("重命名 评审")).toBeInTheDocument();
    expect(screen.getByLabelText("删除 评审")).toBeInTheDocument();
  });

  it("clicking 新增子阶段 opens the inline name editor", () => {
    render(<ScenePanel />);
    enterEditMode();
    fireEvent.click(screen.getByLabelText("新增子阶段"));
    expect(screen.getByLabelText("子阶段名称")).toBeInTheDocument();
  });

  it("creating a sub-stage invokes create_sub_stage with sceneId + name", () => {
    render(<ScenePanel />);
    enterEditMode();
    fireEvent.click(screen.getByLabelText("新增子阶段"));
    const input = screen.getByLabelText("子阶段名称");
    fireEvent.change(input, { target: { value: "修订" } });
    // Re-pull after the write resolves; return the same scenes to keep render stable.
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "create_sub_stage") return Promise.resolve({});
      if (cmd === "list_scenes_with_children") return Promise.resolve(scenes);
      return Promise.resolve({ ok: true });
    });
    fireEvent.keyDown(input, { key: "Enter" });
    const call = invokeMock.mock.calls.find((c) => c[0] === "create_sub_stage");
    expect(call?.[1]).toMatchObject({ sceneId: "scene-plan", name: "修订" });
  });

  it("edit mode exposes drag handles for sub-stage reorder", () => {
    render(<ScenePanel />);
    enterEditMode();
    // Every sub-stage row (including the empty 评审) is drag-sortable (P3-6).
    expect(screen.getByLabelText("拖动排序 生成")).toBeInTheDocument();
    expect(screen.getByLabelText("拖动排序 评审")).toBeInTheDocument();
  });

  it("场景后移 swaps the tab order via reorder_scenes", () => {
    const twoScenes: SceneWithChildren[] = [
      scenes[0],
      {
        scene: {
          id: "scene-review",
          name: "评审场景",
          icon: null,
          orderIndex: 1,
          visible: true,
          rolePresets: [],
          color: null,
        },
        subStages: [],
        phrases: [],
      },
    ];
    usePromptStore.setState({ scenes: twoScenes, pendingDraftCount: 0 });
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children")
        return Promise.resolve([twoScenes[1], twoScenes[0]]);
      return Promise.resolve({ ok: true });
    });
    render(<ScenePanel />);
    enterEditMode();
    // First tab is active: 前移 hits the left boundary, 后移 is available.
    expect(screen.getByLabelText("场景前移")).toBeDisabled();
    expect(screen.getByLabelText("场景后移")).toBeEnabled();
    fireEvent.click(screen.getByLabelText("场景后移"));
    const call = invokeMock.mock.calls.find((c) => c[0] === "reorder_scenes");
    expect(call?.[1]).toMatchObject({
      orderedIds: ["scene-review", "scene-plan"],
    });
  });

  it("deleting a Scene asks for confirmation before invoking delete_scene", () => {
    render(<ScenePanel />);
    enterEditMode();
    fireEvent.click(screen.getByLabelText("删除场景"));
    // The confirm affordance appears; delete is not fired until confirmed.
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_scene"),
    ).toBeUndefined();
    // The store re-pulls scenes after the delete resolves — the mock must
    // answer with an array (here: none left) or the panel render crashes.
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children") return Promise.resolve([]);
      return Promise.resolve({ ok: true });
    });
    fireEvent.click(screen.getByLabelText("确认删除场景"));
    const call = invokeMock.mock.calls.find((c) => c[0] === "delete_scene");
    expect(call?.[1]).toMatchObject({ id: "scene-plan" });
  });
});

describe("ScenePanel view mode — ungrouped column header", () => {
  // Same scene shape, plus a phrase with no sub-stage: it lands in the trailing
  // ungrouped column, which must render a muted「未分组」header (not headerless).
  const scenesWithUngrouped: SceneWithChildren[] = [
    {
      ...scenes[0],
      phrases: [
        ...scenes[0].phrases,
        {
          id: "phrase-2",
          sceneId: "scene-plan",
          name: "补充上下文",
          content: "先补充项目上下文再继续。",
          usageCount: 0,
          lastUsedAt: null,
          createdAt: "2026-05-23T00:00:00Z",
          notes: null,
          deprecated: false,
          subStageId: null,
          orderIndex: 0,
        },
      ],
    },
  ];

  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("renders a 未分组 header for phrases without a sub-stage", () => {
    usePromptStore.setState({
      scenes: scenesWithUngrouped,
      pendingDraftCount: 0,
    });
    render(<ScenePanel />);
    // Both the real sub-stage column and the ungrouped column carry a header.
    expect(screen.getByText("生成")).toBeInTheDocument();
    expect(screen.getByText("未分组")).toBeInTheDocument();
    expect(screen.getByLabelText("补充上下文")).toBeInTheDocument();
  });

  it("omits the 未分组 header when every phrase belongs to a sub-stage", () => {
    usePromptStore.setState({ scenes, pendingDraftCount: 0 });
    render(<ScenePanel />);
    expect(screen.queryByText("未分组")).not.toBeInTheDocument();
  });
});

// P0-1: the drafts view is rendered INSIDE the scene-panel region container, so
// its onKeyDown bubbles up and the draft card action buttons join the region's
// arrow-key roving traversal (03-product-spec §13.4 v0.7 "方向键选草稿卡 + 动作键
// promote/discard").
describe("ScenePanel drafts view — roving nav reaches draft actions", () => {
  const draft: DraftSummary = {
    id: "draft-macro",
    targetType: "macro",
    name: "示例 Macro",
    preview: "预览内容",
    toolName: "mcp:create_draft",
    status: "pending",
    createdAt: "2026-06-30T00:00:00Z",
  };

  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    usePromptStore.setState({
      scenes,
      drafts: [draft],
      pendingDraftCount: 1,
    });
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("arrow keys walk from the draft tab into the first draft action button", () => {
    const { container } = render(<ScenePanel />);
    const region = container.querySelector(
      "[data-region='scene-panel']",
    ) as HTMLElement;
    // Activate the drafts view via its tab.
    const draftTab = screen.getByLabelText("草稿收件箱，1 条待审");
    fireEvent.click(draftTab);

    // The draft card's action buttons are now nav items inside the region.
    const items = Array.from(
      region.querySelectorAll<HTMLElement>("[data-nav-item]"),
    );
    const firstDraftAction = items.find((el) =>
      el.textContent?.includes("编辑"),
    );
    expect(firstDraftAction).toBeDefined();
    expect(firstDraftAction?.getAttribute("tabindex")).toBe("-1");

    // Starting on the draft tab, arrowing right must eventually land on a draft
    // action button (the scene tab sits between them in DOM order).
    draftTab.focus();
    const startIndex = items.indexOf(draftTab);
    expect(startIndex).toBeGreaterThanOrEqual(0);
    for (let i = startIndex; i < items.length - 1; i++) {
      if (document.activeElement === firstDraftAction) break;
      fireEvent.keyDown(region, { key: "ArrowRight" });
    }
    expect(document.activeElement).toBe(firstDraftAction);
  });
});
