import {
  fireEvent,
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DraftSummary, SceneWithChildren } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useAppStore } from "../../stores/appStore";
import { usePromptStore } from "../../stores/promptStore";
import { useToastStore } from "../../stores/toastStore";
import { ScenePanel } from "../ScenePanel";

const promptInitial = usePromptStore.getState();
const appInitial = useAppStore.getState();

// One scene with a non-empty sub-stage (生成) and an empty one (评审) so we can
// assert the view grid surfaces empty sub-stages as manageable columns.
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

describe("ScenePanel scene card — view grid + properties entry", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    usePromptStore.setState({ scenes, pendingDraftCount: 0 });
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("view mode surfaces the empty sub-stage as a manageable column", () => {
    render(<ScenePanel />);
    // 阶段 2 (task 5): view mode now includes empty sub-stages so a freshly
    // created column stays visible + manageable. Both 生成 (populated) and 评审
    // (empty) render as columns, and 评审 carries its own header action cluster.
    expect(screen.getByText("生成")).toBeInTheDocument();
    expect(screen.getByText("评审")).toBeInTheDocument();
    expect(screen.getByLabelText("重命名 评审")).toBeInTheDocument();
    expect(screen.getByLabelText("在 评审 添加话术")).toBeInTheDocument();
  });

  it("卡头 pencil opens the properties panel", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("编辑场景属性"));
    expect(screen.getByLabelText("场景属性")).toBeInTheDocument();
  });

  it("saving properties invokes update_scene with the scene id + payload", () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children") return Promise.resolve(scenes);
      return Promise.resolve({ ok: true });
    });
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("编辑场景属性"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    const call = invokeMock.mock.calls.find((c) => c[0] === "update_scene");
    expect(call?.[1]).toMatchObject({
      id: "scene-plan",
      name: "方案设计",
      rolePresets: ["架构师"],
    });
  });

  it("renders scene rolePresets as chips in the card meta row", () => {
    render(<ScenePanel />);
    // 架构师 preset from the fixture surfaces as a meta-row chip.
    expect(screen.getByText("架构师")).toBeInTheDocument();
  });
});

