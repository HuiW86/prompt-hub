import { useCallback, useRef, useState } from "react";

export interface AnchorRegistry {
  /** Memoised ref callback for `key` — spread onto the trigger element. */
  ref: (key: string) => (el: HTMLElement | null) => void;
  /** The element registered under `key`, or null while it is still settling. */
  get: (key: string | null | undefined) => HTMLElement | null;
}

/**
 * Keeps the trigger elements an `AnchoredEditor` pins to, keyed by whatever the
 * host uses to identify a row (ADR-025 子决策 1).
 *
 * Extracted from AlignmentPhrases during the P1-b migration: four hosts need
 * this and it has two non-obvious failure modes, so copying it four times would
 * mean getting it wrong at least once.
 *
 * 1. THE CALLBACKS MUST BE MEMOISED PER KEY. An inline `el => set(id, el)` is a
 *    fresh function identity every render, and React detaches then re-attaches
 *    a ref whose identity changed. With the setState below inside, that is an
 *    update loop.
 * 2. REGISTERING HAS TO BUMP A RENDER. The elements live in a ref so a
 *    re-render alone cannot lose them, but a panel can only measure an anchor
 *    that is already in the DOM — a freshly registered one is invisible to the
 *    positioning hook until one more render goes by.
 */
export function useAnchorRegistry(): AnchorRegistry {
  const elementsRef = useRef(new Map<string, HTMLElement>());
  const callbacksRef = useRef(
    new Map<string, (el: HTMLElement | null) => void>(),
  );
  const [, bump] = useState(0);

  const ref = useCallback((key: string) => {
    let cb = callbacksRef.current.get(key);
    if (!cb) {
      cb = (el: HTMLElement | null) => {
        if ((elementsRef.current.get(key) ?? null) === el) return;
        if (el) elementsRef.current.set(key, el);
        else elementsRef.current.delete(key);
        bump((n) => n + 1);
      };
      callbacksRef.current.set(key, cb);
    }
    return cb;
  }, []);

  const get = useCallback(
    (key: string | null | undefined) =>
      key == null ? null : (elementsRef.current.get(key) ?? null),
    [],
  );

  return { ref, get };
}
