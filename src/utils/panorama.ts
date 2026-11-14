import { alignmentUsageSource } from "../ipc/usageSource";
import type {
  AlignmentPhrase,
  Composition,
  Macro,
  Modifier,
  PanoramaAssetKind,
  PanoramaGroupId,
  PanoramaPlacement,
  Phrase,
  RecordUsageInput,
} from "../ipc/types";

import {
  buildAlignmentCopyText,
  type AxisValueLookup,
} from "./alignmentCopyText";

// The panorama model (I-03 / ADR-031; columns per ADR-032). Pure: no IPC, no
// store, `now` passed in.
//
// Every item is always present in the model. Tiers decide how loud an item is,
// never whether it is shown ("变暗不消失"), and position comes from the user's
// placement or the default rule, never from usage ("位置稳定").

export type PanoramaTier = "pinned" | "active" | "dormant";
export type PanoramaColumnId = PanoramaGroupId | "ungrouped";

export interface PanoramaItem {
  kind: PanoramaAssetKind;
  id: string;
  name: string;
  /** The exact text that goes to the clipboard. */
  content: string;
  usageCount: number;
  lastUsedAt: string | null;
  tier: PanoramaTier;
  isNew: boolean;
  pinSlot: number | null;
  /** The user's explicit group, or null when the default rule placed it. */
  groupId: PanoramaGroupId | null;
  /** The usage record a copy of this item writes — the same values the
   *  organize workspace's own copy paths write for the same asset. */
  usage: RecordUsageInput;
}

export interface PanoramaColumn {
  id: PanoramaColumnId;
  title: string;
  /** pinned (by pinSlot) → active → dormant; stable order within a tier. */
  items: PanoramaItem[];
  /** pinned + active (new items are active). */
  activeCount: number;
}

export interface PanoramaModel {
  /** The eight work-stage columns, plus `ungrouped` when it has items. */
  columns: PanoramaColumn[];
  /** The bottom strip: live cues, tools. */
  strip: PanoramaColumn[];
  bySlot: Record<number, PanoramaItem>;
  /** Highest usageCount in the library; the denominator of the usage bars. */
  maxUsageCount: number;
}

export const ACTIVE_WINDOW_DAYS = 90;
export const NEW_WINDOW_DAYS = 14;
const DAY_MS = 86_400_000;

// Titles are the phase names, so a column reads the same as the phase bar.
export const COLUMN_TITLES: Record<PanoramaColumnId, string> = {
  understand: "理解",
  diverge: "发散",
  converge: "收敛",
  plan: "规划",
  generate: "生成",
  execute: "执行",
  iterate: "迭代",
  distill: "沉淀",
  cue: "中途口令",
  tool: "工具",
  ungrouped: "未分组",
};

/** The work stages, left to right in the order a piece of work moves. */
export const STAGE_COLUMN_IDS: readonly PanoramaGroupId[] = [
  "understand",
  "diverge",
  "converge",
  "plan",
  "generate",
  "execute",
  "iterate",
  "distill",
];
export const STRIP_COLUMN_IDS: readonly PanoramaGroupId[] = ["cue", "tool"];
export const ALL_GROUP_IDS: readonly PanoramaGroupId[] = [
  ...STAGE_COLUMN_IDS,
  ...STRIP_COLUMN_IDS,
];

/** The one default rule: an item that carries a phase sits in that phase's
 *  column. Alignment phrases and compositions carry one; macros, scene
 *  phrases and modifiers do not, so they wait in 未分组 for the user. */
export const PHASE_TO_GROUP: Readonly<Record<string, PanoramaGroupId>> = {
  "phase-understand": "understand",
  "phase-diverge": "diverge",
  "phase-converge": "converge",
  "phase-plan": "plan",
  "phase-generate": "generate",
  "phase-execute": "execute",
  "phase-iterate": "iterate",
  "phase-distill": "distill",
  "phase-live": "cue",
};

