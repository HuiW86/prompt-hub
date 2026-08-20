import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "./Button";
import { cx, type Layer } from "./cx";
import {
  AnchoredEditor,
  type DismissReason,
  EditorActions,
  EditorInput,
  EditorPanel,
  Input,
} from "./Editor";
import styles from "./primitives.module.css";

export interface PhraseFormValues {
  name: string;
  content: string;
}

interface PhraseFormEditorBaseProps {
  layer: Layer;
  /**
   * Which write this form performs. It also fixes the DIRTY BASELINE, which is
   * why it cannot be inferred from `initialName` being present: a create form's
   * baseline is empty no matter what seeds the fields, because nothing is in
   * the DB yet. An undo-restored draft (ADR-025 子决策 2) arrives prefilled,
   * and measuring it against its own seed reported "unchanged".
   */
  mode: "create" | "edit";
  /** Seed values for the fields — an existing row, or a restored draft. */
  initialName?: string;
  initialContent?: string;
  /**
   * Body-field placeholder. Defaults to the phrase wording; Macro and draft
   * bodies are not 话术, and inheriting that label was a copy regression the
   * shared form introduced when those two surfaces folded into it (P1-b).
   */
  contentPlaceholder?: string;
  /** Localised aria-label for the panel (e.g. "编辑话术"). */
  ariaLabel: string;
  /** Extra fields rendered between the content textarea and the footer
   *  (e.g. ScenePanel's sub-stage select). */
  extraFields?: ReactNode;
  /** Save button copy — create forms read "新增", edit forms read "保存". */
  submitLabel: string;
  className?: string;
  /**
   * Persists the draft. A REJECTION MUST BE SURFACED BY THE CALLER (an error
   * toast) and then re-thrown: this form only re-enables its save button and
   * stays open, and an outside-click save happens after the user has already
   * looked away, so a swallowed rejection is indistinguishable from success.
   */
  onSubmit: (values: PhraseFormValues) => Promise<void> | void;
  onClose: () => void;
  /**
   * The draft was abandoned with unsaved changes — `Esc` or 取消 (ADR-025
   * 子决策 2). The caller owns the undo affordance because only it knows
   * whether the draft was a creation (nothing in the DB to fall back on) or an
   * edit (original row still intact).
   */
  onDiscard?: (draft: PhraseFormValues) => void;
}

/**
 * `presentation` picks the container, and it is REQUIRED on purpose. It used to
 * be inferred from whether `anchor` appeared in the props object at all, which
 * made a single `{...props}` spread enough to conjure an invisible anchored
 * editor with a null anchor — a mode switch you could not see at the call site.
 *
 * - `anchored` — the top-layer floating panel (子决策 1); `anchor` is the
 *   trigger to pin against, `null` while its ref is still settling.
 * - `inline` — the legacy in-flow `EditorPanel`, still used by the five
 *   surfaces awaiting P1-b migration.
 */
export type PhraseFormEditorProps = PhraseFormEditorBaseProps &
  (
    | { presentation: "anchored"; anchor: HTMLElement | null }
    | { presentation: "inline"; anchor?: never }
  );

