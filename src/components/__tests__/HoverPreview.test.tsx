import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HoverPreviewLayer } from "../HoverPreview";
import {
  __resetHoverPreviewForTests,
  CLOSE_GRACE_MS,
  hoverPreviewHandlers,
  OPEN_DELAY_MS,
  WARM_DELAY_MS,
  WARM_WINDOW_MS,
} from "../../stores/hoverPreviewStore";

// Timing contract of the full-prompt hover preview (issue: 悬停全文预览慢). The
// values themselves are a product choice; what these cases lock is the shape:
// a cold hover waits, a passing pointer never opens it, a warm neighbour
// switches fast, the panel survives the trip into it, and any deliberate act
// closes it. Placement / scrolling need a layout engine — those are covered by
// the real-render pass recorded on the PR, not here.

const LONG = "第一行\n第二行 with English\n" + "很长的提示词。".repeat(200);

function Harness() {
  return (
    <>
      <button {...hoverPreviewHandlers({ title: "甲", content: LONG })}>
        row-a
      </button>
      <button
        {...hoverPreviewHandlers({
          title: "乙",
          content: "短内容",
          meta: "3 次",
        })}
      >
        row-b
      </button>
      <HoverPreviewLayer />
    </>
  );
}

const tip = () => screen.queryByRole("tooltip");
const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("HoverPreview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetHoverPreviewForTests();
  });
  afterEach(() => {
    __resetHoverPreviewForTests();
    vi.useRealTimers();
  });

  it("opens only after the cold dwell", () => {
    render(<Harness />);
    fireEvent.pointerEnter(screen.getByText("row-a"));
    advance(OPEN_DELAY_MS - 1);
    expect(tip()).toBeNull();
    advance(1);
    expect(tip()).not.toBeNull();
  });

  it("a pointer that passes through never opens it", () => {
    render(<Harness />);
    const a = screen.getByText("row-a");
    const b = screen.getByText("row-b");
    fireEvent.pointerEnter(a);
    advance(40);
    fireEvent.pointerLeave(a);
    fireEvent.pointerEnter(b);
    advance(40);
    fireEvent.pointerLeave(b);
    advance(OPEN_DELAY_MS * 2);
    expect(tip()).toBeNull();
  });

  it("shows the full content, untruncated, with name and meta", () => {
    render(<Harness />);
    fireEvent.pointerEnter(screen.getByText("row-b"));
    advance(OPEN_DELAY_MS);
    const panel = tip()!;
    expect(panel).toHaveTextContent("乙");
    expect(panel).toHaveTextContent("3 次");
    expect(panel).toHaveTextContent("短内容");
    fireEvent.pointerLeave(screen.getByText("row-b"));
    advance(CLOSE_GRACE_MS);
    fireEvent.pointerEnter(screen.getByText("row-a"));
    advance(OPEN_DELAY_MS);
    // The body carries every character of the prompt (no ellipsis cut).
    const body = tip()!.querySelector("[data-hover-preview-body]");
    expect(body?.textContent).toBe(LONG);
  });

  it("switches to a neighbour after the short warm delay", () => {
    render(<Harness />);
    const a = screen.getByText("row-a");
    const b = screen.getByText("row-b");
    fireEvent.pointerEnter(a);
    advance(OPEN_DELAY_MS);
    fireEvent.pointerLeave(a);
    fireEvent.pointerEnter(b);
    advance(WARM_DELAY_MS - 1);
    expect(tip()).toHaveTextContent("甲");
    advance(1);
    expect(tip()).toHaveTextContent("乙");
  });

  it("stays warm briefly after closing, then cools", () => {
    render(<Harness />);
    const a = screen.getByText("row-a");
    const b = screen.getByText("row-b");
    fireEvent.pointerEnter(a);
    advance(OPEN_DELAY_MS);
    fireEvent.pointerLeave(a);
    advance(CLOSE_GRACE_MS);
    expect(tip()).toBeNull();
    fireEvent.pointerEnter(b);
    advance(WARM_DELAY_MS);
    expect(tip()).toHaveTextContent("乙");
    fireEvent.pointerLeave(b);
    advance(CLOSE_GRACE_MS + WARM_WINDOW_MS);
    fireEvent.pointerEnter(a);
    advance(WARM_DELAY_MS);
    expect(tip()).toBeNull();
    advance(OPEN_DELAY_MS - WARM_DELAY_MS);
    expect(tip()).not.toBeNull();
  });

  it("survives the trip from the row into the panel", () => {
    render(<Harness />);
    const a = screen.getByText("row-a");
    fireEvent.pointerEnter(a);
    advance(OPEN_DELAY_MS);
    fireEvent.pointerLeave(a);
    advance(CLOSE_GRACE_MS - 20);
    fireEvent.pointerEnter(tip()!);
    advance(CLOSE_GRACE_MS * 3);
    expect(tip()).not.toBeNull();
    fireEvent.pointerLeave(tip()!);
    advance(CLOSE_GRACE_MS);
    expect(tip()).toBeNull();
  });

  it("closes on press, on any key, and on window blur", () => {
    render(<Harness />);
    const a = screen.getByText("row-a");
    const open = () => {
      fireEvent.pointerEnter(a);
      advance(OPEN_DELAY_MS);
      expect(tip()).not.toBeNull();
    };
    open();
    fireEvent.pointerDown(a);
    expect(tip()).toBeNull();
    fireEvent.pointerLeave(a);
    open();
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    expect(tip()).toBeNull();
    fireEvent.pointerLeave(a);
    open();
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(tip()).toBeNull();
  });

  it("closes when its row unmounts", async () => {
    const { rerender } = render(<Harness />);
    fireEvent.pointerEnter(screen.getByText("row-a"));
    advance(OPEN_DELAY_MS);
    expect(tip()).not.toBeNull();
    rerender(<HoverPreviewLayer />);
    // MutationObserver callbacks are microtasks.
    await act(async () => {
      await Promise.resolve();
    });
    expect(tip()).toBeNull();
  });

  // App.tsx reads "a [popover] node exists" as "an anchored editor is open"
  // and keeps the workspace on wake. A preview must never look like that.
  it("is not a popover and describes its anchor while open", () => {
    render(<Harness />);
    const a = screen.getByText("row-a");
    fireEvent.pointerEnter(a);
    advance(OPEN_DELAY_MS);
    expect(document.querySelector("[popover]")).toBeNull();
    expect(a.getAttribute("aria-describedby")).toBe(tip()!.id);
    fireEvent.pointerDown(a);
    expect(a.hasAttribute("aria-describedby")).toBe(false);
  });
});
