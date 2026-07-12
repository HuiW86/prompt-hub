import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useSettingsStore } from "../../stores/settingsStore";
import { ModeToggle } from "../ModeToggle";

const initial = useSettingsStore.getState();

describe("ModeToggle — D-0 interaction-mode switch", () => {
  beforeEach(() => {
    useSettingsStore.setState(initial, true);
  });

  it("marks the active mode with aria-pressed (answerable at a glance)", () => {
    render(<ModeToggle />);
    // Default 调用态.
    expect(screen.getByRole("button", { name: /调用/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /整理/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicking 整理 switches the persisted mode", () => {
    render(<ModeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /整理/ }));
    expect(useSettingsStore.getState().interactionMode).toBe("organize");
    expect(screen.getByRole("button", { name: /整理/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("both segments are real buttons (keyboard reachable)", () => {
    render(<ModeToggle />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.tagName).toBe("BUTTON");
  });
});