// Shared name + content editor for the four-grid phrase editors (AlignmentPhrases
// protocol phrases + ScenePanel task phrases). Owns the draft state, autofocus,
// IME-guarded Enter-to-save, and the trim/validation gate so callers only wire
// persistence. Enter in the name field commits; Cmd/Ctrl+Enter in the content
// textarea commits; Escape closes. The optional extraFields slot lets a caller
// inject additional controls (e.g. a sub-stage picker) without forking the form.
export function PhraseFormEditor(props: PhraseFormEditorProps) {
  const {
    layer,
    mode,
    initialName,
    initialContent,
    contentPlaceholder = "话术内容",
    ariaLabel,
    extraFields,
    submitLabel,
    className,
    onSubmit,
    onClose,
    onDiscard,
  } = props;
  const [name, setName] = useState(initialName ?? "");
  const [content, setContent] = useState(initialContent ?? "");
  const [saving, setSaving] = useState(false);
  // Set when a dismissal was refused for failing validation, so the offending
  // field can say why instead of the panel just stubbornly staying open.
  const [showInvalid, setShowInvalid] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSave = name.trim().length > 0 && content.trim().length > 0;
  // Dirty is measured against WHAT IS PERSISTED, never against "was this field
  // focused" (ADR-025 子决策 2) — tabbing through a form must not make it dirty.
  // Compared trimmed so a stray space is not mistaken for an edit.
  //
  // A create form's persisted baseline is empty even when the fields are
  // seeded: see `mode`. Comparing against the seed instead made an
  // undo-restored draft read as not-dirty, so the outside-click rule table took
  // its "nothing changed, close without an IPC round trip" branch and threw the
  // restored text away — no save, no toast, right after the undo affordance had
  // promised the user it was back.
  const baseName = mode === "edit" ? (initialName ?? "") : "";
  const baseContent = mode === "edit" ? (initialContent ?? "") : "";
  const dirty =
    name.trim() !== baseName.trim() || content.trim() !== baseContent.trim();

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), content: content.trim() });
      // The caller closes on success; on failure it stays open, so re-enable.
      // Nothing is reported here on purpose — the message belongs to whoever
      // knows what the write was. See `onSubmit`: the caller must toast before
      // re-throwing, or a failed save looks exactly like a successful one.
    } catch {
      setSaving(false);
    }
  };

  // Giving up on the draft. Escape and the 取消 button are the same decision,
  // so they run the same rule (ADR-025 子决策 2 的规则表 last row): 取消 used to
  // be wired straight to `onClose`, which meant one dirty draft got an undo
  // toast when abandoned by keyboard and nothing whatsoever by mouse.
  const handleAbandon = () => {
    if (saving) return;
    if (dirty) onDiscard?.({ name, content });
    onClose();
  };

  // ADR-025 子决策 2 rules table. Only reachable in anchored mode: an in-flow
  // editor has no "outside", and its Escape is handled by the field handlers.
  // Returns false when the dismissal is REFUSED, which is how the container
  // knows to swallow the rest of that press.
  const handleDismiss = (reason: DismissReason): boolean => {
    if (saving) return true;
    if (reason === "escape") {
      handleAbandon();
      return true;
    }
    // Clicking away is not a decision to throw work out — an empty name or
    // body means we cannot save it either, so hold the panel open and point at
    // the gap rather than silently dropping half a phrase.
    if (!canSave) {
      setShowInvalid(true);
      (name.trim().length === 0 ? nameRef : contentRef).current?.focus();
      return false;
    }
    // Nothing changed — close without spending an IPC round trip.
    if (!dirty) {
      onClose();
      return true;
    }
    void handleSave();
    return true;
  };

  // Both fields commit on Cmd/Ctrl+Enter for one consistent submit key (A1-08).
  // The name field's bare Enter advances focus to the content textarea instead
  // of submitting — a single-line name almost always has a body still to fill,
  // so a lone Enter that saved half a phrase was a foot-gun. IME guard shared by
  // both: committing a pinyin/kana candidate fires an Enter whose isComposing is
  // still true, and swallowing it would eat the composition instead.
  const onNameKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") handleAbandon();
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) void handleSave();
      else contentRef.current?.focus();
    }
  };

  const onContentKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") handleAbandon();
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      void handleSave();
    }
  };

  const nameMissing = showInvalid && name.trim().length === 0;
  const contentMissing = showInvalid && content.trim().length === 0;

  const fields = (
    <>
      <Input
        ref={nameRef}
        placeholder="名称"
        value={name}
        aria-invalid={nameMissing || undefined}
        className={cx(nameMissing && styles.fieldInvalid)}
        onChange={(e) => {
          setName(e.target.value);
          setShowInvalid(false);
        }}
        onKeyDown={onNameKeyDown}
      />
      <EditorInput
        ref={contentRef}
        placeholder={contentPlaceholder}
        value={content}
        rows={3}
        aria-invalid={contentMissing || undefined}
        className={cx(contentMissing && styles.fieldInvalid)}
        onChange={(e) => {
          setContent(e.target.value);
          setShowInvalid(false);
        }}
        onKeyDown={onContentKeyDown}
      />
      {extraFields}
      {showInvalid && (
        <p role="status" className={styles.fieldHint}>
          名称与内容都不能为空，补齐后才能保存
        </p>
      )}
      <EditorActions>
        <Button intent="subtle" onClick={handleAbandon}>
          取消
        </Button>
        <Button
          layer={layer}
          intent="primary"
          onClick={() => void handleSave()}
          disabled={!canSave || saving}
        >
          {submitLabel}
        </Button>
      </EditorActions>
    </>
  );

  if (props.presentation === "anchored") {
    return (
      <AnchoredEditor
        anchor={props.anchor}
        layer={layer}
        ariaLabel={ariaLabel}
        className={className}
        onDismiss={handleDismiss}
      >
        {fields}
      </AnchoredEditor>
    );
  }

  return (
    <EditorPanel
      layer={layer}
      role="group"
      aria-label={ariaLabel}
      className={className}
    >
      {fields}
    </EditorPanel>
  );
}
