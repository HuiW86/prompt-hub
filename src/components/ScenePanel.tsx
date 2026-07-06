import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Copy,
  Folder,
  Inbox,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { useCopy } from "../hooks/useCopy";
import { useRegionNav } from "../hooks/useRegionNav";
import type { Phrase, SubStage } from "../ipc/types";
import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";
import { toUserMessage } from "../utils/errorMessage";

import { DraftInbox } from "./DraftInbox";
import {
  ActionCluster,
  Button,
  Chip,
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
import { SceneIcon } from "./SceneIcon";
import styles from "./ScenePanel.module.css";
import {
  ScenePropertiesEditor,
  type ScenePropertiesPayload,
} from "./ScenePropertiesEditor";

type EditTarget = { mode: "create" } | { mode: "edit"; phrase: Phrase } | null;

type Grouped = Array<{ subStage: SubStage | null; phrases: Phrase[] }>;

// includeEmpty keeps sub-stages with no phrases in the result — the grid passes
// it so a freshly-created empty sub-stage stays a visible, manageable column (a
// muted column with an add-phrase placeholder). The default-false path is
// retained for callers that only want populated groups.
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
  const updateScene = usePromptStore((s) => s.updateScene);
  const deleteScene = usePromptStore((s) => s.deleteScene);
  const reorderScenes = usePromptStore((s) => s.reorderScenes);
  const createSubStage = usePromptStore((s) => s.createSubStage);
  const updateSubStage = usePromptStore((s) => s.updateSubStage);
  const deleteSubStage = usePromptStore((s) => s.deleteSubStage);
  const reorderSubStages = usePromptStore((s) => s.reorderSubStages);
  const reorderPhrases = usePromptStore((s) => s.reorderPhrases);
  const copy = useCopy();
  const flashId = useToastStore((s) => s.flashTargetId);
  const showToast = useToastStore((s) => s.show);
  const showError = useToastStore((s) => s.showError);
  const onRegionKeyDown = useRegionNav();
  // Active scene is tracked by ID, not index (P3-6): a tab reorder shifts every
  // index, and an index-keyed selection would silently land on a neighbour scene.
  // The id stays stable across reorders; a deleted/unknown id falls back to the
  // first.
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [showDrafts, setShowDrafts] = useState(false);
  const [showProperties, setShowProperties] = useState(false);
  // View-mode in-place editing state — the grid's own action clusters (tasks
  // 5 + 6) drive these. phraseEdit: a phrase card swapped for the PhraseEditor
  // (edit an existing phrase). addPhraseFor: a column's ghost card opened into a
  // create-mode PhraseEditor prefilled with that column's subStageId (null =
  // ungrouped).
  const [renamingSubId, setRenamingSubId] = useState<string | null>(null);
  const [confirmingSubId, setConfirmingSubId] = useState<string | null>(null);
  const [creatingSubStage, setCreatingSubStage] = useState(false);
  const [phraseEditId, setPhraseEditId] = useState<string | null>(null);
  const [addPhraseFor, setAddPhraseFor] = useState<{
    subStageId: string | null;
  } | null>(null);

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

  const current =
    scenes.find((sc) => sc.scene.id === activeSceneId) ?? scenes[0];
  const currentSceneId = current?.scene.id;

  // Programmatic scene jumps that must open the properties panel on arrival
  // (create-scene jumping to the fresh tab) raise this flag; the reset effect
  // below consumes it once, opening the panel instead of closing it.
  const openPropsOnSceneChange = useRef(false);

  // Switching scenes (or jumping to drafts) mid-edit would mutate a list the
  // user can no longer see — reset edit state on either change. A flagged
  // programmatic jump (fresh scene) opens the properties panel on the new tab;
  // any other change closes the properties panel and clears in-place editors.
  useEffect(() => {
    setShowProperties(openPropsOnSceneChange.current);
    openPropsOnSceneChange.current = false;
    // Reset the view-mode in-place editing state too — a scene switch must
    // not carry an open rename / confirm / phrase editor onto the new scene.
    setRenamingSubId(null);
    setConfirmingSubId(null);
    setCreatingSubStage(false);
    setPhraseEditId(null);
    setAddPhraseFor(null);
  }, [currentSceneId, draftsActive]);

  const handleDelete = async (id: string) => {
    try {
      await deletePhrase(id);
      showToast("已永久删除");
    } catch (err) {
      showError(toUserMessage(err, "删除失败"));
    }
  };

  // New scenes append to the global order — after the store re-pull, jump to
  // the trailing scene and open its properties panel so the user names / styles
  // it immediately (replaces the old inline-rename-in-edit-mode flow).
  const handleCreateScene = async () => {
    try {
      await createScene({ name: "新场景", rolePresets: [] });
      const next = usePromptStore.getState().scenes;
      const created = next[next.length - 1];
      if (created) {
        // Flag the jump so the scene-change reset effect opens the props panel.
        openPropsOnSceneChange.current = true;
        setActiveSceneId(created.scene.id);
      }
    } catch (err) {
      showError(toUserMessage(err, "新建场景失败"));
    }
  };

  // Persist the properties panel edits through the existing update_scene link,
  // then close the panel. onSave's payload already matches update_scene's wire
  // shape; we only thread the scene id through.
  const handleSaveProperties = async (payload: ScenePropertiesPayload) => {
    if (!current) return;
    try {
      await updateScene({ id: current.scene.id, ...payload });
      setShowProperties(false);
    } catch (err) {
      showError(toUserMessage(err, "保存场景属性失败"));
    }
  };

  // Backend refuses a non-empty Scene (RepoError::SceneNotEmpty) — surface that
  // message rather than swallowing it. On success fall back to the first tab.
  const handleDeleteScene = async (id: string) => {
    try {
      await deleteScene(id);
      showToast("已删除场景");
      setShowProperties(false);
      setActiveSceneId(null);
    } catch (err) {
      showError(toUserMessage(err, "删除场景失败"));
    }
  };

  // P3-6 scene reorder: swap the active scene with its left/right neighbour in
  // the global tab order. Buttons over tab dnd — the tabs double as
  // click-to-switch buttons and share the nav with the conditional 草稿 tab, so
  // a drag layer there would fight both. Selection is pinned to the moved
  // scene's id below so the id-keyed lookup keeps it active through the store
  // re-pull.
  const handleMoveScene = async (dir: -1 | 1) => {
    if (!current) return;
    const idx = scenes.findIndex((sc) => sc.scene.id === current.scene.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= scenes.length) return;
    const ids = scenes.map((sc) => sc.scene.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    // Pin the selection BEFORE persisting: with activeSceneId still null the
    // selection rides the scenes[0] fallback, which after the reorder re-pull
    // would resolve to the swapped-in neighbour. The id itself is unchanged,
    // so currentSceneId stays stable and the edit-reset effect does not fire.
    setActiveSceneId(current.scene.id);
    try {
      await reorderScenes(ids);
    } catch (err) {
      showError(toUserMessage(err, "场景排序保存失败"));
    }
  };

  // ── View-mode structure ops (task 5) ──────────────────────────────────────
  // Sub-stage rename/create commit through the existing update_sub_stage /
  // create_sub_stage links; the ←→ swap reuses reorder_sub_stages by rebuilding
  // the ordered id list with the target and its neighbour transposed. Move
  // buttons over a drag handle — copy is the grid's primary action, so a drag
  // affordance would fight it (plan 关键决策: 拖拽 → 按钮移动).
  const handleRenameSub = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await updateSubStage({ id, name: trimmed });
      setRenamingSubId(null);
    } catch (err) {
      showError(toUserMessage(err, "重命名失败"));
    }
  };

  const handleCreateSub = async (name: string) => {
    if (!current) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createSubStage({ sceneId: current.scene.id, name: trimmed });
      setCreatingSubStage(false);
    } catch (err) {
      showError(toUserMessage(err, "新增子阶段失败"));
    }
  };

  const handleDeleteSub = async (id: string) => {
    setConfirmingSubId(null);
    try {
      await deleteSubStage(id);
    } catch (err) {
      showError(toUserMessage(err, "删除子阶段失败"));
    }
  };

  const handleMoveSub = async (id: string, dir: -1 | 1) => {
    if (!current) return;
    const ordered = [...current.subStages].sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    const idx = ordered.findIndex((s) => s.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= ordered.length) return;
    const ids = ordered.map((s) => s.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    try {
      await reorderSubStages(current.scene.id, ids);
    } catch (err) {
      showError(toUserMessage(err, "子阶段排序保存失败"));
    }
  };

  // ── View-mode phrase ops (task 6) ─────────────────────────────────────────
  // ↑↓ swaps a phrase with its neighbour WITHIN its own group, persisting the
  // partition's new order through reorder_phrases (order_index is partitioned
  // per (scene, sub-stage), matching this list). Cross-column moves are out of
  // scope — changing a phrase's group goes through the editor's sub-stage select.
  const handleMovePhrase = async (
    subStageId: string | null,
    groupPhrases: Phrase[],
    id: string,
    dir: -1 | 1,
  ) => {
    if (!current) return;
    const idx = groupPhrases.findIndex((p) => p.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= groupPhrases.length) return;
    const ids = groupPhrases.map((p) => p.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    try {
      await reorderPhrases(current.scene.id, subStageId, ids);
    } catch (err) {
      showError(toUserMessage(err, "排序保存失败"));
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
        onKeyDown={onRegionKeyDown}
      >
        <RegionHeader title="Scene" subtitle="场景全景" count={0} />
        {/* Rich empty state (Promptscape empty Scene: dashed card + folder
            icon + headline + accent CTA wired to the existing create entry). */}
        <EmptyState
          framed
          icon={<Folder size={24} aria-hidden strokeWidth={2} />}
          title={<span id="scene-panel-empty-msg">还没有场景分类</span>}
          action={
            <Button
              layer="task"
              intent="accent"
              aria-label="创建第一个场景"
              data-nav-item
              tabIndex={-1}
              onClick={() => void handleCreateScene()}
            >
              <Plus size={14} aria-hidden strokeWidth={2} />
              <span>创建第一个场景</span>
            </Button>
          }
        >
          创建正交的场景分类，把子阶段与场景话术组织成可切换的标签全景
        </EmptyState>
      </section>
    );
  }

  // Include empty sub-stages so a freshly-created empty column stays visible and
  // manageable in the grid (plan task 5).
  const groups = groupBySubStage(current.phrases, current.subStages, true);

  return (
    <section
      className={styles.region}
      aria-label="Scene 全景区"
      data-region="scene-panel"
      tabIndex={0}
      onKeyDown={onRegionKeyDown}
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
              data-nav-item
              tabIndex={-1}
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
        {scenes.map((sc) => {
          const isActive = !draftsActive && sc.scene.id === currentSceneId;
          return (
            <button
              key={sc.scene.id}
              type="button"
              className={`${styles.tab} ${isActive ? styles.active : ""}`}
              onClick={() => {
                setShowDrafts(false);
                setActiveSceneId(sc.scene.id);
              }}
              aria-current={isActive ? "page" : undefined}
              data-nav-item
              tabIndex={-1}
            >
              <span
                className={styles.icon}
                // Scene color paints only the scene's own icon, never chrome
                // (ADR-019); absent color falls back to inherited chrome tone.
                style={{ color: sc.scene.color ?? undefined }}
              >
                <SceneIcon name={sc.scene.icon} size={14} />
              </span>
              <span className={styles.tabName}>{sc.scene.name}</span>
              <span className={styles.tabCount}>{sc.phrases.length}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={styles.tabAdd}
          onClick={() => void handleCreateScene()}
          aria-label="新建场景"
          data-nav-item
          tabIndex={-1}
        >
          <Plus size={14} aria-hidden strokeWidth={2} />
        </button>
      </nav>
      {draftsActive ? (
        <div className={styles.phrases}>
          <DraftInbox />
        </div>
      ) : (
        <div className={styles.sceneCard}>
          <div className={styles.sceneHead}>
            <span
              className={styles.sceneIcon}
              aria-hidden
              // Scene color paints only the scene's own icon glyph (ADR-019).
              style={{ color: current.scene.color ?? undefined }}
            >
              <SceneIcon name={current.scene.icon ?? "📁"} size={18} />
            </span>
            <div className={styles.sceneIdentity}>
              <div className={styles.sceneName}>{current.scene.name}</div>
              <div className={styles.sceneMeta}>
                <span>{current.phrases.length} 条话术</span>
                {current.scene.rolePresets.length > 0 && (
                  <span className={styles.roleChips}>
                    {current.scene.rolePresets.map((role) => (
                      <Chip key={role} layer="task" dim>
                        {role}
                      </Chip>
                    ))}
                  </span>
                )}
              </div>
            </div>
            <span className={styles.sceneSubCount}>
              <Layers size={12} aria-hidden strokeWidth={2} />
              {current.subStages.length} 个子阶段
            </span>
            <div className={styles.sceneHeadActions}>
              <IconButton
                aria-label="编辑场景属性"
                data-nav-item
                tabIndex={-1}
                onClick={() => setShowProperties(true)}
              >
                <Pencil size={12} aria-hidden strokeWidth={2} />
              </IconButton>
            </div>
          </div>

          {showProperties && (
            <div className={styles.editorSlot}>
              <ScenePropertiesEditor
                scene={current.scene}
                canMoveLeft={
                  scenes.findIndex((sc) => sc.scene.id === current.scene.id) > 0
                }
                canMoveRight={
                  scenes.findIndex((sc) => sc.scene.id === current.scene.id) <
                  scenes.length - 1
                }
                onSave={(payload) => void handleSaveProperties(payload)}
                onMoveScene={(dir) => void handleMoveScene(dir)}
                onDelete={() => void handleDeleteScene(current.scene.id)}
                onClose={() => setShowProperties(false)}
              />
            </div>
          )}

          <div className={styles.phrases}>
            {groups.map((g, gi) => {
              const subId = g.subStage?.id ?? null;
              return (
                <ViewColumn
                  key={subId ?? "__ungrouped__"}
                  index={gi}
                  subStage={g.subStage}
                  phrases={g.phrases}
                  canMoveLeft={gi > 0 && g.subStage != null}
                  // The ungrouped column always trails last, so a real
                  // sub-stage can move right only if the next column is also a
                  // real sub-stage (never past the ungrouped orphan bucket).
                  canMoveRight={
                    g.subStage != null && groups[gi + 1]?.subStage != null
                  }
                  renaming={renamingSubId === g.subStage?.id}
                  confirmingDelete={confirmingSubId === g.subStage?.id}
                  editingPhraseId={phraseEditId}
                  addingPhrase={addPhraseFor?.subStageId === subId}
                  flashId={flashId}
                  sceneId={current.scene.id}
                  subStages={current.subStages}
                  onCopy={(p) =>
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
                  onRenameStart={() =>
                    g.subStage && setRenamingSubId(g.subStage.id)
                  }
                  onRenameCancel={() => setRenamingSubId(null)}
                  onRenameSave={(name) =>
                    g.subStage && void handleRenameSub(g.subStage.id, name)
                  }
                  onMove={(dir) =>
                    g.subStage && void handleMoveSub(g.subStage.id, dir)
                  }
                  onDeleteRequest={() =>
                    g.subStage && setConfirmingSubId(g.subStage.id)
                  }
                  onDeleteCancel={() => setConfirmingSubId(null)}
                  onDeleteConfirm={() =>
                    g.subStage && void handleDeleteSub(g.subStage.id)
                  }
                  onPhraseEdit={(id) => setPhraseEditId(id)}
                  onPhraseEditClose={() => setPhraseEditId(null)}
                  onPhraseMove={(id, dir) =>
                    void handleMovePhrase(subId, g.phrases, id, dir)
                  }
                  onPhraseDelete={(id) => void handleDelete(id)}
                  onAddPhrase={() => setAddPhraseFor({ subStageId: subId })}
                  onAddPhraseClose={() => setAddPhraseFor(null)}
                  onError={showError}
                />
              );
            })}
            {/* Trailing ghost column — opens an inline name editor to create a
                  new sub-stage (create link: create_sub_stage). */}
            <div className={`${styles.group} ${styles.ghostColumn}`}>
              {creatingSubStage ? (
                <InlineNameEditor
                  initialValue=""
                  ariaLabel="子阶段名称"
                  placeholder="子阶段名称"
                  onSave={(name) => void handleCreateSub(name)}
                  onCancel={() => setCreatingSubStage(false)}
                />
              ) : (
                <button
                  type="button"
                  className={styles.ghostAdd}
                  onClick={() => setCreatingSubStage(true)}
                  aria-label="新增子阶段"
                  data-nav-item
                  tabIndex={-1}
                >
                  <Plus size={14} aria-hidden strokeWidth={2} />
                  <span>新增子阶段</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface ViewColumnProps {
  index: number;
  subStage: SubStage | null;
  phrases: Phrase[];
  canMoveLeft: boolean;
  canMoveRight: boolean;
  renaming: boolean;
  confirmingDelete: boolean;
  editingPhraseId: string | null;
  addingPhrase: boolean;
  flashId: string | null;
  sceneId: string;
  subStages: SubStage[];
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
  onPhraseDelete: (id: string) => void;
  onAddPhrase: () => void;
  onAddPhraseClose: () => void;
  onError: (msg: string) => void;
}

// One view-mode grid column: a sub-stage header with a hover/focus-within action
// cluster (rename / move / delete — task 5) atop its phrase cards, each carrying
// its own cluster (edit / move / delete — task 6), and a trailing add-phrase
// ghost card. The ungrouped orphan column (subStage == null) renders the muted
// 未分组 header with no header actions, but still gets add-phrase (subStageId
// null) so orphan phrases can be created in place.
function ViewColumn({
  index,
  subStage,
  phrases,
  canMoveLeft,
  canMoveRight,
  renaming,
  confirmingDelete,
  editingPhraseId,
  addingPhrase,
  flashId,
  sceneId,
  subStages,
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
  onPhraseDelete,
  onAddPhrase,
  onAddPhraseClose,
  onError,
}: ViewColumnProps) {
  const subStageId = subStage?.id ?? null;
  return (
    <div className={styles.group}>
      <div className={styles.subStage}>
        <span className={styles.subStageIdx}>
          {String(index + 1).padStart(2, "0")}
        </span>
        {renaming && subStage ? (
          <InlineNameEditor
            initialValue={subStage.name}
            ariaLabel="子阶段名称"
            onSave={onRenameSave}
            onCancel={onRenameCancel}
          />
        ) : confirmingDelete && subStage ? (
          <>
            <span className={styles.subStageName}>{subStage.name}</span>
            <ConfirmInline
              text="删除子阶段？话术将解除归属"
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
            >
              {subStage ? subStage.name : "未分组"}
            </span>
            {/* Ungrouped column has no rename/move/delete — it is a synthetic
                bucket, not a real sub-stage. */}
            {subStage && (
              <ActionCluster className={styles.subStageActions} reveal>
                <IconButton
                  aria-label={`前移 ${subStage.name}`}
                  data-nav-item
                  tabIndex={-1}
                  disabled={!canMoveLeft}
                  onClick={() => onMove(-1)}
                >
                  <ArrowLeft size={13} aria-hidden strokeWidth={2} />
                </IconButton>
                <IconButton
                  aria-label={`后移 ${subStage.name}`}
                  data-nav-item
                  tabIndex={-1}
                  disabled={!canMoveRight}
                  onClick={() => onMove(1)}
                >
                  <ArrowRight size={13} aria-hidden strokeWidth={2} />
                </IconButton>
                <IconButton
                  aria-label={`重命名 ${subStage.name}`}
                  data-nav-item
                  tabIndex={-1}
                  onClick={onRenameStart}
                >
                  <Pencil size={13} aria-hidden strokeWidth={2} />
                </IconButton>
                <IconButton
                  aria-label={`删除 ${subStage.name}`}
                  data-nav-item
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
        editingPhraseId === p.id ? (
          <PhraseEditor
            key={p.id}
            target={{ mode: "edit", phrase: p }}
            sceneId={sceneId}
            subStages={subStages}
            onClose={onPhraseEditClose}
            onError={onError}
          />
        ) : (
          <ViewPhraseCard
            key={p.id}
            phrase={p}
            flash={flashId === p.id}
            canMoveUp={pi > 0}
            canMoveDown={pi < phrases.length - 1}
            onCopy={() => onCopy(p)}
            onEdit={() => onPhraseEdit(p.id)}
            onMove={(dir) => onPhraseMove(p.id, dir)}
            onDelete={() => onPhraseDelete(p.id)}
          />
        ),
      )}

      {addingPhrase ? (
        <PhraseEditor
          target={{ mode: "create" }}
          sceneId={sceneId}
          subStages={subStages}
          initialSubStageId={subStageId}
          onClose={onAddPhraseClose}
          onError={onError}
        />
      ) : (
        <button
          type="button"
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
      )}
    </div>
  );
}

interface ViewPhraseCardProps {
  phrase: Phrase;
  flash: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}

// A view-mode phrase card: the whole card copies (primary action), so every
// action-cluster button stops propagation to never trigger a copy (task 6).
// Delete is a two-step inline confirm held in local state so one card's confirm
// never bleeds into another's.
function ViewPhraseCard({
  phrase,
  flash,
  canMoveUp,
  canMoveDown,
  onCopy,
  onEdit,
  onMove,
  onDelete,
}: ViewPhraseCardProps) {
  const [confirming, setConfirming] = useState(false);
  const stop = (fn: () => void) => (e: ReactMouseEvent) => {
    e.stopPropagation();
    fn();
  };
  const cls = `${styles.phrase} ${flash ? `${primitiveStyles.task} ${primitiveStyles.flash}` : ""}`;
  return (
    <div
      role="button"
      tabIndex={-1}
      className={cls}
      data-nav-item
      onClick={onCopy}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCopy();
        }
      }}
      aria-label={phrase.name}
    >
      <Copy
        size={13}
        className={styles.phraseIcon}
        aria-hidden
        strokeWidth={2}
      />
      <span className={styles.phraseBody}>
        <h4 className={styles.phraseTitle}>{phrase.name}</h4>
        <p className={styles.phraseContent}>{phrase.content}</p>
      </span>
      {confirming ? (
        <div
          className={styles.phraseActions}
          onClick={(e) => e.stopPropagation()}
        >
          <ConfirmInline
            text="永久删除？"
            confirmLabel="确认永久删除"
            cancelLabel="取消删除"
            onConfirm={onDelete}
            onCancel={() => setConfirming(false)}
          />
        </div>
      ) : (
        <ActionCluster className={styles.phraseActions} reveal>
          <IconButton
            aria-label={`上移 ${phrase.name}`}
            data-nav-item
            tabIndex={-1}
            disabled={!canMoveUp}
            onClick={stop(() => onMove(-1))}
          >
            <ArrowUp size={13} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton
            aria-label={`下移 ${phrase.name}`}
            data-nav-item
            tabIndex={-1}
            disabled={!canMoveDown}
            onClick={stop(() => onMove(1))}
          >
            <ArrowDown size={13} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton
            aria-label={`编辑 ${phrase.name}`}
            data-nav-item
            tabIndex={-1}
            onClick={stop(onEdit)}
          >
            <Pencil size={13} aria-hidden strokeWidth={2} />
          </IconButton>
          <IconButton
            aria-label={`删除 ${phrase.name}`}
            data-nav-item
            tabIndex={-1}
            onClick={stop(() => setConfirming(true))}
          >
            <Trash2 size={13} aria-hidden strokeWidth={2} />
          </IconButton>
        </ActionCluster>
      )}
    </div>
  );
}

interface InlineNameEditorProps {
  initialValue: string;
  ariaLabel: string;
  placeholder?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

// Self-contained inline name editor for the view-mode grid (sub-stage rename +
// create). It owns its draft state so the grid header stays presentational.
// Enter commits with an IME guard — committing a pinyin/kana candidate fires
// Enter while isComposing is still true, and swallowing it would eat the
// composition instead of saving.
function InlineNameEditor({
  initialValue,
  ariaLabel,
  placeholder,
  onSave,
  onCancel,
}: InlineNameEditorProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className={styles.subStageInline}>
      <Input
        autoFocus
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter") {
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            if (value.trim().length > 0) onSave(value);
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
          onClick={() => onSave(value)}
          disabled={value.trim().length === 0}
        >
          保存
        </Button>
      </ActionCluster>
    </div>
  );
}

interface EditorProps {
  target: Exclude<EditTarget, null>;
  sceneId: string;
  subStages: SubStage[];
  // The add-phrase ghost card prefills the create form with the column's
  // sub-stage so the new phrase lands in place (task 6); when left undefined the
  // create form defaults to ungrouped.
  initialSubStageId?: string | null;
  onClose: () => void;
  onError: (msg: string) => void;
}

const UNGROUPED_VALUE = "__ungrouped__";

function PhraseEditor({
  target,
  sceneId,
  subStages,
  initialSubStageId,
  onClose,
  onError,
}: EditorProps) {
  const createPhrase = usePromptStore((s) => s.createPhrase);
  const updatePhrase = usePromptStore((s) => s.updatePhrase);
  const existing = target.mode === "edit" ? target.phrase : null;

  const [name, setName] = useState(existing?.name ?? "");
  const [content, setContent] = useState(existing?.content ?? "");
  const [subStageValue, setSubStageValue] = useState(
    existing?.subStageId ?? initialSubStageId ?? UNGROUPED_VALUE,
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
      onError(toUserMessage(err, "保存失败"));
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
