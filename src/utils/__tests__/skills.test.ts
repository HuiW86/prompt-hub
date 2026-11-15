import { describe, expect, it } from "vitest";

import type { Skill } from "../../ipc/types";
import {
  buildSkillBoard,
  columnOf,
  matchesSkill,
  SKILL_STAGES,
  skillPreviewText,
  skillsInReadingOrder,
} from "../skills";

const NOW = new Date("2026-11-15T12:00:00Z");
const RECENT = "2026-11-10T00:00:00Z";
const OLD = "2025-01-01T00:00:00Z";

function skill(over: Partial<Skill> & Pick<Skill, "id">): Skill {
  return {
    name: over.id,
    purpose: "",
    whenToUse: "",
    notFor: "",
    invocation: "",
    stage: "diverge",
    trigger: "manual",
    source: "own",
    sourceUrl: "",
    status: "installed",
    pinSlot: null,
    orderIndex: 0,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: OLD,
    ...over,
  };
}

describe("buildSkillBoard", () => {
  it("lays out six stage columns in workflow order, without 收敛 and 执行", () => {
    const board = buildSkillBoard([], NOW);
    expect(board.columns.map((c) => c.title)).toEqual([
      "理解",
      "发散",
      "规划",
      "生成",
      "迭代",
      "沉淀",
    ]);
    expect(SKILL_STAGES).toHaveLength(6);
    expect(board.strip).toEqual([]);
    expect(board.total).toBe(0);
  });

  it("routes Muse built-ins, auto-triggered and unstaged skills to the strip", () => {
    const skills = [
      skill({ id: "edl", stage: "plan" }),
      skill({ id: "verify", trigger: "auto", stage: null }),
      skill({ id: "ticket", source: "muse", stage: null }),
      // A Muse skill is a general errand even if someone gave it a stage.
      skill({ id: "mail", source: "muse", stage: "generate" }),
      skill({ id: "loose", stage: null }),
    ];
    expect(skills.map(columnOf)).toEqual([
      "plan",
      "auto",
      "muse",
      "muse",
      "unstaged",
    ]);
    const board = buildSkillBoard(skills, NOW);
    expect(board.strip.map((c) => c.title)).toEqual([
      "自动触发",
      "通用能力",
      "未分阶段",
    ]);
    expect(board.total).toBe(5);
  });

  it("leaves candidate and retired skills off the board", () => {
    const board = buildSkillBoard(
      [
        skill({ id: "a" }),
        skill({ id: "b", status: "candidate" }),
        skill({ id: "c", status: "retired", pinSlot: 2 }),
      ],
      NOW,
    );
    expect(skillsInReadingOrder(board).map((i) => i.skill.id)).toEqual(["a"]);
    expect(board.bySlot[2]).toBeUndefined();
  });

  it("tiers like the panorama: pinned by slot, then recent or new, then dormant", () => {
    const board = buildSkillBoard(
      [
        skill({ id: "dormant", orderIndex: 0, usageCount: 4, lastUsedAt: OLD }),
        skill({ id: "fresh", orderIndex: 1, createdAt: RECENT }),
        skill({ id: "used", orderIndex: 2, usageCount: 1, lastUsedAt: RECENT }),
        skill({ id: "pin3", orderIndex: 3, pinSlot: 3 }),
        skill({ id: "pin1", orderIndex: 4, pinSlot: 1, usageCount: 9 }),
      ],
      NOW,
    );
    const col = board.columns.find((c) => c.id === "diverge")!;
    expect(col.items.map((i) => [i.skill.id, i.tier])).toEqual([
      ["pin1", "pinned"],
      ["pin3", "pinned"],
      ["fresh", "active"],
      ["used", "active"],
      ["dormant", "dormant"],
    ]);
    expect(col.items.find((i) => i.skill.id === "fresh")!.isNew).toBe(true);
    expect(col.activeCount).toBe(4);
    expect(board.bySlot[1].skill.id).toBe("pin1");
    expect(board.maxUsageCount).toBe(9);
  });

  it("copies the invocation, or the name when there is none", () => {
    const board = buildSkillBoard(
      [
        skill({ id: "a", name: "EDL", invocation: "  用 EDL  " }),
        skill({ id: "b", name: "docx" }),
      ],
      NOW,
    );
    expect(skillsInReadingOrder(board).map((i) => i.copyText)).toEqual([
      "用 EDL",
      "docx",
    ]);
  });
});

describe("matchesSkill / skillPreviewText", () => {
  const item = buildSkillBoard(
    [
      skill({
        id: "pcr",
        name: "platform-capability-research",
        purpose: "核实平台当天的原生能力",
        whenToUse: "设计工作流之前",
        notFor: "要不要自建",
        invocation: "用 platform-capability-research 核实 ___",
        sourceUrl: "ai-colab 仓库 skills/",
      }),
    ],
    NOW,
  ).columns[1].items[0];

  it("finds a skill by what you would look it up by", () => {
    expect(matchesSkill(item, "")).toBe(true);
    expect(matchesSkill(item, "PLATFORM")).toBe(true);
    expect(matchesSkill(item, "原生能力")).toBe(true);
    expect(matchesSkill(item, "工作流")).toBe(true);
    expect(matchesSkill(item, "核实 ___")).toBe(true);
    // The boundary text is not a reason to pick it.
    expect(matchesSkill(item, "自建")).toBe(false);
  });

  it("puts purpose, when, not-for, invocation and source on the hover card", () => {
    expect(skillPreviewText(item.skill)).toBe(
      [
        "核实平台当天的原生能力",
        "什么时候用：设计工作流之前",
        "不用于：要不要自建",
        "调用句：用 platform-capability-research 核实 ___",
        "源地址：ai-colab 仓库 skills/",
      ].join("\n\n"),
    );
    expect(skillPreviewText(skill({ id: "bare" }))).toBe("");
  });
});
