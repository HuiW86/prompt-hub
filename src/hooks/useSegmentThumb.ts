import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Sliding selection thumb for a segmented control (2026-11 motion pass).
 *
 * The control's picked segment used to swap its fill in place: one segment
 * went dark while another lit up, so nothing said "the choice moved from here
 * to there". This hook measures the active segment and publishes its box as
 * custom properties on the track; the track's ::before paints one thumb and
 * slides it (transform + width, --d-base) to the new segment.
 *
 * Contract with the CSS (see .segmentTrack in styles/motion.module.css):
 *   - the active child carries data-segment-active="true";
 *   - the track gets data-thumb once measured. While data-thumb is absent
 *     (first paint, jsdom, no layout) the segments keep their own fill, so the
 *     control never renders without a selection;
 *   - data-thumb="live" (transition on) only after the first placement, so the
 *     thumb never slides in from the corner on mount. A resize or text-size
 *     change re-measures with data-thumb="placed" (no transition) so the
 *     thumb tracks its segment instead of trailing it.
 *
 * Returns a CALLBACK ref: the track may mount long after the host (the
 * settings dialog renders nothing until opened), and an object ref plus
 * mount-only effects would never see it.
 */
export function useSegmentThumb<T extends HTMLElement>(activeKey: unknown) {
  const trackRef = useRef<T | null>(null);
  const lastRef = useRef<string | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);

  const place = useCallback((animate: boolean) => {
    const track = trackRef.current;
    if (!track) return;
    const active = track.querySelector<HTMLElement>(
      '[data-segment-active="true"]',
    );
    if (!active || active.offsetWidth === 0) {
      delete track.dataset.thumb;
      lastRef.current = null;
      return;
    }
    // De-duplicated against the last box, so the observer's initial callback
    // and unrelated resizes never interrupt a slide that is already running.
    const box = `${active.offsetLeft},${active.offsetTop},${active.offsetWidth},${active.offsetHeight}`;
    if (box === lastRef.current) return;
    track.dataset.thumb = animate && lastRef.current ? "live" : "placed";
    track.style.setProperty("--thumb-x", `${active.offsetLeft}px`);
    track.style.setProperty("--thumb-y", `${active.offsetTop}px`);
    track.style.setProperty("--thumb-w", `${active.offsetWidth}px`);
    track.style.setProperty("--thumb-h", `${active.offsetHeight}px`);
    lastRef.current = box;
  }, []);

  const ref = useCallback(
    (node: T | null) => {
      roRef.current?.disconnect();
      roRef.current = null;
      trackRef.current = node;
      lastRef.current = null;
      if (!node) return;
      place(false);
      if (typeof ResizeObserver === "undefined") return;
      // Geometry change (window, text size, label width): snap, don't slide.
      const ro = new ResizeObserver(() => place(false));
      ro.observe(node);
      for (const child of Array.from(node.children)) ro.observe(child);
      roRef.current = ro;
    },
    [place],
  );

  // Selection change: slide.
  useLayoutEffect(() => {
    place(true);
  }, [activeKey, place]);

  return ref;
}
