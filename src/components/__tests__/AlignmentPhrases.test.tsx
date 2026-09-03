import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AlignmentPhrase } from "../../ipc/types";

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
