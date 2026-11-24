import { useMemo } from "react";

import { usePanoramaStore } from "../stores/panoramaStore";
import { usePromptStore } from "../stores/promptStore";
import { buildPanorama, type PanoramaModel } from "../utils/panorama";

/** The panorama model from the live stores. Shared by the panorama and the
 *  quick view (ADR-034) so both read the same items and the same pin slots. */
export function usePanoramaModel(): PanoramaModel {
  const phases = usePromptStore((s) => s.phases);
  const macros = usePromptStore((s) => s.macros);
  const modifiers = usePromptStore((s) => s.modifiers);
  const scenes = usePromptStore((s) => s.scenes);
  const alignmentByPhase = usePromptStore((s) => s.alignmentPhrasesByPhase);
  const compositionsByPhase = usePromptStore((s) => s.compositionsByPhase);
  const axisById = usePromptStore((s) => s.alignmentAxisValuesById);
  const placements = usePanoramaStore((s) => s.placements);

  return useMemo(() => {
    // Phase order first, so alignment phrases enter in the order the phase
    // bar shows them; buckets for phases the store no longer lists come last.
    const order = [
      ...phases.map((p) => p.id),
      ...Object.keys(alignmentByPhase).filter(
        (id) => !phases.some((p) => p.id === id),
      ),
    ];
    const compOrder = [
      ...phases.map((p) => p.id),
      ...Object.keys(compositionsByPhase).filter(
        (id) => !phases.some((p) => p.id === id),
      ),
    ];
    return buildPanorama({
      macros,
      modifiers,
      phrases: scenes.flatMap((s) => s.phrases),
      alignmentPhrases: order.flatMap((id) => alignmentByPhase[id] ?? []),
      compositions: compOrder.flatMap((id) => compositionsByPhase[id] ?? []),
      placements,
      now: new Date(),
      alignmentAxisValuesById: axisById,
    });
  }, [
    phases,
    macros,
    modifiers,
    scenes,
    alignmentByPhase,
    compositionsByPhase,
    placements,
    axisById,
  ]);
}
