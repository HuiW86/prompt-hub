import { ArrowLeft, ArrowRight, Pencil, Plus, Trash2 } from "lucide-react";
import { Fragment } from "react";

import { useAnchorRegistry } from "../../hooks/useAnchorRegistry";
import type { Phrase, SceneWithChildren, SubStage } from "../../ipc/types";
import type { InteractionMode } from "../../stores/settingsStore";
import {
  ActionCluster,
  ConfirmInline,
  IconButton,
  type PhraseFormValues,
} from "../primitives";

import styles from "../ScenePanel.module.css";
import { InlineNameEditor } from "./InlineNameEditor";
import { PhraseEditor } from "./PhraseEditor";
import { PhraseMoveSelector } from "./PhraseMoveSelector";
import { ViewPhraseCard } from "./ViewPhraseCard";

// Anchor key for this column's add-phrase ghost button. Phrase ids are uuids,
// so a reserved literal cannot collide with one.
const ADD_ANCHOR = "__add__";

interface ViewColumnProps {
  index: number;
  subStage: SubStage | null;
  phrases: Phrase[];
  canMoveLeft: boolean;
  canMoveRight: boolean;
  renaming: boolean;
  confirmingDelete: boolean;
  editingPhraseId: string | null;
  movingPhraseId: string | null;
  addingPhrase: boolean;
  /** Draft the undo toast put back into this column's create form. */
  addPhraseDraft?: PhraseFormValues | null;
  flashId: string | null;
  interactionMode: InteractionMode;
  sceneId: string;
  subStages: SubStage[];
  // Every scene, for the cross-scene move selector's Scene picker (ADR-022).
  scenes: SceneWithChildren[];
  onCopy: (phrase: Phrase) => void;
  onRenameStart: () => void;
  onRenameCancel: () => void;
  onRenameSave: (name: string) => void;
  onMove: (dir: -1 | 1) => void;
  onDeleteRequest: () => void;
  onDeleteCancel: () => void;
  onDeleteConfirm: () => void;
  onPhraseEdit: (id: string) => void;
  onPhraseEditClose: () => void;
  onPhraseMove: (id: string, dir: -1 | 1) => void;
  onPhraseMoveToStart: (id: string) => void;
  onPhraseMoveToCancel: () => void;
  onPhraseMoveToConfirm: (
    phrase: Phrase,
    targetSceneId: string,
    targetSubStageId: string | null,
  ) => void;
  onPhraseDelete: (id: string) => void;
  onAddPhrase: () => void;
  onAddPhraseClose: () => void;
  onAddPhraseDiscard: (draft: PhraseFormValues) => void;
  onError: (msg: string) => void;
}

