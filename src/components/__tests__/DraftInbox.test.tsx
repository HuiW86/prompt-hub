import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  Draft,
  DraftPayload,
  DraftSummary,
  DraftTargetType,
} from "../../ipc/types";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({ ok: true }),
}));

import { invoke } from "@tauri-apps/api/core";

import { usePromptStore } from "../../stores/promptStore";
import { useToastStore } from "../../stores/toastStore";
import { DraftInbox } from "../DraftInbox";

const promptInitial = usePromptStore.getState();

function makeDraft(
  targetType: DraftTargetType,
  overrides: Partial<DraftSummary> = {},
): DraftSummary {
  return {
    id: `draft-${targetType}`,
    targetType,
    name: `示例 ${targetType}`,
    preview: "预览内容",
    toolName: "mcp:create_draft",
    status: "pending",
    createdAt: "2026-06-30T00:00:00Z",
    ...overrides,
  };
}

// Locate a draft's card by its rendered name within the inbox list.
function cardOf(draft: DraftSummary) {
  const card = screen
    .getAllByRole("listitem")
    .find((el) => within(el).queryByText(draft.name));
  if (!card) throw new Error(`card not found for ${draft.name}`);
  return card;
}

describe("DraftInbox — composition promote stopgap (P0-5)", () => {
  const promoteDraft = vi.fn().mockResolvedValue(undefined);
  const discardDraft = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({
      drafts: [
        makeDraft("composition"),
        makeDraft("macro"),
        makeDraft("alignment_phrase"),
        makeDraft("modifier"),
      ],
      promoteDraft,
      discardDraft,
    });
    promoteDraft.mockClear();
    discardDraft.mockClear();
  });

  it("disables promote for composition drafts and shows the blocked hint", () => {
    render(<DraftInbox />);
    const card = cardOf(makeDraft("composition"));
    const promote = within(card).getByRole("button", { name: /归档/ });
    expect(promote).toBeDisabled();
    expect(promote).toHaveAttribute("title", "该类型暂无 UI 承载");
    expect(within(card).getByText("该类型暂无 UI 承载")).toBeInTheDocument();
    // Even a programmatic click must never reach the store.
    fireEvent.click(promote);
    expect(promoteDraft).not.toHaveBeenCalled();
  });

  it("keeps discard available for composition drafts", () => {
    render(<DraftInbox />);
    const card = cardOf(makeDraft("composition"));
    const discard = within(card).getByRole("button", { name: /丢弃/ });
    expect(discard).toBeEnabled();
    fireEvent.click(discard);
    expect(discardDraft).toHaveBeenCalledWith("draft-composition");
  });

  it("still promotes macro and alignment_phrase drafts straight through", () => {
    render(<DraftInbox />);
    for (const type of ["macro", "alignment_phrase"] as const) {
      const card = cardOf(makeDraft(type));
      const promote = within(card).getByRole("button", { name: /归档/ });
      expect(promote).toBeEnabled();
      expect(promote).not.toHaveAttribute("title");
      fireEvent.click(promote);
    }
    expect(promoteDraft).toHaveBeenCalledTimes(2);
    expect(promoteDraft).toHaveBeenCalledWith({
      id: "draft-macro",
      groupKind: undefined,
    });
    expect(promoteDraft).toHaveBeenCalledWith({
      id: "draft-alignment_phrase",
      groupKind: undefined,
    });
  });

  it("still opens the four-quadrant picker for modifier drafts", () => {
    render(<DraftInbox />);
    const card = cardOf(makeDraft("modifier"));
    const promote = within(card).getByRole("button", { name: /归档/ });
    expect(promote).toBeEnabled();
    fireEvent.click(promote);
    // Picker toggles open instead of promoting directly.
    expect(promoteDraft).not.toHaveBeenCalled();
    const picker = within(card).getByRole("group", {
      name: "选择四象限分类",
    });
    fireEvent.click(within(picker).getByRole("button", { name: "认知" }));
    expect(promoteDraft).toHaveBeenCalledWith({
      id: "draft-modifier",
      groupKind: "cognition",
    });
  });
});

describe("DraftInbox — error feedback (P1-3)", () => {
  const promoteDraft = vi.fn().mockResolvedValue(undefined);
  // Reject with a raw English IO-flavoured string, the shape that used to leak
  // straight into the toast before toUserMessage() funnelled catch sites.
  const discardDraft = vi
    .fn()
    .mockRejectedValue(new Error("io: some backend failure (os error 5)"));

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    useToastStore.getState().clear();
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({
      drafts: [makeDraft("macro")],
      promoteDraft,
      discardDraft,
    });
    discardDraft.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the Chinese fallback, never the raw English message", async () => {
    render(<DraftInbox />);
    const card = cardOf(makeDraft("macro"));
    fireEvent.click(within(card).getByRole("button", { name: /丢弃/ }));

    // Wait for the rejected mutation's catch to land on the toast store.
    await vi.waitFor(() => {
      expect(useToastStore.getState().message).toBe("丢弃失败");
    });
    const toast = useToastStore.getState();
    expect(toast.intent).toBe("error");
    expect(toast.message).not.toContain("os error");
  });
});