// 阶段 2 (tasks 5 + 6): view-mode grid in-place editing. The action clusters on
// the sub-stage column headers and phrase cards must reach every SubStage /
// Phrase mutation directly in the grid. A two-phrase fixture lets us assert the
// ↑↓ within-group swap; the empty 评审 column exercises empty-column ops.
describe("ScenePanel view mode — in-place structure + content editing", () => {
  const twoPhrase: SceneWithChildren[] = [
    {
      ...scenes[0],
      phrases: [
        scenes[0].phrases[0],
        {
          id: "phrase-2",
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

  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    usePromptStore.setState({ scenes: twoPhrase, pendingDraftCount: 0 });
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children")
        return Promise.resolve(twoPhrase);
      return Promise.resolve({ ok: true });
    });
  });

  // ── SubStage: Update / Reorder / Delete / Create ──────────────────────────
  it("renames a sub-stage in place via update_sub_stage", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("重命名 生成"));
    const input = screen.getAllByLabelText("子阶段名称")[0];
    fireEvent.change(input, { target: { value: "起草" } });
    fireEvent.keyDown(input, { key: "Enter" });
    const call = invokeMock.mock.calls.find((c) => c[0] === "update_sub_stage");
    expect(call?.[1]).toMatchObject({ id: "ss-generate", name: "起草" });
  });

  it("Enter mid-IME-composition does not commit a sub-stage rename", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("重命名 生成"));
    const input = screen.getAllByLabelText("子阶段名称")[0];
    fireEvent.change(input, { target: { value: "起草" } });
    // Committing an IME candidate fires Enter with isComposing still true.
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "update_sub_stage"),
    ).toBeUndefined();
  });

  it("后移 swaps a sub-stage with its neighbour via reorder_sub_stages", () => {
    render(<ScenePanel />);
    // 生成 (idx 0) can move right into 评审 (idx 1); the resulting id order swaps.
    fireEvent.click(screen.getByLabelText("后移 生成"));
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "reorder_sub_stages",
    );
    expect(call?.[1]).toMatchObject({
      sceneId: "scene-plan",
      orderedIds: ["ss-review", "ss-generate"],
    });
  });

  it("deleting a sub-stage confirms then invokes delete_sub_stage", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("删除 评审"));
    // Confirm gate: nothing fires until the user confirms.
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_sub_stage"),
    ).toBeUndefined();
    fireEvent.click(screen.getByLabelText("确认删除子阶段"));
    const call = invokeMock.mock.calls.find((c) => c[0] === "delete_sub_stage");
    expect(call?.[1]).toMatchObject({ id: "ss-review" });
  });

  it("the ghost column creates a sub-stage via create_sub_stage", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("新增子阶段"));
    const inputs = screen.getAllByLabelText("子阶段名称");
    const ghostInput = inputs[inputs.length - 1];
    fireEvent.change(ghostInput, { target: { value: "验收" } });
    fireEvent.keyDown(ghostInput, { key: "Enter" });
    const call = invokeMock.mock.calls.find((c) => c[0] === "create_sub_stage");
    expect(call?.[1]).toMatchObject({ sceneId: "scene-plan", name: "验收" });
  });

  // ── Phrase: Update / Reorder / Delete / Create ────────────────────────────
  it("editing a phrase in place swaps in the editor and saves via update_phrase", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("编辑 设计导出模块"));
    // The card is replaced by the editor; save the (unchanged) fields.
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    const call = invokeMock.mock.calls.find((c) => c[0] === "update_phrase");
    expect(call?.[1]).toMatchObject({ id: "phrase-1" });
  });

  it("Enter mid-IME-composition does not commit a phrase edit", () => {
    // Fix 1: the PhraseEditor name field must swallow the commit-Enter of an
    // in-flight IME composition instead of saving the phrase.
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("编辑 设计导出模块"));
    const nameField = screen.getByPlaceholderText("名称");
    fireEvent.change(nameField, { target: { value: "改名" } });
    fireEvent.keyDown(nameField, { key: "Enter", isComposing: true });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "update_phrase"),
    ).toBeUndefined();
    // A normal Enter still commits.
    fireEvent.keyDown(nameField, { key: "Enter" });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "update_phrase"),
    ).toBeTruthy();
  });

  it("下移 swaps a phrase with its group neighbour via reorder_phrases", () => {
    render(<ScenePanel />);
    // 设计导出模块 (idx 0) moves down past 写测试 (idx 1) within 生成.
    fireEvent.click(screen.getByLabelText("下移 设计导出模块"));
    const call = invokeMock.mock.calls.find((c) => c[0] === "reorder_phrases");
    expect(call?.[1]).toMatchObject({
      sceneId: "scene-plan",
      subStageId: "ss-generate",
      orderedIds: ["phrase-2", "phrase-1"],
    });
  });

  it("deleting a phrase confirms then invokes delete_phrase", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("删除 设计导出模块"));
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_phrase"),
    ).toBeUndefined();
    fireEvent.click(screen.getByLabelText("确认永久删除"));
    const call = invokeMock.mock.calls.find((c) => c[0] === "delete_phrase");
    expect(call?.[1]).toMatchObject({ id: "phrase-1" });
  });

  it("the add-phrase ghost prefills the column's sub-stage on create", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("在 生成 添加话术"));
    // The create editor opens with 生成 preselected in the sub-stage picker.
    expect(screen.getByLabelText("所属子阶段")).toHaveValue("ss-generate");
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "新话术" },
    });
    fireEvent.change(screen.getByPlaceholderText("话术内容"), {
      target: { value: "内容" },
    });
    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    const call = invokeMock.mock.calls.find((c) => c[0] === "create_phrase");
    expect(call?.[1]).toMatchObject({
      sceneId: "scene-plan",
      name: "新话术",
      subStageId: "ss-generate",
    });
  });

  // ── Copy isolation: cluster clicks must not fire the card's copy action ────
  it("clicking a phrase card action does not trigger copy", () => {
    render(<ScenePanel />);
    // The move button lives inside the card whose whole surface copies; its
    // stopPropagation must keep record_usage (the copy path's IPC) from firing.
    fireEvent.click(screen.getByLabelText("下移 设计导出模块"));
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "record_usage"),
    ).toBeUndefined();
  });
});

