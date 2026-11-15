import type { Skill, SkillSource, SkillStage } from "../ipc/types";

import { ACTIVE_WINDOW_DAYS, NEW_WINDOW_DAYS } from "./panorama";

// The skill board (ADR-033): the panorama's layout applied to the skill index.
// Six stage columns — the panorama's stage words minus 收敛 and 执行, which
// hold no skill a person calls by hand — and bottom strips for what is listed
// to be seen rather than fetched. Tiers follow the panorama exactly: pinned by
// the user, active by recent use (or newly added), dormant otherwise. Nothing
// installed is ever hidden; candidate and retired rows are not on the board.

export type SkillTier = "pinned" | "active" | "dormant";
export type SkillColumnId = SkillStage | "auto" | "muse" | "unstaged";

export interface SkillItem {
  skill: Skill;
  tier: SkillTier;
  isNew: boolean;
  /** What a copy puts on the clipboard: the invocation, or the name. */
  copyText: string;
}

export interface SkillColumn {
  id: SkillColumnId;
  title: string;
  items: SkillItem[];
  activeCount: number;
}

export interface SkillBoard {
  columns: SkillColumn[];
  /** Only the strip groups that have something in them. */
  strip: SkillColumn[];
  bySlot: Record<number, SkillItem>;
  maxUsageCount: number;
  /** Installed skills on the board; the empty state keys off this. */
  total: number;
}

export const SKILL_STAGES: readonly SkillStage[] = [
  "understand",
  "diverge",
  "plan",
  "generate",
  "iterate",
  "distill",
];

export const SKILL_COLUMN_TITLES: Record<SkillColumnId, string> = {
  understand: "理解",
  diverge: "发散",
  plan: "规划",
  generate: "生成",
  iterate: "迭代",
  distill: "沉淀",
  auto: "自动触发",
  muse: "通用能力",
  unstaged: "未分阶段",
};

export const SKILL_SOURCE_LABELS: Record<SkillSource, string> = {
  own: "自建",
  anthropic: "Anthropic",
  muse: "Muse",
  community: "社区",
};

const DAY_MS = 86_400_000;
const TIER_RANK: Record<SkillTier, number> = {
  pinned: 0,
  active: 1,
  dormant: 2,
};

function ageMs(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : now - t;
}

function tierOf(
  skill: Skill,
  now: number,
): { tier: SkillTier; isNew: boolean } {
  if (skill.pinSlot != null) return { tier: "pinned", isNew: false };
  const created = ageMs(skill.createdAt, now);
  const isNew =
    skill.usageCount === 0 &&
    created != null &&
    created <= NEW_WINDOW_DAYS * DAY_MS;
  if (isNew) return { tier: "active", isNew: true };
  const used = ageMs(skill.lastUsedAt, now);
  if (used != null && used <= ACTIVE_WINDOW_DAYS * DAY_MS) {
    return { tier: "active", isNew: false };
  }
  return { tier: "dormant", isNew: false };
}

/** Which column a skill lives in. Muse built-ins are general errands, not work
 *  stages; auto-triggered skills are seen, not called; a called skill with no
 *  stage is shown apart rather than dropped. */
export function columnOf(skill: Skill): SkillColumnId {
  if (skill.source === "muse") return "muse";
  if (skill.trigger === "auto") return "auto";
  return skill.stage ?? "unstaged";
}

function column(id: SkillColumnId, items: SkillItem[]): SkillColumn {
  const sorted = items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const t = TIER_RANK[a.item.tier] - TIER_RANK[b.item.tier];
      if (t !== 0) return t;
      if (a.item.tier === "pinned") {
        return (a.item.skill.pinSlot ?? 0) - (b.item.skill.pinSlot ?? 0);
      }
      return a.i - b.i;
    })
    .map(({ item }) => item);
  return {
    id,
    title: SKILL_COLUMN_TITLES[id],
    items: sorted,
    activeCount: sorted.filter((i) => i.tier !== "dormant").length,
  };
}

export function buildSkillBoard(skills: Skill[], now: Date): SkillBoard {
  const t = now.getTime();
  const groups = new Map<SkillColumnId, SkillItem[]>();
  const bySlot: Record<number, SkillItem> = {};
  let maxUsageCount = 0;
  let total = 0;
  // Index order is the stable within-tier order.
  const ordered = [...skills].sort(
    (a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id),
  );
  for (const skill of ordered) {
    if (skill.status !== "installed") continue;
    total += 1;
    const { tier, isNew } = tierOf(skill, t);
    const item: SkillItem = {
      skill,
      tier,
      isNew,
      copyText: skill.invocation.trim() || skill.name,
    };
    if (skill.pinSlot != null) bySlot[skill.pinSlot] = item;
    maxUsageCount = Math.max(maxUsageCount, skill.usageCount);
    const id = columnOf(skill);
    const list = groups.get(id) ?? [];
    list.push(item);
    groups.set(id, list);
  }
  const strip = (["auto", "muse", "unstaged"] as const)
    .filter((id) => (groups.get(id)?.length ?? 0) > 0)
    .map((id) => column(id, groups.get(id) ?? []));
  return {
    columns: SKILL_STAGES.map((id) => column(id, groups.get(id) ?? [])),
    strip,
    bySlot,
    maxUsageCount,
    total,
  };
}

/** Case-insensitive match on what you would look a skill up by: its name,
 *  what it is for, when to use it, and the sentence that calls it. */
export function matchesSkill(item: SkillItem, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (q === "") return true;
  const s = item.skill;
  return [s.name, s.purpose, s.whenToUse, s.invocation].some((f) =>
    f.toLocaleLowerCase().includes(q),
  );
}

/** Columns left to right, each top to bottom, then the strip the same way. */
export function skillsInReadingOrder(board: SkillBoard): SkillItem[] {
  return [...board.columns, ...board.strip].flatMap((c) => c.items);
}

/** The hover card body: everything you need to decide whether this is the one. */
export function skillPreviewText(skill: Skill): string {
  const lines: string[] = [];
  if (skill.purpose) lines.push(skill.purpose);
  if (skill.whenToUse) lines.push(`什么时候用：${skill.whenToUse}`);
  if (skill.notFor) lines.push(`不用于：${skill.notFor}`);
  if (skill.invocation) lines.push(`调用句：${skill.invocation}`);
  if (skill.sourceUrl) lines.push(`源地址：${skill.sourceUrl}`);
  return lines.join("\n\n");
}
