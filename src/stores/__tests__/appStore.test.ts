import { beforeEach, describe, expect, it } from "vitest";

import { useAppStore } from "../appStore";

const initial = useAppStore.getState();

describe("appStore", () => {
  beforeEach(() => {
    useAppStore.setState(initial, true);
  });

  it("setVisible flips the mirrored flag", () => {
    useAppStore.getState().setVisible(false);
    expect(useAppStore.getState().isVisible).toBe(false);
    useAppStore.getState().setVisible(true);
    expect(useAppStore.getState().isVisible).toBe(true);
  });

  it("setActivePhase tracks the selected phase id", () => {
    useAppStore.getState().setActivePhase("phase-diverge");
    expect(useAppStore.getState().activePhaseId).toBe("phase-diverge");
    useAppStore.getState().setActivePhase(null);
    expect(useAppStore.getState().activePhaseId).toBeNull();
  });
});
