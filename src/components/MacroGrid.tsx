import { Flame } from "lucide-react";

import { useCopy } from "../hooks/useCopy";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { relativeTime } from "../utils/time";

import { EmptyState, RegionHeader } from "./primitives";
import styles from "./MacroGrid.module.css";

const HOT_TOP_N = 4;

export function MacroGrid() {
  const macros = usePromptStore((s) => s.macros);
  const copy = useCopy();
  const flashId = useToastStore((s) => s.flashTargetId);

  return (
    <section
      className={styles.region}
      aria-label="Macro 快捷区"
      data-region="macro-grid"
      tabIndex={0}
    >
      <RegionHeader title="Macro" count={`${macros.length} 张`} />
      {macros.length === 0 ? (
        <EmptyState>暂无 Macro · 把高频组合保存下来吧</EmptyState>
      ) : (
        <div className={styles.grid}>
          {macros.map((m, idx) => {
            const isHot = idx < HOT_TOP_N;
            const classes = [styles.card, flashId === m.id ? styles.flash : ""]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={m.id}
                type="button"
                className={classes}
                aria-label={m.name}
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
              >
                <h3 className={styles.title}>
                  {isHot && (
                    <Flame
                      size={12}
                      className={styles.hotIc}
                      aria-hidden
                      strokeWidth={2}
                    />
                  )}
                  <span>{m.name}</span>
                </h3>
                <p className={styles.body}>{m.content}</p>
                <div className={styles.meta}>
                  <span>{m.usageCount} 次</span>
                  <span className={styles.sep}>·</span>
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
