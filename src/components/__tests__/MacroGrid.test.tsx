import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Macro } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { usePromptStore } from "../../stores/promptStore";
import { useToastStore } from "../../stores/toastStore";
import { MacroGrid } from "../MacroGrid";

const promptInitial = usePromptStore.getState();

const macros: Macro[] = [
  {
    id: "macro-1",
    name: "生成测试",
    content: "为该模块补充单元测试。",
    expandFrom: null,
    native: false,
    role: null,
    task: null,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: "2026-05-23T00:00:00Z",
    notes: null,
    sceneId: null,
    deprecated: false,
    orderIndex: 0,
  },
];

const call = (name: string) => invokeMock.mock.calls.find((c) => c[0] === name);

describe("MacroGrid — editor IME guard", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({ macros });
    useToastStore.getState().clear();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("Enter mid-IME-composition does not commit a new Macro", () => {
    // Fix 1: committing a pinyin candidate fires Enter with isComposing still
    // true — the name field must swallow it instead of creating the Macro.
    render(<MacroGrid />);
    fireEvent.click(screen.getByLabelText("新增 Macro"));
    const nameField = screen.getByPlaceholderText("名称");
    fireEvent.change(nameField, { target: { value: "新宏" } });
    fireEvent.change(screen.getByPlaceholderText("内容"), {
      target: { value: "宏内容" },
    });
    fireEvent.keyDown(nameField, {
      key: "Enter",
      metaKey: true,
      isComposing: true,
    });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_macro"),
    ).toBeUndefined();
    // A normal Cmd+Enter still commits.
    fireEvent.keyDown(nameField, { key: "Enter", metaKey: true });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_macro"),
    ).toBeTruthy();
  });

  it("bare Enter in the name field advances instead of committing", () => {
    // ADR-025 P1-b folded this surface into the shared PhraseFormEditor, so
    // Macro adopts A1-08's unified submit key: ⌘Enter commits from either
    // field, a lone Enter in the name advances to the body. The hand-rolled
    // form used to save on bare Enter, which could persist a Macro whose body
    // the user had not written yet.
    render(<MacroGrid />);
    fireEvent.click(screen.getByLabelText("新增 Macro"));
    const nameField = screen.getByPlaceholderText("名称");
    const contentField = screen.getByPlaceholderText("内容");
    fireEvent.change(nameField, { target: { value: "新宏" } });
    fireEvent.change(contentField, { target: { value: "宏内容" } });

    fireEvent.keyDown(nameField, { key: "Enter" });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_macro"),
    ).toBeUndefined();
    expect(document.activeElement).toBe(contentField);
  });
});

// P1-b folded this surface into the shared anchored editor, so the 子决策 2 rule
// table now governs it too. Before the migration an outside click threw the
// draft away and Escape did so silently — neither was ever a decision the user
// made about their text.
describe("MacroGrid — anchored editor rules (ADR-025 子决策 2)", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({ macros });
    useToastStore.getState().clear();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  const fillCreateForm = () => {
    fireEvent.click(screen.getByLabelText("新增 Macro"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "新宏" },
    });
    fireEvent.change(screen.getByPlaceholderText("内容"), {
      target: { value: "宏内容" },
    });
  };

  it("clicking outside saves the draft rather than dropping it", async () => {
    render(<MacroGrid />);
    fillCreateForm();

    fireEvent.pointerDown(document.body);

    await waitFor(() => expect(call("create_macro")).toBeTruthy());
  });

  it("clicking outside an incomplete draft holds the panel open", () => {
    render(<MacroGrid />);
    fireEvent.click(screen.getByLabelText("新增 Macro"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "只有名字" },
    });

    fireEvent.pointerDown(document.body);

    // Half a Macro cannot be saved, and looking away is not a decision to throw
    // it out — the panel stays up and points at the gap.
    expect(screen.getByRole("group", { name: "新增 Macro" })).toBeTruthy();
    expect(call("create_macro")).toBeUndefined();
  });

  it("Escape on a dirty create draft offers an undo that restores the text", () => {
    render(<MacroGrid />);
    fillCreateForm();

    fireEvent.keyDown(document, { key: "Escape", bubbles: true });
    expect(screen.queryByRole("group", { name: "新增 Macro" })).toBeNull();
    expect(call("create_macro")).toBeUndefined();

    // The text exists nowhere else, so the toast is the only route back to it.
    const undo = useToastStore.getState().action;
    expect(undo?.label).toBe("撤销");
    act(() => undo?.onClick());

    expect(screen.getByPlaceholderText("名称")).toHaveValue("新宏");
    expect(screen.getByPlaceholderText("内容")).toHaveValue("宏内容");
  });
});

