import { useState } from "react";

import type { Phrase, SceneWithChildren } from "../../ipc/types";
import { ActionCluster, Button } from "../primitives";

import styles from "../ScenePanel.module.css";
import { UNGROUPED_KEY } from "./constants";

interface PhraseMoveSelectorProps {
  phrase: Phrase;
  scenes: SceneWithChildren[];
  onCancel: () => void;
  onConfirm: (targetSceneId: string, targetSubStageId: string | null) => void;
}

// Layered target selector for a cross-scene / cross-sub-stage move (ADR-022 子决策
// 1). Step 1 picks the target Scene from ALL scenes; step 2 picks a SubStage of
// that scene (including 未分组). Two selects rather than drag: the target scene's
// board is hidden behind its tab at move time, so there is no drop target — the
// selector is the only stable form (parity with ADR-021 button-move). Native
// <select>s keep it keyboard-reachable and token-styled via .subStageSelect.
export function PhraseMoveSelector({
  phrase,
  scenes,
  onCancel,
  onConfirm,
}: PhraseMoveSelectorProps) {
  // Default the Scene picker to the phrase's current scene so a same-scene
  // cross-sub-stage move (A1-06) is one field away; SubStage starts at 未分组.
  const [sceneId, setSceneId] = useState(phrase.sceneId);
  const [subValue, setSubValue] = useState(UNGROUPED_KEY);

  const targetScene = scenes.find((sc) => sc.scene.id === sceneId);
  const orderedSubStages = [...(targetScene?.subStages ?? [])].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  const targetSubStageId = subValue === UNGROUPED_KEY ? null : subValue;
  // A no-op move (same scene AND same grouping) would still hit the backend's
  // MAX+1 append branch, dropping the card to its own partition's end and firing
  // a misleading 「已移至」 toast (P2-1). Disable confirm on an unchanged target,
  // matching the boundary-disabled reorder buttons' idiom.
  const isNoop =
    sceneId === phrase.sceneId &&
    targetSubStageId === (phrase.subStageId ?? null);

  const handleConfirm = () => {
    if (isNoop) return;
    onConfirm(sceneId, targetSubStageId);
  };

  return (
    <div
      className={styles.moveSelector}
      role="group"
      aria-label={`移动 ${phrase.name}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <select
        className={styles.subStageSelect}
        aria-label="目标场景"
        value={sceneId}
        data-nav-item
        tabIndex={-1}
        onChange={(e) => {
          // Changing the scene invalidates the previously-picked sub-stage
          // (it belonged to the old scene), so reset to 未分组.
          setSceneId(e.target.value);
          setSubValue(UNGROUPED_KEY);
        }}
      >
        {scenes.map((sc) => (
          <option key={sc.scene.id} value={sc.scene.id}>
            {sc.scene.name}
          </option>
        ))}
      </select>
      <select
        className={styles.subStageSelect}
        aria-label="目标子阶段"
        value={subValue}
        data-nav-item
        tabIndex={-1}
        onChange={(e) => setSubValue(e.target.value)}
      >
        <option value={UNGROUPED_KEY}>未分组</option>
        {orderedSubStages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <ActionCluster>
        <Button intent="subtle" data-nav-item tabIndex={-1} onClick={onCancel}>
          取消
        </Button>
        <Button
          layer="task"
          intent="primary"
          data-nav-item
          tabIndex={-1}
          disabled={isNoop}
          onClick={handleConfirm}
        >
          移动到此
        </Button>
      </ActionCluster>
    </div>
  );
}
