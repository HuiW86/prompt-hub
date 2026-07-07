import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AlignmentPhrase } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useAppStore } from "../../stores/appStore";
import { usePromptStore } from "../../stores/promptStore";
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
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ ok: true });
}

describe("AlignmentPhrases — in-place editing (ADR-021)", () => {
  beforeEach(() => seed(twoPhrases));

  it("Enter mid-IME-composition does not commit a new alignment phrase", () => {
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
    fireEvent.keyDown(nameField, { key: "Enter", isComposing: true });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_alignment_phrase"),
    ).toBeUndefined();
    // A normal Enter still commits.
    fireEvent.keyDown(nameField, { key: "Enter" });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_alignment_phrase"),
    ).toBeTruthy();
  });

  it("edits a phrase in place through the shared editor", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    const nameField = screen.getByPlaceholderText("名称");
    expect((nameField as HTMLInputElement).value).toBe("默认协议");
    fireEvent.change(nameField, { target: { value: "改名协议" } });
    fireEvent.keyDown(nameField, { key: "Enter" });
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "update_alignment_phrase",
    );
    expect(call).toBeTruthy();
    expect((call?.[1] as { name: string }).name).toBe("改名协议");
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

  it("delete is a two-step inline confirm", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("删除 次要协议"));
    // No delete fired yet — the confirm affordance is shown first.
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_alignment_phrase"),
    ).toBeUndefined();
    fireEvent.click(screen.getByLabelText("确认永久删除"));
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_alignment_phrase"),
    ).toBeTruthy();
  });
});
