import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { GripVertical, Inbox, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCopy } from "../hooks/useCopy";
import type { Phrase, SubStage } from "../ipc/types";
import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";

import { DraftInbox } from "./DraftInbox";
import {
  ActionCluster,
  Button,
  ConfirmInline,
  EditorActions,
  EditorInput,
  EditorPanel,
  EmptyState,
  IconButton,
  Input,
  RegionHeader,
} from "./primitives";
import primitiveStyles from "./primitives/primitives.module.css";
import styles from "./ScenePanel.module.css";

type EditTarget = { mode: "create" } | { mode: "edit"; phrase: Phrase } | null;

type Grouped = Array<{ subStage: SubStage | null; phrases: Phrase[] }>;

function groupBySubStage(phrases: Phrase[], subStages: SubStage[]): Grouped {
  const ordered = [...subStages].sort((a, b) => a.orderIndex - b.orderIndex);
  const groups: Grouped = ordered.map((s) => ({ subStage: s, phrases: [] }));
  const ungrouped: Phrase[] = [];
  for (const p of phrases) {
    if (!p.subStageId) {
      ungrouped.push(p);
      continue;
    }
    const target = groups.find((g) => g.subStage?.id === p.subStageId);
    if (target) target.phrases.push(p);
    else ungrouped.push(p);
  }
  if (ungrouped.length > 0) groups.push({ subStage: null, phrases: ungrouped });
  return groups.filter((g) => g.phrases.length > 0);
}

