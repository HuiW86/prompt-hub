import { Inbox, Plus } from "lucide-react";

import type { SceneWithChildren } from "../../ipc/types";

import { SceneIcon } from "../SceneIcon";
import styles from "../ScenePanel.module.css";

interface SceneTabsProps {
  scenes: SceneWithChildren[];
  currentSceneId: string | undefined;
  draftsAvailable: boolean;
  draftsActive: boolean;
  pendingDraftCount: number;
  onSelectDrafts: () => void;
  onSelectScene: (id: string) => void;
  onCreateScene: () => void;
}

// The Scene tab track: the conditional 草稿 tab (shown only while drafts are
// pending), one tab per scene, and the trailing ＋ add-scene button. All tabs
// double as click-to-switch buttons and share the region's roving arrow-key nav
// (data-nav-item + tabIndex=-1). Purely presentational — every mutation is a
// callback into the orchestrator, which owns the active-scene ID pinning (P3-6).
export function SceneTabs({
  scenes,
  currentSceneId,
  draftsAvailable,
  draftsActive,
  pendingDraftCount,
  onSelectDrafts,
  onSelectScene,
  onCreateScene,
}: SceneTabsProps) {
  return (
    <nav className={styles.tabs} aria-label="Scene tabs">
      {draftsAvailable && (
        <>
          <button
            type="button"
            className={`${styles.tab} ${styles.draftTab} ${draftsActive ? styles.active : ""}`}
            onClick={onSelectDrafts}
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
            onClick={() => onSelectScene(sc.scene.id)}
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
        onClick={onCreateScene}
        aria-label="新建场景"
        data-nav-item
        tabIndex={-1}
      >
        <Plus size={14} aria-hidden strokeWidth={2} />
      </button>
    </nav>
  );
}
