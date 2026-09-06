import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AlignmentAxisValueWithRefs,
  AlignmentPhrase,
} from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useAppStore } from "../../stores/appStore";
import { usePromptStore } from "../../stores/promptStore";
import { useToastStore } from "../../stores/toastStore";
import { AlignmentPhrases } from "../AlignmentPhrases";

const promptInitial = usePromptStore.getState();
const appInitial = useAppStore.getState();

function makePhrase(over: Partial<AlignmentPhrase>): AlignmentPhrase {
  return {
    id: "ap-1",
    phaseId: "phase-1",
    name: "默认协议",
    content: "请遵循协议对齐。",
    isDefault: true,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: "2026-05-23T00:00:00Z",
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

const twoPhrases: AlignmentPhrase[] = [
  makePhrase({ id: "ap-1", name: "默认协议", isDefault: true, orderIndex: 0 }),
  makePhrase({ id: "ap-2", name: "次要协议", isDefault: false, orderIndex: 1 }),
];

function seed(phrases: AlignmentPhrase[]) {
  usePromptStore.setState(promptInitial, true);
  useAppStore.setState(appInitial, true);
  usePromptStore.setState({ alignmentPhrasesByPhase: { "phase-1": phrases } });
  useAppStore.setState({ activePhaseId: "phase-1" });
  useToastStore.getState().clear();
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ ok: true });
}

describe("AlignmentPhrases — in-place editing (ADR-021)", () => {
  beforeEach(() => seed(twoPhrases));

  it("Cmd/Ctrl+Enter mid-IME-composition does not commit a new alignment phrase", () => {
    // The shared PhraseFormEditor must swallow the commit-Enter of an in-flight
    // IME composition instead of creating the phrase.
    render(<AlignmentPhrases />);
    // No global edit mode: the ghost "新增" entry opens the create editor.
    fireEvent.click(screen.getByLabelText("新增对齐话术"));
    const nameField = screen.getByPlaceholderText("名称");
    fireEvent.change(nameField, { target: { value: "新话术" } });
    fireEvent.change(screen.getByPlaceholderText("话术内容"), {
      target: { value: "话术内容" },
    });
    fireEvent.keyDown(nameField, {
      key: "Enter",
      ctrlKey: true,
      isComposing: true,
    });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_alignment_phrase"),
    ).toBeUndefined();
    // A normal Cmd/Ctrl+Enter still commits (A1-08 unified submit key).
    fireEvent.keyDown(nameField, { key: "Enter", ctrlKey: true });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_alignment_phrase"),
    ).toBeTruthy();
  });

  it("bare Enter in the name field advances focus to content, not submit (A1-08)", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("新增对齐话术"));
    const nameField = screen.getByPlaceholderText("名称");
    const contentField = screen.getByPlaceholderText("话术内容");
    fireEvent.change(nameField, { target: { value: "新话术" } });
    fireEvent.change(contentField, { target: { value: "话术内容" } });
    fireEvent.keyDown(nameField, { key: "Enter" });
    // Bare Enter must not submit — it hands off to the content textarea.
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_alignment_phrase"),
    ).toBeUndefined();
    expect(document.activeElement).toBe(contentField);
  });

  it("edits a phrase in place through the shared editor", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    const nameField = screen.getByPlaceholderText("名称");
    expect((nameField as HTMLInputElement).value).toBe("默认协议");
    fireEvent.change(nameField, { target: { value: "改名协议" } });
    fireEvent.keyDown(nameField, { key: "Enter", ctrlKey: true });
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "update_alignment_phrase",
    );
    expect(call).toBeTruthy();
    expect((call?.[1] as { name: string }).name).toBe("改名协议");
  });

  it("editing a phrase shows a success toast (A1-07)", async () => {
    useToastStore.getState().clear();
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "改名协议" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("名称"), {
      key: "Enter",
      ctrlKey: true,
    });
    await waitFor(() =>
      expect(useToastStore.getState().message).toBe("已保存对齐话术"),
    );
  });

  it("moves a phrase right via the swap button (no drag)", () => {
    render(<AlignmentPhrases />);
    // ap-1 is first; 后移 swaps it with ap-2.
    fireEvent.click(screen.getByLabelText("后移 默认协议"));
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "reorder_alignment_phrases",
    );
    expect(call).toBeTruthy();
    expect((call?.[1] as { orderedIds: string[] }).orderedIds).toEqual([
      "ap-2",
      "ap-1",
    ]);
  });

  it("only non-defaults offer set-default; sets it via the star button", () => {
    render(<AlignmentPhrases />);
    // The default (ap-1) has no set-default action; the non-default (ap-2) does.
    expect(screen.queryByLabelText("设为默认 默认协议")).toBeNull();
    fireEvent.click(screen.getByLabelText("设为默认 次要协议"));
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "set_default_alignment_phrase",
    );
    expect(call).toBeTruthy();
  });

  // ADR-028 子决策 3: the two-step「永久删除？」confirm is gone.
  it("delete fires on the first click and the toast undoes it (ADR-028)", async () => {
    invokeMock.mockImplementation((cmd: string) =>
      cmd === "list_alignment_phrases"
        ? Promise.resolve(twoPhrases)
        : Promise.resolve({ ok: true }),
    );
    render(<AlignmentPhrases />);
    expect(screen.queryByLabelText("确认永久删除")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("删除 次要协议"));
    });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_alignment_phrase"),
    ).toBeTruthy();

    const toast = useToastStore.getState();
    expect(toast.message).toBe("已删除「次要协议」");
    expect(toast.action?.label).toBe("撤销");

    await act(async () => {
      toast.action?.onClick();
    });
    const restore = invokeMock.mock.calls.find((c) => c[0] === "restore_asset");
    expect(restore?.[1]).toMatchObject({
      kind: "alignment_phrase",
      id: "ap-2",
    });
  });

  // A rejected delete removed nothing, so it must NOT offer an undo that would
  // resurrect a row which never left (the backend refuses a phase's default).
  it("a rejected delete shows an error with no 撤销", async () => {
    invokeMock.mockImplementation((cmd: string) =>
      cmd === "delete_alignment_phrase"
        ? Promise.reject(new Error("DefaultPhraseProtected"))
        : Promise.resolve({ ok: true }),
    );
    render(<AlignmentPhrases />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText("删除 次要协议"));
    });
    const toast = useToastStore.getState();
    expect(toast.intent).toBe("error");
    expect(toast.action).toBeNull();
  });
});