export interface BuildPanoramaInput {
  macros: Macro[];
  phrases: Phrase[];
  alignmentPhrases: AlignmentPhrase[];
  modifiers: Modifier[];
  compositions: Composition[];
  placements: PanoramaPlacement[];
  now: Date;
  /** Resolves alignment coordinates into the copy prefix. Omit = no prefix. */
  alignmentAxisValuesById?: AxisValueLookup;
}

/**
 * A composition's clipboard text: its modifiers' contents in the stored order,
 * one blank line apart. A modifier that is no longer in the library is skipped
 * rather than leaving a hole. Copy-time assembly, never stored (06-prd §6).
 */
export function buildCompositionText(
  composition: Pick<Composition, "modifierIds">,
  modifiersById: ReadonlyMap<string, Pick<Modifier, "content">>,
): string {
  return composition.modifierIds
    .map((id) => modifiersById.get(id)?.content)
    .filter((c): c is string => c != null && c.length > 0)
    .join("\n\n");
}

interface Draft {
  kind: PanoramaAssetKind;
  id: string;
  name: string;
  content: string;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  defaultGroup: PanoramaColumnId;
  usage: RecordUsageInput;
}

function usage(
  targetType: RecordUsageInput["targetType"],
  targetId: string,
  source: RecordUsageInput["source"],
  extra: Partial<Pick<RecordUsageInput, "modifierIds" | "phaseId">> = {},
): RecordUsageInput {
  return {
    targetType,
    targetId,
    source,
    modifierIds: extra.modifierIds ?? null,
    sopId: null,
    sopStepOrder: null,
    phaseId: extra.phaseId ?? null,
  };
}

function ageMs(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : now - t;
}

function tierOf(
  d: Draft,
  pinSlot: number | null,
  now: number,
): { tier: PanoramaTier; isNew: boolean } {
  if (pinSlot != null) return { tier: "pinned", isNew: false };
  const created = ageMs(d.createdAt, now);
  const isNew =
    d.usageCount === 0 &&
    created != null &&
    created <= NEW_WINDOW_DAYS * DAY_MS;
  if (isNew) return { tier: "active", isNew: true };
  const used = ageMs(d.lastUsedAt, now);
  if (used != null && used <= ACTIVE_WINDOW_DAYS * DAY_MS) {
    return { tier: "active", isNew: false };
  }
  return { tier: "dormant", isNew: false };
}

const TIER_RANK: Record<PanoramaTier, number> = {
  pinned: 0,
  active: 1,
  dormant: 2,
};

function placementKey(kind: PanoramaAssetKind, id: string): string {
  return `${kind}:${id}`;
}

