import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import {
  Bug,
  Code,
  Copy,
  DraftingCompass,
  GripVertical,
  Inbox,
  Layers,
  type LucideIcon,
  Microscope,
  Pen,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCopy } from "../hooks/useCopy";
import type { Phrase, Scene, SubStage } from "../ipc/types";
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

// Scene icons are user content (design-spec §12.4): a lucide name string renders
// as a lucide glyph (matching the Promptscape design稿), anything else falls back
// to raw text so emoji / single-char icons keep working. Explicit map (not the
// full lucide registry) keeps the bundle lean per §12 icon restraint.
const SCENE_LUCIDE: Record<string, LucideIcon> = {
  "drafting-compass": DraftingCompass,
  microscope: Microscope,
  wrench: Wrench,
  pen: Pen,
  code: Code,
  bug: Bug,
};

function SceneIcon({
  name,
  size,
  className,
}: {
  name: string | null;
  size: number;
  className?: string;
}) {
  if (!name) return null;
  const Lucide = SCENE_LUCIDE[name];
  if (Lucide)
    return (
      <Lucide size={size} className={className} aria-hidden strokeWidth={2} />
    );
  return (
    <span className={className} aria-hidden>
      {name}
    </span>
  );
}

type EditTarget = { mode: "create" } | { mode: "edit"; phrase: Phrase } | null;

type Grouped = Array<{ subStage: SubStage | null; phrases: Phrase[] }>;

// View mode drops empty sub-stages (no phrases = nothing to show). Edit mode
// keeps them (includeEmpty) so they render as visible, droppable partitions —
// otherwise a freshly-created sub-stage would be invisible until it has phrases.
function groupBySubStage(
  phrases: Phrase[],
  subStages: SubStage[],
  includeEmpty = false,
): Grouped {
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
  return includeEmpty ? groups : groups.filter((g) => g.phrases.length > 0);
}

