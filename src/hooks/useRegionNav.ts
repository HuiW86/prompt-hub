import { useCallback } from "react";

// Roving-focus keyboard navigation for a Tab region (03-product-spec §13.4:
// "↑↓←→ 在卡片间移动焦点"). Tab still moves BETWEEN the six regions (each region
// container keeps tabIndex=0, its interactive items drop to tabIndex=-1); the
// arrow keys move WITHIN the focused region. The returned handler mounts on the
// region container's onKeyDown; items opt in with a `data-nav-item` attribute.
//
// Linear traversal in DOM order (no 2D grid geometry) — the visible cards form a
// single logical sequence per region, so DOM order is the navigation order.
export function useRegionNav() {
  return useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    // A real text-entry target (edit forms embedded in a region) keeps native
    // caret/selection behavior — never hijack its arrow keys.
    const target = e.target as HTMLElement;
    const tag = target.tagName;
    if (
      tag === "INPUT" ||
      tag === "TEXTAREA" ||
      tag === "SELECT" ||
      target.isContentEditable
    ) {
      return;
    }
    // IME candidate navigation owns the arrows while composing (isComposing is
    // the standard signal; keyCode 229 covers older webviews that omit it —
    // mirrors SearchOverlay.tsx). isComposing lives on the native event; the
    // React synthetic type doesn't surface it.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    // Any modifier means the arrows belong to another handler (Shift-arrow
    // selection, ⌘-arrow, etc.) — leave them alone.
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;

    let dir: 1 | -1 | "first" | "last";
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        dir = 1;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        dir = -1;
        break;
      case "Home":
        dir = "first";
        break;
      case "End":
        dir = "last";
        break;
      default:
        return;
    }

    const container = e.currentTarget;
    // jsdom leaves offsetParent null for everything, so an offsetParent filter
    // would drop every item in tests. Instead skip items inside a [hidden]
    // ancestor (covers collapsed edit branches) — enough to exclude the items
    // that are genuinely not on screen while staying test-environment safe.
    const items = Array.from(
      container.querySelectorAll<HTMLElement>("[data-nav-item]"),
    ).filter((el) => !el.closest("[hidden]"));
    if (items.length === 0) return;

    const active = document.activeElement;
    const currentIndex = items.findIndex((el) => el === active);

    let nextIndex: number;
    if (dir === "first") {
      nextIndex = 0;
    } else if (dir === "last") {
      nextIndex = items.length - 1;
    } else if (currentIndex === -1) {
      // Focus is on the container itself (Tab just landed here): entering with
      // ↓/→ goes to the first item, with ↑/← to the last.
      nextIndex = dir === 1 ? 0 : items.length - 1;
    } else {
      nextIndex = currentIndex + dir;
      if (nextIndex < 0 || nextIndex >= items.length) return;
    }

    e.preventDefault();
    items[nextIndex]?.focus();
  }, []);
}
