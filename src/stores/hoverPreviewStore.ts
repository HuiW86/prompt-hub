import type { PointerEvent as ReactPointerEvent } from "react";
import { create } from "zustand";

// Full-prompt hover preview (issue: 悬停全文预览慢且字小).
//
// Replaces the native `title` tooltip that every content-bearing row used to
// carry. That tooltip was the whole problem: its delay belongs to the OS and
// cannot be set from the page, it renders in the system's small tooltip font
// that ignores the app's type scale, and it cannot scroll — so a long prompt
// was slow to appear, hard to read, and could not be read to the end.
//
// One layer for the whole app (components/HoverPreview.tsx, mounted once in
// Dashboard). Triggers do not own a panel; they report pointer intent to the
// controller below, which decides when the single panel opens, switches or
// closes.
//
// NOT a `popover`: App.tsx reads "a [popover] node exists" as "an anchored
// editor is open" to decide whether a wake may switch workspaces. A preview
// must never pass for an open editor, so it is a plain fixed-position element
// portalled to <body>.

/** Pointer must rest this long on a cold row before the panel opens. Long
 *  enough that crossing a row on the way somewhere else (≈20–60ms per row at
 *  ordinary mouse speed) never opens it; short enough to read as a response to
 *  "I stopped here". */
export const OPEN_DELAY_MS = 300;
/** Once a panel is open — or was closed moments ago — moving to a neighbour
 *  switches after only this long: the user is already reading previews. Still
 *  non-zero, so a fast vertical sweep does not repaint the panel per row. */
export const WARM_DELAY_MS = 80;
/** How long after a close the next hover still counts as warm. */
export const WARM_WINDOW_MS = 500;
/** Grace between leaving the row and closing, so the pointer can cross the
 *  gap into the panel (to scroll a long prompt) without it vanishing. */
export const CLOSE_GRACE_MS = 150;

export interface HoverPreviewPayload {
  title: string;
  content: string;
  /** Short trailing meta line, e.g. 「12 次」. */
  meta?: string;
}

interface Target extends HoverPreviewPayload {
  anchor: HTMLElement;
}

interface HoverPreviewState {
  target: Target | null;
}

export const useHoverPreviewStore = create<HoverPreviewState>(() => ({
  target: null,
}));

// ── Controller ───────────────────────────────────────────────────────────────
// Module state, not React state: timers must survive the trigger re-rendering
// (a copy flash re-renders the row) and are shared by every trigger.

let openTimer: ReturnType<typeof setTimeout> | null = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
let pendingAnchor: HTMLElement | null = null;
let lastClosedAt = 0;

function clearOpen() {
  if (openTimer) clearTimeout(openTimer);
  openTimer = null;
  pendingAnchor = null;
}

export function clearHoverPreviewClose() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
}

function closeNow() {
  clearOpen();
  clearHoverPreviewClose();
  if (useHoverPreviewStore.getState().target) {
    lastClosedAt = Date.now();
    useHoverPreviewStore.setState({ target: null });
  }
}

/** Close immediately and forget warmth: the next preview needs a fresh dwell.
 *  For deliberate actions (click / key / scroll) — after acting on a row the
 *  user is not browsing previews any more. */
export function dismissHoverPreview() {
  closeNow();
  lastClosedAt = 0;
}

function hoverEnter(anchor: HTMLElement, payload: HoverPreviewPayload) {
  clearHoverPreviewClose();
  const current = useHoverPreviewStore.getState().target;
  if (current?.anchor === anchor) {
    clearOpen();
    return;
  }
  if (pendingAnchor === anchor) return;
  clearOpen();
  const warm = current != null || Date.now() - lastClosedAt < WARM_WINDOW_MS;
  pendingAnchor = anchor;
  openTimer = setTimeout(
    () => {
      openTimer = null;
      pendingAnchor = null;
      if (!anchor.isConnected) return;
      useHoverPreviewStore.setState({ target: { anchor, ...payload } });
    },
    warm ? WARM_DELAY_MS : OPEN_DELAY_MS,
  );
}

export function scheduleHoverPreviewClose() {
  clearHoverPreviewClose();
  closeTimer = setTimeout(closeNow, CLOSE_GRACE_MS);
}

function hoverLeave(anchor: HTMLElement) {
  if (pendingAnchor === anchor) clearOpen();
  if (useHoverPreviewStore.getState().target) scheduleHoverPreviewClose();
}

/** Test seam: reset module state between cases. */
export function __resetHoverPreviewForTests() {
  closeNow();
  lastClosedAt = 0;
}

// ── Trigger handlers ─────────────────────────────────────────────────────────

/**
 * Pointer handlers for one preview trigger. Spread onto the element whose
 * hover should preview `payload` — and drop that element's `title`, or the
 * native tooltip will stack on top of this one.
 *
 * Plain handlers rather than a hook so list renderers (the panorama's row
 * loop) can attach them per row. A row unmounted under an open panel is caught
 * by the layer, which closes when its anchor leaves the document.
 *
 * Mouse / pen only: touch has no hover, and a long-press preview would fight
 * the tap that copies.
 */
export function hoverPreviewHandlers(payload: HoverPreviewPayload) {
  return {
    onPointerEnter: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === "touch") return;
      hoverEnter(e.currentTarget, payload);
    },
    onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === "touch") return;
      hoverLeave(e.currentTarget);
    },
    onPointerDown: () => dismissHoverPreview(),
  };
}
