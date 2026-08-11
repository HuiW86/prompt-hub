import type {
  AlignmentPhrase,
  Composition,
  DraftPayload,
  RecentUsageEntry,
  UsageTargetType,
} from "../../ipc/types";

import type { PromptState } from "./types";

// Distinct assets the wake surfaces.
export const RECENT_LIMIT = 5;

// Raw usage rows pulled from SQLite per refresh. Deliberately wider than
// RECENT_LIMIT because the wake is deduped by asset below: copying one Macro
// five times in a row used to fill the entire list with five identical lines,
// which carries no information the tile's own usage count doesn't already show.
//
// A window buys headroom, it does not guarantee a full wake: the dedupe caps at
// RECENT_LIMIT but can return FEWER. Copy one asset 40 times in a row and every
// fetched row collapses into a single entry while distinct older assets sit at
// row 41+, unreachable. Accepted for now — it under-fills, never shows wrong
// data, and one copy of anything else restores a second row. The structural fix
// is to dedupe in SQL (GROUP BY target_type, target_id with MAX(timestamp)) so
// the LIMIT counts distinct assets; see the characterisation test in
// __tests__/helpers.test.ts.
//
// Must stay <= RECENT_USAGE_LIMIT_MAX (100) in src-tauri/src/commands.rs, which
// silently clamps rather than erroring. The bound is asserted in that test.
export const RECENT_FETCH_LIMIT = 40;

// Collapse repeat copies of the same asset to its most recent touch. Rows
// arrive newest-first (list_recent_usage ORDER BY timestamp DESC), so the first
// row seen per asset IS its latest use and later duplicates are dropped.
// Rows whose target is gone (targetId null — asset deleted) can't be identified
// as "the same asset", so each keeps its own slot rather than collapsing
// unrelated tombstones into one.
export function dedupeRecent(entries: RecentUsageEntry[]): RecentUsageEntry[] {
  const seen = new Set<string>();
  const out: RecentUsageEntry[] = [];
  for (const entry of entries) {
    const { targetType, targetId, id } = entry.record;
    // targetType scopes the id: ids are unique per table, not across tables.
    const key = targetId ? `${targetType}:${targetId}` : `record:${id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
    if (out.length === RECENT_LIMIT) break;
  }
  return out;
}

export function indexByPhase(
  phrases: AlignmentPhrase[],
): Record<string, AlignmentPhrase[]> {
  return phrases.reduce<Record<string, AlignmentPhrase[]>>((acc, p) => {
    (acc[p.phaseId] ??= []).push(p);
    return acc;
  }, {});
}

export function indexCompositionsByPhase(
  compositions: Composition[],
): Record<string, Composition[]> {
  return compositions.reduce<Record<string, Composition[]>>((acc, c) => {
    (acc[c.phaseId] ??= []).push(c);
    return acc;
  }, {});
}

// Client-side mirror of DraftPayload::preview() in repo-core (80 chars,
// char-boundary safe via the spread iterator, Composition summarizes its
// modifier count) so the optimistic inbox card matches what a refetch shows.
const DRAFT_PREVIEW_MAX = 80;
export function draftPreview(payload: DraftPayload): string {
  const body =
    payload.target_type === "composition"
      ? `${payload.modifier_ids.length} modifiers`
      : payload.content;
  const chars = [...body];
  return chars.length > DRAFT_PREVIEW_MAX
    ? `${chars.slice(0, DRAFT_PREVIEW_MAX).join("")}…`
    : body;
}

// Mutate the matching asset list so the UI reflects the bump without a full
// refetch on every copy. Only Macro/Phrase/AlignmentPhrase carry a usage_count
// the dashboard cares about; Modifier is not surfaced in phase 1.
export function bumpUsageCount(
  state: PromptState,
  targetType: UsageTargetType,
  targetId: string | null,
  nowIso: string,
): Partial<PromptState> {
  if (!targetId) return {};
  switch (targetType) {
    case "macro":
      return {
        macros: state.macros.map((m) =>
          m.id === targetId
            ? { ...m, usageCount: m.usageCount + 1, lastUsedAt: nowIso }
            : m,
        ),
      };
    case "phrase":
      return {
        scenes: state.scenes.map((sc) => ({
          ...sc,
          phrases: sc.phrases.map((p) =>
            p.id === targetId
              ? { ...p, usageCount: p.usageCount + 1, lastUsedAt: nowIso }
              : p,
          ),
        })),
      };
    case "alignment": {
      const next: Record<string, AlignmentPhrase[]> = {};
      for (const [phaseId, list] of Object.entries(
        state.alignmentPhrasesByPhase,
      )) {
        next[phaseId] = list.map((a) =>
          a.id === targetId
            ? { ...a, usageCount: a.usageCount + 1, lastUsedAt: nowIso }
            : a,
        );
      }
      return { alignmentPhrasesByPhase: next };
    }
    default:
      return {};
  }
}
