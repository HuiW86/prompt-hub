import { useMemo } from "react";

import type { AlignmentPhrase, Macro, Phrase } from "../ipc/types";
import { usePromptStore } from "../stores/promptStore";
import { useSearchStore } from "../stores/searchStore";

// PRD §5.0 search overlay surfaces these three types. SOP arrives in 第三阶段
// so the overlay reserves a slot but the hook returns no SOP hits for now.
export interface PhraseHit {
  phrase: Phrase;
  sceneName: string;
}

export interface AlignmentHit {
  ap: AlignmentPhrase;
  phaseName: string;
}

export interface SearchResults {
  query: string;
  macros: Macro[];
  phrases: PhraseHit[];
  alignments: AlignmentHit[];
  total: number;
}

function matches(needle: string, haystacks: (string | null | undefined)[]) {
  for (const h of haystacks) {
    if (h && h.toLowerCase().includes(needle)) return true;
  }
  return false;
}

export function useSearchResults(): SearchResults {
  const rawQuery = useSearchStore((s) => s.query);
  const phases = usePromptStore((s) => s.phases);
  const alignmentByPhase = usePromptStore((s) => s.alignmentPhrasesByPhase);
  const macros = usePromptStore((s) => s.macros);
  const scenes = usePromptStore((s) => s.scenes);

  return useMemo(() => {
    const q = rawQuery.trim().toLowerCase();
    if (!q) {
      return {
        query: rawQuery,
        macros: [],
        phrases: [],
        alignments: [],
        total: 0,
      };
    }

    const macroHits = macros.filter(
      (m) => !m.deprecated && matches(q, [m.name, m.content, m.notes]),
    );

    const phraseHits: PhraseHit[] = [];
    for (const sc of scenes) {
      for (const p of sc.phrases) {
        if (p.deprecated) continue;
        if (matches(q, [p.name, p.content, p.notes])) {
          phraseHits.push({ phrase: p, sceneName: sc.scene.name });
        }
      }
    }

    const phaseNameById = new Map(phases.map((p) => [p.id, p.name]));
    const alignmentHits: AlignmentHit[] = [];
    for (const list of Object.values(alignmentByPhase)) {
      for (const ap of list) {
        if (ap.deprecated) continue;
        if (matches(q, [ap.name, ap.content, ap.notes])) {
          alignmentHits.push({
            ap,
            phaseName: phaseNameById.get(ap.phaseId) ?? "?",
          });
        }
      }
    }

    // Sort each group by usageCount DESC then name ASC; spec §5.0 calls this
    // out as "相关度算法可演化" so anything richer (tf-idf, recency boost) goes
    // here later.
    macroHits.sort(
      (a, b) => b.usageCount - a.usageCount || a.name.localeCompare(b.name),
    );
    phraseHits.sort(
      (a, b) =>
        b.phrase.usageCount - a.phrase.usageCount ||
        a.phrase.name.localeCompare(b.phrase.name),
    );
    alignmentHits.sort(
      (a, b) =>
        b.ap.usageCount - a.ap.usageCount || a.ap.name.localeCompare(b.ap.name),
    );

    return {
      query: rawQuery,
      macros: macroHits,
      phrases: phraseHits,
      alignments: alignmentHits,
      total: macroHits.length + phraseHits.length + alignmentHits.length,
    };
  }, [rawQuery, phases, alignmentByPhase, macros, scenes]);
}
