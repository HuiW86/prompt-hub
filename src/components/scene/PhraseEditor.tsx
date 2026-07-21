import { useState } from "react";

import type { SubStage } from "../../ipc/types";
import { usePromptStore } from "../../stores/promptStore";
import { useToastStore } from "../../stores/toastStore";
import { toUserMessage } from "../../utils/errorMessage";
import { PhraseFormEditor, type PhraseFormValues } from "../primitives";

import styles from "../ScenePanel.module.css";
import { type EditTarget, UNGROUPED_KEY } from "./constants";

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

export function PhraseEditor({
  target,
  sceneId,
  subStages,
  initialSubStageId,
  onClose,
  onError,
}: EditorProps) {
  const createPhrase = usePromptStore((s) => s.createPhrase);
  const updatePhrase = usePromptStore((s) => s.updatePhrase);
  const showToast = useToastStore((s) => s.show);
  const existing = target.mode === "edit" ? target.phrase : null;

  // Sub-stage picker is the one field beyond name/content, so it rides the
  // shared editor's extraFields slot rather than forking the whole form.
  const [subStageValue, setSubStageValue] = useState(
    existing?.subStageId ?? initialSubStageId ?? UNGROUPED_KEY,
  );

  const orderedSubStages = [...subStages].sort(
    (a, b) => a.orderIndex - b.orderIndex,
  );

  const handleSubmit = async ({ name, content }: PhraseFormValues) => {
    const subStageId = subStageValue === UNGROUPED_KEY ? null : subStageValue;
    try {
      if (existing) {
        await updatePhrase({ id: existing.id, name, content, subStageId });
        // Match the delete path's feedback strength (A1-07): a save is a write
        // like a delete, so it earns the same explicit confirmation toast.
        showToast("已保存话术");
      } else {
        await createPhrase({ sceneId, name, content, subStageId });
        showToast("已新增话术");
      }
      onClose();
    } catch (err) {
      onError(toUserMessage(err, "保存失败"));
      // Re-throw so the shared editor re-enables its save button.
      throw err;
    }
  };

  return (
    <PhraseFormEditor
      layer="task"
      ariaLabel={existing ? "编辑话术" : "新增话术"}
      initialName={existing?.name}
      initialContent={existing?.content}
      submitLabel={existing ? "保存" : "新增"}
      onSubmit={handleSubmit}
      onClose={onClose}
      extraFields={
        <select
          className={styles.subStageSelect}
          aria-label="所属子阶段"
          value={subStageValue}
          onChange={(e) => setSubStageValue(e.target.value)}
        >
          <option value={UNGROUPED_KEY}>未分组</option>
          {orderedSubStages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      }
    />
  );
}
