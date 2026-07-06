import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Phase } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { usePromptStore } from "../../stores/promptStore";
import { PhaseBar } from "../PhaseBar";

const promptInitial = usePromptStore.getState();

const phases: Phase[] = [
  {
    id: "phase-plan",
    name: "规划",
    orderIndex: 0,
    color: null,
    description: null,
    visible: true,
    defaultAlignmentPhraseId: null,
  },
  {
    id: "phase-build",
    name: "构建",
    orderIndex: 1,
    color: null,
    description: null,
    visible: true,
    defaultAlignmentPhraseId: null,
  },
];

describe("PhaseBar — region roving navigation (P0-1)", () => {
  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({ phases });
    invokeMock.mockReset();
  });

  it("region container focus + ArrowRight moves focus to the first pill", () => {
    const { container } = render(<PhaseBar />);
    const region = container.querySelector(
      "[data-region='phase-bar']",
    ) as HTMLElement;
    // B5-5 contract: the region container is the single Tab stop (tabIndex 0).
    expect(region.getAttribute("tabindex")).toBe("0");
    region.focus();
    fireEvent.keyDown(region, { key: "ArrowRight" });
    const items = region.querySelectorAll("[data-nav-item]");
    expect(document.activeElement).toBe(items[0]);
  });

  it("nav items are removed from the Tab order (tabIndex -1)", () => {
    const { container } = render(<PhaseBar />);
    const region = container.querySelector(
      "[data-region='phase-bar']",
    ) as HTMLElement;
    const items = region.querySelectorAll("[data-nav-item]");
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.getAttribute("tabindex")).toBe("-1");
    }
  });

  it("ArrowRight then ArrowLeft walks the pills in DOM order", () => {
    const { container } = render(<PhaseBar />);
    const region = container.querySelector(
      "[data-region='phase-bar']",
    ) as HTMLElement;
    const items = region.querySelectorAll("[data-nav-item]");
    (items[0] as HTMLElement).focus();
    fireEvent.keyDown(region, { key: "ArrowRight" });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(region, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(items[0]);
  });
});
