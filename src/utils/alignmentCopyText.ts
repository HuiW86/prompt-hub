import type {
  AlignmentAxisValue,
  AlignmentPhrase,
  AxisKind,
  CueAxis,
} from "../ipc/types";

/**
 * Axis display names, in the fixed order the chip and the copy prefix both use.
 * Also the word the axis-value delete confirmation names (「『层』坐标将被清空」),
 * so the three surfaces can never drift apart on what an axis is called.
 */
export const AXIS_LABELS: Record<AxisKind, string> = {
  layer: "层",
  domain: "域",
  mode: "模式",
};

/** The axes in their canonical order — 层 · 域 · 模式 (03-product-spec 区域 2-bis). */
export const AXIS_ORDER: readonly AxisKind[] = ["layer", "domain", "mode"];

/**
 * The four columns the cue tally is filed under (03-product-spec 区域 7
 * 「按形态 / 层 / 域 / 模式四栏分列」). Built ON TOP of AXIS_LABELS rather than
 * beside it, so the three coordinate axes can only ever be called one thing.
 *
 * 形态 has no coordinate column of its own — a phrase's form is carried by its
 * phase — but a cue can still correct it, which is why the cue vocabulary is
 * one word wider than the coordinate vocabulary.
 */
export const CUE_AXIS_LABELS: Record<CueAxis, string> = {
  form: "形态",
  ...AXIS_LABELS,
};

/** 形态 · 层 · 域 · 模式, fixed. Column order is not a finding. */
export const CUE_AXIS_ORDER: readonly CueAxis[] = ["form", ...AXIS_ORDER];

/** Only the three coordinate columns are needed, so recents/search rows and
 *  half-built editor drafts can be passed without faking a whole phrase. */
export type AlignmentCoordinates = Pick<
  AlignmentPhrase,
  "layerId" | "domainId" | "modeId"
>;

/** Anything keyed by axis-value id that can answer "what is this called". */
export type AxisValueLookup = Readonly<
  Record<string, Pick<AlignmentAxisValue, "name">>
>;

// An id the lookup cannot resolve is treated exactly like NULL. That case is
// real, not defensive: `ON DELETE SET NULL` blanks the column server-side the
// moment an axis value is deleted, so a render that happens before the re-pull
// lands holds an id nobody can name. Dropping the segment matches what the row
// in the database already says.
function resolveName(id: string | null, byId: AxisValueLookup): string | null {
  if (id == null) return null;
  const name = byId[id]?.name;
  return name == null || name.length === 0 ? null : name;
}

/**
 * What actually goes on the clipboard when an alignment phrase is copied
 * (06-prd §6.6 「复制文本的拼装」, 03-product-spec 「对齐坐标与漂移账契约」a/b).
 *
 * The database only ever stores the clean `content`; the coordinate prefix is
 * assembled HERE, at copy time. That is why changing a coordinate is not
 * changing content (`contentRevisedAt` stays put), and why the prefix wording
 * can be rewritten later without migrating a single row.
 *
 * EVERY copy path must go through this function — chip click, ⌘1-9, the search
 * overlay and the recents strip — or the same phrase would reach the clipboard
 * differently depending on where the user clicked, which contract b forbids.
 *
 * With all three coordinates NULL the return value is `content` byte for byte:
 * the eight pre-ADR-029 seed phrases and every phrase the user already wrote
 * behave exactly as before.
 */
export function buildAlignmentCopyText(
  phrase: AlignmentCoordinates & Pick<AlignmentPhrase, "content">,
  byId: AxisValueLookup,
): string {
  const layer = resolveName(phrase.layerId, byId);
  const domain = resolveName(phrase.domainId, byId);
  const mode = resolveName(phrase.modeId, byId);

  // Fixed order, and an empty segment is dropped whole — no placeholder word
  // stands in for 「不限」, because the sentence reads fine without it.
  const segments: string[] = [];
  if (layer != null) segments.push(`本轮在${layer}层`);
  if (domain != null) segments.push(`只谈${domain}闭环`);
  if (mode != null) segments.push(`${mode}模式`);

  if (segments.length === 0) return phrase.content;
  return `${segments.join("，")}。\n${phrase.content}`;
}

/**
 * The coordinate short-label shown inside the chip, after the name and before
 * the action cluster (03-product-spec 区域 2-bis 「坐标可见」).
 *
 * Returns `null` when nothing resolves, and the caller must then render NOTHING
 * — not an empty span, not a separator. A zero-coordinate chip has to stay
 * pixel-identical to what it was before ADR-029.
 */
export function formatAlignmentCoordinates(
  coordinates: AlignmentCoordinates,
  byId: AxisValueLookup,
): string | null {
  const names = [
    resolveName(coordinates.layerId, byId),
    resolveName(coordinates.domainId, byId),
    resolveName(coordinates.modeId, byId),
  ].filter((n): n is string => n != null);
  return names.length === 0 ? null : names.join(" · ");
}
