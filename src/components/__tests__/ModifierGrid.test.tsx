import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Modifier } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { usePromptStore } from "../../stores/promptStore";
import { ModifierGrid } from "../ModifierGrid";

function mod(
  over: Partial<Modifier> & Pick<Modifier, "id" | "name">,
): Modifier {
  return {
    content: "body",
    groupKind: "cognition",
    usageCount: 0,
    lastUsedAt: null,
    createdAt: "2026-05-23T00:00:00Z",
    notes: null,
    deprecated: false,
    orderIndex: 0,
    ...over,
  };
}

const initialPrompt = usePromptStore.getState();

const createModifier = vi.fn();
const updateModifier = vi.fn();
const deleteModifier = vi.fn();
const reorderModifiers = vi.fn();

beforeEach(() => {
  usePromptStore.setState(initialPrompt, true);
  createModifier.mockReset().mockResolvedValue(undefined);
  updateModifier.mockReset().mockResolvedValue(undefined);
  deleteModifier.mockReset().mockResolvedValue(undefined);
  reorderModifiers.mockReset().mockResolvedValue(undefined);
  usePromptStore.setState({
    modifiers: [
      mod({ id: "m1", name: "结构化输出", groupKind: "cognition" }),
      mod({ id: "m2", name: "分步执行", groupKind: "action" }),
    ],
    loadState: "ready",
    createModifier,
    updateModifier,
    deleteModifier,
    reorderModifiers,
  });
});

describe("ModifierGrid", () => {
  it("renders the region landmark and all four quadrant headers", () => {
    const { container } = render(<ModifierGrid />);
    expect(
      container.querySelector("[data-region='modifier-grid']"),
    ).not.toBeNull();
    expect(screen.getByText("认知")).toBeInTheDocument();
    expect(screen.getByText("行动")).toBeInTheDocument();
    expect(screen.getByText("交付")).toBeInTheDocument();
    expect(screen.getByText("约束")).toBeInTheDocument();
  });

  it("places each modifier under its groupKind quadrant", () => {
    render(<ModifierGrid />);
    expect(screen.getByText("结构化输出")).toBeInTheDocument();
    expect(screen.getByText("分步执行")).toBeInTheDocument();
  });

  it("creates a modifier with the groupKind of the triggering quadrant", async () => {
    render(<ModifierGrid />);
    fireEvent.click(screen.getByLabelText("新增交付 Modifier"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "  Markdown 表格  " },
    });
    fireEvent.change(screen.getByPlaceholderText("内容"), {
      target: { value: "用表格输出" },
    });
    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    await waitFor(() => expect(createModifier).toHaveBeenCalledTimes(1));
    expect(createModifier).toHaveBeenCalledWith({
      name: "Markdown 表格",
      content: "用表格输出",
      groupKind: "delivery",
    });
  });

  it("edits an existing modifier preserving its id", async () => {
    render(<ModifierGrid />);
    fireEvent.click(screen.getByLabelText("编辑 结构化输出"));
    const nameInput = screen.getByDisplayValue("结构化输出");
    fireEvent.change(nameInput, { target: { value: "结构化 JSON" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(updateModifier).toHaveBeenCalledTimes(1));
    expect(updateModifier).toHaveBeenCalledWith(
      expect.objectContaining({ id: "m1", name: "结构化 JSON" }),
    );
  });

  it("requires confirmation before deleting", async () => {
    render(<ModifierGrid />);
    fireEvent.click(screen.getByLabelText("删除 结构化输出"));
    expect(deleteModifier).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("确认永久删除"));
    await waitFor(() => expect(deleteModifier).toHaveBeenCalledWith("m1"));
  });

  it("disallows saving with a blank name", () => {
    render(<ModifierGrid />);
    fireEvent.click(screen.getByLabelText("新增认知 Modifier"));
    fireEvent.change(screen.getByPlaceholderText("内容"), {
      target: { value: "只有内容" },
    });
    expect(screen.getByRole("button", { name: "新增" })).toBeDisabled();
    expect(createModifier).not.toHaveBeenCalled();
  });
});
