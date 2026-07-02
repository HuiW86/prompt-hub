import { useMemo, useState } from "react";
import { ArrowRightLeft, Route, Trash2 } from "lucide-react";

import { writeClipboard } from "../hooks/useClipboard";
import { GROUP_KINDS, type GroupKind, type Modifier } from "../ipc/types";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";

import {
  ActionCluster,
  Chip,
  ConfirmInline,
  EmptyState,
  IconButton,
  RegionHeader,
} from "./primitives";
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
//
// P3-6 minimal management entry (NOT the v1.3-removed full editor): each chip
// carries a hover/focus-revealed cluster with a quadrant-move menu (remedy for
// a wrong promote-time pick, ADR-015 decision iii) and a confirmed hard delete.
// Buttons are real focusables, so keyboard users reach them via Tab and the
// reveal follows :focus-within.
export function ModifierGrid() {
  const modifiers = usePromptStore((s) => s.modifiers);
  const updateModifier = usePromptStore((s) => s.updateModifier);
  const deleteModifier = usePromptStore((s) => s.deleteModifier);
  const showToast = useToastStore((s) => s.show);
  const showError = useToastStore((s) => s.showError);
  // At most one open management affordance at a time: a quadrant menu OR a
  // delete confirm, keyed by modifier id.
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

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
      showError(`复制「${name}」失败`);
    }
  };

  const moveTo = async (m: Modifier, kind: GroupKind) => {
    setMenuId(null);
    try {
      await updateModifier({
        id: m.id,
        name: m.name,
        content: m.content,
        groupKind: kind,
      });
      showToast(`已移至「${GROUP_LABELS[kind]}」`);
    } catch (err) {
      showError(err instanceof Error ? err.message : "移动象限失败");
    }
  };

  const remove = async (id: string) => {
    setConfirmingId(null);
    try {
      await deleteModifier(id);
      showToast("已永久删除");
    } catch (err) {
      showError(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <section className={styles.region} aria-label="Modifier 原子库">
      <RegionHeader
        title="Modifier"
        subtitle="原子方法论"
        count={modifiers.length}
        right={
          /* Layer marker (ADR-020): the aside carries no layer marker while
             Modifier belongs to the protocol layer (design-spec §13.1) — a
             small pill matching the 协议层/任务层 pills, visual label only
             (B2 physical partitioning is untouched). */
          <span className={styles.layerPill}>
            <Route size={12} strokeWidth={2} aria-hidden />
            协议层 · 参考
          </span>
        }
      />
      {groups.length === 0 ? (
        /* Copy-only enrichment (P3-5): NO create CTA — Modifier deliberately
           has no UI create entry (v1.3 decision: assets arrive via MCP draft
           promotion), so the empty state explains that path instead. */
        <EmptyState framed>
          还没有 Modifier · 原子方法论动作会按 4 组在这里展开，通过 MCP
          草稿促升添加
        </EmptyState>
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
                  <span key={m.id} className={styles.atom}>
                    <Chip
                      layer="protocol"
                      className={styles.atomChip}
                      title={m.content}
                      aria-label={m.name}
                      onClick={() => void copy(m.content, m.name)}
                    >
                      {m.name}
                    </Chip>
                    {confirmingId === m.id ? (
                      <ConfirmInline
                        text="永久删除？"
                        confirmLabel={`确认永久删除 ${m.name}`}
                        cancelLabel="取消删除"
                        onConfirm={() => void remove(m.id)}
                        onCancel={() => setConfirmingId(null)}
                      />
                    ) : (
                      <ActionCluster className={styles.manage}>
                        <IconButton
                          aria-label={`移动 ${m.name} 到其他象限`}
                          aria-expanded={menuId === m.id}
                          onClick={() => {
                            setConfirmingId(null);
                            setMenuId((prev) => (prev === m.id ? null : m.id));
                          }}
                        >
                          <ArrowRightLeft
                            size={12}
                            aria-hidden
                            strokeWidth={2}
                          />
                        </IconButton>
                        <IconButton
                          aria-label={`删除 ${m.name}`}
                          onClick={() => {
                            setMenuId(null);
                            setConfirmingId(m.id);
                          }}
                        >
                          <Trash2 size={12} aria-hidden strokeWidth={2} />
                        </IconButton>
                      </ActionCluster>
                    )}
                    {menuId === m.id && (
                      <span
                        className={styles.moveMenu}
                        role="group"
                        aria-label={`选择 ${m.name} 的目标象限`}
                      >
                        {GROUP_KINDS.filter((k) => k !== m.groupKind).map(
                          (k) => (
                            <button
                              key={k}
                              type="button"
                              className={styles.moveBtn}
                              onClick={() => void moveTo(m, k)}
                            >
                              {GROUP_LABELS[k]}
                            </button>
                          ),
                        )}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
