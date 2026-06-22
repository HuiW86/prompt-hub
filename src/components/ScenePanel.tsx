import { Inbox } from "lucide-react";
import { useEffect, useState } from "react";

import { useCopy } from "../hooks/useCopy";
import type { Phrase, SubStage } from "../ipc/types";
import { useAppStore } from "../stores/appStore";
import { usePromptStore } from "../stores/promptStore";
import { useToastStore } from "../stores/toastStore";

import { DraftInbox } from "./DraftInbox";
import { EmptyState, RegionHeader } from "./primitives";
import primitiveStyles from "./primitives/primitives.module.css";
import styles from "./ScenePanel.module.css";

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
  const copy = useCopy();
  const flashId = useToastStore((s) => s.flashTargetId);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showDrafts, setShowDrafts] = useState(false);

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
        <div className={styles.phrases}>
          {groups.length === 0 ? (
            <EmptyState>该 Scene 暂无话术</EmptyState>
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
      )}
    </section>
  );
}
