import type {
  AlignmentPhrase,
  Composition,
  DraftPayload,
  UsageTargetType,
} from "../../ipc/types";

import type { PromptState } from "./types";

export const RECENT_LIMIT = 5;

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