// 阶段 1 core acceptance: the properties panel must persist EVERY edited field
// through update_scene — the pre-refactor path (ScenePanel.tsx old 568-574) only
// passed name/rolePresets and let icon/color ride the stale scene value. These
// integration tests drive the real ScenePropertiesEditor rendered inside the
// panel and assert the invoke payload carries the fresh icon / color / role edits.
describe("ScenePanel properties panel — full-field save link", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    usePromptStore.setState({ scenes, pendingDraftCount: 0 });
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children") return Promise.resolve(scenes);
      return Promise.resolve({ ok: true });
    });
  });

  function openProperties() {
    fireEvent.click(screen.getByLabelText("编辑场景属性"));
    return screen.getByLabelText("场景属性");
  }

  it("persists edited name / icon / color / rolePresets in one update_scene call", () => {
    render(<ScenePanel />);
    openProperties();

    // name: overwrite the fixture value.
    fireEvent.change(screen.getByLabelText("场景名称"), {
      target: { value: "重构规划" },
    });
    // icon: pick a lucide preset by aria-label (avoids preset-order coupling);
    // microscope differs from the fixture's drafting-compass.
    fireEvent.click(screen.getByLabelText("图标 microscope"));
    // color: pick a swatch.
    fireEvent.click(screen.getByLabelText("颜色 #2f9e6e"));
    // rolePresets: add a second role via Enter.
    const roleInput = screen.getByLabelText("添加角色预设");
    fireEvent.change(roleInput, { target: { value: "评审员" } });
    fireEvent.keyDown(roleInput, { key: "Enter" });

    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    const call = invokeMock.mock.calls.find((c) => c[0] === "update_scene");
    expect(call?.[1]).toMatchObject({
      id: "scene-plan",
      name: "重构规划",
      icon: "microscope",
      color: "#2f9e6e",
      rolePresets: ["架构师", "评审员"],
    });
  });

  it("clearing icon and color sends undefined (not the stale scene value)", () => {
    render(<ScenePanel />);
    openProperties();
    // 无 clears the icon; the X swatch clears the color.
    fireEvent.click(screen.getByLabelText("无图标"));
    fireEvent.click(screen.getByLabelText("清除颜色"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    const call = invokeMock.mock.calls.find((c) => c[0] === "update_scene");
    // icon defaulted from the fixture (drafting-compass) must not leak through.
    expect(call?.[1]).toMatchObject({
      id: "scene-plan",
      icon: undefined,
      color: undefined,
    });
  });

  it("removing a role chip drops it from the saved rolePresets", () => {
    render(<ScenePanel />);
    openProperties();
    fireEvent.click(screen.getByLabelText("删除角色 架构师"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    const call = invokeMock.mock.calls.find((c) => c[0] === "update_scene");
    expect(call?.[1]).toMatchObject({ id: "scene-plan", rolePresets: [] });
  });

  it("closes the panel after a successful save", async () => {
    render(<ScenePanel />);
    openProperties();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    // handleSaveProperties awaits update_scene before closing — let the
    // resolve microtask flush so the panel actually unmounts.
    await waitForElementToBeRemoved(() => screen.queryByLabelText("场景属性"));
  });

  it("取消 closes the panel without invoking update_scene", () => {
    render(<ScenePanel />);
    openProperties();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByLabelText("场景属性")).not.toBeInTheDocument();
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "update_scene"),
    ).toBeUndefined();
  });

  it("Escape from the name field closes the panel", () => {
    render(<ScenePanel />);
    openProperties();
    fireEvent.keyDown(screen.getByLabelText("场景名称"), { key: "Escape" });
    expect(screen.queryByLabelText("场景属性")).not.toBeInTheDocument();
  });

  it("deleting from the panel confirms, calls delete_scene, and closes", async () => {
    render(<ScenePanel />);
    openProperties();
    // The delete lives in the panel footer; the confirm gate fires first.
    fireEvent.click(screen.getByLabelText("删除场景"));
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_scene"),
    ).toBeUndefined();
    // After delete resolves the store re-pulls; answer empty so render survives.
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children") return Promise.resolve([]);
      return Promise.resolve({ ok: true });
    });
    fireEvent.click(screen.getByLabelText("确认删除场景"));
    const call = invokeMock.mock.calls.find((c) => c[0] === "delete_scene");
    expect(call?.[1]).toMatchObject({ id: "scene-plan" });
    // deleteScene awaits the store re-pull before the panel closes.
    await waitForElementToBeRemoved(() => screen.queryByLabelText("场景属性"));
  });
});

