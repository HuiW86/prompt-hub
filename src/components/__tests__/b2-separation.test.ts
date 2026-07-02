import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// B2 gate (constitution §B2 + CLAUDE §4.3): protocol layer (AlignmentPhrase)
// and task layer (Modifier / Composition / Macro / Scene / SOP) are physically
// separated — AlignmentPhrase never joins Modifier composition, never enters a
// SOP, never converts to/from a Macro, never belongs to a Scene. This gate
// asserts at the source level (same pattern as styles/token-gate.test.ts and
// the composition-b2-separation gate removed in fedb3a8 along with the old
// CompositionWorkbench) that task-layer components neither import nor
// reference anything alignment-related, so the separation can't silently
// regress when a component is edited or restored.
//
// Exemptions (deliberate, each with a documented basis):
// - SearchOverlay: ADR-013 ratified AlignmentPhrases as a top-level
//   tab-reachable region and a first-class asset surface; the global search
//   overlay is a cross-layer retrieval surface (it lists alignment results in
//   their own group), not a task-layer composition surface, so it may
//   reference AlignmentPhrase.
// - ProtocolBand / AlignmentPhrases / PhaseBar: these ARE the protocol layer.
// - RecentList: usage-history badges label past invocations by target type
//   (including "alignment"); shipped and B2-rechecked under ADR-018.
// - DraftInbox: partially exempt — see the scoped assertion below.
const componentsDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function read(file: string): string {
  return readFileSync(resolve(componentsDir, file), "utf8");
}

// Task-layer surfaces named by constitution §B2's falsification list: Modifier
// composition (ModifierGrid), Scene ownership (ScenePanel), SOP (SopProgress),
// Macro display (MacroGrid). Zero alignment references allowed, in any form.
const TASK_LAYER_COMPONENTS = [
  "MacroGrid.tsx",
  "ScenePanel.tsx",
  "ModifierGrid.tsx",
  "SopProgress.tsx",
];

describe("B2 gate — protocol/task physical separation (constitution §B2)", () => {
  for (const file of TASK_LAYER_COMPONENTS) {
    it(`${file} does not reference AlignmentPhrase in any form`, () => {
      expect(read(file)).not.toMatch(/alignment/i);
    });
  }

  // DraftInbox is a cross-layer staging surface, not a task-layer composition
  // surface: ADR-015 designed the inbox to stage drafts of all four target
  // types, and prd §10.3 routes an `alignment_phrase` draft into the
  // protocol-layer table on promote (verified in ADR-012 Phase 5 acceptance).
  // So the `alignment_phrase` DraftTargetType discriminant (and its label) is
  // the one permitted alignment token; anything beyond it — importing the
  // AlignmentPhrases component, the AlignmentPhrase type, or rendering phrase
  // content — would be a B2 leak and must fail here.
  it("DraftInbox.tsx only touches alignment via the alignment_phrase draft target type", () => {
    const source = read("DraftInbox.tsx");
    expect(source).not.toMatch(/AlignmentPhrase/);
    const withoutTargetType = source.replace(/alignment_phrase/g, "");
    expect(withoutTargetType).not.toMatch(/alignment/i);
  });
});
