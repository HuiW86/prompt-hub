import { Check, X } from "lucide-react";
import { useState } from "react";

import { GROUP_KINDS } from "../ipc/types";
import type { DraftSummary, DraftTargetType, GroupKind } from "../ipc/types";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { relativeTime } from "../utils/time";

import { Button, CardSurface, EmptyState } from "./primitives";
import styles from "./DraftInbox.module.css";

const TYPE_LABEL: Record<DraftTargetType, string> = {
  modifier: "Modifier",
  composition: "Composition",
  macro: "Macro",
  alignment_phrase: "对齐话术",
};

// The four-quadrant classification a Modifier promote requires (decision iii):
// omar's call at promote time, never carried in the AI-written payload.
const GROUP_KIND_LABEL: Record<GroupKind, string> = {
  cognition: "认知",
  action: "行动",
  delivery: "交付",
  constraint: "约束",
};

export function DraftInbox() {
  const drafts = usePromptStore((s) => s.drafts);

  if (drafts.length === 0) {
    return <EmptyState>收件箱已清空</EmptyState>;
  }

  return (
    <div className={styles.list} role="list" aria-label="草稿收件箱">
      {drafts.map((draft) => (
        <DraftCard key={draft.id} draft={draft} />
      ))}
    </div>
  );
}

function DraftCard({ draft }: { draft: DraftSummary }) {
  const promoteDraft = usePromptStore((s) => s.promoteDraft);
  const discardDraft = usePromptStore((s) => s.discardDraft);
  const toast = useToastStore((s) => s.show);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  const isModifier = draft.targetType === "modifier";

  async function doPromote(groupKind?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await promoteDraft({ id: draft.id, groupKind });
      toast(`已归入 ${TYPE_LABEL[draft.targetType]}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "归档失败");
    } finally {
      setBusy(false);
      setPicking(false);
    }
  }

  async function doDiscard() {
    if (busy) return;
    setBusy(true);
    try {
      await discardDraft(draft.id);
      toast("已丢弃草稿");
    } catch (err) {
      toast(err instanceof Error ? err.message : "丢弃失败");
    } finally {
      setBusy(false);
    }
  }

  function onPromoteClick() {
    // Modifier needs the four-quadrant pick before it can land; everything else
    // promotes straight through (PRD §10.2).
    if (isModifier) setPicking((v) => !v);
    else void doPromote();
  }

  return (
    <CardSurface layer="neutral" role="listitem">
      <div className={styles.head}>
        <span className={styles.type}>{TYPE_LABEL[draft.targetType]}</span>
        <h4 className={styles.name}>{draft.name}</h4>
      </div>
      <p className={styles.preview}>{draft.preview}</p>
      <div className={styles.foot}>
        <div className={styles.meta}>
          <span className={styles.source}>{draft.toolName}</span>
          <span className={styles.time}>{relativeTime(draft.createdAt)}</span>
        </div>
        <div className={styles.actions}>
          <Button
            intent="ghost"
            onClick={() => void doDiscard()}
            disabled={busy}
          >
            <X size={13} aria-hidden strokeWidth={2} />
            丢弃
          </Button>
          <Button
            intent="ghost"
            onClick={onPromoteClick}
            disabled={busy}
            aria-expanded={isModifier ? picking : undefined}
          >
            <Check size={13} aria-hidden strokeWidth={2} />
            归档
          </Button>
        </div>
      </div>
      {isModifier && picking && (
        <div className={styles.quad} role="group" aria-label="选择四象限分类">
          {GROUP_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              className={styles.quadBtn}
              onClick={() => void doPromote(kind)}
              disabled={busy}
            >
              {GROUP_KIND_LABEL[kind]}
            </button>
          ))}
        </div>
      )}
    </CardSurface>
  );
}
