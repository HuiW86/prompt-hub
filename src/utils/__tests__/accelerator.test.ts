import { afterEach, describe, expect, it } from "vitest";

import {
  eventToAccelerator,
  formatAccelerator,
  isModifierCode,
} from "../accelerator";

// utils/platform reads navigator.platform on every call, so each block can pin
// the platform it is describing.
const realPlatform = Object.getOwnPropertyDescriptor(
  window.navigator,
  "platform",
);

function setPlatform(value: string) {
  Object.defineProperty(window.navigator, "platform", {
    value,
    configurable: true,
  });
}

afterEach(() => {
  if (realPlatform) {
    Object.defineProperty(window.navigator, "platform", realPlatform);
  }
});

function keydown(
  code: string,
  mods: Partial<{
    altKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
  }> = {},
) {
  return {
    code,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...mods,
  };
}

describe("eventToAccelerator", () => {
  it("builds the plugin's accelerator grammar from code + modifiers", () => {
    expect(eventToAccelerator(keydown("Space", { altKey: true }))).toBe(
      "Alt+Space",
    );
    expect(
      eventToAccelerator(keydown("KeyP", { ctrlKey: true, shiftKey: true })),
    ).toBe("Control+Shift+KeyP");
    expect(eventToAccelerator(keydown("Backquote", { metaKey: true }))).toBe(
      "Command+Backquote",
    );
  });

  // The ordering rule exists so the same physical chord always serialises
  // identically — otherwise "Alt+Shift+KeyK" and "Shift+Alt+KeyK" would compare
  // unequal and the settings UI would report phantom changes.
  it("emits modifiers in a fixed order regardless of which were pressed", () => {
    const all = keydown("KeyK", {
      metaKey: true,
      shiftKey: true,
      altKey: true,
      ctrlKey: true,
    });
    expect(eventToAccelerator(all)).toBe("Control+Alt+Shift+Command+KeyK");
  });

  // A modifier-less global chord swallows that key in every application, and
  // the only way to undo it is the window the key was meant to open. Refusing
  // it in the recorder is what keeps the setting recoverable.
  it("refuses a bare key", () => {
    expect(eventToAccelerator(keydown("Space"))).toBeNull();
    expect(eventToAccelerator(keydown("KeyA"))).toBeNull();
  });

  it("refuses a modifier-only press (the user is still mid-reach)", () => {
    expect(
      eventToAccelerator(keydown("ShiftLeft", { shiftKey: true })),
    ).toBeNull();
    expect(
      eventToAccelerator(keydown("MetaRight", { metaKey: true })),
    ).toBeNull();
  });

  it("uses e.code, so the chord survives a keyboard-layout change", () => {
    // ⌥N on a US layout arrives as e.key "Dead"; e.code is still KeyN.
    expect(eventToAccelerator(keydown("KeyN", { altKey: true }))).toBe(
      "Alt+KeyN",
    );
  });
});

describe("isModifierCode", () => {
  it("covers both sides of every modifier", () => {
    for (const code of [
      "AltLeft",
      "AltRight",
      "ControlLeft",
      "ControlRight",
      "MetaLeft",
      "MetaRight",
      "ShiftLeft",
      "ShiftRight",
    ]) {
      expect(isModifierCode(code), code).toBe(true);
    }
    expect(isModifierCode("KeyA")).toBe(false);
    expect(isModifierCode("Space")).toBe(false);
  });
});

describe("formatAccelerator", () => {
  it("renders macOS glyphs and strips W3C code prefixes", () => {
    setPlatform("MacIntel");
    expect(formatAccelerator("Alt+Space")).toBe("⌥ Space");
    expect(formatAccelerator("Control+Shift+KeyP")).toBe("⌃ ⇧ P");
    expect(formatAccelerator("Command+Digit1")).toBe("⌘ 1");
  });

  it("renders words on non-mac platforms", () => {
    setPlatform("Win32");
    expect(formatAccelerator("Alt+Space")).toBe("Alt+Space");
    expect(formatAccelerator("Control+Shift+KeyP")).toBe("Ctrl+Shift+P");
  });

  // A hand-edited DB row is a documented escape hatch, so an unrecognised token
  // must stay legible rather than render as an empty keycap.
  it("passes unknown tokens through instead of dropping them", () => {
    setPlatform("MacIntel");
    expect(formatAccelerator("Alt+F13")).toBe("⌥ F13");
    expect(formatAccelerator("Gibberish")).toBe("Gibberish");
  });
});
