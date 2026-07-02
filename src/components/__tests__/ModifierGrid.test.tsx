import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Modifier } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { usePromptStore } from "../../stores/promptStore";
import { ModifierGrid } from "../ModifierGrid";

const promptInitial = usePromptStore.getState();

// One modifier per test: the P3-6 minimal management entry (quadrant move +
// delete) is the promote-remedy path — ADR-015 decision iii picks the quadrant
// at promote time, and this cluster is the only way to fix a wrong pick.
const modifiers: Modifier[] = [
  {
    id: "mod-structured",
    name: "结构化输出",
    content: "请用要点列表回答",
    groupKind: "delivery",
    usageCount: 0,
    lastUsedAt: null,
    createdAt: "2026-05-23T00:00:00Z",
    notes: null,
    deprecated: false,
    orderIndex: 0,
  },
];

describe("ModifierGrid — P3-6 minimal management entry", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({ modifiers });
    invokeMock.mockReset();
    invokeMock.mockResolvedValue({ ok: true });
  });

  it("moving a chip offers only the OTHER three quadrants and sends groupKind", () => {
    render(<ModifierGrid />);
    fireEvent.click(screen.getByLabelText("移动 结构化输出 到其他象限"));
    // The current quadrant (产出形态 = delivery) is not a move target.
    expect(screen.queryByText("产出形态")).not.toBeNull(); // group header stays
    const menu = screen.getByLabelText("选择 结构化输出 的目标象限");
    expect(menu).toBeInTheDocument();
    expect(menu.querySelectorAll("button")).toHaveLength(3);

    fireEvent.click(screen.getByText("认知前置"));
    const call = invokeMock.mock.calls.find((c) => c[0] === "update_modifier");
    expect(call?.[1]).toMatchObject({
      id: "mod-structured",
      name: "结构化输出",
      content: "请用要点列表回答",
      groupKind: "cognition",
    });
  });

  it("delete asks for confirmation before invoking delete_modifier", () => {
    render(<ModifierGrid />);
    fireEvent.click(screen.getByLabelText("删除 结构化输出"));
    expect(
      invokeMock.mock.calls.find((c) => c[0] === "delete_modifier"),
    ).toBeUndefined();
    fireEvent.click(screen.getByLabelText("确认永久删除 结构化输出"));
    const call = invokeMock.mock.calls.find((c) => c[0] === "delete_modifier");
    expect(call?.[1]).toMatchObject({ id: "mod-structured" });
  });
});
