import { describe, expect, it } from "vitest";

import type { AlignmentPhrase } from "./types";
import { alignmentUsageSource, findAlignmentPhrase } from "./usageSource";

function phrase(over: Partial<AlignmentPhrase>): AlignmentPhrase {
  return {
    id: "ap-1",
    phaseId: "phase-diverge",
    name: "默认 · 发散",
    content: "我们做发散",
    isDefault: true,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: "2026-05-23T00:00:00Z",
    notes: null,
    deprecated: false,
    orderIndex: 0,
    kind: "opening",
    layerId: null,
    domainId: null,
    modeId: null,
    cueAxis: null,
    contentRevisedAt: null,
    ...over,
  };
}

describe("alignmentUsageSource — class beats entry point", () => {
  it("leaves an opening phrase with the region it was copied from", () => {
    expect(alignmentUsageSource(phrase({}), "phase_bar")).toBe("phase_bar");
    expect(alignmentUsageSource(phrase({}), "recent")).toBe("recent");
  });

  // The failure this prevents: a cue recorded as `phase_bar` becomes an ANCHOR
  // in the drift ledger, which looks backwards for the nearest `phase_bar`
  // record to attribute cues to. 「停」 would then be reported as an opening
  // phrase nobody ever sent, and usage_records is append-only, so those rows
  // could never be corrected — only outlived.
  it("records a cue as live_cue no matter which region it came from", () => {
    const cue = phrase({ id: "ap-live-stop", kind: "cue" });
    expect(alignmentUsageSource(cue, "phase_bar")).toBe("live_cue");
    expect(alignmentUsageSource(cue, "recent")).toBe("live_cue");
  });
});

describe("findAlignmentPhrase", () => {
  const byPhase = {
    "phase-diverge": [phrase({ id: "ap-a" })],
    "phase-live": [phrase({ id: "ap-live-stop", kind: "cue" })],
  };

  it("finds a phrase in any phase bucket", () => {
    expect(findAlignmentPhrase(byPhase, "ap-live-stop")?.kind).toBe("cue");
  });

  it("returns undefined for a null or unresolvable id", () => {
    expect(findAlignmentPhrase(byPhase, null)).toBeUndefined();
    expect(findAlignmentPhrase(byPhase, "ap-trashed")).toBeUndefined();
  });
});
