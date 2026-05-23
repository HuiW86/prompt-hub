// Tauri builds target macOS first but the same binary can run on Windows /
// Linux, where the primary keyboard modifier is Ctrl, not ⌘. Functions are
// re-evaluated on every call so tests can override navigator.platform per
// describe block (utils/platform is otherwise stateless).

export function isMacLike(): boolean {
  return (
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.platform)
  );
}

// True iff the event's primary modifier matches the platform convention AND
// no secondary modifier is also held. Use in keyboard handlers that implement
// ⌘N / Ctrl+N style shortcuts.
export function isPrimaryModifier(e: KeyboardEvent): boolean {
  if (isMacLike()) {
    return e.metaKey && !e.ctrlKey;
  }
  return e.ctrlKey && !e.metaKey;
}

// Display label for the primary modifier — used in kbd hints next to keycaps.
export function primaryModifierLabel(): string {
  return isMacLike() ? "⌘" : "Ctrl+";
}
