import { useState } from "react";

import type {
  AlignmentPhrase,
  AlignmentPhraseCoordinates,
  AxisKind,
} from "../../ipc/types";
import { usePromptStore } from "../../stores/promptStore";
import { AXIS_LABELS, AXIS_ORDER } from "../../utils/alignmentCopyText";
import { PhraseFormEditor, type PhraseFormValues } from "../primitives";

import { AxisValueManager } from "./AxisValueManager";
import styles from "./alignment.module.css";

/**
 * Sentinel option values. Neither can collide with a backend UUID, and both are
 * kept here as single literals so the option markup and the change handler can
 * never disagree about what the user picked.
 *
 * `不限` is NOT a row in `alignment_axis_values` — it is the column being NULL
 * (06-prd §6.6-bis). A real row named 不限 would give the same idea two
 * spellings with two different filter predicates.
 */
const UNCONSTRAINED_KEY = "__unconstrained__";
const MANAGE_KEY = "__manage__";

/** The three coordinate columns, as the editor drafts them. */
type CoordinateDraft = Pick<AlignmentPhrase, "layerId" | "domainId" | "modeId">;

const FIELD_OF: Record<AxisKind, keyof CoordinateDraft> = {
  layer: "layerId",
  domain: "domainId",
  mode: "modeId",
};

const EMPTY_DRAFT: CoordinateDraft = {
  layerId: null,
  domainId: null,
  modeId: null,
};

// An id the axis list no longer contains is treated as NULL. Deleting an axis
// value blanks the column server-side (`ON DELETE SET NULL`), so an open editor
// holding that id would otherwise offer to write a dead foreign key straight
// back.
function normalize(
  draft: CoordinateDraft,
  byId: Record<string, unknown>,
): CoordinateDraft {
  return {
    layerId:
      draft.layerId != null && byId[draft.layerId] ? draft.layerId : null,
    domainId:
      draft.domainId != null && byId[draft.domainId] ? draft.domainId : null,
    modeId: draft.modeId != null && byId[draft.modeId] ? draft.modeId : null,
  };
}

function sameDraft(a: CoordinateDraft, b: CoordinateDraft): boolean {
  return (
    a.layerId === b.layerId &&
    a.domainId === b.domainId &&
    a.modeId === b.modeId
  );
}

export interface AlignmentPhraseSubmit extends PhraseFormValues {
  coordinates: AlignmentPhraseCoordinates;
}

interface AlignmentPhraseEditorProps {
  /** The row being edited; `null` opens a create form. */
  phrase: AlignmentPhrase | null;
  /** Trigger element the panel pins to (the chip, or the ghost add button). */
  anchor: HTMLElement | null;
  /** Name/content of a discarded create draft the undo toast put back. */
  initialDraft?: PhraseFormValues | null;
  onSubmit: (values: AlignmentPhraseSubmit) => Promise<void>;
  onClose: () => void;
  onDiscard?: (draft: PhraseFormValues) => void;
}

/**
 * The alignment-phrase editor: the shared name/content form plus the three
 * coordinate selectors ADR-029 adds (03-product-spec 区域 2-bis).
 *
 * The coordinates ride the shared form's `extraFields` slot rather than forking
 * it, exactly as ScenePanel's sub-stage picker does — the container, the save
 * semantics and the Escape ladder all stay the editing-container contract's.
 *
 * Coordinates are sent as one payload alongside name and content, and `kind` /
 * `cueAxis` are carried through UNCHANGED: P1 does not let the user retype a
 * cue as an opening phrase, and the backend writes all five classification
 * fields whenever `coordinates` is present, so omitting them here would silently
 * demote every cue it touched to an opening phrase.
 */
