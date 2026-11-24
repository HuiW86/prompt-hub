import { beforeEach, describe, expect, it } from "vitest";

import { firstLineOf, orderQuickRows, type QuickRow } from "../quickList";
import { countPaste, trialTotals } from "../viewTrial";

function row(
  key: string,
  name: string,
  extra: Partial<QuickRow> = {},
): QuickRow {
  return {
    key,
    // Ordering never reads the entry; a placeholder keeps the fixture small.
    entry: { kind: "website", key } as unknown as QuickRow["entry"],
    name,
    firstLine: "",
    body: "",
    pinSlot: null,
    usageCount: 0,
    lastUsedAt: null,
    ...extra,
  };
}

describe("firstLineOf", () => {
  it("skips blank lines and trims", () => {
    expect(firstLineOf("\n\n  先出方案  \n再确认")).toBe("先出方案");
    expect(firstLineOf("   \n")).toBe("");
  });
});

describe("orderQuickRows", () => {
  const rows = [
    row("a", "调研最佳实践", { lastUsedAt: "2026-11-01T00:00:00Z" }),
    row("b", "整理成方案", {
      pinSlot: 2,
      lastUsedAt: "2026-01-01T00:00:00Z",
    }),
    row("c", "先出方案再确认", {
      pinSlot: 1,
      body: "有多个可行方案时先铺开比较",
    }),
    row("d", "复述任务", {
      lastUsedAt: "2026-11-20T00:00:00Z",
      body: "复述验收标准",
    }),
    row("e", "从没用过"),
  ];

  it("empty query: pins by slot, then most recently used, never-used last", () => {
    expect(orderQuickRows(rows, "").map((r) => r.key)).toEqual([
      "c",
      "b",
      "d",
      "a",
      "e",
    ]);
  });

  it("query: name prefix > name contains > body contains; misses dropped", () => {
    const keys = orderQuickRows(
      [
        row("body", "甲", { body: "方案" }),
        row("contains", "整理成方案"),
        row("prefix", "方案评审"),
        row("miss", "调研"),
      ],
      "方案",
    ).map((r) => r.key);
    expect(keys).toEqual(["prefix", "contains", "body"]);
  });

  it("within a rank band, a pin leads, then higher use count", () => {
    const keys = orderQuickRows(
      [
        row("low", "方案甲", { usageCount: 1 }),
        row("high", "方案乙", { usageCount: 40 }),
        row("pin", "方案丙", { pinSlot: 3 }),
      ],
      "方案",
    ).map((r) => r.key);
    expect(keys).toEqual(["pin", "high", "low"]);
  });

  it("is case-insensitive", () => {
    expect(
      orderQuickRows([row("gh", "GitHub")], "git").map((r) => r.key),
    ).toEqual(["gh"]);
  });
});

describe("view trial counter", () => {
  beforeEach(() => localStorage.clear());

  it("counts per view per day and sums a trailing window", () => {
    const today = new Date(2026, 10, 24, 12);
    const yesterday = new Date(2026, 10, 23, 12);
    const longAgo = new Date(2026, 9, 1, 12);
    countPaste("quick", today);
    countPaste("quick", yesterday);
    countPaste("panorama", today);
    countPaste("quick", longAgo);
    expect(trialTotals(14, today)).toEqual({
      quick: 2,
      panorama: 1,
      skills: 0,
      manage: 0,
    });
  });

  it("survives corrupt storage instead of throwing", () => {
    localStorage.setItem("prompt-hub:view-trial:v1", "{not json");
    expect(() => countPaste("quick")).not.toThrow();
    expect(trialTotals(1).quick).toBe(1);
  });
});