describe("AlignmentPhrases — re-pressing the chip while editing (G4 缺陷 O7)", () => {
  beforeEach(() => seed(twoPhrases));

  it("holds the editor open and does not copy", () => {
    const writeText = vi.mocked(navigator.clipboard.writeText);
    writeText.mockClear();
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    const chip = screen.getByRole("button", { name: "默认协议" });

    // The chip IS the anchor and its own click is copy — which would put the
    // phrase on the clipboard, and in 调用态 hide the window, out from under
    // the editor the user is still typing in.
    fireEvent.pointerDown(chip);
    fireEvent.click(chip);

    expect(screen.getByRole("group", { name: "编辑对齐话术" })).toBeTruthy();
    expect(writeText).not.toHaveBeenCalled();
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "record_usage"),
    ).toBeUndefined();
    expect(screen.getByPlaceholderText("名称")).toHaveFocus();
  });
});

// ── ADR-029 坐标 ────────────────────────────────────────────────────────────

const axisValues: AlignmentAxisValueWithRefs[] = [
  {
    id: "axv-layer-path",
    axis: "layer",
    name: "路径",
    hint: "分几期、每期做什么",
    orderIndex: 0,
    refCount: 0,
    trashedRefCount: 0,
  },
  {
    id: "axv-layer-arch",
    axis: "layer",
    name: "架构",
    hint: null,
    orderIndex: 1,
    refCount: 2,
    trashedRefCount: 3,
  },
  {
    id: "axv-domain-tech",
    axis: "domain",
    name: "技术",
    hint: null,
    orderIndex: 0,
    refCount: 0,
    trashedRefCount: 0,
  },
  {
    id: "axv-mode-converge",
    axis: "mode",
    name: "收敛",
    hint: null,
    orderIndex: 0,
    refCount: 0,
    trashedRefCount: 0,
  },
];