export function ScenePanel() {
  const scenes = usePromptStore((s) => s.scenes);
  const pendingDraftCount = usePromptStore((s) => s.pendingDraftCount);
  const draftsViewRequestId = useAppStore((s) => s.draftsViewRequestId);
  const deletePhrase = usePromptStore((s) => s.deletePhrase);
  const copy = useCopy();
  const flashId = useToastStore((s) => s.flashTargetId);
  const showToast = useToastStore((s) => s.show);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showDrafts, setShowDrafts] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // The 待审 badge jumps here by bumping draftsViewRequestId.
  useEffect(() => {
    if (draftsViewRequestId > 0 && pendingDraftCount > 0) setShowDrafts(true);
  }, [draftsViewRequestId, pendingDraftCount]);

  // The drafts tab is conditional (shown only while drafts are pending). Once the
  // inbox empties — promote/discard drains it — fall back to the scene view so we
  // never strand the user on a vanished tab.
  const draftsAvailable = pendingDraftCount > 0;
  const draftsActive = showDrafts && draftsAvailable;
  useEffect(() => {
    if (!draftsAvailable && showDrafts) setShowDrafts(false);
  }, [draftsAvailable, showDrafts]);

  const current = scenes[Math.min(activeIdx, scenes.length - 1)];
  const currentSceneId = current?.scene.id;

  // Switching scenes (or jumping to drafts) mid-edit would mutate a list the
  // user can no longer see — reset edit state on either change.
  useEffect(() => {
    setEditMode(false);
    setEditing(null);
    setConfirmingId(null);
  }, [currentSceneId, draftsActive]);

  const handleDelete = async (id: string) => {
    setConfirmingId(null);
    try {
      await deletePhrase(id);
      showToast("已永久删除");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "删除失败");
    }
  };

  if (!current) {
    return (
      <section
        className={styles.region}
        aria-label="Scene 全景区"
        aria-describedby="scene-panel-empty-msg"
        data-region="scene-panel"
        tabIndex={0}
      >
        <RegionHeader title="Scene" count={0} />
        <EmptyState>
          <span id="scene-panel-empty-msg">暂无 Scene</span>
        </EmptyState>
      </section>
    );
  }

  const groups = groupBySubStage(current.phrases, current.subStages);

  return (
    <section
      className={styles.region}
      aria-label="Scene 全景区"
      data-region="scene-panel"
      tabIndex={0}
    >
      <RegionHeader title="Scene" count={scenes.length} />
      <nav className={styles.tabs} aria-label="Scene tabs">
        {draftsAvailable && (
          <>
            <button
              type="button"
              className={`${styles.tab} ${styles.draftTab} ${draftsActive ? styles.active : ""}`}
              onClick={() => setShowDrafts(true)}
              aria-current={draftsActive ? "page" : undefined}
              aria-label={`草稿收件箱，${pendingDraftCount} 条待审`}
            >
              <Inbox
                size={13}
                className={styles.draftIcon}
                aria-hidden
                strokeWidth={2}
              />
              草稿
              <span className={styles.draftCount}>{pendingDraftCount}</span>
            </button>
            <span className={styles.sep} aria-hidden />
          </>
        )}
        {scenes.map((sc, idx) => {
          const isActive = !draftsActive && idx === activeIdx;
          return (
            <button
              key={sc.scene.id}
              type="button"
              className={`${styles.tab} ${isActive ? styles.active : ""}`}
              onClick={() => {
                setShowDrafts(false);
                setActiveIdx(idx);
              }}
              aria-current={isActive ? "page" : undefined}
            >
              {sc.scene.icon && (
                <span className={styles.icon} aria-hidden>
                  {sc.scene.icon}
                </span>
              )}
              {sc.scene.name}
            </button>
          );
        })}
      </nav>
      {draftsActive ? (
        <div className={styles.phrases}>
          <DraftInbox />
        </div>
      ) : (
        <>
          <div className={styles.toolbar}>
            {editMode ? (
              <>
                <Button
                  layer="task"
                  aria-label="新增话术"
                  onClick={() => setEditing({ mode: "create" })}
                >
                  <Plus size={14} aria-hidden strokeWidth={2} />
                  <span>新增</span>
                </Button>
                <Button
                  onClick={() => {
                    setEditMode(false);
                    setEditing(null);
                  }}
                >
                  完成
                </Button>
              </>
            ) : (
              <IconButton
                className={styles.manageBtn}
                aria-label="管理话术"
                onClick={() => setEditMode(true)}
              >
                <Pencil size={12} aria-hidden strokeWidth={2} />
              </IconButton>
            )}
          </div>

          {editMode && editing && (
            <PhraseEditor
              target={editing}
              sceneId={current.scene.id}
              subStages={current.subStages}
              onClose={() => setEditing(null)}
              onError={(msg) => showToast(msg)}
            />
          )}

          <div className={styles.phrases}>
            {groups.length === 0 ? (
              <EmptyState>
                {editMode
                  ? "该 Scene 暂无话术 · 点「新增」添加"
                  : "该 Scene 暂无话术"}
              </EmptyState>
            ) : editMode ? (
              groups.map((g) => (
                <EditablePhraseGroup
                  key={g.subStage?.id ?? "__ungrouped__"}
                  sceneId={current.scene.id}
                  subStageId={g.subStage?.id ?? null}
                  subStageName={g.subStage?.name ?? null}
                  phrases={g.phrases}
                  confirmingId={confirmingId}
                  onEdit={(p) => setEditing({ mode: "edit", phrase: p })}
                  onRequestDelete={(id) => setConfirmingId(id)}
                  onCancelDelete={() => setConfirmingId(null)}
                  onConfirmDelete={(id) => void handleDelete(id)}
                />
              ))
            ) : (
              groups.map((g) => (
                <div
                  key={g.subStage?.id ?? "__ungrouped__"}
                  className={styles.group}
                >
                  {g.subStage && (
                    <div className={styles.subStage}>{g.subStage.name}</div>
                  )}
                  {g.phrases.map((p) => {
                    const cls = `${styles.phrase} ${flashId === p.id ? `${primitiveStyles.task} ${primitiveStyles.flash}` : ""}`;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={cls}
                        onClick={() =>
                          void copy(
                            p.content,
                            {
                              targetType: "phrase",
                              targetId: p.id,
                              source: "scene",
                              modifierIds: null,
                              sopId: null,
                              sopStepOrder: null,
                              phaseId: null,
                            },
                            p.id,
                          )
                        }
                        aria-label={p.name}
                      >
                        <h4 className={styles.phraseTitle}>{p.name}</h4>
                        <p className={styles.phraseContent}>{p.content}</p>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

interface GroupProps {
  sceneId: string;
  subStageId: string | null;
  subStageName: string | null;
  phrases: Phrase[];
  confirmingId: string | null;
  onEdit: (phrase: Phrase) => void;
  onRequestDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
}

// One DragDropProvider PER (scene, sub-stage) partition so a drag can never cross
// groups — order_index is partitioned the same way in the backend. Local `items`
// mirror MacroGrid: the store stays source-of-truth until the drop persists.
function EditablePhraseGroup({
  sceneId,
  subStageId,
  subStageName,
  phrases,
  confirmingId,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: GroupProps) {
  const reorderPhrases = usePromptStore((s) => s.reorderPhrases);
  const showToast = useToastStore((s) => s.show);
  const [items, setItems] = useState<Phrase[]>(phrases);
  useEffect(() => setItems(phrases), [phrases]);

  return (
    <div className={styles.group}>
      {subStageName && <div className={styles.subStage}>{subStageName}</div>}
      <DragDropProvider
        onDragOver={(event) => setItems((prev) => move(prev, event))}
        onDragEnd={(event) => {
          if (event.canceled) {
            setItems(phrases);
            return;
          }
          const orderedIds = items.map((p) => p.id);
          void reorderPhrases(sceneId, subStageId, orderedIds).catch((err) => {
            showToast(err instanceof Error ? err.message : "排序保存失败");
          });
        }}
      >
        <ul className={styles.list}>
          {items.map((p, idx) => (
            <SortablePhraseRow
              key={p.id}
              phrase={p}
              index={idx}
              isConfirming={confirmingId === p.id}
              onEdit={() => onEdit(p)}
              onRequestDelete={() => onRequestDelete(p.id)}
              onCancelDelete={onCancelDelete}
              onConfirmDelete={() => onConfirmDelete(p.id)}
            />
          ))}
        </ul>
      </DragDropProvider>
    </div>
  );
}

interface RowProps {
  phrase: Phrase;
  index: number;
  isConfirming: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

function SortablePhraseRow({
  phrase,
  index,
  isConfirming,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: RowProps) {
  const { ref, handleRef, isDragging } = useSortable({ id: phrase.id, index });

  const classes = [styles.row, isDragging ? styles.dragging : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <li ref={ref} className={classes} data-phrase-id={phrase.id}>
      <IconButton
        ref={handleRef}
        plain
        dragHandle
        aria-label={`拖动排序 ${phrase.name}`}
      >
        <GripVertical size={14} aria-hidden strokeWidth={2} />
      </IconButton>
      <span className={styles.rowName}>{phrase.name}</span>

      {isConfirming ? (
        <ConfirmInline
          text="永久删除？"
          confirmLabel="确认永久删除"
          cancelLabel="取消删除"
          onConfirm={onConfirmDelete}
          onCancel={onCancelDelete}
        />
      ) : (
        <ActionCluster>
          <IconButton aria-label={`编辑 ${phrase.name}`} onClick={onEdit}>
            <Pencil size={13} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton
            aria-label={`删除 ${phrase.name}`}
            onClick={onRequestDelete}
          >
            <Trash2 size={13} aria-hidden strokeWidth={2} />
          </IconButton>
        </ActionCluster>
      )}
    </li>
  );
}

interface EditorProps {
  target: Exclude<EditTarget, null>;
  sceneId: string;
  subStages: SubStage[];
  onClose: () => void;
  onError: (msg: string) => void;
}

const UNGROUPED_VALUE = "__ungrouped__";

function PhraseEditor({
  target,
  sceneId,
  subStages,
  onClose,
  onError,
}: EditorProps) {
  const createPhrase = usePromptStore((s) => s.createPhrase);
  const updatePhrase = usePromptStore((s) => s.updatePhrase);
  const existing = target.mode === "edit" ? target.phrase : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [subStageValue, setSubStageValue] = useState(
    existing?.subStageId ?? UNGROUPED_VALUE,
  );
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const orderedSubStages = [...subStages].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );
  const canSave = name.trim().length > 0 && content.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    const subStageId = subStageValue === UNGROUPED_VALUE ? null : subStageValue;
    try {
      if (existing) {
        await updatePhrase({
          id: existing.id,
          name: name.trim(),
          content: content.trim(),
          subStageId,
        });
      } else {
        await createPhrase({
          sceneId,
          name: name.trim(),
          content: content.trim(),
          subStageId,
        });
      }
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : "保存失败");
      setSaving(false);
    }
  };

  return (
    <EditorPanel
      layer="task"
      role="group"
      aria-label={existing ? "编辑话术" : "新增话术"}
    >
      <Input
        ref={nameRef}
        placeholder="名称"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter") {
            e.preventDefault();
            void handleSave();
          }
        }}
      />
      <EditorInput
        placeholder="话术内容"
        value={content}
        rows={3}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSave();
          }
        }}
      />
      <select
        className={styles.subStageSelect}
        aria-label="所属子阶段"
        value={subStageValue}
        onChange={(e) => setSubStageValue(e.target.value)}
      >
        <option value={UNGROUPED_VALUE}>无分组</option>
        {orderedSubStages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <EditorActions>
        <Button intent="subtle" onClick={onClose}>
          取消
        </Button>
        <Button
          layer="task"
          intent="primary"
          onClick={() => void handleSave()}
          disabled={!canSave || saving}
        >
          {existing ? "保存" : "新增"}
        </Button>
      </EditorActions>
    </EditorPanel>
  );
}
