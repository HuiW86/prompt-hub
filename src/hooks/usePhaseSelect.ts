import { useCallback } from "react";

import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";

import { useCopy } from "./useCopy";

// Keyboard launcher path (⌘1-⌘8, B5-1): activate the phase AND copy its default
// AlignmentPhrase (source='phase_bar'), which triggers copy-then-hide so the
// user grabs the opener and the window dismisses. PhaseBar mouse clicks
// deliberately do NOT use this — clicking inside the open window means
// "browse/manage", so it only activates (no copy, no hide); otherwise entering
// a phase's AlignmentPhrase manage panel would be impossible (the switch would
// hide the window first). flashId is the phaseId (not the AP id) by convention.
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