function seedWithAxes(phrases: AlignmentPhrase[]) {
  seed(phrases);
  usePromptStore.setState({
    alignmentAxisValues: axisValues,
    alignmentAxisValuesById: Object.fromEntries(
      axisValues.map((v) => [v.id, v]),
    ),
  });
  invokeMock.mockImplementation((cmd: string) => {
    switch (cmd) {
      case "list_alignment_axis_values":
        return Promise.resolve(axisValues);
      case "list_alignment_phrases":
        return Promise.resolve(phrases);
      default:
        return Promise.resolve({ ok: true });
    }
  });
}

describe("AlignmentPhrases — coordinates on the chip (ADR-029)", () => {
  it("renders no coordinate element at all when all three axes are NULL", () => {
    seedWithAxes(twoPhrases);
    render(<AlignmentPhrases />);
    // Pixel-identical to v0.25: the chip holds the dot, the name and the
    // (hidden) action cluster, and nothing else.
    const chip = screen.getByRole("button", { name: "默认协议" });
    expect(chip.textContent).toBe("默认协议");
  });

  it("shows the resolved names in 层 · 域 · 模式 order, after the name", () => {
    seedWithAxes([
      makePhrase({
        id: "ap-1",
        name: "架构推演",
        layerId: "axv-layer-path",
        modeId: "axv-mode-converge",
      }),
    ]);
    render(<AlignmentPhrases />);
    const chip = screen.getByRole("button", { name: "架构推演" });
    expect(chip.textContent).toBe("架构推演路径 · 收敛");
    expect(screen.getByText("路径 · 收敛")).toBeTruthy();
  });

  it("copies the coordinate prefix plus a newline plus the content", async () => {
    const writeText = vi.mocked(navigator.clipboard.writeText);
    writeText.mockClear();
    seedWithAxes([
      makePhrase({
        id: "ap-1",
        name: "架构推演",
        content: "先把边界说清楚。",
        layerId: "axv-layer-path",
        domainId: "axv-domain-tech",
        modeId: "axv-mode-converge",
      }),
    ]);
    render(<AlignmentPhrases />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "架构推演" }));
    });
    expect(writeText).toHaveBeenCalledWith(
      "本轮在路径层，只谈技术闭环，收敛模式。\n先把边界说清楚。",
    );
  });

  it("copies a zero-coordinate phrase byte-identically", async () => {
    const writeText = vi.mocked(navigator.clipboard.writeText);
    writeText.mockClear();
    seedWithAxes(twoPhrases);
    render(<AlignmentPhrases />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "默认协议" }));
    });
    expect(writeText).toHaveBeenCalledWith("请遵循协议对齐。");
  });
});

