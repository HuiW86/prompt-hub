import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Token gate (CLAUDE §4.1 / design-spec §10.2.2 hard rule #2): component CSS may
// never carry naked px / hex / ms literals — every length, color, and duration
// must reference a token defined in tokens.css (the single source of truth).
// This is the engineering gate codex flagged for the v0.10 A-phase consistency
// pass; it asserts at the source level so a stray literal can't silently regress.
const srcRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// tokens.css is the one file allowed to hold raw literals — it defines the tokens.
const ALLOWLIST = new Set(["styles/tokens.css"]);

function collectCss(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectCss(full));
    else if (entry.name.endsWith(".css")) out.push(full);
  }
  return out;
}

// Strip block comments so prose like "≤200ms" never trips the scanner.
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

const NAKED = [
  // px: catch negative offsets (-4px) and sub-pixel decimals (1.5px) too — the
  // old /\d+px/ let both slip through into component CSS.
  { label: "naked px length", re: /-?\b\d*\.?\d+px\b/g },
  { label: "naked hex color", re: /#[0-9a-fA-F]{3,8}\b/g },
  // ms: allow a leading decimal (1.5ms) — same bypass class as px.
  { label: "naked ms duration", re: /\b\d*\.?\d+ms\b/g },
  // Seconds durations (0.2s / 2s) fully bypassed the ms-only gate. Require a
  // non-identifier char before the number so we don't fire inside idents, and a
  // digit immediately before `s` so `160ms` is claimed by the ms rule, not this.
  { label: "naked s duration", re: /(?<![a-zA-Z0-9.])-?\d*\.?\d+s\b/g },
  // Raw color functions: rgb()/rgba()/hsl()/hsla() with a literal first channel
  // dodge the hex gate entirely. rgb(var(--x)) stays legal — it composes tokens;
  // only a bare numeric/percentage channel trips this.
  { label: "naked rgb/hsl color", re: /\b(?:rgba?|hsla?)\(\s*-?\.?\d/g },
  // --layer is a structural alias (resolves to --border-3): as a text color it
  // drops to ~1.4:1 contrast on lifted surfaces (the .btnPrimary regression).
  // Only the bare `color:` property is banned; border-color / background-color
  // and derived vars (--layer-fg / --layer-8 / --layer-16) stay legal.
  {
    label: "var(--layer) as text color",
    re: /(?:^|[;{])\s*color\s*:\s*var\(--layer\s*(?:,[^)]*)?\)/g,
  },
];

describe("CSS token gate — no naked px / hex / ms outside tokens.css", () => {
  const files = collectCss(srcRoot);

  it("finds CSS files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = relative(srcRoot, file).split("\\").join("/");
    if (ALLOWLIST.has(rel)) continue;

    it(`${rel} references tokens, not raw literals`, () => {
      const body = stripComments(readFileSync(file, "utf8"));
      const violations: string[] = [];
      for (const { label, re } of NAKED) {
        const hits = body.match(re);
        if (hits) violations.push(`${label}: ${[...new Set(hits)].join(", ")}`);
      }
      expect(violations, `${rel} has naked values`).toEqual([]);
    });
  }
});

// Self-test: the gate must catch the bypass classes that motivated the P1-7
// regex widening. Each snippet is a naked literal a stray commit could add; if a
// pattern regresses to the old form these fail loudly.
describe("token gate — bypass classes are caught (P1-7)", () => {
  const hit = (css: string) =>
    NAKED.some(({ re }) => re.test(css) && ((re.lastIndex = 0), true));

  it.each([
    ["negative px", "margin: -4px;"],
    ["decimal px", "top: 1.5px;"],
    ["decimal ms", "transition: all 1.5ms;"],
    ["bare seconds", "transition: opacity 0.2s ease;"],
    ["seconds in shorthand", "animation: slide 2s infinite;"],
    ["raw rgba color", "box-shadow: 0 0 0 rgba(0, 0, 0, 0.4);"],
    ["raw hsl color", "background: hsl(210, 50%, 40%);"],
  ])("flags %s", (_label, css) => {
    expect(hit(css)).toBe(true);
  });

  it.each([
    ["token spacing", "gap: var(--s-2);"],
    ["rgb composed from a token", "color: rgb(var(--x));"],
    ["hsl composed from a token", "background: hsl(var(--h) 50% 40%);"],
    ["opacity scalar", "opacity: 0.7;"],
    ["viewport height", "height: 100vh;"],
    ["percentage transform", "transform: translateX(250%);"],
  ])("allows %s", (_label, css) => {
    expect(hit(css)).toBe(false);
  });

  // The ms rule owns `160ms`; the seconds rule must not double-claim it (the
  // digit before `s` is `0`, but it's part of an `ms` token). Assert on the
  // seconds pattern in isolation so the two duration rules stay disjoint.
  it("seconds rule does not fire on an ms literal", () => {
    const secondsRule = NAKED.find((n) => n.label === "naked s duration")!.re;
    secondsRule.lastIndex = 0;
    expect(secondsRule.test("transition: all 160ms linear;")).toBe(false);
  });
});
