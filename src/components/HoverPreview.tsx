import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

import {
  clearHoverPreviewClose,
  dismissHoverPreview,
  scheduleHoverPreviewClose,
  useHoverPreviewStore,
} from "../stores/hoverPreviewStore";

import styles from "./HoverPreview.module.css";

// The single full-prompt preview panel (issue: 悬停全文预览慢且字小). Timing
// and intent live in stores/hoverPreviewStore.ts; this file only places and
// paints whatever target the controller has chosen.

/** Gap between the anchor row and the panel, and inset from the frame edge.
 *  JS geometry, like useAnchoredPosition's: not a token contract. */
const GAP = 8;
const INSET = 8;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

// Clamp to the dashboard frame (an inset floating window with rounded
// corners), not the viewport — same rule as useAnchoredPosition. A zero-size
// frame means no layout engine (jsdom); fall back to the viewport there.
function frameRect(): Box {
  const frame = document.querySelector("[data-dashboard-frame]");
  if (frame) {
    const r = frame.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  return { left: 0, top: 0, right: w, bottom: h, width: w, height: h };
}

/**
 * Side placement. A preview sits BESIDE its row, never below it: below would
 * cover the very rows the pointer travels to next, and the panorama is read
 * down its columns. Right first (reading direction), left if right cannot
 * hold it, and only when neither side can — a full-width row such as the
 * bottom strip on a narrow window — above or below, whichever is roomier.
 */
function place(panel: HTMLElement, anchor: HTMLElement) {
  const a = anchor.getBoundingClientRect();
  const f = frameRect();
  const maxW = Math.max(0, f.width - INSET * 2);
  panel.style.maxWidth = `${maxW}px`;
  // Height cap first: the measured height below depends on it.
  panel.style.maxHeight = `${Math.max(0, f.height - INSET * 2)}px`;
  const p = panel.getBoundingClientRect();

  const roomRight = f.right - INSET - (a.right + GAP);
  const roomLeft = a.left - GAP - (f.left + INSET);
  let left: number;
  let top: number;
  let side: "right" | "left" | "below" | "above";
  if (roomRight >= p.width) {
    side = "right";
    left = a.right + GAP;
  } else if (roomLeft >= p.width) {
    side = "left";
    left = a.left - GAP - p.width;
  } else {
    const roomBelow = f.bottom - INSET - (a.bottom + GAP);
    const roomAbove = a.top - GAP - (f.top + INSET);
    side = roomBelow >= p.height || roomBelow >= roomAbove ? "below" : "above";
    left = a.left;
    const cap = Math.max(0, side === "below" ? roomBelow : roomAbove);
    panel.style.maxHeight = `${cap}px`;
  }
  const h = panel.getBoundingClientRect().height;
  if (side === "below") top = a.bottom + GAP;
  else if (side === "above") top = a.top - GAP - h;
  else top = a.top;
  left = Math.max(f.left + INSET, Math.min(left, f.right - INSET - p.width));
  top = Math.max(f.top + INSET, Math.min(top, f.bottom - INSET - h));
  panel.style.left = `${left}px`;
  panel.style.top = `${top}px`;
  panel.dataset.side = side;
  panel.dataset.anchorTop = String(a.top);
}

export function HoverPreviewLayer() {
  const target = useHoverPreviewStore((s) => s.target);
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const id = useId();

  // Place before paint; reveal in the same frame so the panel never flashes
  // at its unpositioned origin.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const body = bodyRef.current;
    if (!panel || !target) return;
    panel.style.visibility = "hidden";
    if (body) body.scrollTop = 0;
    place(panel, target.anchor);
    if (body) {
      panel.dataset.overflowing = String(body.scrollHeight > body.clientHeight);
    }
    panel.style.visibility = "visible";
  }, [target]);

  // Describe the anchor while open (screen readers get the content the
  // title attribute used to carry).
  useEffect(() => {
    const anchor = target?.anchor;
    if (!anchor) return;
    anchor.setAttribute("aria-describedby", id);
    return () => anchor.removeAttribute("aria-describedby");
  }, [target, id]);

  // Anything that is not "keep looking" ends the preview: a key press (the
  // panorama's typing / arrows / ↵ all act on the list, not the panel), a
  // scroll outside the panel (its anchor moved), a press outside it, or the
  // window losing focus (the overlay hides on blur).
  useEffect(() => {
    if (!target) return;
    const onKey = () => dismissHoverPreview();
    const onScroll = (e: Event) => {
      const panel = panelRef.current;
      if (panel && e.target instanceof Node && panel.contains(e.target)) return;
      dismissHoverPreview();
    };
    const onDown = (e: PointerEvent) => {
      const panel = panelRef.current;
      if (panel && e.target instanceof Node && panel.contains(e.target)) return;
      dismissHoverPreview();
    };
    // The anchor row can unmount under the panel (filtered away, deleted,
    // workspace switched); a panel pinned to a detached node must go too.
    if (!target.anchor.isConnected) {
      dismissHoverPreview();
      return;
    }
    const mo = new MutationObserver(() => {
      if (!target.anchor.isConnected) dismissHoverPreview();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    const onResize = () => {
      const panel = panelRef.current;
      if (panel && target.anchor.isConnected) place(panel, target.anchor);
      else dismissHoverPreview();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("blur", dismissHoverPreview);
    window.addEventListener("resize", onResize);
    return () => {
      mo.disconnect();
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("blur", dismissHoverPreview);
      window.removeEventListener("resize", onResize);
    };
  }, [target]);

  if (!target || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role="tooltip"
      className={styles.panel}
      data-hover-preview
      style={{ visibility: "hidden" }}
      onPointerEnter={clearHoverPreviewClose}
      onPointerLeave={scheduleHoverPreviewClose}
    >
      <div className={styles.header}>
        <span className={styles.title}>{target.title}</span>
        {target.meta && <span className={styles.meta}>{target.meta}</span>}
      </div>
      <div ref={bodyRef} className={styles.body} data-hover-preview-body>
        {target.content}
      </div>
      <div className={styles.footer} aria-hidden>
        <span>{Array.from(target.content).length} 字</span>
        <span className={styles.scrollHint}>移入此处滚动阅读全文</span>
      </div>
    </div>,
    document.body,
  );
}
