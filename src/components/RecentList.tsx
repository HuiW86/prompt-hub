import { useCopy } from "../hooks/useCopy";
import { usePromptStore } from "../stores/promptStore";
import { relativeTime } from "../utils/time";

import { EmptyState, RegionHeader } from "./primitives";
import styles from "./RecentList.module.css";

export function RecentList() {
  const recent = usePromptStore((s) => s.recentUsage);
  const copy = useCopy();

  return (
    <section
      className={styles.region}
      aria-label="最近使用"
      data-region="recent-list"
      tabIndex={0}
    >
      <RegionHeader title="最近使用" count={recent.length} />
      {recent.length === 0 ? (
        <EmptyState>完成 3 次复制后会在这里看到</EmptyState>
      ) : (
        <ul className={styles.list}>
          {recent.map((entry) => {
            const canRecopy = Boolean(
              entry.targetContent && entry.record.targetId,
            );
            return (
              <li key={entry.record.id}>
                <button
                  type="button"
                  className={styles.item}
                  disabled={!canRecopy}
                  onClick={() => {
                    if (!canRecopy) return;
                    void copy(
                      entry.targetContent ?? "",
                      {
                        targetType: entry.record.targetType,
                        targetId: entry.record.targetId,
                        source: "recent",
                        modifierIds: null,
                        sopId: null,
                        sopStepOrder: null,
                        phaseId: entry.record.phaseId,
                      },
                      entry.record.targetId ?? undefined,
                    );
                  }}
                  aria-label={entry.targetName ?? "未知话术"}
                >
                  <span className={styles.itemName}>
                    {entry.targetName ?? "（未知话术）"}
                  </span>
                  <span className={styles.itemTime}>
                    {relativeTime(entry.record.timestamp)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