// 阶段 1 wiring: the tab-tail ＋ creates a scene, jumps to it, and auto-opens the
// properties panel (replacing the old inline-rename-in-edit-mode flow).
describe("ScenePanel new-scene entry — auto-opens properties", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    usePromptStore.setState({ scenes, pendingDraftCount: 0 });
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("＋ new-scene creates via create_scene then opens the properties panel", async () => {
    const created: SceneWithChildren = {
      scene: {
        id: "scene-new",
        name: "新场景",
        icon: null,
        orderIndex: 1,
        visible: true,
        rolePresets: [],
        color: null,
      },
      subStages: [],
      phrases: [],
    };
    // The store optimistically re-pulls after create_scene; return the fixture
    // scene plus the freshly-created one so the panel can jump to the new tab.
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children")
        return Promise.resolve([scenes[0], created]);
      return Promise.resolve({ ok: true });
    });

    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("新建场景"));

    // Let the create + re-pull microtasks flush.
    await screen.findByLabelText("场景属性");
    const call = invokeMock.mock.calls.find((c) => c[0] === "create_scene");
    expect(call?.[1]).toMatchObject({ name: "新场景", rolePresets: [] });
    // The panel is scoped to the newly-created scene (its name in the input).
    expect(screen.getByLabelText("场景名称")).toHaveValue("新场景");
  });
});

