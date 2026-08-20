// Wake-chord accelerator handling (ADR-027).
//
// The strings here cross the IPC boundary verbatim into
// tauri-plugin-global-shortcut's parser, so the grammar is not ours to invent:
// `Modifier+Modifier+Key`, split on `+`, tokens matched case-insensitively.
// Accepted modifier tokens are Alt/Option, Ctrl/Control, Cmd/Command/Super and
// Shift; the main key accepts W3C `KeyboardEvent.code` names (KeyA, Digit1,
// Space, Backquote, …).
//
// Keys are captured from `e.code`, never `e.key`: `code` is the physical
// position, so a chord recorded on one keyboard layout still fires on another,
// and Alt-combinations don't arrive as the composed character the OS produced
// (⌥N is "Dead" in `e.key` on a US layout). Same reasoning as the ADR-025 P2
// key table.
//
// Rust re-validates everything sent from here — this module exists to make the
// recorder usable, not to be the security boundary.

import { isMacLike } from "./platform";

// Modifier-only presses while recording: these are the user reaching for a
// chord, not the chord itself.
const MODIFIER_CODES = new Set([
  "AltLeft",
  "AltRight",
  "ControlLeft",
  "ControlRight",
  "MetaLeft",
  "MetaRight",
  "ShiftLeft",
  "ShiftRight",
  "CapsLock",
]);

// Emitted in a fixed order so the same chord always produces the same string —
// otherwise "Alt+Shift+K" and "Shift+Alt+K" would compare unequal while being
// the same binding, and the settings UI would show spurious changes.
const MODIFIER_ORDER = ["Control", "Alt", "Shift", "Command"] as const;

export function isModifierCode(code: string): boolean {
  return MODIFIER_CODES.has(code);
}

/**
 * Build an accelerator string from a keydown, or `null` when the event does not
 * yet describe a bindable chord (modifier-only press, or no modifier held).
 *
 * The modifier requirement is enforced here AND in Rust. It is not defensive
 * duplication: a bare-key global shortcut swallows that key in every running
 * application, and the only way to take it back is the window the key was meant
 * to open. The UI needs to refuse it before the user commits, and the backend
 * needs to refuse it because the UI is not the only caller.
 */
export function eventToAccelerator(e: {
  code: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}): string | null {
  if (isModifierCode(e.code)) return null;

  const held: string[] = [];
  for (const mod of MODIFIER_ORDER) {
    if (mod === "Control" && e.ctrlKey) held.push("Control");
    if (mod === "Alt" && e.altKey) held.push("Alt");
    if (mod === "Shift" && e.shiftKey) held.push("Shift");
    if (mod === "Command" && e.metaKey) held.push("Command");
  }
  if (held.length === 0) return null;

  return [...held, e.code].join("+");
}

// Display forms. macOS renders modifiers as glyphs; elsewhere the words are the
// convention. Unknown tokens pass through unchanged rather than being dropped,
// so a hand-edited DB value stays legible in the UI instead of rendering blank.
const MAC_GLYPHS: Record<string, string> = {
  control: "⌃",
  ctrl: "⌃",
  alt: "⌥",
  option: "⌥",
  shift: "⇧",
  command: "⌘",
  cmd: "⌘",
  super: "⌘",
  commandorcontrol: "⌘",
};

const PC_WORDS: Record<string, string> = {
  control: "Ctrl",
  ctrl: "Ctrl",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
  command: "Win",
  cmd: "Win",
  super: "Win",
  commandorcontrol: "Ctrl",
};

// Strip the W3C prefixes that carry no meaning for a reader: KeyA → A,
// Digit1 → 1. Everything else (Space, Escape, F1, ArrowUp) already reads fine.
function prettifyKey(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  return code;
}

/** Human-readable form of an accelerator, e.g. `Alt+Space` → `⌥ Space`. */
export function formatAccelerator(accelerator: string): string {
  const mac = isMacLike();
  const table = mac ? MAC_GLYPHS : PC_WORDS;
  const parts = accelerator
    .split("+")
    .map(
      (token) => table[token.trim().toLowerCase()] ?? prettifyKey(token.trim()),
    )
    .filter((part) => part.length > 0);
  return parts.join(mac ? " " : "+");
}