export function AlignmentPhraseEditor({
  phrase,
  anchor,
  initialDraft,
  onSubmit,
  onClose,
  onDiscard,
}: AlignmentPhraseEditorProps) {
  const axisValues = usePromptStore((s) => s.alignmentAxisValues);
  const byId = usePromptStore((s) => s.alignmentAxisValuesById);

  const [draft, setDraft] = useState<CoordinateDraft>(() =>
    phrase
      ? {
          layerId: phrase.layerId,
          domainId: phrase.domainId,
          modeId: phrase.modeId,
        }
      : EMPTY_DRAFT,
  );
  // Which axis's value list is expanded inside this same panel; only ever one.
  const [managingAxis, setManagingAxis] = useState<AxisKind | null>(null);

  // Render guard rather than an effect (same shape as AlignmentPhrases' stale
  // editingId reset): if the axis list changed under the open panel, the draft
  // follows it in the very render that noticed.
  const normalized = normalize(draft, byId);
  if (!sameDraft(normalized, draft)) setDraft(normalized);

  const persisted: CoordinateDraft = phrase
    ? normalize(
        {
          layerId: phrase.layerId,
          domainId: phrase.domainId,
          modeId: phrase.modeId,
        },
        byId,
      )
    : EMPTY_DRAFT;

  // Only edit mode needs this. A create form with both text fields filled is
  // already dirty against its empty baseline, and one that is not cannot be
  // saved at all — so coordinates can never be the sole reason a creation is
  // savable, and counting them would only mislabel an empty draft as worth an
  // undo toast (see PhraseFormEditor's `extraDirty`).
  const coordinatesDirty = phrase != null && !sameDraft(normalized, persisted);

  const handleSubmit = async ({ name, content }: PhraseFormValues) => {
    await onSubmit({
      name,
      content,
      coordinates: {
        kind: phrase?.kind ?? "opening",
        cueAxis: phrase?.cueAxis ?? null,
        ...normalized,
      },
    });
  };

  const selectFor = (axis: AxisKind) => {
    const field = FIELD_OF[axis];
    const value = normalized[field];
    const label = AXIS_LABELS[axis];
    const options = axisValues
      .filter((v) => v.axis === axis)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    return (
      <div className={styles.field} key={axis}>
        <span className={styles.fieldLabel}>{label}</span>
        <select
          className={styles.select}
          aria-label={`${label}坐标`}
          value={value ?? UNCONSTRAINED_KEY}
          onChange={(e) => {
            const next = e.target.value;
            // 「管理…」 is an ACTION parked at the bottom of the option list, not
            // a value: picking it opens the list editor and leaves the
            // coordinate exactly as it was (React re-renders the select back to
            // the current value on its own).
            if (next === MANAGE_KEY) {
              setManagingAxis(axis);
              return;
            }
            setDraft({
              ...normalized,
              [field]: next === UNCONSTRAINED_KEY ? null : next,
            });
          }}
        >
          <option value={UNCONSTRAINED_KEY}>不限</option>
          {options.map((v) => (
            <option key={v.id} value={v.id} title={v.hint ?? undefined}>
              {v.name}
            </option>
          ))}
          <option value={MANAGE_KEY}>管理…</option>
        </select>
      </div>
    );
  };

  return (
    <PhraseFormEditor
      layer="protocol"
      presentation="anchored"
      anchor={anchor}
      mode={phrase ? "edit" : "create"}
      ariaLabel={phrase ? "编辑对齐话术" : "新增对齐话术"}
      initialName={phrase?.name ?? initialDraft?.name}
      initialContent={phrase?.content ?? initialDraft?.content}
      submitLabel={phrase ? "保存" : "新增"}
      extraDirty={coordinatesDirty}
      onSubmit={handleSubmit}
      onClose={onClose}
      // Only a creation has nothing to fall back on; an edit's original row is
      // still in the DB (ADR-025 子决策 2 的规则表 last row).
      onDiscard={phrase ? undefined : onDiscard}
      extraFields={
        <div className={styles.coordinates}>
          {AXIS_ORDER.map((axis) => selectFor(axis))}
          {managingAxis != null && (
            <AxisValueManager
              axis={managingAxis}
              onClose={() => setManagingAxis(null)}
            />
          )}
        </div>
      }
    />
  );
}
