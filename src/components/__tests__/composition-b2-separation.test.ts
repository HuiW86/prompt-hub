import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// B2 (constitution §B2 + CLAUDE §4.3): the Composition workbench is a task-layer
// surface. Protocol-layer AlignmentPhrases must NEVER leak into it. This is the
// physical-separation gate for the workbench (plan asset-editing §7 #1) — it
// asserts at the source level that the component neither imports nor references
// anything alignment-related, so the separation can't silently regress.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  resolve(here, "../CompositionWorkbench.tsx"),
  "utf8",
);

describe("Composition workbench — B2 protocol/task separation", () => {
  it("does not reference AlignmentPhrase in any form", () => {
    expect(source).not.toMatch(/alignment/i);
  });

  it("does not import or render the AlignmentPhrases component", () => {
    expect(source).not.toMatch(/AlignmentPhrases/);
  });
});