// 阶段 1 consumption anchors: scene.color paints the icon wrapper's inline color;
// rolePresets render as meta-row chips only when non-empty.
describe("ScenePanel consumption anchors — color + rolePresets", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("paints the tab + card-head icon wrappers with scene.color", () => {
    const colored: SceneWithChildren[] = [
      {
        ...scenes[0],
        scene: { ...scenes[0].scene, color: "#4c8dff" },
      },
    ];
    usePromptStore.setState({ scenes: colored, pendingDraftCount: 0 });
    const { container } = render(<ScenePanel />);
    // Both the active tab icon span and the card-head icon span carry the
    // inline color (rgb-normalised by jsdom).
    const painted = Array.from(
      container.querySelectorAll<HTMLElement>("span[style]"),
    ).filter((el) => el.style.color === "rgb(76, 141, 255)");
    expect(painted.length).toBeGreaterThanOrEqual(2);
  });

  it("omits the inline color when scene.color is null", () => {
    usePromptStore.setState({ scenes, pendingDraftCount: 0 });
    const { container } = render(<ScenePanel />);
    const painted = Array.from(
      container.querySelectorAll<HTMLElement>("span[style]"),
    ).filter((el) => el.style.color !== "");
    expect(painted).toHaveLength(0);
  });

  it("renders no role chips when rolePresets is empty", () => {
    const noRoles: SceneWithChildren[] = [
      {
        ...scenes[0],
        scene: { ...scenes[0].scene, rolePresets: [] },
      },
    ];
    usePromptStore.setState({ scenes: noRoles, pendingDraftCount: 0 });
    render(<ScenePanel />);
    // The fixture's 架构师 chip must be gone; the phrase-count meta stays.
    expect(screen.queryByText("架构师")).not.toBeInTheDocument();
    expect(screen.getByText("1 条话术")).toBeInTheDocument();
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

  // Fake timers here: the promote-rejection test arms an error toast whose
  // dwell setTimeout would otherwise leak past teardown. Reset the toast via
  // clear() (monotonic seq bump) rather than setState(reset) — rewinding seq to
  // 0 is what lets a leaked timer's captured seq re-match and flip a later
  // test's error intent back to success (the historical properties-panel flake).
  beforeEach(() => {
    vi.useFakeTimers();
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    useToastStore.getState().clear();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
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

  // Promote flow: naming the bucket = create_sub_stage + re-home each orphan
  // phrase via update_phrase (no new write link; see handlePromoteUngrouped).
  it("naming the ungrouped column creates a sub-stage and re-homes its phrases", async () => {
    usePromptStore.setState({
      scenes: scenesWithUngrouped,
      pendingDraftCount: 0,
    });
    invokeMock.mockImplementation((cmd: unknown) => {
      if (cmd === "create_sub_stage")
        return Promise.resolve({
          id: "ss-new",
          sceneId: "scene-plan",
          name: "收尾",
          orderIndex: 2,
        });
      if (cmd === "list_scenes_with_children")
        return Promise.resolve(scenesWithUngrouped);
      return Promise.resolve({ ok: true });
    });
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("命名未分组为子阶段"));
    const input = screen.getAllByLabelText("子阶段名称")[0];
    fireEvent.change(input, { target: { value: "收尾" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await vi.waitFor(() => {
      const create = invokeMock.mock.calls.find(
        (c) => c[0] === "create_sub_stage",
      );
      expect(create?.[1]).toMatchObject({
        sceneId: "scene-plan",
        name: "收尾",
      });
      const rehome = invokeMock.mock.calls.find(
        (c) => c[0] === "update_phrase",
      );
      expect(rehome?.[1]).toMatchObject({
        id: "phrase-2",
        subStageId: "ss-new",
      });
    });
  });

  it("create_sub_stage rejection surfaces an error and re-homes nothing", async () => {
    usePromptStore.setState({
      scenes: scenesWithUngrouped,
      pendingDraftCount: 0,
    });
    invokeMock.mockImplementation((cmd: unknown) => {
      if (cmd === "create_sub_stage")
        return Promise.reject(new Error("DbError"));
      if (cmd === "list_scenes_with_children")
        return Promise.resolve(scenesWithUngrouped);
      return Promise.resolve({ ok: true });
    });
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("命名未分组为子阶段"));
    const input = screen.getAllByLabelText("子阶段名称")[0];
    fireEvent.change(input, { target: { value: "收尾" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await vi.waitFor(() => {
      expect(useToastStore.getState().intent).toBe("error");
    });
    // No orphan is re-homed, and the inline editor survives for a retry.
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "update_phrase"),
    ).toBeUndefined();
    expect(screen.getAllByLabelText("子阶段名称")[0]).toBeInTheDocument();
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

// ── CRUD matrix cell: Scene × Reorder ─────────────────────────────────────────
// The 12-cell 实体×CRUD matrix demands one ScenePanel-level assertion per cell
// that the in-place entry reaches the right IPC link. Every other cell already
// has an integration test above (Scene C/U/D, SubStage C/U/D/R, Phrase C/U/D/R);
// Scene × Reorder was only covered at the ScenePropertiesEditor unit level
// (onMoveScene callback), never wired through the panel to reorder_scenes. Two
// scenes let the active-scene move right past its neighbour.
describe("ScenePanel properties panel — scene reorder link", () => {
  const twoScenes: SceneWithChildren[] = [
    scenes[0],
    {
      scene: {
        id: "scene-impl",
        name: "编码实现",
        icon: "wrench",
        orderIndex: 1,
        visible: true,
        rolePresets: [],
        color: null,
      },
      subStages: [],
      phrases: [],
    },
  ];

  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    usePromptStore.setState({ scenes: twoScenes, pendingDraftCount: 0 });
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children")
        return Promise.resolve(twoScenes);
      return Promise.resolve({ ok: true });
    });
  });

  it("场景后移 from the properties panel invokes reorder_scenes with the swapped order", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("编辑场景属性"));
    // Active scene is the first tab (方案设计); moving it right swaps it past
    // 编码实现, so the persisted order transposes the two ids.
    fireEvent.click(screen.getByLabelText("场景后移"));
    const call = invokeMock.mock.calls.find((c) => c[0] === "reorder_scenes");
    expect(call?.[1]).toMatchObject({
      orderedIds: ["scene-impl", "scene-plan"],
    });
  });

  // Fix 5a regression: after the reorder persists and the store re-pulls the
  // swapped order, the properties panel must stay open and still point at the
  // SAME scene the user was editing. Before the fix, moving from the fallback
  // (activeSceneId === null) selection dropped the panel because the pinned id
  // did not survive the re-pull's new scenes[0].
  it("场景后移 keeps the properties panel open on the same scene after the re-pull", async () => {
    // Mock the re-pull to return the SWAPPED order (真实后端行为), so the panel
    // must survive scenes[0] changing under it.
    const swapped: SceneWithChildren[] = [twoScenes[1], twoScenes[0]];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children") return Promise.resolve(swapped);
      return Promise.resolve({ ok: true });
    });
    render(<ScenePanel />);
    // Open properties WITHOUT first clicking a tab — activeSceneId stays null,
    // exercising the fallback-selection path where the bug surfaced.
    fireEvent.click(screen.getByLabelText("编辑场景属性"));
    fireEvent.click(screen.getByLabelText("场景后移"));
    // Drive the async refreshScenes microtask, then assert the panel is still
    // mounted and the edited scene (方案设计 / scene-plan) is still active.
    await screen.findByLabelText("场景属性");
    expect(screen.getByLabelText("场景属性")).toBeInTheDocument();
    expect(screen.getByLabelText("场景名称")).toHaveValue("方案设计");
  });
});

// ── Adversarial gap 1: async failure paths ────────────────────────────────────
// A rejected update_scene / delete_scene must surface the backend message via
// showError and must NOT silently drop the panel — the user has to see why the
// save/delete failed and still have the panel to retry.
describe("ScenePanel properties panel — async failure surfaces + panel survives", () => {
  // Fake timers here, not real. toastStore.show() arms a setTimeout that resets
  // intent → "success" after the dwell, guarded by a monotonic seq. Reset the
  // toast via clear() (bumps seq) instead of setState(reset) — rewinding seq to
  // 0 is precisely what lets a leaked dwell timer from an earlier real-timer
  // block re-match the current seq and flip THIS test's error intent back to
  // success mid-poll (the historical flake). Freezing timers keeps this test's
  // own dwell callback from firing; clearAllTimers on teardown drops it before
  // real timers resume so it can never leak into a later test.
  beforeEach(() => {
    vi.useFakeTimers();
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    useToastStore.getState().clear();
    usePromptStore.setState({ scenes, pendingDraftCount: 0 });
    invokeMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("update_scene rejection keeps the panel open and shows the error", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children") return Promise.resolve(scenes);
      if (cmd === "update_scene")
        return Promise.reject(new Error("SceneNotEmpty"));
      return Promise.resolve({ ok: true });
    });
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("编辑场景属性"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    // handleSaveProperties awaits update_scene; on reject it never closes the
    // panel and routes the message through showError (toast intent "error").
    // vi.waitFor drives fake time forward to flush the rejection microtask.
    await vi.waitFor(() => {
      expect(useToastStore.getState().intent).toBe("error");
    });
    expect(screen.getByLabelText("场景属性")).toBeInTheDocument();
    expect(useToastStore.getState().message).toBeTruthy();
  });

  it("delete_scene rejection keeps the panel open and shows the error", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_scenes_with_children") return Promise.resolve(scenes);
      if (cmd === "delete_scene")
        return Promise.reject(new Error("SceneNotEmpty"));
      return Promise.resolve({ ok: true });
    });
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("编辑场景属性"));
    fireEvent.click(screen.getByLabelText("删除场景"));
    fireEvent.click(screen.getByLabelText("确认删除场景"));

    await vi.waitFor(() => {
      expect(useToastStore.getState().intent).toBe("error");
    });
    // handleDeleteScene only closes the panel on success; a reject must leave it
    // mounted so the SceneNotEmpty reason stays actionable.
    expect(screen.getByLabelText("场景属性")).toBeInTheDocument();
  });
});

