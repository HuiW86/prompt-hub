import { usePhaseSelect } from "../hooks/usePhaseSelect";
import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";
import { primaryModifierLabel } from "../utils/platform";

import styles from "./PhaseBar.module.css";

export function PhaseBar() {
  const phases = usePromptStore((s) => s.phases);
  const activePhaseId = useAppStore((s) => s.activePhaseId);
  const hiddenIds = useSettingsStore((s) => s.hiddenPhaseIds);
  const flashId = useToastStore((s) => s.flashTargetId);
  const selectPhase = usePhaseSelect();
  const visible = phases.filter((p) => !hiddenIds.includes(p.id));

  return (
    <nav
      className={styles.phaseBar}
      aria-label="相位带"
      data-region="phase-bar"
      tabIndex={0}
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
            onClick={() => selectPhase(phase.id)}
          >
            <span className={styles.name}>{phase.name}</span>
            <kbd className={styles.shortcut}>
              {primaryModifierLabel()}
              {idx + 1}
            </kbd>
          </button>
        );
      })}
    </nav>
  );
}
