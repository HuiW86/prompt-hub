import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Macro } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { usePromptStore } from "../../stores/promptStore";
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

describe("MacroGrid — editor IME guard", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({ macros });
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
    fireEvent.keyDown(nameField, { key: "Enter", isComposing: true });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_macro"),
    ).toBeUndefined();
    // A normal Enter still commits.
    fireEvent.keyDown(nameField, { key: "Enter" });
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "create_macro"),
    ).toBeTruthy();
  });
});
