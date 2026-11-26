// Regression tests for the 2026-11 motion pass (findings from the pre-merge
// GPT review): an expiring undo must not fire, a repeat copy must re-flash
// even when three copies land inside the two-frame reflash window, and a
// lazily mounted segmented track must still get measured.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSegmentThumb } from "../../hooks/useSegmentThumb";
import { useToastStore } from "../../stores/toastStore";
import { Toast } from "../Toast";

const initial = useToastStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState(initial, true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Toast exit", () => {
  it("keeps the toast for its exit but makes the expired undo inert", () => {
    const onClick = vi.fn();
    render(<Toast />);
    act(() => {
      useToastStore
        .getState()
        .showWithAction("已删除", { label: "撤销", onClick });
    });
    const undo = screen.getByRole("button", { name: "撤销" });
    expect(undo).not.toBeDisabled();

    // Dwell ends: the store clears, the toast is leaving.
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    const leavingUndo = screen.getByText("撤销").closest("button")!;
    expect(leavingUndo).toBeDisabled();
    leavingUndo.click();
    expect(onClick).not.toHaveBeenCalled();
    expect(leavingUndo.closest("[inert]")).not.toBeNull();

    // Exit fallback unmounts it.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("已删除")).toBeNull();
  });

  it("a new toast during the exit takes the surface back", () => {
    render(<Toast />);
    act(() => useToastStore.getState().show("已复制"));
    act(() => {
      vi.advanceTimersByTime(800);
    });
    act(() => useToastStore.getState().show("已保存"));
    expect(screen.getByRole("status")).toHaveTextContent("已保存");
    expect(screen.getByRole("status")).not.toHaveAttribute("inert");
  });
});

describe("repeat-copy reflash", () => {
  it("drops the flash for two frames, then restores it for the newest copy", () => {
    const frames: Array<() => void> = [];
    vi.stubGlobal("requestAnimationFrame", (fn: () => void) => {
      frames.push(fn);
      return frames.length;
    });
    const runFrame = () => frames.splice(0).forEach((f) => f());
    const s = () => useToastStore.getState();

    s().show("已复制", "a");
    expect(s().flashTargetId).toBe("a");

    s().show("已复制", "a"); // second copy: class must leave first
    expect(s().flashTargetId).toBeNull();
    runFrame();
    s().show("已复制", "a"); // third copy inside the window
    expect(s().flashTargetId).toBeNull();
    runFrame(); // second copy's last frame — superseded, must not restore
    expect(s().flashTargetId).toBeNull();
    runFrame();
    runFrame();
    expect(s().flashTargetId).toBe("a");
    vi.unstubAllGlobals();
  });
});

function Track({ show, active }: { show: boolean; active: string }) {
  const ref = useSegmentThumb<HTMLDivElement>(active);
  if (!show) return null;
  return (
    <div ref={ref} data-testid="track">
      {["a", "b"].map((k) => (
        <button key={k} data-segment-active={k === active ? "true" : undefined}>
          {k}
        </button>
      ))}
    </div>
  );
}

describe("useSegmentThumb", () => {
  it("measures a track that mounts after the host", () => {
    // jsdom has no layout; give the buttons a box.
    const spy = vi
      .spyOn(HTMLElement.prototype, "offsetWidth", "get")
      .mockReturnValue(40);
    const { rerender } = render(<Track show={false} active="a" />);
    rerender(<Track show active="a" />);
    const track = screen.getByTestId("track");
    expect(track.dataset.thumb).toBe("placed");
    spy.mockRestore();
  });
});
