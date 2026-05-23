import { useCopy } from "../hooks/useCopy";
import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";

import styles from "./PhaseBar.module.css";

export function PhaseBar() {
  const phases = usePromptStore((s) => s.phases);
  const alignmentByPhase = usePromptStore((s) => s.alignmentPhrasesByPhase);
  const activePhaseId = useAppStore((s) => s.activePhaseId);
  const setActivePhase = useAppStore((s) => s.setActivePhase);
  const hiddenIds = useSettingsStore((s) => s.hiddenPhaseIds);
  const flashId = useToastStore((s) => s.flashTargetId);
  const copy = useCopy();
  const visible = phases.filter((p) => !hiddenIds.includes(p.id));

  function handleSelect(phaseId: string) {
    setActivePhase(phaseId);
    const aps = alignmentByPhase[phaseId] ?? [];
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
  }

  return (
    <nav
      className={styles.phaseBar}
      aria-label="相位带"
      data-region="phase-bar"
    >
      {visible.map((phase, idx) => {
        const isActive = phase.id === activePhaseId;
        const cls = [
          styles.phase,
          isActive ? styles.active : "",
          flashId === phase.id ? styles.flash : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={phase.id}
            type="button"
            className={cls}
            aria-current={isActive ? "true" : undefined}
            data-phase-id={phase.id}
            onClick={() => handleSelect(phase.id)}
          >
            <span className={styles.name}>{phase.name}</span>
            <kbd className={styles.shortcut}>⌘{idx + 1}</kbd>
          </button>
        );
      })}
    </nav>
  );
}
