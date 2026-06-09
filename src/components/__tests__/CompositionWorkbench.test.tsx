import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Composition, Modifier } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useAppStore } from "../../stores/appStore";
import { usePromptStore } from "../../stores/promptStore";
import { CompositionWorkbench } from "../CompositionWorkbench";

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

function comp(
  over: Partial<Composition> & Pick<Composition, "id" | "name">,
): Composition {
  return {
    modifierIds: [],
    phaseId: "phase-explore",
    sceneId: null,
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
const initialApp = useAppStore.getState();

const createComposition = vi.fn();
const updateComposition = vi.fn();
const deleteComposition = vi.fn();
const reorderCompositions = vi.fn();

beforeEach(() => {
  usePromptStore.setState(initialPrompt, true);
  useAppStore.setState(initialApp, true);
  createComposition.mockReset().mockResolvedValue(undefined);
  updateComposition.mockReset().mockResolvedValue(undefined);
  deleteComposition.mockReset().mockResolvedValue(undefined);
  reorderCompositions.mockReset().mockResolvedValue(undefined);
  useAppStore.setState({ activePhaseId: "phase-explore" });
  usePromptStore.setState({
    modifiers: [
      mod({ id: "m1", name: "结构化输出" }),
      mod({ id: "m2", name: "分步执行" }),
    ],
    compositionsByPhase: {
      "phase-explore": [
        comp({ id: "c1", name: "发散三件套", modifierIds: ["m1"] }),
      ],
    },
    loadState: "ready",
    createComposition,
    updateComposition,
    deleteComposition,
    reorderCompositions,
  });
});

describe("CompositionWorkbench", () => {
  it("renders the region landmark and existing compositions for the active phase", () => {
    const { container } = render(<CompositionWorkbench />);
    expect(
      container.querySelector("[data-region='composition-workbench']"),
    ).not.toBeNull();
    expect(screen.getByText("发散三件套")).toBeInTheDocument();
    expect(screen.getByText("1 材料")).toBeInTheDocument();
  });

  it("shows the no-phase empty state when no phase is active", () => {
    useAppStore.setState({ activePhaseId: null });
    render(<CompositionWorkbench />);
    expect(screen.getByText("未选相位")).toBeInTheDocument();
  });

  it("creates a composition with the picked modifierIds in selection order", async () => {
    render(<CompositionWorkbench />);
    fireEvent.click(screen.getByLabelText("新增 Composition"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "  新组合  " },
    });
    // Pool offers the two modifiers; pick m2 then m1 so order is [m2, m1].
    fireEvent.click(screen.getByLabelText("加入 分步执行"));
    fireEvent.click(screen.getByLabelText("加入 结构化输出"));
    fireEvent.click(screen.getByRole("button", { name: "新增" }));
    await waitFor(() => expect(createComposition).toHaveBeenCalledTimes(1));
    expect(createComposition).toHaveBeenCalledWith({
      phaseId: "phase-explore",
      name: "新组合",
      modifierIds: ["m2", "m1"],
    });
  });

  it("cannot save a composition with no modifiers selected", () => {
    render(<CompositionWorkbench />);
    fireEvent.click(screen.getByLabelText("新增 Composition"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "空组合" },
    });
    expect(screen.getByRole("button", { name: "新增" })).toBeDisabled();
    expect(createComposition).not.toHaveBeenCalled();
  });

  it("edits an existing composition preserving its id", async () => {
    render(<CompositionWorkbench />);
    fireEvent.click(screen.getByLabelText("编辑 发散三件套"));
    fireEvent.change(screen.getByDisplayValue("发散三件套"), {
      target: { value: "发散四件套" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(updateComposition).toHaveBeenCalledTimes(1));
    expect(updateComposition).toHaveBeenCalledWith(
      expect.objectContaining({ id: "c1", name: "发散四件套" }),
    );
  });

  it("requires confirmation before deleting", async () => {
    render(<CompositionWorkbench />);
    fireEvent.click(screen.getByLabelText("删除 发散三件套"));
    expect(deleteComposition).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("确认永久删除"));
    await waitFor(() => expect(deleteComposition).toHaveBeenCalledWith("c1"));
  });
});
