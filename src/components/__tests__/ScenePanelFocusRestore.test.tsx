import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SceneWithChildren } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useAppStore } from "../../stores/appStore";
import { usePromptStore } from "../../stores/promptStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import { ScenePanel } from "../ScenePanel";

const promptInitial = usePromptStore.getState();
const appInitial = useAppStore.getState();

// Two phrases in one sub-stage so a reorder / delete has a real neighbour, plus
// an empty second sub-stage so a sub-stage delete has a surviving sibling.
const scenes: SceneWithChildren[] = [
  {
    scene: {
      id: "scene-plan",
      name: "方案设计",
      icon: "drafting-compass",
      orderIndex: 0,
      visible: true,
      rolePresets: [],
      color: null,
    },
    subStages: [
      { id: "ss-generate", sceneId: "scene-plan", name: "生成", orderIndex: 0 },
      { id: "ss-review", sceneId: "scene-plan", name: "评审", orderIndex: 1 },
    ],
    phrases: [
      {
        id: "p1",
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
      {
        id: "p2",
        sceneId: "scene-plan",
        name: "写测试",
        content: "为该模块补充单元测试。",
        usageCount: 0,
        lastUsedAt: null,
        createdAt: "2026-05-23T00:00:00Z",
        notes: null,
        deprecated: false,
        subStageId: "ss-generate",
        orderIndex: 1,
      },
    ],
  },
];

// After a write the store re-pulls listScenesWithChildren and the panel
// re-renders from the returned tree. React's keyed reconciliation PRESERVES
// surviving nodes (a reorder moves them, keeping focus), while genuinely
// removed nodes (delete) or swapped subtrees (editor open/close) drop focus to
// <body> — useFocusRestore then re-lands it on the right [data-nav-id] node.
// These tests pin down both halves of that contract.
function mockRepull(tree: SceneWithChildren[]) {
  invokeMock.mockImplementation((cmd: string) => {
    if (cmd === "list_scenes_with_children") return Promise.resolve(tree);
    return Promise.resolve({ ok: true });
  });
}

describe("ScenePanel focus restore across store re-pull (A1-05)", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    useToastStore.getState().clear();
    useSettingsStore.setState({ interactionMode: "invoke" });
    usePromptStore.setState({ scenes, pendingDraftCount: 0 });
    invokeMock.mockReset();
    mockRepull(scenes);
  });

  it("reorder keeps focus on the pressed move control across the re-pull", async () => {
    render(<ScenePanel />);
    const moveBtn = screen.getByLabelText("下移 设计导出模块");
    // Focus the move button as a keyboard user would before pressing it.
    moveBtn.focus();
    expect(document.activeElement).toBe(moveBtn);

    fireEvent.click(moveBtn);

    // reorder_phrases fired and the re-pull resolved. Keyed reconciliation
    // keeps the button mounted, so the user can press 下移 again immediately —
    // and focus must NOT be stranded on <body> either way.
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        "reorder_phrases",
        expect.anything(),
      );
    });
    await waitFor(() => {
      expect(document.activeElement).not.toBe(document.body);
      expect(document.activeElement).toBe(
        screen.getByLabelText("下移 设计导出模块"),
      );
    });
  });

  it("deleting a phrase moves focus to the next surviving sibling", async () => {
    // The re-pull after delete returns a tree WITHOUT p1 so the deleted card
    // is genuinely gone and the fallback chain must pick p2.
    const afterDelete: SceneWithChildren[] = [
      {
        ...scenes[0],
        phrases: [scenes[0].phrases[1]],
      },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children")
        return Promise.resolve(afterDelete);
      return Promise.resolve({ ok: true });
    });

    render(<ScenePanel />);
    // Open the inline confirm, then confirm the delete of p1.
    const deleteBtn = screen.getByLabelText("删除 设计导出模块");
    deleteBtn.focus();
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByLabelText("确认永久删除"));

    // p1's card is gone; focus fell to the nearest surviving sibling (p2's
    // card) rather than being stranded on <body>.
    await waitFor(() => {
      const survivor = screen.getByRole("button", { name: "写测试" });
      expect(document.activeElement).toBe(survivor);
      expect(survivor.getAttribute("data-nav-id")).toBe("phrase-p2");
    });
  });

  it("saving a phrase edit returns focus to the edited card", async () => {
    render(<ScenePanel />);
    // Open the editor on p1; the card is swapped for the form.
    fireEvent.click(screen.getByLabelText("编辑 设计导出模块"));
    // Save the (unchanged) fields — updatePhrase re-pulls, the editor closes,
    // and the card remounts.
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      const card = screen.getByRole("button", { name: "设计导出模块" });
      expect(document.activeElement).toBe(card);
      expect(card.getAttribute("data-nav-id")).toBe("phrase-p1");
    });
  });

  it("deleting a sub-stage moves focus to a surviving column's rename control", async () => {
    // Re-pull after the sub-stage delete drops ss-generate, leaving ss-review.
    const afterDelete: SceneWithChildren[] = [
      {
        ...scenes[0],
        subStages: [scenes[0].subStages[1]],
        // Its phrases unbind (backend behaviour) — model them as ungrouped.
        phrases: scenes[0].phrases.map((p) => ({ ...p, subStageId: null })),
      },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children")
        return Promise.resolve(afterDelete);
      return Promise.resolve({ ok: true });
    });

    render(<ScenePanel />);
    const deleteBtn = screen.getByLabelText("删除 生成");
    deleteBtn.focus();
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByLabelText("确认删除子阶段"));

    // ss-generate's header controls are gone; focus lands on the surviving
    // ss-review column's rename control (data-nav-id="substage-ss-review-rename").
    await waitFor(() => {
      const survivorRename = screen.getByLabelText("重命名 评审");
      expect(document.activeElement).toBe(survivorRename);
      expect(survivorRename.getAttribute("data-nav-id")).toBe(
        "substage-ss-review-rename",
      );
    });
  });

  it("restored targets stay roving-nav items so arrow nav continues", async () => {
    // Use the delete path — the one where restoration actually re-targets.
    const afterDelete: SceneWithChildren[] = [
      {
        ...scenes[0],
        phrases: [scenes[0].phrases[1]],
      },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children")
        return Promise.resolve(afterDelete);
      return Promise.resolve({ ok: true });
    });

    render(<ScenePanel />);
    const deleteBtn = screen.getByLabelText("删除 设计导出模块");
    deleteBtn.focus();
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByLabelText("确认永久删除"));

    await waitFor(() => {
      const survivor = screen.getByRole("button", { name: "写测试" });
      expect(document.activeElement).toBe(survivor);
      // The restored card is a data-nav-item, so useRegionNav resumes arrow
      // traversal from it instead of restarting at the region container.
      expect(survivor.hasAttribute("data-nav-item")).toBe(true);
    });
  });
});
