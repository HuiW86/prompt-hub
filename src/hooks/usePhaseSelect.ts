import { useCallback } from "react";

import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";

import { useCopy } from "./useCopy";

// Selecting a phase = activating it in the app shell AND copying its default
// AlignmentPhrase with source='phase_bar'. Shared by PhaseBar clicks (B3) and
// ⌘1-⌘8 global shortcuts (B5-1), so both paths stay in lockstep — including
// the convention that flashId is the phaseId (not the AP id).
// Wrapped in useCallback so App.tsx's document keydown effect can depend on
// it without tearing down on every render. Reads alignmentPhrasesByPhase via
// getState so changes to that slice don't invalidate the callback.
export function usePhaseSelect() {
  const setActivePhase = useAppStore((s) => s.setActivePhase);
  const copy = useCopy();

  return useCallback(
    function selectPhase(phaseId: string): void {
      setActivePhase(phaseId);
      const aps =
        usePromptStore.getState().alignmentPhrasesByPhase[phaseId] ?? [];
      const def = aps.find((a) => a.isDefault) ?? aps[0];
      if (!def) return;
      void copy(
        def.content,
        {
          targetType: "alignment",
          targetId: def.id,
          source: "phase_bar",
          modifierIds: null,
          sopId: null,
          sopStepOrder: null,
          phaseId,
        },
        phaseId,
      );
    },
    [setActivePhase, copy],
  );
}
