import { useCopy } from "../hooks/useCopy";
import { useRegionNav } from "../hooks/useRegionNav";
import type {
  RecentUsageEntry,
  UsageSource,
  UsageTargetType,
} from "../ipc/types";
import { alignmentUsageSource, findAlignmentPhrase } from "../ipc/usageSource";
import { usePromptStore } from "../stores/promptStore";
import { buildAlignmentCopyText } from "../utils/alignmentCopyText";
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
  const alignmentPhrasesByPhase = usePromptStore(
    (s) => s.alignmentPhrasesByPhase,
  );
  const axisValuesById = usePromptStore((s) => s.alignmentAxisValuesById);
  const copy = useCopy();
  const onRegionKeyDown = useRegionNav();

  // Only alignment rows can be cues; everything else keeps `recent`.
  function sourceFor(entry: RecentUsageEntry): UsageSource {
    if (entry.record.targetType !== "alignment") return "recent";
    const phrase = findAlignmentPhrase(
      alignmentPhrasesByPhase,
      entry.record.targetId,
    );
    return phrase ? alignmentUsageSource(phrase, "recent") : "recent";
  }

  // Re-copying an alignment phrase from here must produce the same clipboard
  // string as the chip row (03-product-spec 「对齐坐标与漂移账契约」b), so the
  // prefix is assembled from the live phrase rather than taken from the usage
  // record's stored content — which is the bare `content`, coordinates and all
  // omitted. A phrase the store cannot resolve (trashed) falls back to that
  // stored content: one un-prefixed copy beats copying nothing.
  function contentFor(entry: RecentUsageEntry): string {
    const stored = entry.targetContent ?? "";
    if (entry.record.targetType !== "alignment") return stored;
    const phrase = findAlignmentPhrase(
      alignmentPhrasesByPhase,
      entry.record.targetId,
    );
    return phrase ? buildAlignmentCopyText(phrase, axisValuesById) : stored;
  }

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
                      contentFor(entry),
                      {
                        targetType: entry.record.targetType,
                        targetId: entry.record.targetId,
                        // Re-copying a cue from here records `live_cue`, not
                        // `recent`: the class of the phrase decides, never the
                        // region the click came from (06-prd §6.8).
                        source: sourceFor(entry),
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
