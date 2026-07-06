import { useCopy } from "../hooks/useCopy";
import { useRegionNav } from "../hooks/useRegionNav";
import type { UsageTargetType } from "../ipc/types";
import { usePromptStore } from "../stores/promptStore";
import { relativeTime } from "../utils/time";

import { EmptyState, RegionHeader } from "./primitives";
import styles from "./RecentList.module.css";

// Type badge per recent row (Promptscape): every asset type renders the same
// neutral outline badge — the layer is read from the label text, not a fill
// (design-spec §13.1 "accent carries no semantics", ADR-020 ripple).
const TYPE_LABELS: Record<UsageTargetType, string> = {
  alignment: "对齐话术",
  macro: "Macro",
  composition: "Composition",
  modifier: "Modifier",
  phrase: "话术",
};

export function RecentList() {
  const recent = usePromptStore((s) => s.recentUsage);
  const copy = useCopy();
  const onRegionKeyDown = useRegionNav();

  return (
    <section
      className={styles.region}
      aria-label="最近使用"
      data-region="recent-list"
      tabIndex={0}
      onKeyDown={onRegionKeyDown}
    >
      <RegionHeader title="最近使用" count={recent.length} />
      {recent.length === 0 ? (
        <EmptyState>复制过的话术会在这里出现</EmptyState>
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
                  data-nav-item
                  tabIndex={-1}
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
                  <span
                    className={`${styles.badge} ${
                      entry.record.targetType === "alignment"
                        ? styles.badgeProtocol
                        : styles.badgeTask
                    }`}
                  >
                    {TYPE_LABELS[entry.record.targetType]}
                  </span>
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
