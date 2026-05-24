import { useCopy } from "../hooks/useCopy";
import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";

import styles from "./AlignmentPhrases.module.css";

export function AlignmentPhrases() {
  const activePhaseId = useAppStore((s) => s.activePhaseId);
  const phrasesByPhase = usePromptStore((s) => s.alignmentPhrasesByPhase);
  const copy = useCopy();
  const flashId = useToastStore((s) => s.flashTargetId);

  const phrases =
    activePhaseId != null ? (phrasesByPhase[activePhaseId] ?? []) : [];

  return (
    <section
      className={styles.phrases}
      aria-label="对齐话术"
      data-region="alignment-phrases"
      tabIndex={0}
    >
      <span className={styles.label}>aligned</span>
      {phrases.length === 0 ? (
        <span className={styles.empty}>
          {activePhaseId == null ? "未选相位" : "暂无对齐话术"}
        </span>
      ) : (
        phrases.map((p) => {
          const cls = [
            styles.chip,
            p.isDefault ? styles.active : styles.dim,
            flashId === p.id ? styles.flash : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={p.id}
              type="button"
              className={cls}
              aria-label={p.name}
              onClick={() =>
                void copy(
                  p.content,
                  {
                    targetType: "alignment",
                    targetId: p.id,
                    source: "phase_bar",
                    modifierIds: null,
                    sopId: null,
                    sopStepOrder: null,
                    phaseId: p.phaseId,
                  },
                  p.id,
                )
              }
            >
              <span className={styles.dot} aria-hidden />
              {p.name}
            </button>
          );
        })
      )}
    </section>
  );
}