describe("AlignmentPhrases — coordinate selectors in the editor (ADR-029)", () => {
  beforeEach(() => seedWithAxes(twoPhrases));

  it("defaults all three selectors to 不限 and offers 管理… last", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    for (const label of ["层坐标", "域坐标", "模式坐标"]) {
      const select = screen.getByLabelText(label) as HTMLSelectElement;
      expect(select.value).toBe("__unconstrained__");
      expect(select.options[0].textContent).toBe("不限");
      expect(select.options[select.options.length - 1].textContent).toBe(
        "管理…",
      );
    }
    // Only that axis's values are offered: 层 has two, plus 不限 and 管理….
    expect(
      (screen.getByLabelText("层坐标") as HTMLSelectElement).options,
    ).toHaveLength(4);
    expect(
      (screen.getByLabelText("模式坐标") as HTMLSelectElement).options,
    ).toHaveLength(3);
  });

  it("sends the picked coordinates and preserves kind / cueAxis", async () => {
    seedWithAxes([
      makePhrase({ id: "ap-1", kind: "cue", cueAxis: "layer", name: "换层" }),
    ]);
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 换层"));
    fireEvent.change(screen.getByLabelText("层坐标"), {
      target: { value: "axv-layer-path" },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByPlaceholderText("名称"), {
        key: "Enter",
        ctrlKey: true,
      });
    });
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "update_alignment_phrase",
    );
    expect(call?.[1]).toMatchObject({
      // Content is untouched by a coordinate edit — the backend keeps
      // contentRevisedAt where it is (06-prd §6.6).
      content: "请遵循协议对齐。",
      coordinates: {
        kind: "cue",
        cueAxis: "layer",
        layerId: "axv-layer-path",
        domainId: null,
        modeId: null,
      },
    });
  });

  it("sends explicit nulls for the axes left at 不限", async () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    fireEvent.change(screen.getByLabelText("模式坐标"), {
      target: { value: "axv-mode-converge" },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByPlaceholderText("名称"), {
        key: "Enter",
        ctrlKey: true,
      });
    });
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "update_alignment_phrase",
    );
    expect(
      (call?.[1] as { coordinates: Record<string, unknown> }).coordinates,
    ).toEqual({
      kind: "opening",
      cueAxis: null,
      layerId: null,
      domainId: null,
      modeId: "axv-mode-converge",
    });
  });

  // ADR-025 子决策 2 的规则表 branch "nothing changed → close without an IPC"
  // reads dirty off the draft. A coordinate is part of the draft, so a change
  // confined to a selector must not fall into that branch and be dropped after
  // the user has already looked away.
  it("clicking outside saves a change made only to a coordinate", async () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    fireEvent.change(screen.getByLabelText("层坐标"), {
      target: { value: "axv-layer-path" },
    });
    await act(async () => {
      fireEvent.pointerDown(document.body);
    });
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "update_alignment_phrase",
    );
    expect(
      (call?.[1] as { coordinates: Record<string, unknown> }).coordinates,
    ).toMatchObject({ layerId: "axv-layer-path" });
  });

  it("clicking outside with nothing changed still spends no IPC", async () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    await act(async () => {
      fireEvent.pointerDown(document.body);
    });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "update_alignment_phrase"),
    ).toBeUndefined();
  });

  it("a create form starts at 不限 on every axis", async () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("新增对齐话术"));
    expect((screen.getByLabelText("层坐标") as HTMLSelectElement).value).toBe(
      "__unconstrained__",
    );
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "新档位" },
    });
    fireEvent.change(screen.getByPlaceholderText("话术内容"), {
      target: { value: "正文" },
    });
    fireEvent.change(screen.getByLabelText("域坐标"), {
      target: { value: "axv-domain-tech" },
    });
    await act(async () => {
      fireEvent.keyDown(screen.getByPlaceholderText("名称"), {
        key: "Enter",
        ctrlKey: true,
      });
    });
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "create_alignment_phrase",
    );
    expect(
      (call?.[1] as { coordinates: Record<string, unknown> }).coordinates,
    ).toEqual({
      kind: "opening",
      cueAxis: null,
      layerId: null,
      domainId: "axv-domain-tech",
      modeId: null,
    });
  });
});

