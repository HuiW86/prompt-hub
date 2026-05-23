import { useCopy } from "../hooks/useCopy";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { relativeTime } from "../utils/time";

import styles from "./MacroGrid.module.css";

const HOT_TOP_N = 4;

export function MacroGrid() {
  const macros = usePromptStore((s) => s.macros);
  const copy = useCopy();
  const flashId = useToastStore((s) => s.flashTargetId);

  return (
    <section
      className={styles.macroGrid}
      aria-label="Macro 快捷区"
      data-region="macro-grid"
      tabIndex={0}
    >
      <header className={styles.heading}>
        <h2 className={styles.title}>Macro</h2>
        <span className={styles.count}>{macros.length} 张</span>
      </header>
      {macros.length === 0 ? (
        <p className={styles.empty}>暂无 Macro · 把高频组合保存下来吧</p>
      ) : (
        <div className={styles.grid}>
          {macros.map((m, idx) => {
            const classes = [
              styles.card,
              idx < HOT_TOP_N ? styles.hot : "",
              flashId === m.id ? styles.flash : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={m.id}
                type="button"
                className={classes}
                onClick={() =>
                  void copy(
                    m.content,
                    {
                      targetType: "macro",
                      targetId: m.id,
                      source: "macro_area",
                      modifierIds: null,
                      sopId: null,
                      sopStepOrder: null,
                      phaseId: null,
                    },
                    m.id,
                  )
                }
                aria-label={m.name}
              >
                <h3 className={styles.cardTitle}>
                  {idx < HOT_TOP_N && (
                    <span className={styles.flame} aria-hidden>
                      🔥
                    </span>
                  )}
                  {m.name}
                </h3>
                <p className={styles.cardContent}>{m.content}</p>
                <div className={styles.meta}>
                  <span>{m.usageCount} 次</span>
                  <span>{relativeTime(m.lastUsedAt)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