export function buildPanorama(input: BuildPanoramaInput): PanoramaModel {
  const now = input.now.getTime();
  const axis = input.alignmentAxisValuesById ?? {};
  const modifiersById = new Map(input.modifiers.map((m) => [m.id, m]));

  // Source order is the stable within-tier order: each list arrives from the
  // store already in its own user-controlled order, so concatenating them in a
  // fixed kind order never reorders anything on a usage change.
  const drafts: Draft[] = [];
  for (const p of input.alignmentPhrases) {
    if (p.deprecated) continue;
    drafts.push({
      kind: "alignment_phrase",
      id: p.id,
      name: p.name,
      content: buildAlignmentCopyText(p, axis),
      usageCount: p.usageCount,
      lastUsedAt: p.lastUsedAt,
      createdAt: p.createdAt,
      defaultGroup: PHASE_TO_GROUP[p.phaseId] ?? "ungrouped",
      usage: usage("alignment", p.id, alignmentUsageSource(p, "phase_bar"), {
        phaseId: p.phaseId,
      }),
    });
  }
  for (const m of input.macros) {
    if (m.deprecated) continue;
    drafts.push({
      kind: "macro",
      id: m.id,
      name: m.name,
      content: m.content,
      usageCount: m.usageCount,
      lastUsedAt: m.lastUsedAt,
      createdAt: m.createdAt,
      defaultGroup: "ungrouped",
      usage: usage("macro", m.id, "macro_area"),
    });
  }
  for (const p of input.phrases) {
    if (p.deprecated) continue;
    drafts.push({
      kind: "phrase",
      id: p.id,
      name: p.name,
      content: p.content,
      usageCount: p.usageCount,
      lastUsedAt: p.lastUsedAt,
      createdAt: p.createdAt,
      defaultGroup: "ungrouped",
      usage: usage("phrase", p.id, "scene"),
    });
  }
  for (const c of input.compositions) {
    if (c.deprecated) continue;
    drafts.push({
      kind: "composition",
      id: c.id,
      name: c.name,
      content: buildCompositionText(c, modifiersById),
      usageCount: c.usageCount,
      lastUsedAt: c.lastUsedAt,
      createdAt: c.createdAt,
      defaultGroup: PHASE_TO_GROUP[c.phaseId] ?? "ungrouped",
      usage: usage("composition", c.id, "composition", {
        modifierIds: c.modifierIds,
        phaseId: c.phaseId,
      }),
    });
  }
  for (const m of input.modifiers) {
    if (m.deprecated) continue;
    drafts.push({
      kind: "modifier",
      id: m.id,
      name: m.name,
      content: m.content,
      usageCount: m.usageCount,
      lastUsedAt: m.lastUsedAt,
      createdAt: m.createdAt,
      defaultGroup: "ungrouped",
      // Same source the organize workspace's modifier chips record.
      usage: usage("modifier", m.id, "macro_area"),
    });
  }

  const placements = new Map(
    input.placements.map((p) => [placementKey(p.assetKind, p.assetId), p]),
  );

  const buckets = new Map<PanoramaColumnId, PanoramaItem[]>();
  const bySlot: Record<number, PanoramaItem> = {};
  let maxUsageCount = 0;
  for (const d of drafts) {
    const placement = placements.get(placementKey(d.kind, d.id));
    const pinSlot = placement?.pinSlot ?? null;
    const groupId = placement?.groupId ?? null;
    const { tier, isNew } = tierOf(d, pinSlot, now);
    const item: PanoramaItem = {
      kind: d.kind,
      id: d.id,
      name: d.name,
      content: d.content,
      usageCount: d.usageCount,
      lastUsedAt: d.lastUsedAt,
      tier,
      isNew,
      pinSlot,
      groupId,
      usage: d.usage,
    };
    maxUsageCount = Math.max(maxUsageCount, d.usageCount);
    if (pinSlot != null) bySlot[pinSlot] = item;
    const column: PanoramaColumnId = groupId ?? d.defaultGroup;
    const list = buckets.get(column);
    if (list) list.push(item);
    else buckets.set(column, [item]);
  }

  const column = (id: PanoramaColumnId): PanoramaColumn => {
    const items = (buckets.get(id) ?? [])
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const t = TIER_RANK[a.item.tier] - TIER_RANK[b.item.tier];
        if (t !== 0) return t;
        if (a.item.tier === "pinned") {
          return (a.item.pinSlot ?? 0) - (b.item.pinSlot ?? 0);
        }
        return a.index - b.index;
      })
      .map(({ item }) => item);
    return {
      id,
      title: COLUMN_TITLES[id],
      items,
      activeCount: items.filter((i) => i.tier !== "dormant").length,
    };
  };

  const columns = STAGE_COLUMN_IDS.map(column);
  if ((buckets.get("ungrouped")?.length ?? 0) > 0) {
    columns.push(column("ungrouped"));
  }
  return {
    columns,
    strip: STRIP_COLUMN_IDS.map(column),
    bySlot,
    maxUsageCount,
  };
}

/** Case-insensitive match on name or clipboard text. Blank query matches all. */
export function matchesFilter(item: PanoramaItem, query: string): boolean {
  const q = query.trim().toLocaleLowerCase();
  if (q === "") return true;
  return (
    item.name.toLocaleLowerCase().includes(q) ||
    item.content.toLocaleLowerCase().includes(q)
  );
}

/** Reading order for keyboard focus and "first match": columns left to right,
 *  each top to bottom, then the strip the same way. */
export function itemsInReadingOrder(model: PanoramaModel): PanoramaItem[] {
  return [...model.columns, ...model.strip].flatMap((c) => c.items);
}
