import { Folder, Layers, Pencil, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCopy } from "../../hooks/useCopy";
import { useFocusRestore } from "../../hooks/useFocusRestore";
import { useRegionNav } from "../../hooks/useRegionNav";
import type { Phrase, SubStage } from "../../ipc/types";
import { useAppStore } from "../../stores/appStore";
import { usePromptStore } from "../../stores/promptStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import { toUserMessage } from "../../utils/errorMessage";

import { DraftInbox } from "../DraftInbox";
import {
  Button,
  Chip,
  EmptyState,
  IconButton,
  RegionHeader,
} from "../primitives";
import { SceneIcon } from "../SceneIcon";
import styles from "../ScenePanel.module.css";
import {
  ScenePropertiesEditor,
  type ScenePropertiesPayload,
} from "../ScenePropertiesEditor";

import { UNGROUPED_KEY } from "./constants";
import { InlineNameEditor } from "./InlineNameEditor";
import { SceneTabs } from "./SceneTabs";
import { ViewColumn } from "./ViewColumn";

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
  const updatePhrase = usePromptStore((s) => s.updatePhrase);
  const createScene = usePromptStore((s) => s.createScene);
  const updateScene = usePromptStore((s) => s.updateScene);
  const deleteScene = usePromptStore((s) => s.deleteScene);
  const reorderScenes = usePromptStore((s) => s.reorderScenes);
  const createSubStage = usePromptStore((s) => s.createSubStage);
  const updateSubStage = usePromptStore((s) => s.updateSubStage);
  const deleteSubStage = usePromptStore((s) => s.deleteSubStage);
  const reorderSubStages = usePromptStore((s) => s.reorderSubStages);
  const reorderPhrases = usePromptStore((s) => s.reorderPhrases);
  const movePhrase = usePromptStore((s) => s.movePhrase);
  const copy = useCopy();
  const flashId = useToastStore((s) => s.flashTargetId);
  const showToast = useToastStore((s) => s.show);
  const showWithAction = useToastStore((s) => s.showWithAction);
  const showError = useToastStore((s) => s.showError);
  const interactionMode = useSettingsStore((s) => s.interactionMode);
  const onRegionKeyDown = useRegionNav();
  // Region container ref backs focus restoration across store re-pulls (A1-05):
  // a write re-pulls the scenes tree, the list re-renders, DOM focus falls to
  // <body>, and useRegionNav would restart at the container. useFocusRestore
  // re-lands focus on the mutated item's [data-nav-id] node inside this root.
  const regionRef = useRef<HTMLElement>(null);
  const { run: withFocusRestore, restoreAfterRender } = useFocusRestore(
    () => regionRef.current,
  );
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
  // The phrase whose card is swapped for the move selector (ADR-022 "移动到…").
  const [movingPhraseId, setMovingPhraseId] = useState<string | null>(null);

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
    setMovingPhraseId(null);
  }, [currentSceneId, draftsActive]);

  const handleDelete = async (id: string, siblingIds: string[]) => {
    // Deletion drops the focused card; restore to the nearest surviving sibling
    // so keyboard flow continues (A1-05).
    await withFocusRestore(
      async () => {
        try {
          await deletePhrase(id);
          showToast("已永久删除");
        } catch (err) {
          showError(toUserMessage(err, "删除失败"));
        }
      },
      {
        targetKey: `phrase-${id}`,
        siblingKeys: siblingIds.map((sid) => `phrase-${sid}`),
      },
    );
  };

  // Commit a cross-scene / cross-sub-stage move (ADR-022). Resolve the human
  // labels for the toast BEFORE the store re-pull mutates the tree, run the
  // move, then arm a 撤销 toast whose action reverses it via the receipt
  // (targetOrderIndex = fromOrderIndex refills the exact vacated slot). Undo
  // lives only for the toast's lifetime (子决策 3); a failed move OR a failed
  // undo surfaces an honest error toast rather than being swallowed.
  const handleMovePhraseTo = async (
    phrase: Phrase,
    targetSceneId: string,
    targetSubStageId: string | null,
  ) => {
    const destScene = scenes.find((sc) => sc.scene.id === targetSceneId);
    const destSubName = targetSubStageId
      ? (destScene?.subStages.find((s) => s.id === targetSubStageId)?.name ??
        "子阶段")
      : "未分组";
    const destLabel = `${destScene?.scene.name ?? "场景"} / ${destSubName}`;
    setMovingPhraseId(null);
    try {
      const receipt = await movePhrase({
        id: phrase.id,
        targetSceneId,
        targetSubStageId,
      });
      showWithAction(`已移至 ${destLabel}`, {
        label: "撤销",
        onClick: () => {
          void (async () => {
            try {
              await movePhrase({
                id: receipt.phraseId,
                targetSceneId: receipt.fromSceneId,
                targetSubStageId: receipt.fromSubStageId,
                targetOrderIndex: receipt.fromOrderIndex,
              });
              showToast("已撤销移动");
            } catch (err) {
              showError(toUserMessage(err, "撤销失败"));
            }
          })();
        },
      });
    } catch (err) {
      showError(toUserMessage(err, "移动失败"));
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
    // Rename keeps the same sub-stage id: restore focus to its rename control.
    await withFocusRestore(
      async () => {
        try {
          await updateSubStage({ id, name: trimmed });
          setRenamingSubId(null);
        } catch (err) {
          showError(toUserMessage(err, "重命名失败"));
        }
      },
      { targetKey: `substage-${id}-rename` },
    );
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

  // Promote the synthetic ungrouped bucket: naming it creates a real sub-stage
  // and re-homes the bucket's phrases into it (create_sub_stage + update_phrase,
  // no new write link). Each re-home is an independent write — a mid-loop
  // failure keeps already-moved phrases, leaves the rest ungrouped and surfaces
  // the error, so retrying the promote is harmless (the bucket only holds the
  // remainder).
  const handlePromoteUngrouped = async (name: string, orphans: Phrase[]) => {
    if (!current) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const created = await createSubStage({
        sceneId: current.scene.id,
        name: trimmed,
      });
      for (const p of orphans) {
        await updatePhrase({
          id: p.id,
          name: p.name,
          content: p.content,
          subStageId: created.id,
        });
      }
      setRenamingSubId(null);
    } catch (err) {
      showError(toUserMessage(err, "转为子阶段失败"));
    }
  };

  const handleDeleteSub = async (id: string, siblingIds: string[]) => {
    setConfirmingSubId(null);
    await withFocusRestore(
      async () => {
        try {
          await deleteSubStage(id);
        } catch (err) {
          showError(toUserMessage(err, "删除子阶段失败"));
        }
      },
      // The deleted column's header controls vanish — fall to a surviving
      // column's rename control (next then previous).
      {
        targetKey: `substage-${id}-rename`,
        siblingKeys: siblingIds.map((sid) => `substage-${sid}-rename`),
      },
    );
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
    // The moved sub-stage keeps its id; a boundary move may disable the arrow
    // that was clicked, so restore to the stable rename control instead.
    await withFocusRestore(
      async () => {
        try {
          await reorderSubStages(current.scene.id, ids);
        } catch (err) {
          showError(toUserMessage(err, "子阶段排序保存失败"));
        }
      },
      { targetKey: `substage-${id}-rename` },
    );
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
    // The moved phrase keeps its id — restore focus to its card after the
    // re-pull so ↑↓ can be chained (A1-05).
    await withFocusRestore(
      async () => {
        try {
          await reorderPhrases(current.scene.id, subStageId, ids);
        } catch (err) {
          showError(toUserMessage(err, "排序保存失败"));
        }
      },
      { targetKey: `phrase-${id}` },
    );
  };

  if (!current) {
    return (
      <section
        ref={regionRef}
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
      ref={regionRef}
      className={styles.region}
      aria-label="Scene 全景区"
      data-region="scene-panel"
      tabIndex={0}
      onKeyDown={onRegionKeyDown}
    >
      <RegionHeader title="Scene" subtitle="场景全景" count={scenes.length} />
      <SceneTabs
        scenes={scenes}
        currentSceneId={currentSceneId}
        draftsAvailable={draftsAvailable}
        draftsActive={draftsActive}
        pendingDraftCount={pendingDraftCount}
        onSelectDrafts={() => setShowDrafts(true)}
        onSelectScene={(id) => {
          setShowDrafts(false);
          setActiveSceneId(id);
        }}
        onCreateScene={() => void handleCreateScene()}
      />
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
              // Sibling id lists for focus-restore fallbacks on deletion.
              const realSubIds = groups
                .map((gr) => gr.subStage?.id)
                .filter((id): id is string => id != null);
              return (
                <ViewColumn
                  key={subId ?? UNGROUPED_KEY}
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
                  renaming={renamingSubId === (g.subStage?.id ?? UNGROUPED_KEY)}
                  confirmingDelete={confirmingSubId === g.subStage?.id}
                  editingPhraseId={phraseEditId}
                  movingPhraseId={movingPhraseId}
                  addingPhrase={addPhraseFor?.subStageId === subId}
                  flashId={flashId}
                  interactionMode={interactionMode}
                  sceneId={current.scene.id}
                  subStages={current.subStages}
                  scenes={scenes}
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
                    setRenamingSubId(g.subStage?.id ?? UNGROUPED_KEY)
                  }
                  onRenameCancel={() => setRenamingSubId(null)}
                  onRenameSave={(name) =>
                    g.subStage
                      ? void handleRenameSub(g.subStage.id, name)
                      : void handlePromoteUngrouped(name, g.phrases)
                  }
                  onMove={(dir) =>
                    g.subStage && void handleMoveSub(g.subStage.id, dir)
                  }
                  onDeleteRequest={() =>
                    g.subStage && setConfirmingSubId(g.subStage.id)
                  }
                  onDeleteCancel={() => setConfirmingSubId(null)}
                  onDeleteConfirm={() =>
                    g.subStage &&
                    void handleDeleteSub(g.subStage.id, realSubIds)
                  }
                  onPhraseEdit={(id) => {
                    // Arm a focus restore to the edited card: the save re-pull
                    // lives inside PhraseEditor, so the orchestrator schedules
                    // the restore for when the editor closes + the card remounts.
                    restoreAfterRender(`phrase-${id}`);
                    setPhraseEditId(id);
                  }}
                  onPhraseEditClose={() => setPhraseEditId(null)}
                  onPhraseMove={(id, dir) =>
                    void handleMovePhrase(subId, g.phrases, id, dir)
                  }
                  onPhraseMoveToStart={(id) => setMovingPhraseId(id)}
                  onPhraseMoveToCancel={() => setMovingPhraseId(null)}
                  onPhraseMoveToConfirm={(phrase, sceneId, subStageId) =>
                    void handleMovePhraseTo(phrase, sceneId, subStageId)
                  }
                  onPhraseDelete={(id) =>
                    void handleDelete(
                      id,
                      g.phrases.map((p) => p.id),
                    )
                  }
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
