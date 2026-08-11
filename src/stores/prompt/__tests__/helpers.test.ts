import { describe, expect, it } from "vitest";

import type { RecentUsageEntry, UsageTargetType } from "../../../ipc/types";
import { RECENT_FETCH_LIMIT, RECENT_LIMIT, dedupeRecent } from "../helpers";

// Newest-first, mirroring list_recent_usage's ORDER BY timestamp DESC.
function entry(
  id: string,
  targetType: UsageTargetType,
  targetId: string | null,
): RecentUsageEntry {
  return {
    record: {
      id,
      timestamp: `2026-08-10T00:00:${id.padStart(2, "0")}Z`,
      targetType,
      targetId,
      source: "macro_area",
      modifierIds: null,
      sopId: null,
      sopStepOrder: null,
      phaseId: null,
    },
    targetName: targetId ?? "（未知话术）",
    targetContent: "body",
  };
}

describe("dedupeRecent", () => {
  it("collapses repeat copies of one asset to its most recent touch", () => {
    const out = dedupeRecent([
      entry("5", "macro", "m-1"),
      entry("4", "macro", "m-1"),
      entry("3", "macro", "m-1"),
      entry("2", "alignment", "a-1"),
      entry("1", "alignment", "a-1"),
    ]);
    // Three copies of m-1 used to fill three of five wake slots with the same
    // line; the tile's own usage count already carries "how often".
    expect(out.map((e) => e.record.id)).toEqual(["5", "2"]);
  });

  it("keeps the newest row per asset, not the oldest", () => {
    const out = dedupeRecent([
      entry("9", "macro", "m-1"),
      entry("2", "macro", "m-1"),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.record.timestamp).toBe("2026-08-10T00:00:09Z");
  });

  it("scopes identity by target type so ids never collide across tables", () => {
    const out = dedupeRecent([
      entry("2", "macro", "shared-id"),
      entry("1", "phrase", "shared-id"),
    ]);
    expect(out).toHaveLength(2);
  });

  it("does not merge rows whose target is gone (null targetId)", () => {
    // Two deleted assets are not "the same asset" — collapsing them would hide
    // one real tombstone behind another.
    const out = dedupeRecent([
      entry("2", "macro", null),
      entry("1", "macro", null),
    ]);
    expect(out).toHaveLength(2);
  });

  it("caps the wake at RECENT_LIMIT distinct assets", () => {
    const out = dedupeRecent(
      Array.from({ length: 20 }, (_, i) =>
        entry(String(20 - i), "macro", `m-${i}`),
      ),
    );
    expect(out).toHaveLength(RECENT_LIMIT);
  });

  it("passes an already-distinct list through unchanged", () => {
    const input = [entry("2", "macro", "m-1"), entry("1", "phrase", "p-1")];
    expect(dedupeRecent(input)).toEqual(input);
  });

  it("handles degenerate inputs", () => {
    expect(dedupeRecent([])).toEqual([]);
    expect(dedupeRecent([entry("1", "macro", "m-1")])).toHaveLength(1);
  });

  it("keeps all rows when the distinct count equals RECENT_LIMIT exactly", () => {
    // Guards the `out.length === RECENT_LIMIT` break against an off-by-one
    // rewrite: at exactly the cap nothing may be dropped.
    const input = Array.from({ length: RECENT_LIMIT }, (_, i) =>
      entry(String(RECENT_LIMIT - i), "macro", `m-${i}`),
    );
    expect(dedupeRecent(input)).toHaveLength(RECENT_LIMIT);
  });

  it("does not mutate its input", () => {
    const input = [entry("2", "macro", "m-1"), entry("1", "macro", "m-1")];
    const snapshot = [...input];
    dedupeRecent(input);
    expect(input).toEqual(snapshot);
  });

  it("under-fills when one asset saturates the fetch window (known tradeoff)", () => {
    // Characterisation, not an endorsement: 40 consecutive copies of one asset
    // fill the entire RECENT_FETCH_LIMIT window, so distinct assets at row 41+
    // never reach the client and the wake renders one row instead of five.
    // Accepted because it under-displays rather than showing wrong data. The
    // structural fix is deduping in SQL (GROUP BY target_type, target_id) so
    // the LIMIT counts distinct assets — see helpers.ts RECENT_FETCH_LIMIT.
    const out = dedupeRecent(
      Array.from({ length: RECENT_FETCH_LIMIT }, (_, i) =>
        entry(String(RECENT_FETCH_LIMIT - i), "macro", "m-1"),
      ),
    );
    expect(out).toHaveLength(1);
    expect(out.length).toBeLessThan(RECENT_LIMIT);
  });
});

describe("RECENT_FETCH_LIMIT", () => {
  it("stays within the Rust-side clamp so the ask is never truncated", () => {
    // src-tauri/src/commands.rs RECENT_USAGE_LIMIT_MAX. The clamp silently
    // truncates instead of erroring, so nothing at runtime would surface a
    // breach — this assertion is the only guard on that cross-language coupling.
    const RECENT_USAGE_LIMIT_MAX = 100;
    expect(RECENT_FETCH_LIMIT).toBeGreaterThan(RECENT_LIMIT);
    expect(RECENT_FETCH_LIMIT).toBeLessThanOrEqual(RECENT_USAGE_LIMIT_MAX);
  });
});