describe("AlignmentPhrases — 管理… axis-value editing (ADR-029)", () => {
  beforeEach(() => seedWithAxes(twoPhrases));

  function openManager() {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    fireEvent.change(screen.getByLabelText("层坐标"), {
      target: { value: "__manage__" },
    });
  }

  it("opens inside the same anchored panel and leaves the coordinate alone", () => {
    openManager();
    const panel = screen.getByRole("group", { name: "编辑对齐话术" });
    const manager = screen.getByRole("group", { name: "管理层取值" });
    // No second modal: the list editor is a descendant of the phrase editor.
    expect(panel.contains(manager)).toBe(true);
    // 管理… is an action, not a value — the selector snaps back to 不限.
    expect((screen.getByLabelText("层坐标") as HTMLSelectElement).value).toBe(
      "__unconstrained__",
    );
  });

  it("deletes through ConfirmInline, printing refCount even when it is 0", async () => {
    openManager();
    fireEvent.click(screen.getByLabelText("删除 路径"));
    expect(
      screen.getByText(
        "删除『路径』？0 条话术的『层』坐标将被清空，删除后无法恢复",
      ),
    ).toBeTruthy();
    // Nothing has been written yet — the confirm is the whole point.
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_alignment_axis_value"),
    ).toBeUndefined();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("确认删除"));
    });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_alignment_axis_value"),
    ).toBeTruthy();
    // The delete blanks coordinates server-side, so the phrases are re-pulled.
    expect(
      invokeMock.mock.calls.filter((c) => c[0] === "list_alignment_phrases")
        .length,
    ).toBeGreaterThan(0);
  });

  it("appends the trashed count when it is above zero", () => {
    openManager();
    fireEvent.click(screen.getByLabelText("删除 架构"));
    expect(
      screen.getByText(
        "删除『架构』？2 条话术的『层』坐标将被清空，删除后无法恢复。废纸篓里另有 3 条",
      ),
    ).toBeTruthy();
  });

  it("cancelling the confirm writes nothing", () => {
    openManager();
    fireEvent.click(screen.getByLabelText("删除 路径"));
    fireEvent.click(screen.getByLabelText("取消"));
    expect(screen.getByLabelText("删除 路径")).toBeTruthy();
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_alignment_axis_value"),
    ).toBeUndefined();
  });

  it("←/→ swap two adjacent values within the axis", async () => {
    openManager();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("后移 路径"));
    });
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "reorder_alignment_axis_values",
    );
    expect(call?.[1]).toMatchObject({
      axis: "layer",
      orderedIds: ["axv-layer-arch", "axv-layer-path"],
    });
  });

  it("renames a value on blur, always sending the hint alongside", async () => {
    openManager();
    const nameField = screen.getByLabelText("路径 名称");
    fireEvent.change(nameField, { target: { value: "实施路径" } });
    await act(async () => {
      fireEvent.blur(nameField);
    });
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "update_alignment_axis_value",
    );
    expect(call?.[1]).toMatchObject({
      id: "axv-layer-path",
      name: "实施路径",
      hint: "分几期、每期做什么",
    });
  });

  // A1-08: ⌘Enter means "save the phrase" everywhere, and that does not lapse
  // because the caret is in the axis-value sub-panel. Claiming it here would
  // add an axis value at the exact moment the user asked to commit the draft.
  it("⌘Enter in the add row does not create an axis value", async () => {
    openManager();
    const nameField = screen.getByLabelText("新增层取值名称");
    fireEvent.change(nameField, { target: { value: "判据" } });
    await act(async () => {
      fireEvent.keyDown(nameField, { key: "Enter", metaKey: true });
    });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_alignment_axis_value"),
    ).toBeUndefined();
    // Plain Enter still means "add" — the modifier is the whole difference.
    await act(async () => {
      fireEvent.keyDown(nameField, { key: "Enter" });
    });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_alignment_axis_value"),
    ).toBeTruthy();
  });

  it("⌘Enter in a value row does not commit that row", async () => {
    openManager();
    const nameField = screen.getByLabelText("路径 名称");
    fireEvent.change(nameField, { target: { value: "实施路径" } });
    await act(async () => {
      fireEvent.keyDown(nameField, { key: "Enter", metaKey: true });
    });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "update_alignment_axis_value"),
    ).toBeUndefined();
    // Plain Enter blurs, and the blur is what commits the rename.
    await act(async () => {
      fireEvent.keyDown(nameField, { key: "Enter" });
      fireEvent.blur(nameField);
    });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "update_alignment_axis_value"),
    ).toBeTruthy();
  });

  it("adds a value to the axis it was opened for", async () => {
    openManager();
    fireEvent.change(screen.getByLabelText("新增层取值名称"), {
      target: { value: "判据" },
    });
    fireEvent.change(screen.getByLabelText("新增层取值说明"), {
      target: { value: "怎么算做成了" },
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("添加层取值"));
    });
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "create_alignment_axis_value",
    );
    expect(call?.[1]).toMatchObject({
      axis: "layer",
      name: "判据",
      hint: "怎么算做成了",
    });
  });
});