// ── Adversarial gap 2: draftsActive reset ─────────────────────────────────────
// The edit-reset effect depends on [currentSceneId, draftsActive]. Switching to
// the drafts view must reset an open properties panel and any in-place editor —
// otherwise a stale editor would mutate a scene the user can no longer see.
describe("ScenePanel — switching to drafts resets open editors", () => {
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

  it("activating the drafts tab closes an open properties panel", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("编辑场景属性"));
    expect(screen.getByLabelText("场景属性")).toBeInTheDocument();
    // draftsActive flips true → the [currentSceneId, draftsActive] reset effect
    // runs and clears showProperties.
    fireEvent.click(screen.getByLabelText("草稿收件箱，1 条待审"));
    expect(screen.queryByLabelText("场景属性")).not.toBeInTheDocument();
  });

  it("activating the drafts tab cancels an in-place sub-stage rename", () => {
    render(<ScenePanel />);
    fireEvent.click(screen.getByLabelText("重命名 生成"));
    expect(screen.getAllByLabelText("子阶段名称").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByLabelText("草稿收件箱，1 条待审"));
    // The rename input is gone: the reset cleared renamingSubId, and the drafts
    // view replaces the grid entirely.
    expect(screen.queryByLabelText("子阶段名称")).not.toBeInTheDocument();
  });
});

