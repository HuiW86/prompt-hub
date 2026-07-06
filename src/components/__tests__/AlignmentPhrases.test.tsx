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

const phrases: AlignmentPhrase[] = [
  {
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
  },
];

describe("AlignmentPhrases — editor IME guard", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useAppStore.setState(appInitial, true);
    usePromptStore.setState({
      alignmentPhrasesByPhase: { "phase-1": phrases },
    });
    useAppStore.setState({ activePhaseId: "phase-1" });
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("Enter mid-IME-composition does not commit a new alignment phrase", () => {
    // Fix 1: the PhraseEditor name field must swallow the commit-Enter of an
    // in-flight IME composition instead of creating the phrase.
    render(<AlignmentPhrases />);
    // Enter edit mode, then open the create editor.
    fireEvent.click(screen.getByLabelText("管理对齐话术"));
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
});
