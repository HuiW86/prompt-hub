import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Density gate — tokens.css §3c: the compact tier may ONLY tighten structure.
// Two invariants, asserted at the source level like theme-parity:
//   1. Every token in `:root.compact` re-declares a token defined in a base
//      `:root` block (no orphan overrides that silently do nothing).
//   2. Every override is a px value strictly SMALLER than the base value —
//      "compact" that grows or merely equals the baseline is a regression.
// Type-size tokens (--t-*) are banned outright: density must not cost
// readability (§3c contract).
const tokensPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "tokens.css",
);
const css = readFileSync(tokensPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

// Collect declarations from every bare `:root { ... }` block (base tier).
// Brace-walk instead of a regex body-match so an inner `}` can't truncate.
function collectBlocks(selector: string): Map<string, string> {
  const map = new Map<string, string>();
  let from = 0;
  for (;;) {
    const at = css.indexOf(selector + " {", from);
    if (at === -1) return map;
    // Reject longer selectors (`:root.light {` when scanning `:root {`).
    const open = at + selector.length + 1;
    let depth = 1;
    let i = open + 1;
    while (i < css.length && depth > 0) {
      if (css[i] === "{") depth += 1;
      else if (css[i] === "}") depth -= 1;
      i += 1;
    }
    for (const decl of css.slice(open + 1, i - 1).split(";")) {
      const m = decl.match(/(--[\w-]+)\s*:\s*([^;]+)/);
      if (m) map.set(m[1], m[2].trim());
    }
    from = i;
  }
}

const base = collectBlocks(":root");
const compact = collectBlocks(":root.compact");

describe("density gate (tokens.css §3c)", () => {
  it("compact block exists and is non-empty", () => {
    expect(compact.size).toBeGreaterThan(0);
  });

  it("never touches type-size or line-height tokens", () => {
    const banned = [...compact.keys()].filter(
      (t) => t.startsWith("--t-") || t.startsWith("--lh-"),
    );
    expect(banned).toEqual([]);
  });

  it("every compact override re-declares a base token, strictly smaller", () => {
    for (const [token, value] of compact) {
      const baseValue = base.get(token);
      expect(baseValue, `${token} has no base :root declaration`).toBeDefined();
      const px = value.match(/^(\d*\.?\d+)px$/);
      const basePx = (baseValue as string).match(/^(\d*\.?\d+)px$/);
      expect(px, `${token} compact value must be a bare px length`).not.toBe(
        null,
      );
      expect(
        basePx,
        `${token} base value must be a bare px length`,
      ).not.toBeNull();
      expect(
        Number(px![1]),
        `${token} compact (${value}) must be < base (${baseValue})`,
      ).toBeLessThan(Number(basePx![1]));
    }
  });
});
