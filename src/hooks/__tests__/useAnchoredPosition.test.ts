import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useAnchoredPosition } from "../useAnchoredPosition";

// jsdom has no layout engine, so every getBoundingClientRect answers 0×0 at
// (0,0). The placement rules are pure arithmetic over those rects, though, so
// stubbing them is enough to test the part that can actually be wrong: which
// side the panel takes, and how it is clamped.
function el(rect: Partial<DOMRect>): HTMLElement {
  const node = document.createElement("div");
  const full = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  node.getBoundingClientRect = () =>
    ({ ...full, ...rect }) as unknown as DOMRect;
  document.body.append(node);
  return node;
}

function frame(rect: Partial<DOMRect>) {
  const f = el(rect);
  f.setAttribute("data-dashboard-frame", "");
  return f;
}

const place = (anchor: HTMLElement, panel: HTMLElement) =>
  renderHook(() => useAnchoredPosition(anchor, panel, true)).result.current;

afterEach(() => {
  document.body.replaceChildren();
});

describe("useAnchoredPosition — placement (ADR-025 子决策 1)", () => {
  it("sits below the anchor, left-aligned, with a gap", () => {
    frame({
      top: 0,
      left: 0,
      right: 1000,
      bottom: 800,
      width: 1000,
      height: 800,
    });
    const anchor = el({ top: 100, left: 200, bottom: 124, right: 300 });
    const panel = el({ width: 300, height: 200 });

    expect(place(anchor, panel)).toEqual({
      top: 132,
      left: 200,
      flipped: false,
    });
  });

  it("flips above when the space below cannot hold the panel", () => {
    frame({
      top: 0,
      left: 0,
      right: 1000,
      bottom: 400,
      width: 1000,
      height: 400,
    });
    const anchor = el({ top: 300, left: 100, bottom: 324, right: 200 });
    const panel = el({ width: 300, height: 200 });

    // 400 − 8 inset − (324 + 8 gap) = 60px below, but 300 − 8 − 8 = 284 above.
    expect(place(anchor, panel)).toEqual({ top: 92, left: 100, flipped: true });
  });

  it("stays below when neither side fits, keeping the panel's top on screen", () => {
    frame({
      top: 0,
      left: 0,
      right: 1000,
      bottom: 300,
      width: 1000,
      height: 300,
    });
    const anchor = el({ top: 140, left: 0, bottom: 164, right: 100 });
    const panel = el({ width: 200, height: 400 });

    // Flipping would put the footer on screen and the name field off it; the
    // clamp keeps the reading order's start visible instead.
    const pos = place(anchor, panel);
    expect(pos?.flipped).toBe(false);
    expect(pos?.top).toBe(8);
  });

  it("clamps to the dashboard frame, not the viewport", () => {
    // The shell is an inset floating frame with a radius — clamping to the
    // viewport would hang the panel over that edge onto the desktop behind it.
    frame({
      top: 12,
      left: 12,
      right: 500,
      bottom: 400,
      width: 488,
      height: 388,
    });
    const anchor = el({ top: 100, left: 460, bottom: 124, right: 490 });
    const panel = el({ width: 300, height: 100 });

    expect(place(anchor, panel)?.left).toBe(192); // 500 − 8 − 300
  });

  it("falls back to the viewport when no frame is mounted", () => {
    const anchor = el({ top: 10, left: 10, bottom: 34, right: 60 });
    const panel = el({ width: 100, height: 50 });

    expect(place(anchor, panel)).toEqual({ top: 42, left: 10, flipped: false });
  });

  it("reports no position until it has both an anchor and a panel", () => {
    const panel = el({ width: 100, height: 50 });
    const { result } = renderHook(() => useAnchoredPosition(null, panel, true));
    expect(result.current).toBeNull();
  });
});
