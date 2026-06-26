import { useMemo } from "react";

import { writeClipboard } from "../hooks/useClipboard";
import { GROUP_KINDS, type GroupKind } from "../ipc/types";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";

import { Chip, EmptyState, RegionHeader } from "./primitives";
import styles from "./ModifierGrid.module.css";

// Quadrant labels mirror the four CHECK-constrained groupKinds (migration 0006).
const GROUP_LABELS: Record<GroupKind, string> = {
  cognition: "认知前置",
  action: "动作策略",
  delivery: "产出形态",
  constraint: "通用约束",
};

// Compact atom-library reference absorbed from the Promptscape right aside
// (ADR-018 补遗): modifiers grouped by quadrant, each a click-to-copy chip.
// NOT a Tab-cycle region (no data-region / region tabIndex) — the chips are
// buttons and stay individually reachable, but the block is a reference surface,
// not one of the §13.4 working regions, so it does not reshuffle the Tab order.
export function ModifierGrid() {
  const modifiers = usePromptStore((s) => s.modifiers);
  const showToast = useToastStore((s) => s.show);

  const groups = useMemo(
    () =>
      GROUP_KINDS.map((kind) => ({
        kind,
        label: GROUP_LABELS[kind],
        items: modifiers
          .filter((m) => m.groupKind === kind)
          .sort((a, b) => a.orderIndex - b.orderIndex),
      })).filter((g) => g.items.length > 0),
    [modifiers],
  );

  // UsageSource has no `modifier` value, so a Modifier copy writes the clipboard
  // directly — it skips the record_usage round-trip the other assets make (and
  // therefore does not surface in Recent / bump usageCount). Faithful adaptation
  // of the design's click-to-copy without inventing a wire source.
  const copy = async (content: string, name: string) => {
    try {
      await writeClipboard(content);
      showToast("已复制");
    } catch {
      showToast(`复制「${name}」失败`);
    }
  };

  return (
    <section className={styles.region} aria-label="Modifier 原子库">
      <RegionHeader
        title="Modifier"
        subtitle="原子方法论"
        count={modifiers.length}
      />
      {groups.length === 0 ? (
        <EmptyState>暂无 Modifier · 原子方法论会在这里按四组展开</EmptyState>
      ) : (
        <div className={styles.card}>
          {groups.map((g) => (
            <div key={g.kind} className={styles.group}>
              <div className={styles.groupHead}>
                <span className={styles.dot} aria-hidden />
                <span className={styles.groupName}>{g.label}</span>
                <span className={styles.groupCount}>{g.items.length}</span>
              </div>
              <div className={styles.chips}>
                {g.items.map((m) => (
                  <Chip
                    key={m.id}
                    layer="protocol"
                    title={m.content}
                    aria-label={m.name}
                    onClick={() => void copy(m.content, m.name)}
                  >
                    {m.name}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
