import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SceneWithChildren } from "../../ipc/types";

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

  it("deleting a Scene asks for confirmation before invoking delete_scene", () => {
    render(<ScenePanel />);
    enterEditMode();
    fireEvent.click(screen.getByLabelText("删除场景"));
    // The confirm affordance appears; delete is not fired until confirmed.
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_scene"),
    ).toBeUndefined();
    fireEvent.click(screen.getByLabelText("确认删除场景"));
    const call = invokeMock.mock.calls.find((c) => c[0] === "delete_scene");
    expect(call?.[1]).toMatchObject({ id: "scene-plan" });
  });
});
