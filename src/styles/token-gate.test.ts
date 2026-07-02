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
  { label: "naked px length", re: /\b\d+px\b/g },
  { label: "naked hex color", re: /#[0-9a-fA-F]{3,8}\b/g },
  { label: "naked ms duration", re: /\b\d+ms\b/g },
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