// One view-mode grid column: a sub-stage header with a hover/focus-within action
// cluster (rename / move / delete — task 5) atop its phrase cards, each carrying
// its own cluster (edit / move / delete — task 6), and a trailing add-phrase
// ghost card. The ungrouped orphan column (subStage == null) renders the muted
// 未分组 header with no header actions, but still gets add-phrase (subStageId
// null) so orphan phrases can be created in place.
export function ViewColumn({
  index,
  subStage,
  phrases,
  canMoveLeft,
  canMoveRight,
  renaming,
  confirmingDelete,
  editingPhraseId,
  movingPhraseId,
  addingPhrase,
  addPhraseDraft,
  flashId,
  interactionMode,
  sceneId,
  subStages,
  scenes,
  onCopy,
  onRenameStart,
  onRenameCancel,
  onRenameSave,
  onMove,
  onDeleteRequest,
  onDeleteCancel,
  onDeleteConfirm,
  onPhraseEdit,
  onPhraseEditClose,
  onPhraseMove,
  onPhraseMoveToStart,
  onPhraseMoveToCancel,
  onPhraseMoveToConfirm,
  onPhraseDelete,
  onAddPhrase,
  onAddPhraseClose,
  onAddPhraseDiscard,
  onError,
}: ViewColumnProps) {
  const subStageId = subStage?.id ?? null;
  // Trigger elements the anchored editors pin to: each phrase card by id, and
  // this column's add-phrase ghost button (ADR-025 子决策 1).
  const anchors = useAnchorRegistry();
  return (
    <div className={styles.group}>
      <div className={styles.subStage}>
        {/* The ungrouped bucket carries no sequence number — an index would
            disguise the synthetic column as a real, editable sub-stage. */}
        {subStage && (
          <span className={styles.subStageIdx}>
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        {renaming ? (
          // Renaming the ungrouped bucket starts from an empty field —「未分组」
          // is a placeholder label, not a name; saving promotes the bucket to a
          // real sub-stage and re-homes its phrases (handlePromoteUngrouped).
          <InlineNameEditor
            initialValue={subStage?.name ?? ""}
            ariaLabel="子阶段名称"
            placeholder={subStage ? undefined : "子阶段名称"}
            onSave={onRenameSave}
            onCancel={onRenameCancel}
          />
        ) : confirmingDelete && subStage ? (
          <>
            <span className={styles.subStageName}>{subStage.name}</span>
            <ConfirmInline
              text="永久删除？话术将解除归属"
              confirmLabel="确认删除子阶段"
              cancelLabel="取消删除"
              onConfirm={onDeleteConfirm}
              onCancel={onDeleteCancel}
            />
          </>
        ) : (
          <>
            <span
              className={
                subStage
                  ? styles.subStageName
                  : `${styles.subStageName} ${styles.subStageNameMuted}`
              }
              title={
                subStage
                  ? undefined
                  : "无归属的话术——命名此列即可转为子阶段并归入这些话术"
              }
            >
              {subStage ? subStage.name : "未分组"}
            </span>
            {/* The ungrouped bucket is synthetic — no move/delete, but naming
                it (pencil) promotes it to a real sub-stage. */}
            {!subStage && (
              <ActionCluster className={styles.subStageActions} reveal>
                <IconButton
                  aria-label="命名未分组为子阶段"
                  data-nav-item
                  tabIndex={-1}
                  onClick={onRenameStart}
                >
                  <Pencil size={13} aria-hidden strokeWidth={2} />
                </IconButton>
              </ActionCluster>
            )}
            {subStage && (
              <ActionCluster className={styles.subStageActions} reveal>
                <IconButton
                  aria-label={`前移 ${subStage.name}`}
                  data-nav-item
                  data-nav-id={`substage-${subStage.id}-left`}
                  tabIndex={-1}
                  disabled={!canMoveLeft}
                  onClick={() => onMove(-1)}
                >
                  <ArrowLeft size={13} aria-hidden strokeWidth={2} />
                </IconButton>
                <IconButton
                  aria-label={`后移 ${subStage.name}`}
                  data-nav-item
                  data-nav-id={`substage-${subStage.id}-right`}
                  tabIndex={-1}
                  disabled={!canMoveRight}
                  onClick={() => onMove(1)}
                >
                  <ArrowRight size={13} aria-hidden strokeWidth={2} />
                </IconButton>
                <IconButton
                  aria-label={`重命名 ${subStage.name}`}
                  data-nav-item
                  data-nav-id={`substage-${subStage.id}-rename`}
                  tabIndex={-1}
                  onClick={onRenameStart}
                >
                  <Pencil size={13} aria-hidden strokeWidth={2} />
                </IconButton>
                <IconButton
                  aria-label={`删除 ${subStage.name}`}
                  data-nav-item
                  data-nav-id={`substage-${subStage.id}-delete`}
                  tabIndex={-1}
                  onClick={onDeleteRequest}
                >
                  <Trash2 size={13} aria-hidden strokeWidth={2} />
                </IconButton>
              </ActionCluster>
            )}
          </>
        )}
      </div>

      {phrases.map((p, pi) =>
        // The move selector still SWAPS the card — it is a picker, not an
        // ADR-025 editor, and it has no anchor to pin to.
        movingPhraseId === p.id ? (
          <PhraseMoveSelector
            key={p.id}
            phrase={p}
            scenes={scenes}
            onCancel={onPhraseMoveToCancel}
            onConfirm={(targetSceneId, targetSubStageId) =>
              onPhraseMoveToConfirm(p, targetSceneId, targetSubStageId)
            }
          />
        ) : (
          // The card stays mounted while its editor is open: it is the anchor,
          // and the column must not collapse a slot out from under the panel.
          <Fragment key={p.id}>
            {editingPhraseId === p.id && (
              <PhraseEditor
                target={{ mode: "edit", phrase: p }}
                sceneId={sceneId}
                subStages={subStages}
                anchor={anchors.get(p.id)}
                onClose={onPhraseEditClose}
                onError={onError}
              />
            )}
            <ViewPhraseCard
              phrase={p}
              anchorRef={anchors.ref(p.id)}
              flash={flashId === p.id}
              interactionMode={interactionMode}
              canMoveUp={pi > 0}
              canMoveDown={pi < phrases.length - 1}
              onCopy={() => onCopy(p)}
              onEdit={() => onPhraseEdit(p.id)}
              onMove={(dir) => onPhraseMove(p.id, dir)}
              onMoveTo={() => onPhraseMoveToStart(p.id)}
              onDelete={() => onPhraseDelete(p.id)}
            />
          </Fragment>
        ),
      )}

      {/* The ghost button stays put while the create form floats above it —
          it is the anchor, and the column's trailing slot must not jump. */}
      {addingPhrase && (
        <PhraseEditor
          target={{ mode: "create" }}
          sceneId={sceneId}
          subStages={subStages}
          anchor={anchors.get(ADD_ANCHOR)}
          initialSubStageId={subStageId}
          initialDraft={addPhraseDraft}
          onClose={onAddPhraseClose}
          onDiscard={onAddPhraseDiscard}
          onError={onError}
        />
      )}
      <button
        type="button"
        ref={anchors.ref(ADD_ANCHOR)}
        className={styles.ghostAdd}
        onClick={onAddPhrase}
        aria-label={
          subStage ? `在 ${subStage.name} 添加话术` : "在未分组添加话术"
        }
        data-nav-item
        tabIndex={-1}
      >
        <Plus size={14} aria-hidden strokeWidth={2} />
        <span>添加话术</span>
      </button>
    </div>
  );
}
