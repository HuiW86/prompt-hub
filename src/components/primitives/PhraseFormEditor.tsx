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

export interface PhraseFormEditorProps {
  layer: Layer;
  /** Existing values seed edit mode; absent means a create form. */
  initialName?: string;
  initialContent?: string;
  /** Localised aria-label for the panel (e.g. "编辑话术"). */
  ariaLabel: string;
  /** Extra fields rendered between the content textarea and the footer
   *  (e.g. ScenePanel's sub-stage select). */
  extraFields?: ReactNode;
  /** Save button copy — create forms read "新增", edit forms read "保存". */
  submitLabel: string;
  className?: string;
  /**
   * Opt into the anchored top-layer container (ADR-025 子决策 1): pass the
   * trigger element to pin against, or `null` while its ref is still settling.
   * OMITTING the prop keeps the legacy in-flow `EditorPanel` — that is what the
   * five not-yet-migrated editing surfaces still use, pending the P1-b
   * interface contract. Presence of the prop, not its value, selects the mode.
   */
  anchor?: HTMLElement | null;
  onSubmit: (values: PhraseFormValues) => Promise<void> | void;
  onClose: () => void;
  /**
   * Escape with unsaved changes (ADR-025 子决策 2). The caller owns the undo
   * affordance because only it knows whether the draft was a creation (nothing
   * in the DB to fall back on) or an edit (original row still intact).
   */
  onDiscard?: (draft: PhraseFormValues) => void;
}

// Shared name + content editor for the four-grid phrase editors (AlignmentPhrases
// protocol phrases + ScenePanel task phrases). Owns the draft state, autofocus,
// IME-guarded Enter-to-save, and the trim/validation gate so callers only wire
// persistence. Enter in the name field commits; Cmd/Ctrl+Enter in the content
// textarea commits; Escape closes. The optional extraFields slot lets a caller
// inject additional controls (e.g. a sub-stage picker) without forking the form.
export function PhraseFormEditor(props: PhraseFormEditorProps) {
  const {
    layer,
    initialName,
    initialContent,
    ariaLabel,
    extraFields,
    submitLabel,
    className,
    anchor,
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
  // Dirty is measured against the seed snapshot, never against "was this field
  // focused" (ADR-025 子决策 2) — tabbing through a form must not make it dirty.
  // Compared trimmed so a stray space is not mistaken for an edit.
  const dirty =
    name.trim() !== (initialName ?? "").trim() ||
    content.trim() !== (initialContent ?? "").trim();

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), content: content.trim() });
      // The caller closes on success; on failure it stays open, so re-enable.
    } catch {
      setSaving(false);
    }
  };

  // ADR-025 子决策 2 rules table. Only reachable in anchored mode: an in-flow
  // editor has no "outside", and its Escape is handled by the field handlers.
  const handleDismiss = (reason: DismissReason) => {
    if (saving) return;
    if (reason === "escape") {
      if (dirty) onDiscard?.({ name, content });
      onClose();
      return;
    }
    // Clicking away is not a decision to throw work out — an empty name or
    // body means we cannot save it either, so hold the panel open and point at
    // the gap rather than silently dropping half a phrase.
    if (!canSave) {
      setShowInvalid(true);
      (name.trim().length === 0 ? nameRef : contentRef).current?.focus();
      return;
    }
    // Nothing changed — close without spending an IPC round trip.
    if (!dirty) {
      onClose();
      return;
    }
    void handleSave();
  };

  // Both fields commit on Cmd/Ctrl+Enter for one consistent submit key (A1-08).
  // The name field's bare Enter advances focus to the content textarea instead
  // of submitting — a single-line name almost always has a body still to fill,
  // so a lone Enter that saved half a phrase was a foot-gun. IME guard shared by
  // both: committing a pinyin/kana candidate fires an Enter whose isComposing is
  // still true, and swallowing it would eat the composition instead.
  const onNameKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      if (e.metaKey || e.ctrlKey) void handleSave();
      else contentRef.current?.focus();
    }
  };

  const onContentKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") onClose();
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
        placeholder="话术内容"
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
        <Button intent="subtle" onClick={onClose}>
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

  // Presence of the prop selects the container — see the `anchor` doc comment.
  if ("anchor" in props) {
    return (
      <AnchoredEditor
        anchor={anchor ?? null}
        open
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
