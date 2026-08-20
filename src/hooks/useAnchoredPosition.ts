import { useCallback, useEffect, useLayoutEffect, useState } from "react";

export interface AnchoredPosition {
  top: number;
  left: number;
}

// Geometry constants, independent of the spacing tokens on purpose: these feed
// arithmetic in JS, and reading --s-2 out of the computed root style every
// reposition would trade a real cost for a cosmetic link. They happen to equal
// --s-2 today; that is not a contract, so do not "sync" them to it.

/** Gap between the anchor edge and the panel. */
const OFFSET = 8;
/** Keep the panel this far inside the dashboard frame on every side. */
const INSET = 8;

// Walks up from `el` collecting every ancestor that can scroll, plus window.
// The alignment-phrase chip row is `overflow-x: auto` and the Scene / Recent
// columns scroll vertically, so an anchored panel that only listened to resize
// would detach the moment the user scrolled the row it is pinned to
// (ADR-025 §3 技术约束 — "锚点自身可能在滚动容器里").
function scrollableAncestors(el: Element): (Element | Window)[] {
  const found: (Element | Window)[] = [];
  let node = el.parentElement;
  while (node && node !== document.body) {
    const { overflow, overflowX, overflowY } = getComputedStyle(node);
    if (/(auto|scroll|overlay|hidden)/.test(overflow + overflowX + overflowY)) {
      found.push(node);
    }
    node = node.parentElement;
  }
  found.push(window);
  return found;
}

// The app shell is an inset floating frame (`.dashboard` is fixed at
// inset: var(--s-3) with a radius and overflow: hidden), so clamping to the
// viewport would let a panel hang over the rounded edge onto the desktop.
// Clamp to the frame rect instead; fall back to the viewport if the frame is
// not mounted (tests rendering a component in isolation).
function frameRect(): {
  top: number;
  left: number;
  right: number;
  bottom: number;
} {
  const frame = document.querySelector("[data-dashboard-frame]");
  if (frame) {
    const r = frame.getBoundingClientRect();
    // A zero-size rect means jsdom (no layout engine) — the viewport fallback
    // keeps the arithmetic meaningful there instead of collapsing to 0×0.
    if (r.width > 0 && r.height > 0) {
      return { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
    }
  }
  return {
    top: 0,
    left: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };
}

/**
 * Positions a top-layer panel against an anchor element (ADR-025 子决策 1).
 *
 * Placement: below the anchor by default, flipped above when the space below
 * cannot hold the panel but the space above can; then clamped into the
 * dashboard frame on both axes. Recomputed on scroll of every scrollable
 * ancestor, on window resize, and whenever the anchor or panel changes size.
 *
 * Returns viewport coordinates for `position: fixed`. That is correct even for
 * a top-layer element: the top layer's containing block is the initial
 * containing block, which is exactly what `fixed` resolves against — this is
 * what lets the panel escape the hover-lift `transform` containing blocks on
 * the Macro / Scene cards.
 *
 * There is no `open` parameter: a closed panel is an unmounted panel, so the
 * hook is only ever called while open. An open flag would be a second source
 * of truth for the same fact.
 */
export function useAnchoredPosition(
  anchor: HTMLElement | null,
  panel: HTMLElement | null,
): AnchoredPosition | null {
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

  const compute = useCallback(() => {
    if (!anchor || !panel) return;
    const a = anchor.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    const frame = frameRect();

    const roomBelow = frame.bottom - INSET - (a.bottom + OFFSET);
    const roomAbove = a.top - OFFSET - (frame.top + INSET);
    // Only flip when flipping actually helps — a panel taller than both gaps
    // stays below and gets clamped, which keeps its top (name field, primary
    // reading order) on screen rather than its footer.
    // Kept local: which side was taken is an input to the coordinates below and
    // nothing outside this function has ever needed it. Reporting it would be a
    // public field no caller reads — add it back only with a consumer in hand.
    const flipped = p.height > roomBelow && roomAbove >= p.height;

    const top = flipped ? a.top - OFFSET - p.height : a.bottom + OFFSET;
    const left = a.left;

    const maxLeft = frame.right - INSET - p.width;
    const maxTop = frame.bottom - INSET - p.height;
    setPosition({
      top: Math.max(frame.top + INSET, Math.min(top, maxTop)),
      left: Math.max(frame.left + INSET, Math.min(left, maxLeft)),
    });
  }, [anchor, panel]);

  // Layout effect: measure and place before paint, so the panel never shows for
  // one frame at its unpositioned origin.
  useLayoutEffect(compute, [compute]);

  useEffect(() => {
    if (!anchor || !panel) return;

    const onChange = () => compute();
    const targets = scrollableAncestors(anchor);
    for (const t of targets) {
      t.addEventListener("scroll", onChange, { passive: true });
    }
    window.addEventListener("resize", onChange);

    // The panel grows as the user types into the textarea and the anchor can
    // reflow with its row; both invalidate a placement computed once.
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(onChange);
    ro?.observe(anchor);
    ro?.observe(panel);

    return () => {
      for (const t of targets) t.removeEventListener("scroll", onChange);
      window.removeEventListener("resize", onChange);
      ro?.disconnect();
    };
  }, [anchor, panel, compute]);

  return position;
}