// ── Adversarial gap 3: keyboard reachability of action clusters ────────────────
// Tasks 5/6 give every in-place action button data-nav-item + tabIndex={-1} so
// the region's roving arrow-key nav can reach them (mirrors the drafts-nav test
// above, which asserts the same markers on draft actions). Assert the SubStage
// and Phrase clusters are inside the roving sequence with the right markers.
describe("ScenePanel view grid — action clusters are roving-nav items", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    usePromptStore.setState({ scenes, pendingDraftCount: 0 });
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("sub-stage + phrase cluster buttons carry data-nav-item and tabindex -1", () => {
    const { container } = render(<ScenePanel />);
    const region = container.querySelector(
      "[data-region='scene-panel']",
    ) as HTMLElement;
    const navItems = Array.from(
      region.querySelectorAll<HTMLElement>("[data-nav-item]"),
    );
    // A representative button from each cluster must be a nav item.
    const subMove = screen.getByLabelText("后移 生成");
    const subDelete = screen.getByLabelText("删除 生成");
    const phraseMove = screen.getByLabelText("下移 设计导出模块");
    const phraseEdit = screen.getByLabelText("编辑 设计导出模块");
    for (const btn of [subMove, subDelete, phraseMove, phraseEdit]) {
      expect(navItems).toContain(btn);
      expect(btn.getAttribute("tabindex")).toBe("-1");
    }
  });
});
