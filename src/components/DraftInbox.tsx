import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";

import { ipc } from "../ipc";
import { GROUP_KINDS } from "../ipc/types";
import type {
  DraftPayload,
  DraftSummary,
  DraftTargetType,
  GroupKind,
} from "../ipc/types";
import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { toUserMessage } from "../utils/errorMessage";
import { relativeTime } from "../utils/time";

import {
  Button,
  CardSurface,
  EmptyState,
  PhraseFormEditor,
  type PhraseFormValues,
} from "./primitives";
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

// P0-5 stopgap: a promoted Composition becomes a ghost asset — no UI surface
// can view/search/delete it yet, so promote is blocked (discard stays open)
// until Composition gets a real UI home. Docs ripple handled separately.
// P3-2 mirrors the block for editing: the composition body is a modifier_ids
// array, which has no editor surface here either.
const PROMOTE_BLOCKED_HINT = "该类型暂无 UI 承载";

// The three editable draft variants all carry name + content. Composition
// (modifier_ids body) is excluded — its edit stays blocked alongside promote.
type EditablePayload = Exclude<DraftPayload, { target_type: "composition" }>;

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
  const restoreDraft = usePromptStore((s) => s.restoreDraft);
  const setActivePhase = useAppStore((s) => s.setActivePhase);
  const toast = useToastStore((s) => s.show);
  const toastAction = useToastStore((s) => s.showWithAction);
  const toastError = useToastStore((s) => s.showError);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  // Full payload hydrated via get_draft when the edit flow opens; null = closed.
  const [editing, setEditing] = useState<EditablePayload | null>(null);
  // The 编辑 button is the trigger the panel pins to and where focus returns
  // (ADR-025 子决策 1). It is preferred over the whole card because the card
  // also holds 丢弃 / 归档: pressing the anchor is treated as a toggle rather
  // than an outside dismissal, so anchoring to the card would let a draft be
  // discarded out from under its own open editor.
  const [editAnchor, setEditAnchor] = useState<HTMLElement | null>(null);

  const isModifier = draft.targetType === "modifier";
  const promoteBlocked = draft.targetType === "composition";
  // Same stopgap as promote: no editor surface for a modifier_ids body.
  const editBlocked = promoteBlocked;

  async function doPromote(groupKind?: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await promoteDraft({ id: draft.id, groupKind });
      // A1-03: the draft left the inbox and landed in a real region. Flash the
      // landed asset so the user sees WHERE it went — the toast's flashTargetId
      // drives the target region's flash. When the landed asset renders only
      // under an active phase, the store hands back its phaseId so the PhaseBar
      // can switch to it first, otherwise the flash target is off-screen.
      if (result.phaseId) setActivePhase(result.phaseId);
      toast(`已归入 ${TYPE_LABEL[draft.targetType]}`, result.insertedAssetId);
    } catch (err) {
      toastError(toUserMessage(err, "归档失败"));
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
      // D-5: discard is reversible (a status flip, not a delete), so it does not
      // need a confirm dialog — instead the toast carries an 撤销 button for the
      // life of the toast. Clicking it restores the draft to pending.
      toastAction(`已丢弃「${draft.name}」`, {
        label: "撤销",
        onClick: () => {
          void (async () => {
            try {
              await restoreDraft(draft.id);
              toast("已恢复草稿");
            } catch (err) {
              toastError(toUserMessage(err, "撤销失败"));
            }
          })();
        },
      });
    } catch (err) {
      toastError(toUserMessage(err, "丢弃失败"));
    } finally {
      setBusy(false);
    }
  }

  function onPromoteClick() {
    // Defensive: the button is disabled for blocked types, keep the guard
    // anyway so a programmatic click can never promote a ghost asset.
    if (promoteBlocked) return;
    // Modifier needs the four-quadrant pick before it can land; everything else
    // promotes straight through (PRD §10.2).
    if (isModifier) setPicking((v) => !v);
    else void doPromote();
  }

  // Hydrate the full stored payload before opening the editor — the list only
  // carries an 80-char preview, and update_draft is a full-replacement write.
  async function onEditClick() {
    // Already open: re-hydrating would re-run get_draft under a live draft.
    if (busy || editBlocked || editing) return;
    setBusy(true);
    try {
      const full = await ipc.getDraft(draft.id);
      // Defensive: composition never reaches here (button disabled), but a
      // stale summary row must not open an editor that drops modifier_ids.
      if (full.payload.target_type === "composition") return;
      setPicking(false);
      setEditing(full.payload);
    } catch (err) {
      toastError(toUserMessage(err, "读取草稿失败"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardSurface layer="neutral" role="listitem">
      <div className={styles.head}>
        <span className={styles.type}>{TYPE_LABEL[draft.targetType]}</span>
        <h4 className={styles.name}>{draft.name}</h4>
      </div>
      {editing && (
        <DraftEditor
          draftId={draft.id}
          payload={editing}
          anchor={editAnchor}
          onClose={() => setEditing(null)}
        />
      )}
      <p className={styles.preview}>{draft.preview}</p>
      <div className={styles.foot}>
        <div className={styles.meta}>
          <span className={styles.source}>{draft.toolName}</span>
          <span className={styles.time}>{relativeTime(draft.createdAt)}</span>
        </div>
        <div className={styles.actions}>
          {promoteBlocked && (
            <span className={styles.blockedHint}>{PROMOTE_BLOCKED_HINT}</span>
          )}
          {/* P0-1 roving nav (03-product-spec §13.4 v0.7 "方向键选草稿卡 +
                  动作键 promote/discard"): the browse-state action buttons opt
                  into the scene-panel region's arrow traversal via data-nav-item
                  + tabIndex=-1. Type-blocked buttons (composition edit/promote)
                  stay OUT of the nav list — focus() is a no-op on a disabled
                  button, so marking them would strand arrow traversal. The
                  discard button is never type-blocked, so it always anchors the
                  card in the sequence. */}
          <Button
            intent="ghost"
            ref={setEditAnchor}
            onClick={() => void onEditClick()}
            disabled={busy || editBlocked}
            title={editBlocked ? PROMOTE_BLOCKED_HINT : undefined}
            data-nav-item={editBlocked ? undefined : true}
            tabIndex={-1}
          >
            <Pencil size={13} aria-hidden strokeWidth={2} />
            编辑
          </Button>
          <Button
            intent="ghost"
            onClick={() => void doDiscard()}
            disabled={busy}
            data-nav-item
            tabIndex={-1}
          >
            <X size={13} aria-hidden strokeWidth={2} />
            丢弃
          </Button>
          <Button
            intent="ghost"
            onClick={onPromoteClick}
            disabled={busy || promoteBlocked}
            title={promoteBlocked ? PROMOTE_BLOCKED_HINT : undefined}
            aria-expanded={isModifier ? picking : undefined}
            data-nav-item={promoteBlocked ? undefined : true}
            tabIndex={-1}
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

// Edit panel for a pending draft (PRD §10.3 update_draft "UI 编辑保存"), floated
// over its 编辑 button since ADR-025 P1-b. Only name + content are exposed; every
// hidden payload field (schema_version / phase_id / scene_id / is_default) is
// carried over verbatim from the hydrated payload. Modifier drafts carry NO
// group_kind here — the four-quadrant call stays a promote-time human decision
// (ADR-015 补遗 decision iii).
//
// The hand-rolled form this replaced duplicated the shared editor's draft state,
// autofocus, IME guard and submit keys. Folding it in also buys the 子决策 2 rule
// table for free: an outside click now saves rather than silently abandoning.
function DraftEditor({
  draftId,
  payload,
  anchor,
  onClose,
}: {
  draftId: string;
  payload: EditablePayload;
  anchor: HTMLElement | null;
  onClose: () => void;
}) {
  const updateDraft = usePromptStore((s) => s.updateDraft);
  const toast = useToastStore((s) => s.show);
  const toastError = useToastStore((s) => s.showError);

  const handleSubmit = async ({ name, content }: PhraseFormValues) => {
    try {
      await updateDraft({
        id: draftId,
        payload: { ...payload, name, content },
      });
    } catch (err) {
      toastError(toUserMessage(err, "保存失败"));
      // Re-throw so the shared editor re-enables its save button and holds the
      // draft — an outside-click save lands after the user has looked away, so
      // a swallowed rejection would look exactly like success.
      throw err;
    }
    toast("草稿已保存");
    onClose();
  };

  return (
    <PhraseFormEditor
      layer="neutral"
      presentation="anchored"
      anchor={anchor}
      // A draft always exists in the DB, so this is an edit: the dirty baseline
      // is the stored payload and abandoning needs no undo toast.
      mode="edit"
      ariaLabel="编辑草稿"
      initialName={payload.name}
      initialContent={payload.content}
      contentPlaceholder="内容"
      submitLabel="保存"
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}
