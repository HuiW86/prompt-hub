import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";
import { primaryModifierLabel } from "../utils/platform";

import primitiveStyles from "./primitives/primitives.module.css";
import styles from "./PhaseBar.module.css";

export function PhaseBar() {
  const phases = usePromptStore((s) => s.phases);
  const activePhaseId = useAppStore((s) => s.activePhaseId);
  const setActivePhase = useAppStore((s) => s.setActivePhase);
  const hiddenIds = useSettingsStore((s) => s.hiddenPhaseIds);
  const flashId = useToastStore((s) => s.flashTargetId);
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
          flashId === phase.id
            ? `${primitiveStyles.protocol} ${primitiveStyles.flash}`
            : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={phase.id}
            type="button"
            aria-current={isActive ? "true" : undefined}
            className={cls}
            data-phase-id={phase.id}
            onClick={() => setActivePhase(phase.id)}
          >
            <span className={styles.num} aria-hidden>
              {idx + 1}
            </span>
            <span className={styles.label}>{phase.name}</span>
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
