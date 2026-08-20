import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest doesn't auto-cleanup React Testing Library mounts; without this,
// rendered trees accumulate across `it` blocks in the same file.
afterEach(() => {
  cleanup();
});

// jsdom doesn't ship navigator.clipboard. Provide a writable mock so
// useClipboard.writeClipboard succeeds in tests.
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
  writable: true,
});

// Default jsdom navigator.platform is empty / "Linux x86_64", which would make
// utils/platform.ts treat the test environment as non-Mac and require Ctrl
// modifiers everywhere. Pin to MacIntel so keyboard tests match the primary
// target platform; per-test overrides can re-set this for Win/Linux scenarios.
Object.defineProperty(navigator, "platform", {
  value: "MacIntel",
  configurable: true,
  writable: true,
});

// Popover shim for AnchoredEditor (ADR-025 子决策 1).
//
// jsdom 29.1.1 has no popover API — `showPopover` is undefined and
// `:popover-open` is an unknown pseudo-class. The ADR chose the native top
// layer regardless: giving up a platform capability to suit a test environment
// is the wrong trade. This is that decision's bill.
//
// Two halves, and the second is the one that is easy to miss:
//   1. the API — show / hide / toggle and the `popover` reflected property;
//   2. VISIBILITY. jsdom does ship the UA rule that hides a closed popover, but
//      cannot evaluate the `:popover-open` half of it, so the rule matches
//      always and an open panel still computes to `display: none`. That makes
//      it unfocusable and invisible to Testing Library's role queries — every
//      assertion about the editor would fail for reasons having nothing to do
//      with the editor. An inline `display` is what beats the UA sheet
//      (verified: an author rule using `:popover-open` has no effect).
//
// This buys OPEN/CLOSED STATE ONLY. jsdom has no top layer and no layout, so a
// green suite here says nothing about whether the panel escaped an ancestor's
// `overflow: hidden`, inherited the protocol band's tokens, or landed where it
// should. Those are exactly the ADR-025 G1 真机验收门 items.
{
  const OPEN = new WeakSet<HTMLElement>();
  const attr = (el: HTMLElement) => el.getAttribute("popover");

  // `block` rather than the real sheet's `flex`: with no layout engine behind
  // it the value only has to be "not none", and hard-coding a component's
  // display here would quietly diverge the moment that component changed.
  const setOpen = (el: HTMLElement, open: boolean) => {
    if (open) {
      OPEN.add(el);
      el.style.display = "block";
    } else {
      OPEN.delete(el);
      el.style.removeProperty("display");
    }
  };

  Object.defineProperty(HTMLElement.prototype, "popover", {
    configurable: true,
    get(this: HTMLElement) {
      return attr(this);
    },
    set(this: HTMLElement, v: string | null) {
      if (v == null) this.removeAttribute("popover");
      else this.setAttribute("popover", v);
    },
  });

  const define = (name: string, fn: (el: HTMLElement) => void) => {
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      writable: true,
      value(this: HTMLElement) {
        // The real API throws on an element with no popover attribute; keeping
        // that stops a misuse from passing silently in tests.
        if (attr(this) == null) {
          throw new DOMException(
            "Not supported on element without popover attribute",
            "InvalidStateError",
          );
        }
        fn(this);
      },
    });
  };
  define("showPopover", (el) => setOpen(el, true));
  define("hidePopover", (el) => setOpen(el, false));
  define("togglePopover", (el) => setOpen(el, !OPEN.has(el)));

  // jsdom's matches() rejects `:popover-open` outright, so intercept that one
  // selector and delegate everything else to the real implementation.
  const nativeMatches = HTMLElement.prototype.matches;
  HTMLElement.prototype.matches = function (this: HTMLElement, sel: string) {
    if (sel === ":popover-open") return OPEN.has(this);
    return nativeMatches.call(this, sel);
  };
}

// jsdom has no ResizeObserver; @dnd-kit/dom instantiates one at import time.
// A no-op stub lets MacroGrid (and any dnd-kit consumer) render under jsdom.
if (!("ResizeObserver" in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
