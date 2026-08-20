import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAnchoredPosition } from "../useAnchoredPosition";

// jsdom has no layout engine, so every getBoundingClientRect answers 0×0 at
// (0,0). The placement rules are pure arithmetic over those rects, though, so
// stubbing them is enough to test the part that can actually be wrong: which
// side the panel takes, and how it is clamped.
//
// The rect is mutable so a test can displace an element the way a scroll would
// and check the hook notices — jsdom fires no scroll of its own, and elements
// never actually move, so "the anchor slid" has to be staged by hand.
interface FakeEl extends HTMLElement {
  moveTo(patch: Partial<DOMRect>): void;
}

function el(
  rect: Partial<DOMRect>,
  parent: HTMLElement = document.body,
): FakeEl {
  const node = document.createElement("div");
  const full = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  let current = { ...full, ...rect };
  node.getBoundingClientRect = () => current as unknown as DOMRect;
  const fake = Object.assign(node, {
    moveTo: (patch: Partial<DOMRect>) => {
      current = { ...current, ...patch };
    },
  });
  parent.append(fake);
  return fake;
}

// An ancestor that can scroll. The hook decides by computed overflow, and jsdom
// does reflect inline styles through getComputedStyle, so this is the real
// predicate rather than a stub of it.
function scroller(parent: HTMLElement = document.body) {
  const node = el({}, parent);
  node.style.overflow = "auto";
  return node;
}

function frame(rect: Partial<DOMRect>) {
  const f = el(rect);
  f.setAttribute("data-dashboard-frame", "");
  return f;
}

const place = (anchor: HTMLElement, panel: HTMLElement) =>
  renderHook(() => useAnchoredPosition(anchor, panel)).result.current;

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

    expect(place(anchor, panel)).toMatchObject({ top: 132, left: 200 });
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
    // Flipping is observable only as the resulting `top`, which is the point:
    // it is placement arithmetic, not a fact the caller has to be told.
    expect(place(anchor, panel)).toMatchObject({ top: 92, left: 100 });
  });

  it("keeps the panel's top on screen when it fits on neither side", () => {
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

    // A panel taller than the frame cannot be placed, only clamped, and the
    // clamp keeps its TOP — the name field, the start of the reading order — on
    // screen rather than its footer.
    expect(place(anchor, panel)).toMatchObject({ top: 8, left: 8 });
  });

  it("caps the panel's height to the frame it is clamped into", () => {
    // Clamping the ORIGIN alone is not enough: the case above pins a too-tall
    // panel at the top inset and lets the rest run off the bottom, taking the
    // footer's 保存 / 取消 with it — which is the exact defect ADR-025 exists to
    // fix, reintroduced one panel lower down. The cap is what the caller pairs
    // with an internal scroll so those buttons stay reachable.
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

    expect(place(anchor, panel)?.maxHeight).toBe(284); // 300 − 8 − 8
  });

  it("caps against the frame rather than the viewport", () => {
    // Same reason the clamp uses the frame: the shell is an inset floating box,
    // so a viewport-sized cap would still let a panel spill past its edge.
    frame({
      top: 12,
      left: 12,
      right: 500,
      bottom: 400,
      width: 488,
      height: 388,
    });
    const anchor = el({ top: 100, left: 20, bottom: 124, right: 120 });
    const panel = el({ width: 200, height: 600 });

    expect(place(anchor, panel)?.maxHeight).toBe(372); // 400 − 12 − 8 − 8
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

    expect(place(anchor, panel)).toMatchObject({ top: 42, left: 10 });
  });

  it("reports no position until it has both an anchor and a panel", () => {
    const panel = el({ width: 100, height: 50 });
    const { result } = renderHook(() => useAnchoredPosition(null, panel));
    expect(result.current).toBeNull();
  });
});

// ADR-025 §3 技术约束: "锚点自身可能在滚动容器里". A panel that only listened
// to resize would detach the moment the user scrolled the row it is pinned to —
// the alignment-phrase chip row is overflow-x: auto and the Scene / Recent
// columns scroll vertically.
//
// These tests cover the SUBSCRIPTION half only: which targets get listened to,
// and that an event actually re-runs the placement. Whether the panel visually
// stays glued during a real scroll is a layout question jsdom cannot answer, so
// G1 项 2 was split — that half was confirmed by hand on 2026-08-19 and is not
// reproducible here. Adding a case below protects the logic; it does not
// re-verify the pixels.
describe("useAnchoredPosition — following a moving anchor (ADR-025 子决策 1)", () => {
  it("recomputes when a scrollable ancestor scrolls", () => {
    const row = scroller();
    const anchor = el({ top: 100, left: 200, bottom: 124, right: 300 }, row);
    const panel = el({ width: 300, height: 100 });

    const { result } = renderHook(() => useAnchoredPosition(anchor, panel));
    expect(result.current).toMatchObject({ top: 132, left: 200 });

    // The row scrolled 150px left, carrying the chip with it.
    anchor.moveTo({ left: 50, right: 150 });
    act(() => {
      row.dispatchEvent(new Event("scroll"));
    });

    expect(result.current).toMatchObject({ top: 132, left: 50 });
  });

  it("listens to every scrollable ancestor, not just the nearest", () => {
    // A chip lives inside the phrase row inside a scrolling column; scrolling
    // EITHER one moves it, so subscribing only to the closest would leave the
    // panel behind on the outer scroll.
    const outer = scroller();
    const inner = scroller(outer);
    const anchor = el({ top: 100, left: 200, bottom: 124, right: 300 }, inner);
    const panel = el({ width: 300, height: 100 });

    const { result } = renderHook(() => useAnchoredPosition(anchor, panel));

    anchor.moveTo({ top: 40, bottom: 64 });
    act(() => {
      outer.dispatchEvent(new Event("scroll"));
    });

    expect(result.current?.top).toBe(72);
  });

  it("skips ancestors that cannot scroll", () => {
    const plain = el({});
    const anchor = el({ top: 100, left: 200, bottom: 124, right: 300 }, plain);
    const panel = el({ width: 300, height: 100 });
    const spy = vi.spyOn(plain, "addEventListener");

    renderHook(() => useAnchoredPosition(anchor, panel));

    // Subscribing to everything up the chain would work but wastes listeners on
    // every render of every anchored panel; the overflow test is the filter.
    expect(spy.mock.calls.filter(([type]) => type === "scroll")).toHaveLength(
      0,
    );
  });

  it("recomputes on window resize", () => {
    const anchor = el({ top: 100, left: 200, bottom: 124, right: 300 });
    const panel = el({ width: 300, height: 100 });

    const { result } = renderHook(() => useAnchoredPosition(anchor, panel));

    anchor.moveTo({ left: 400, right: 500 });
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(result.current?.left).toBe(400);
  });

  it("stops listening once the panel is gone", () => {
    const row = scroller();
    const anchor = el({ top: 100, left: 200, bottom: 124, right: 300 }, row);
    const panel = el({ width: 300, height: 100 });
    const remove = vi.spyOn(row, "removeEventListener");

    const { unmount } = renderHook(() => useAnchoredPosition(anchor, panel));
    unmount();

    // A leaked scroll listener would keep recomputing against a detached panel
    // for the rest of the session, once per closed editor.
    expect(remove.mock.calls.filter(([t]) => t === "scroll")).toHaveLength(1);
  });
});
