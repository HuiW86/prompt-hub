import { describe, expect, it } from "vitest";

import type {
  AlignmentPhrase,
  Composition,
  Macro,
  Modifier,
  PanoramaPlacement,
  Phrase,
} from "../../ipc/types";
import {
  buildCompositionText,
  buildPanorama,
  itemsInReadingOrder,
  matchesFilter,
  PHASE_TO_GROUP,
  type BuildPanoramaInput,
  type PanoramaItem,
} from "../panorama";

const NOW = new Date("2026-11-12T12:00:00Z");
const DAY = 86_400_000;
const ago = (days: number, extraMs = 0) =>
  new Date(NOW.getTime() - days * DAY - extraMs).toISOString();
const OLD = "2026-01-01T00:00:00Z";

function macro(id: string, over: Partial<Macro> = {}): Macro {
  return {
    id,
    name: id,
    content: `${id} body`,
    expandFrom: null,
    native: true,
    role: null,
    task: null,
    usageCount: 1,
    lastUsedAt: OLD,
    createdAt: OLD,
    notes: null,
    sceneId: null,
    deprecated: false,
    orderIndex: 0,
    ...over,
  };
}

function ap(
  id: string,
  phaseId: string,
  over: Partial<AlignmentPhrase> = {},
): AlignmentPhrase {
  return {
    id,
    phaseId,
    name: id,
    content: `${id} body`,
    isDefault: false,
    usageCount: 1,
    lastUsedAt: OLD,
    createdAt: OLD,
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

function phrase(id: string, over: Partial<Phrase> = {}): Phrase {
  return {
    id,
    sceneId: "scene-1",
    name: id,
    content: `${id} body`,
    usageCount: 1,
    lastUsedAt: OLD,
    createdAt: OLD,
    notes: null,
    deprecated: false,
    subStageId: null,
    orderIndex: 0,
    ...over,
  };
}

function modifier(id: string, over: Partial<Modifier> = {}): Modifier {
  return {
    id,
    name: id,
    content: `${id} body`,
    groupKind: "role",
    usageCount: 1,
    lastUsedAt: OLD,
    createdAt: OLD,
    notes: null,
    deprecated: false,
    orderIndex: 0,
    ...over,
  } as Modifier;
}

function composition(id: string, over: Partial<Composition> = {}): Composition {
  return {
    id,
    name: id,
    modifierIds: [],
    phaseId: "phase-plan",
    sceneId: null,
    usageCount: 1,
    lastUsedAt: OLD,
    createdAt: OLD,
    notes: null,
    deprecated: false,
    orderIndex: 0,
    ...over,
  };
}

function build(over: Partial<BuildPanoramaInput> = {}) {
  return buildPanorama({
    macros: [],
    phrases: [],
    alignmentPhrases: [],
    modifiers: [],
    compositions: [],
    placements: [],
    now: NOW,
    ...over,
  });
}

function find(model: ReturnType<typeof build>, id: string): PanoramaItem {
  const item = itemsInReadingOrder(model).find((i) => i.id === id);
  if (!item) throw new Error(`no item ${id}`);
  return item;
}

function columnOf(model: ReturnType<typeof build>, id: string): string {
  const col = [...model.columns, ...model.strip].find((c) =>
    c.items.some((i) => i.id === id),
  );
  if (!col) throw new Error(`no column for ${id}`);
  return col.id;
}

describe("buildPanorama — tiers", () => {
  it("used exactly 90 days ago is still active; a millisecond more is dormant", () => {
    const m = build({
      macros: [
        macro("edge", { lastUsedAt: ago(90) }),
        macro("past", { lastUsedAt: ago(90, 1) }),
      ],
    });
    expect(find(m, "edge").tier).toBe("active");
    expect(find(m, "past").tier).toBe("dormant");
  });

  it("never used and created exactly 14 days ago is new; a millisecond older is not", () => {
    const m = build({
      macros: [
        macro("fresh", { usageCount: 0, lastUsedAt: null, createdAt: ago(14) }),
        macro("stale", {
          usageCount: 0,
          lastUsedAt: null,
          createdAt: ago(14, 1),
        }),
      ],
    });
    expect(find(m, "fresh")).toMatchObject({ tier: "active", isNew: true });
    expect(find(m, "stale")).toMatchObject({ tier: "dormant", isNew: false });
  });

  it("a recently created item that has been used is not new", () => {
    const m = build({
      macros: [
        macro("used", { usageCount: 2, lastUsedAt: ago(1), createdAt: ago(2) }),
      ],
    });
    expect(find(m, "used")).toMatchObject({ tier: "active", isNew: false });
  });

  it("a pin slot wins over every other rule, dormant or not", () => {
    const m = build({
      macros: [macro("pinned-old", { lastUsedAt: null })],
      placements: [
        {
          assetKind: "macro",
          assetId: "pinned-old",
          groupId: null,
          pinSlot: 4,
        },
      ],
    });
    expect(find(m, "pinned-old")).toMatchObject({ tier: "pinned", pinSlot: 4 });
  });

  it("never used and not new is dormant", () => {
    const m = build({
      macros: [macro("never", { usageCount: 0, lastUsedAt: null })],
    });
    expect(find(m, "never").tier).toBe("dormant");
  });
});

describe("buildPanorama — columns", () => {
  it.each(Object.entries(PHASE_TO_GROUP))(
    "alignment phrase in %s defaults to column %s",
    (phaseId, group) => {
      const m = build({ alignmentPhrases: [ap("x", phaseId)] });
      expect(columnOf(m, "x")).toBe(group);
    },
  );

  it("maps all nine seeded phase ids", () => {
    expect(Object.keys(PHASE_TO_GROUP).sort()).toEqual(
      [
        "phase-converge",
        "phase-distill",
        "phase-diverge",
        "phase-execute",
        "phase-generate",
        "phase-iterate",
        "phase-live",
        "phase-plan",
        "phase-understand",
      ].sort(),
    );
  });

  it("everything without a phase rule falls into 未分组", () => {
    const m = build({
      macros: [macro("m")],
      phrases: [phrase("p")],
      modifiers: [modifier("mod")],
      compositions: [composition("c", { phaseId: "phase-custom" })],
      alignmentPhrases: [ap("unknown-phase", "phase-custom")],
    });
    for (const id of ["m", "p", "mod", "c", "unknown-phase"]) {
      expect(columnOf(m, id)).toBe("ungrouped");
    }
    expect(m.columns[m.columns.length - 1]?.title).toBe("未分组");
  });

  it.each(Object.entries(PHASE_TO_GROUP))(
    "composition in %s defaults to column %s",
    (phaseId, group) => {
      const m = build({ compositions: [composition("c", { phaseId })] });
      expect(columnOf(m, "c")).toBe(group);
    },
  );

  it("each stage has its own column: 规划 and 生成 are no longer folded away", () => {
    const m = build({
      alignmentPhrases: [
        ap("plan", "phase-plan"),
        ap("conv", "phase-converge"),
        ap("gen", "phase-generate"),
        ap("exec", "phase-execute"),
      ],
    });
    expect(columnOf(m, "plan")).toBe("plan");
    expect(columnOf(m, "conv")).toBe("converge");
    expect(columnOf(m, "gen")).toBe("generate");
    expect(columnOf(m, "exec")).toBe("execute");
  });

  it("an explicit groupId overrides the default rule, including for alignment phrases", () => {
    const placements: PanoramaPlacement[] = [
      {
        assetKind: "alignment_phrase",
        assetId: "a",
        groupId: "tool",
        pinSlot: null,
      },
      { assetKind: "macro", assetId: "m", groupId: "iterate", pinSlot: null },
    ];
    const m = build({
      alignmentPhrases: [ap("a", "phase-understand")],
      macros: [macro("m")],
      placements,
    });
    expect(columnOf(m, "a")).toBe("tool");
    expect(columnOf(m, "m")).toBe("iterate");
  });

  it("a placement is matched by kind AND id, not id alone", () => {
    const m = build({
      macros: [macro("same")],
      placements: [
        {
          assetKind: "phrase",
          assetId: "same",
          groupId: "distill",
          pinSlot: 1,
        },
      ],
    });
    expect(columnOf(m, "same")).toBe("ungrouped");
    expect(m.bySlot[1]).toBeUndefined();
  });

  it("always has the eight stage columns and both strip groups; 未分组 only when non-empty", () => {
    const m = build({ alignmentPhrases: [ap("a", "phase-understand")] });
    expect(m.columns.map((c) => c.id)).toEqual([
      "understand",
      "diverge",
      "converge",
      "plan",
      "generate",
      "execute",
      "iterate",
      "distill",
    ]);
    expect(m.columns.map((c) => c.title)).toEqual([
      "理解",
      "发散",
      "收敛",
      "规划",
      "生成",
      "执行",
      "迭代",
      "沉淀",
    ]);
    expect(m.strip.map((c) => c.id)).toEqual(["cue", "tool"]);
    expect(m.strip.map((c) => c.title)).toEqual(["中途口令", "工具"]);
  });

  it("orders pinned by slot, then active, then dormant, keeping source order within a tier", () => {
    const m = build({
      macros: [
        macro("d1", { lastUsedAt: OLD }),
        macro("a1", { lastUsedAt: ago(1), usageCount: 1 }),
        macro("p7"),
        macro("a2", { lastUsedAt: ago(2), usageCount: 99 }),
        macro("p2"),
        macro("d2", { lastUsedAt: OLD }),
      ],
      placements: [
        { assetKind: "macro", assetId: "p7", groupId: null, pinSlot: 7 },
        { assetKind: "macro", assetId: "p2", groupId: null, pinSlot: 2 },
      ],
    });
    const col = m.columns.find((c) => c.id === "ungrouped");
    expect(col?.items.map((i) => i.id)).toEqual([
      "p2",
      "p7",
      "a1",
      "a2",
      "d1",
      "d2",
    ]);
    // A higher count does not reorder: a2 (99 uses) stays after a1.
    expect(col?.activeCount).toBe(4);
  });
});

describe("buildPanorama — exclusions, slots, copy payloads", () => {
  it("deprecated items of every kind are left out", () => {
    const m = build({
      macros: [macro("m", { deprecated: true })],
      phrases: [phrase("p", { deprecated: true })],
      alignmentPhrases: [ap("a", "phase-plan", { deprecated: true })],
      modifiers: [modifier("mod", { deprecated: true })],
      compositions: [composition("c", { deprecated: true })],
      placements: [
        { assetKind: "macro", assetId: "m", groupId: null, pinSlot: 1 },
      ],
    });
    expect(itemsInReadingOrder(m)).toHaveLength(0);
    expect(m.bySlot[1]).toBeUndefined();
  });

  it("bySlot maps each pinned slot to its item", () => {
    const m = build({
      macros: [macro("m")],
      alignmentPhrases: [ap("a", "phase-live", { kind: "cue" })],
      placements: [
        { assetKind: "macro", assetId: "m", groupId: null, pinSlot: 1 },
        {
          assetKind: "alignment_phrase",
          assetId: "a",
          groupId: null,
          pinSlot: 9,
        },
      ],
    });
    expect(Object.keys(m.bySlot).sort()).toEqual(["1", "9"]);
    expect(m.bySlot[1].id).toBe("m");
    expect(m.bySlot[9].id).toBe("a");
  });

  it("records the same usage sources the organize workspace does", () => {
    const m = build({
      macros: [macro("m")],
      phrases: [phrase("p")],
      modifiers: [modifier("mod")],
      compositions: [composition("c", { modifierIds: ["mod"] })],
      alignmentPhrases: [
        ap("open", "phase-plan"),
        ap("cue", "phase-live", { kind: "cue" }),
      ],
    });
    expect(find(m, "m").usage).toMatchObject({
      targetType: "macro",
      source: "macro_area",
    });
    expect(find(m, "p").usage).toMatchObject({
      targetType: "phrase",
      source: "scene",
    });
    expect(find(m, "mod").usage).toMatchObject({
      targetType: "modifier",
      source: "macro_area",
    });
    expect(find(m, "c").usage).toMatchObject({
      targetType: "composition",
      source: "composition",
      modifierIds: ["mod"],
      phaseId: "phase-plan",
    });
    expect(find(m, "open").usage).toMatchObject({
      targetType: "alignment",
      source: "phase_bar",
      phaseId: "phase-plan",
    });
    expect(find(m, "cue").usage.source).toBe("live_cue");
  });

  it("alignment content carries the coordinate prefix, like every other entry point", () => {
    const m = build({
      alignmentPhrases: [
        ap("a", "phase-plan", { modeId: "mode-x", content: "正文" }),
      ],
      alignmentAxisValuesById: {
        "mode-x": {
          id: "mode-x",
          axis: "mode",
          name: "收敛",
          hint: null,
          orderIndex: 0,
        },
      } as BuildPanoramaInput["alignmentAxisValuesById"],
    });
    expect(find(m, "a").content).toBe("收敛模式。\n正文");
  });

  it("composition text joins its modifiers in order and skips missing ones", () => {
    const byId = new Map([
      ["x", { content: "X" }],
      ["y", { content: "Y" }],
    ]);
    expect(
      buildCompositionText({ modifierIds: ["y", "gone", "x"] }, byId),
    ).toBe("Y\n\nX");
  });

  it("maxUsageCount is the library's highest count", () => {
    const m = build({
      macros: [macro("a", { usageCount: 3 }), macro("b", { usageCount: 12 })],
    });
    expect(m.maxUsageCount).toBe(12);
  });
});

describe("matchesFilter", () => {
  const item = {
    name: "Review Diff",
    content: "请检查这次改动",
  } as PanoramaItem;

  it("matches name or content, ignoring case", () => {
    expect(matchesFilter(item, "review")).toBe(true);
    expect(matchesFilter(item, "DIFF")).toBe(true);
    expect(matchesFilter(item, "改动")).toBe(true);
    expect(matchesFilter(item, "部署")).toBe(false);
  });

  it("a blank query matches everything", () => {
    expect(matchesFilter(item, "")).toBe(true);
    expect(matchesFilter(item, "   ")).toBe(true);
  });
});
