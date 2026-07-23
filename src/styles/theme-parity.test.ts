import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Theme parity gate — tokens.css carries the light palette twice by design:
// `:root.light` (explicit pick) and `:root.system` inside the
// @media (prefers-color-scheme: light) guard (OS-following pick). The two are
// hand-mirrored, so a token added to one and forgotten in the other silently
// forks the 浅色 and 跟随系统 appearances. This gate parses both sets and
// asserts declaration-level equality, per selector suffix (base, .accent-*).
const tokensPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "tokens.css",
);
const css = readFileSync(tokensPath, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

interface Rule {
  selector: string;
  declarations: string[];
  inLightMedia: boolean;
}

// Minimal brace-walking parser: enough for tokens.css (rules + one level of
// @media nesting; no nested rules inside rules).
function parseRules(src: string, inLightMedia = false): Rule[] {
  const rules: Rule[] = [];
  let rest = src;
  for (;;) {
    const open = rest.indexOf("{");
    if (open === -1) return rules;
    const selector = rest.slice(0, open).trim();
    // Find the matching close brace for this block.
    let depth = 1;
    let i = open + 1;
    while (i < rest.length && depth > 0) {
      if (rest[i] === "{") depth += 1;
      else if (rest[i] === "}") depth -= 1;
      i += 1;
    }
    const body = rest.slice(open + 1, i - 1);
    if (selector.startsWith("@media")) {
      const isLight = /prefers-color-scheme:\s*light/.test(selector);
      rules.push(...parseRules(body, inLightMedia || isLight));
    } else {
      const declarations = body
        .split(";")
        .map((d) => d.replace(/\s+/g, " ").trim())
        .filter(Boolean);
      rules.push({ selector, declarations, inLightMedia });
    }
    rest = rest.slice(i);
  }
}

// Merge every rule whose selector is `:root.<mode><suffix>` into a
// suffix → property → value map (later declarations win, like the cascade).
function collect(rules: Rule[], mode: "light" | "system") {
  const bySuffix = new Map<string, Map<string, string>>();
  const head = `:root.${mode}`;
  for (const rule of rules) {
    // `.light` rules live at top level; `.system` palette rules only exist
    // inside the light media guard (bare .system is dark by identity).
    if (mode === "light" ? rule.inLightMedia : !rule.inLightMedia) continue;
    if (rule.selector !== head && !rule.selector.startsWith(`${head}.`)) {
      continue;
    }
    const suffix = rule.selector.slice(head.length);
    const props = bySuffix.get(suffix) ?? new Map<string, string>();
    for (const decl of rule.declarations) {
      const colon = decl.indexOf(":");
      expect(
        colon,
        `malformed declaration in ${rule.selector}: ${decl}`,
      ).toBeGreaterThan(0);
      props.set(decl.slice(0, colon).trim(), decl.slice(colon + 1).trim());
    }
    bySuffix.set(suffix, props);
  }
  return bySuffix;
}

const rules = parseRules(css);
const light = collect(rules, "light");
const system = collect(rules, "system");

const ACCENTS = ["blue", "green", "violet", "amber"];

describe("theme parity — :root.light mirrors @media :root.system", () => {
  it("the two palettes cover the same selector suffixes", () => {
    expect([...system.keys()].sort()).toEqual([...light.keys()].sort());
  });

  for (const suffix of light.keys()) {
    it(`:root.light${suffix} ≡ :root.system${suffix}`, () => {
      const a = Object.fromEntries(light.get(suffix)!);
      const b = Object.fromEntries(system.get(suffix) ?? new Map());
      expect(b).toEqual(a);
    });
  }

  it("every accent class has a light-mode deepening block", () => {
    for (const accent of ACCENTS) {
      const props = light.get(`.accent-${accent}`);
      expect(props, `missing :root.light.accent-${accent}`).toBeDefined();
      // The deepened hue must retake both the applied accent and the brand
      // (ADR-024 补遗: accent IS the identity theme color).
      expect(props!.has("--accent"), `--accent in .accent-${accent}`).toBe(
        true,
      );
      expect(props!.has("--brand"), `--brand in .accent-${accent}`).toBe(true);
    }
  });

  it("light base block re-anchors brand, selection and aux", () => {
    const base = light.get("")!;
    for (const token of ["--brand", "--selection", "--aux", "--canvas"]) {
      expect(base.has(token), `${token} in :root.light`).toBe(true);
    }
  });
});
