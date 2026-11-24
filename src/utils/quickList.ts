import type { Website } from "../ipc/types";

import type { PanoramaItem } from "./panorama";
import type { SkillItem } from "./skills";

// The quick view's list model (ADR-034, issue #50). Pure: no IPC, no store.
//
// One flat list across prompts, skills and websites. Empty query: the
// panorama's pin slots 1–9 first (position fixed, so muscle memory holds),
// then everything else by last use, most recent first. With a query: matches
// ranked by where the query hits (name prefix > name > body), then by use
// count. Pins stay pinned: a pinned item that matches leads its rank band.

export type QuickEntry =
  | { kind: "prompt"; key: string; item: PanoramaItem }
  | { kind: "skill"; key: string; item: SkillItem }
  | { kind: "website"; key: string; site: Website };

export interface QuickRow {
  key: string;
  entry: QuickEntry;
  name: string;
  /** First non-blank line of the body — the cue a title alone lacks. */
  firstLine: string;
  /** Full text shown in the preview footer. */
  body: string;
  pinSlot: number | null;
  usageCount: number | null;
  lastUsedAt: string | null;
}

export function firstLineOf(text: string): string {
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (t !== "") return t;
  }
  return "";
}

export function toQuickRows(input: {
  prompts: readonly PanoramaItem[];
  skills: readonly SkillItem[];
  websites: readonly Website[];
}): QuickRow[] {
  const rows: QuickRow[] = [];
  for (const item of input.prompts) {
    const key = `prompt:${item.kind}:${item.id}`;
    rows.push({
      key,
      entry: { kind: "prompt", key, item },
      name: item.name,
      firstLine: firstLineOf(item.content),
      body: item.content,
      pinSlot: item.pinSlot,
      usageCount: item.usageCount,
      lastUsedAt: item.lastUsedAt,
    });
  }
  for (const item of input.skills) {
    const s = item.skill;
    const key = `skill:${s.id}`;
    // Skill pins belong to the skill board; the quick view's 1–9 are the
    // panorama's, so a skill never claims a slot here.
    rows.push({
      key,
      entry: { kind: "skill", key, item },
      name: s.name,
      firstLine: firstLineOf(s.purpose) || item.copyText,
      body: [s.purpose, s.whenToUse, item.copyText]
        .filter((t) => t.trim() !== "")
        .join("\n\n"),
      pinSlot: null,
      usageCount: s.usageCount,
      lastUsedAt: s.lastUsedAt,
    });
  }
  for (const site of input.websites) {
    if (site.deletedAt) continue;
    const key = `website:${site.id}`;
    rows.push({
      key,
      entry: { kind: "website", key, site },
      name: site.name,
      firstLine: site.description.trim() || site.url,
      body: site.description.trim()
        ? `${site.description.trim()}\n\n${site.url}`
        : site.url,
      pinSlot: null,
      usageCount: null,
      lastUsedAt: null,
    });
  }
  return rows;
}

function time(iso: string | null): number {
  if (!iso) return -Infinity;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

/** 0 = name starts with q, 1 = name contains q, 2 = body contains q, -1 = no match. */
export function matchRank(row: QuickRow, query: string): number {
  const q = query.trim().toLocaleLowerCase();
  if (q === "") return 0;
  const name = row.name.toLocaleLowerCase();
  if (name.startsWith(q)) return 0;
  if (name.includes(q)) return 1;
  if (row.body.toLocaleLowerCase().includes(q)) return 2;
  return -1;
}

/** The order the quick view shows. Stable: ties keep input order. */
export function orderQuickRows(rows: readonly QuickRow[], query: string) {
  const indexed = rows.map((row, index) => ({ row, index }));
  if (query.trim() === "") {
    return indexed
      .sort((a, b) => {
        const pa = a.row.pinSlot ?? Infinity;
        const pb = b.row.pinSlot ?? Infinity;
        if (pa !== pb) return pa - pb;
        const t = time(b.row.lastUsedAt) - time(a.row.lastUsedAt);
        if (t !== 0 && !Number.isNaN(t)) return t;
        return a.index - b.index;
      })
      .map(({ row }) => row);
  }
  return indexed
    .map((e) => ({ ...e, rank: matchRank(e.row, query) }))
    .filter((e) => e.rank !== -1)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      const pa = a.row.pinSlot ?? Infinity;
      const pb = b.row.pinSlot ?? Infinity;
      if (pa !== pb) return pa - pb;
      const u = (b.row.usageCount ?? -1) - (a.row.usageCount ?? -1);
      if (u !== 0) return u;
      return a.index - b.index;
    })
    .map(({ row }) => row);
}