describe("DraftInbox — promote 前编辑 (P3-2)", () => {
  const promoteDraft = vi.fn().mockResolvedValue(undefined);
  const discardDraft = vi.fn().mockResolvedValue(undefined);
  const updateDraft = vi.fn().mockResolvedValue(undefined);

  // Longer than the 80-char list preview: the editor must show THIS (hydrated
  // via get_draft), never the lossy summary preview.
  const FULL_CONTENT = `完整内容——${"长".repeat(100)}`;

  const modifierPayload: DraftPayload = {
    target_type: "modifier",
    schema_version: 1,
    name: "示例 modifier",
    content: FULL_CONTENT,
    phase_id: "phase-1",
    scene_id: null,
  };

  const fullDraft: Draft = {
    id: "draft-modifier",
    targetType: "modifier",
    schemaVersion: 1,
    payload: modifierPayload,
    payloadHash: "hash",
    provenance: {
      sourceApp: "Claude Code",
      conversationRef: "conv-1",
      toolName: "mcp:create_draft",
      modelHint: null,
      confidence: null,
    },
    status: "pending",
    createdAt: "2026-06-30T00:00:00Z",
    updatedAt: "2026-06-30T00:00:00Z",
  };

  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({
      drafts: [makeDraft("modifier"), makeDraft("composition")],
      promoteDraft,
      discardDraft,
      updateDraft,
    });
    promoteDraft.mockClear();
    discardDraft.mockClear();
    updateDraft.mockClear();
    vi.mocked(invoke).mockImplementation((cmd: string) =>
      cmd === "get_draft"
        ? Promise.resolve(fullDraft)
        : Promise.resolve({ ok: true }),
    );
  });

  it("disables edit for composition drafts (same stopgap as promote)", () => {
    render(<DraftInbox />);
    const card = cardOf(makeDraft("composition"));
    const edit = within(card).getByRole("button", { name: /编辑/ });
    expect(edit).toBeDisabled();
    expect(edit).toHaveAttribute("title", "该类型暂无 UI 承载");
    fireEvent.click(edit);
    expect(vi.mocked(invoke)).not.toHaveBeenCalledWith(
      "get_draft",
      expect.anything(),
    );
  });

  it("hydrates the full payload, saves via updateDraft and preserves hidden fields", async () => {
    render(<DraftInbox />);
    const card = cardOf(makeDraft("modifier"));
    fireEvent.click(within(card).getByRole("button", { name: /编辑/ }));

    const editor = await within(card).findByRole("group", {
      name: "编辑草稿",
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith("get_draft", {
      id: "draft-modifier",
    });
    // Editor starts from the FULL stored content, not the 80-char preview.
    const content = within(editor).getByPlaceholderText("内容");
    expect(content).toHaveValue(FULL_CONTENT);
    // No four-quadrant surface inside the edit flow (ADR-015 决策 iii: the
    // quadrant is chosen by the human at promote time, never carried in edit).
    expect(
      within(card).queryByRole("group", { name: "选择四象限分类" }),
    ).not.toBeInTheDocument();

    fireEvent.change(within(editor).getByPlaceholderText("名称"), {
      target: { value: "改名后" },
    });
    fireEvent.change(content, { target: { value: "改写后的内容" } });
    fireEvent.click(within(editor).getByRole("button", { name: "保存" }));

    expect(updateDraft).toHaveBeenCalledWith({
      id: "draft-modifier",
      payload: {
        target_type: "modifier",
        schema_version: 1,
        name: "改名后",
        content: "改写后的内容",
        phase_id: "phase-1",
        scene_id: null,
      },
    });
    const sentPayload = updateDraft.mock.calls[0][0].payload;
    expect(sentPayload).not.toHaveProperty("group_kind");
    // Editor closes after a successful save (preview body comes back).
    expect(await within(card).findByText("预览内容")).toBeInTheDocument();
    expect(
      within(card).queryByRole("group", { name: "编辑草稿" }),
    ).not.toBeInTheDocument();
  });

  it("Enter mid-IME-composition does not commit a draft edit", async () => {
    // Fix 1: committing a pinyin/kana candidate fires Enter with isComposing
    // still true — the name field must swallow it instead of saving.
    render(<DraftInbox />);
    const card = cardOf(makeDraft("modifier"));
    fireEvent.click(within(card).getByRole("button", { name: /编辑/ }));
    const editor = await within(card).findByRole("group", {
      name: "编辑草稿",
    });
    const nameField = within(editor).getByPlaceholderText("名称");
    fireEvent.change(nameField, { target: { value: "改名" } });
    fireEvent.keyDown(nameField, { key: "Enter", isComposing: true });
    expect(updateDraft).not.toHaveBeenCalled();
    // A normal Enter (no composition) still commits.
    fireEvent.keyDown(nameField, { key: "Enter" });
    expect(updateDraft).toHaveBeenCalled();
  });

  it("cancel closes the editor without saving", async () => {
    render(<DraftInbox />);
    const card = cardOf(makeDraft("modifier"));
    fireEvent.click(within(card).getByRole("button", { name: /编辑/ }));

    const editor = await within(card).findByRole("group", {
      name: "编辑草稿",
    });
    fireEvent.click(within(editor).getByRole("button", { name: "取消" }));

    expect(updateDraft).not.toHaveBeenCalled();
    expect(
      within(card).queryByRole("group", { name: "编辑草稿" }),
    ).not.toBeInTheDocument();
    expect(within(card).getByText("预览内容")).toBeInTheDocument();
  });
});