describe("MacroGrid — re-pressing 新增 while its editor is open (G4 缺陷 O7)", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({ macros });
    useToastStore.getState().clear();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("keeps the single editor open with focus still inside it", () => {
    render(<MacroGrid />);
    const trigger = screen.getByLabelText("新增 Macro");
    const reachedTrigger = vi.fn();
    trigger.addEventListener("click", reachedTrigger);
    fireEvent.click(trigger);
    expect(screen.getByPlaceholderText("名称")).toHaveFocus();
    reachedTrigger.mockClear();

    // The button's onClick re-sets the same create target, so React keeps the
    // very same panel mounted — there is no toggle to fall back on. On a
    // release build the press instead moved focus onto the button (tabIndex
    // -1), losing every subsequent keystroke and handing Escape to the window.
    // jsdom runs no mousedown default action, so that focus loss is staged by
    // hand; the swallowed click is the half it can observe directly.
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);

    expect(reachedTrigger).not.toHaveBeenCalled();
    expect(screen.getAllByRole("group", { name: "新增 Macro" })).toHaveLength(
      1,
    );
    const panel = screen.getByRole("group", { name: "新增 Macro" });
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(screen.getByPlaceholderText("名称")).toHaveFocus();
  });
});

// ADR-028 子决策 3: the per-card「永久删除？」confirm is gone — delete fires on the
// first click, and the toast is the only thing standing between the user and a
// mistake, so it has to actually put the macro back.
describe("MacroGrid — one-click delete with undo (ADR-028)", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({ macros });
    useToastStore.getState().clear();
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) =>
      cmd === "list_macros"
        ? Promise.resolve(macros)
        : Promise.resolve({ ok: true }),
    );
  });

  it("deletes on the first click and the toast restores the macro", async () => {
    render(<MacroGrid />);
    expect(screen.queryByLabelText("确认永久删除")).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("删除 生成测试"));
    });
    expect(call("delete_macro")?.[1]).toMatchObject({ id: "macro-1" });
    // The optimistic removal took the card off the grid straight away.
    expect(screen.queryByLabelText("生成测试")).toBeNull();
    // ADR-028 子决策 5: the Recent list resolves usage rows against live assets,
    // so a delete silently changes what belongs in it. Without this re-pull the
    // deleted macro keeps a line there until the next full reload, which is the
    // 「（未知话术）」 tombstone the sub-decision exists to remove.
    expect(call("list_recent_usage")).toBeDefined();

    const toast = useToastStore.getState();
    expect(toast.message).toBe("已删除「生成测试」");
    expect(toast.action?.label).toBe("撤销");

    await act(async () => {
      toast.action?.onClick();
    });
    expect(call("restore_asset")?.[1]).toMatchObject({
      kind: "macro",
      id: "macro-1",
    });
    await waitFor(() => {
      expect(screen.getByLabelText("生成测试")).toBeInTheDocument();
    });
  });

  it("a rejected delete rolls the card back and offers no 撤销", async () => {
    invokeMock.mockImplementation((cmd: string) =>
      cmd === "delete_macro"
        ? Promise.reject(new Error("boom"))
        : Promise.resolve({ ok: true }),
    );
    render(<MacroGrid />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText("删除 生成测试"));
    });
    const toast = useToastStore.getState();
    expect(toast.intent).toBe("error");
    expect(toast.action).toBeNull();
    expect(screen.getByLabelText("生成测试")).toBeInTheDocument();
  });
});