export function ScenePanel() {
  const scenes = usePromptStore((s) => s.scenes);
  const pendingDraftCount = usePromptStore((s) => s.pendingDraftCount);
  const draftsViewRequestId = useAppStore((s) => s.draftsViewRequestId);
  const deletePhrase = usePromptStore((s) => s.deletePhrase);
  const createScene = usePromptStore((s) => s.createScene);
  const deleteScene = usePromptStore((s) => s.deleteScene);
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

  // New scenes append to the global order, so the fresh one lands at the current
  // length — jump to it (still in edit mode) so the user can rename it inline.
  const handleCreateScene = async () => {
    const nextIdx = scenes.length;
    try {
      await createScene({ name: "新场景", rolePresets: [] });
      setActiveIdx(nextIdx);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "新建场景失败");
    }
  };

  // Backend refuses a non-empty Scene (RepoError::SceneNotEmpty) — surface that
  // message rather than swallowing it. On success clamp back to the first tab.
  const handleDeleteScene = async (id: string) => {
    try {
      await deleteScene(id);
      showToast("已删除场景");
      setActiveIdx(0);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "删除场景失败");
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
        <RegionHeader title="Scene" subtitle="场景全景" count={0} />
        <EmptyState>
          <span id="scene-panel-empty-msg">暂无 Scene</span>
        </EmptyState>
      </section>
    );
  }

  const groups = groupBySubStage(current.phrases, current.subStages, editMode);

  return (
    <section
      className={styles.region}
      aria-label="Scene 全景区"
      data-region="scene-panel"
      tabIndex={0}
    >
      <RegionHeader title="Scene" subtitle="场景全景" count={scenes.length} />
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
              <SceneIcon
                name={sc.scene.icon}
                size={14}
                className={styles.icon}
              />
              <span className={styles.tabName}>{sc.scene.name}</span>
              <span className={styles.tabCount}>{sc.phrases.length}</span>
            </button>
          );
        })}
      </nav>
      {draftsActive ? (
        <div className={styles.phrases}>
          <DraftInbox />
        </div>
      ) : (
        <div className={styles.sceneCard}>
          <div className={styles.sceneHead}>
            <span className={styles.sceneIcon} aria-hidden>
              <SceneIcon name={current.scene.icon ?? "📁"} size={18} />
            </span>
            <div className={styles.sceneIdentity}>
              <div className={styles.sceneName}>{current.scene.name}</div>
              <div className={styles.sceneMeta}>
                {current.phrases.length} 条话术
              </div>
            </div>
            <span className={styles.sceneSubCount}>
              <Layers size={12} aria-hidden strokeWidth={2} />
              {current.subStages.length} 个子阶段
            </span>
            <div className={styles.sceneHeadActions}>
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
                  aria-label="管理话术"
                  onClick={() => setEditMode(true)}
                >
                  <Pencil size={12} aria-hidden strokeWidth={2} />
                </IconButton>
              )}
            </div>
          </div>

          {editMode && (
            <SceneStructureEditor
              scene={current.scene}
              subStages={current.subStages}
              onError={(msg) => showToast(msg)}
              onCreateScene={() => void handleCreateScene()}
              onDeleteScene={() => void handleDeleteScene(current.scene.id)}
            />
          )}

          {editMode && editing && (
            <div className={styles.editorSlot}>
              <PhraseEditor
                target={editing}
                sceneId={current.scene.id}
                subStages={current.subStages}
                onClose={() => setEditing(null)}
                onError={(msg) => showToast(msg)}
              />
            </div>
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
              groups.map((g, gi) => (
                <div
                  key={g.subStage?.id ?? "__ungrouped__"}
                  className={styles.group}
                >
                  {g.subStage && (
                    <div className={styles.subStage}>
                      <span className={styles.subStageIdx}>
                        {String(gi + 1).padStart(2, "0")}
                      </span>
                      <span className={styles.subStageName}>
                        {g.subStage.name}
                      </span>
                    </div>
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
                        <Copy
                          size={13}
                          className={styles.phraseIcon}
                          aria-hidden
                          strokeWidth={2}
                        />
                        <span className={styles.phraseBody}>
                          <h4 className={styles.phraseTitle}>{p.name}</h4>
                          <p className={styles.phraseContent}>{p.content}</p>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}

interface StructureEditorProps {
  scene: Scene;
  subStages: SubStage[];
  onError: (msg: string) => void;
  onCreateScene: () => void;
  onDeleteScene: () => void;
}

type SubDraft = { kind: "create" } | { kind: "rename"; id: string } | null;

// Edit-mode structure editor: rename / delete the current Scene, create a new
// Scene, and CRUD its sub-stages. Scene reorder is a backend capability but has
// no UI here (plan scene-substage-editing §5 scopes the UI to 增改名删).
function SceneStructureEditor({
  scene,
  subStages,
  onError,
  onCreateScene,
  onDeleteScene,
}: StructureEditorProps) {
  const updateScene = usePromptStore((s) => s.updateScene);
  const createSubStage = usePromptStore((s) => s.createSubStage);
  const updateSubStage = usePromptStore((s) => s.updateSubStage);
  const deleteSubStage = usePromptStore((s) => s.deleteSubStage);

  const [renamingScene, setRenamingScene] = useState(false);
  const [sceneName, setSceneName] = useState(scene.name);
  const [confirmDeleteScene, setConfirmDeleteScene] = useState(false);
  const [subDraft, setSubDraft] = useState<SubDraft>(null);
  const [subName, setSubName] = useState("");
  const [confirmSubId, setConfirmSubId] = useState<string | null>(null);

  const ordered = [...subStages].sort((a, b) => a.orderIndex - b.orderIndex);

  const cancelSceneRename = () => {
    setRenamingScene(false);
    setSceneName(scene.name);
  };

  const saveSceneName = async () => {
    const name = sceneName.trim();
    if (!name) return;
    try {
      await updateScene({
        id: scene.id,
        name,
        icon: scene.icon ?? undefined,
        rolePresets: scene.rolePresets,
        color: scene.color ?? undefined,
      });
      setRenamingScene(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : "重命名失败");
    }
  };

  const cancelSub = () => {
    setSubDraft(null);
    setSubName("");
  };

  const saveSub = async () => {
    const name = subName.trim();
    if (!name || !subDraft) return;
    try {
      if (subDraft.kind === "create") {
        await createSubStage({ sceneId: scene.id, name });
      } else {
        await updateSubStage({ id: subDraft.id, name });
      }
      cancelSub();
    } catch (err) {
      onError(err instanceof Error ? err.message : "保存失败");
    }
  };

  const removeSub = async (id: string) => {
    setConfirmSubId(null);
    try {
      await deleteSubStage(id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "删除失败");
    }
  };

  return (
    <div className={styles.structureEditor}>
      <div className={styles.structureRow}>
        {renamingScene ? (
          <Input
            autoFocus
            aria-label="场景名称"
            value={sceneName}
            onChange={(e) => setSceneName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") cancelSceneRename();
              if (e.key === "Enter") {
                e.preventDefault();
                void saveSceneName();
              }
            }}
          />
        ) : (
          <span className={styles.structureLabel}>场景 · {scene.name}</span>
        )}
        {renamingScene ? (
          <ActionCluster>
            <Button intent="subtle" onClick={cancelSceneRename}>
              取消
            </Button>
            <Button
              layer="task"
              intent="primary"
              onClick={() => void saveSceneName()}
              disabled={sceneName.trim().length === 0}
            >
              保存
            </Button>
          </ActionCluster>
        ) : confirmDeleteScene ? (
          <ConfirmInline
            text="删除场景？"
            confirmLabel="确认删除场景"
            cancelLabel="取消删除"
            onConfirm={() => {
              setConfirmDeleteScene(false);
              onDeleteScene();
            }}
            onCancel={() => setConfirmDeleteScene(false)}
          />
        ) : (
          <ActionCluster>
            <IconButton
              aria-label="重命名场景"
              onClick={() => {
                setSceneName(scene.name);
                setRenamingScene(true);
              }}
            >
              <Pencil size={13} aria-hidden strokeWidth={2} />
            </IconButton>
            <IconButton
              aria-label="删除场景"
              onClick={() => setConfirmDeleteScene(true)}
            >
              <Trash2 size={13} aria-hidden strokeWidth={2} />
            </IconButton>
            <Button layer="task" aria-label="新建场景" onClick={onCreateScene}>
              <Plus size={14} aria-hidden strokeWidth={2} />
              <span>新建场景</span>
            </Button>
          </ActionCluster>
        )}
      </div>

      <div className={styles.subStageManager}>
        <div className={styles.subStageManagerHead}>
          <span className={styles.structureLabel}>
            <Layers size={12} aria-hidden strokeWidth={2} />
            子阶段
          </span>
          {subDraft?.kind !== "create" && (
            <Button
              layer="task"
              aria-label="新增子阶段"
              onClick={() => {
                setSubName("");
                setSubDraft({ kind: "create" });
              }}
            >
              <Plus size={14} aria-hidden strokeWidth={2} />
              <span>新增子阶段</span>
            </Button>
          )}
        </div>

        {subDraft?.kind === "create" && (
          <SubStageInlineEditor
            value={subName}
            onChange={setSubName}
            onCancel={cancelSub}
            onSave={() => void saveSub()}
          />
        )}

        {ordered.length === 0 && subDraft?.kind !== "create" ? (
          <p className={styles.subStageEmpty}>暂无子阶段</p>
        ) : (
          <ul className={styles.subStageList}>
            {ordered.map((s) => (
              <li key={s.id} className={styles.subStageItem}>
                {subDraft?.kind === "rename" && subDraft.id === s.id ? (
                  <SubStageInlineEditor
                    value={subName}
                    onChange={setSubName}
                    onCancel={cancelSub}
                    onSave={() => void saveSub()}
                  />
                ) : confirmSubId === s.id ? (
                  <>
                    <span className={styles.subStageItemName}>{s.name}</span>
                    <ConfirmInline
                      text="删除子阶段？话术将解除归属"
                      confirmLabel="确认删除子阶段"
                      cancelLabel="取消删除"
                      onConfirm={() => void removeSub(s.id)}
                      onCancel={() => setConfirmSubId(null)}
                    />
                  </>
                ) : (
                  <>
                    <span className={styles.subStageItemName}>{s.name}</span>
                    <ActionCluster>
                      <IconButton
                        aria-label={`重命名 ${s.name}`}
                        onClick={() => {
                          setSubName(s.name);
                          setSubDraft({ kind: "rename", id: s.id });
                        }}
                      >
                        <Pencil size={13} aria-hidden strokeWidth={2} />
                      </IconButton>
                      <IconButton
                        aria-label={`删除 ${s.name}`}
                        onClick={() => setConfirmSubId(s.id)}
                      >
                        <Trash2 size={13} aria-hidden strokeWidth={2} />
                      </IconButton>
                    </ActionCluster>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface SubStageInlineEditorProps {
  value: string;
  onChange: (next: string) => void;
  onCancel: () => void;
  onSave: () => void;
}

function SubStageInlineEditor({
  value,
  onChange,
  onCancel,
  onSave,
}: SubStageInlineEditorProps) {
  return (
    <div className={styles.subStageInline}>
      <Input
        autoFocus
        aria-label="子阶段名称"
        placeholder="子阶段名称"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter") {
            e.preventDefault();
            onSave();
          }
        }}
      />
      <ActionCluster>
        <Button intent="subtle" onClick={onCancel}>
          取消
        </Button>
        <Button
          layer="task"
          intent="primary"
          onClick={onSave}
          disabled={value.trim().length === 0}
        >
          保存
        </Button>
      </ActionCluster>
    </div>
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
      {subStageName && (
        <div className={styles.subStage}>
          <span className={styles.subStageName}>{subStageName}</span>
        </div>
      )}
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
