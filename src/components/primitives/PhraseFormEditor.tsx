import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "./Button";
import { type Layer } from "./cx";
import { EditorActions, EditorInput, EditorPanel, Input } from "./Editor";

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
  onSubmit: (values: PhraseFormValues) => Promise<void> | void;
  onClose: () => void;
}

// Shared name + content editor for the four-grid phrase editors (AlignmentPhrases
// protocol phrases + ScenePanel task phrases). Owns the draft state, autofocus,
// IME-guarded Enter-to-save, and the trim/validation gate so callers only wire
// persistence. Enter in the name field commits; Cmd/Ctrl+Enter in the content
// textarea commits; Escape closes. The optional extraFields slot lets a caller
// inject additional controls (e.g. a sub-stage picker) without forking the form.
export function PhraseFormEditor({
  layer,
  initialName,
  initialContent,
  ariaLabel,
  extraFields,
  submitLabel,
  className,
  onSubmit,
  onClose,
}: PhraseFormEditorProps) {
  const [name, setName] = useState(initialName ?? "");
  const [content, setContent] = useState(initialContent ?? "");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const canSave = name.trim().length > 0 && content.trim().length > 0;

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

  // IME guard shared by both fields: committing a pinyin/kana candidate fires an
  // Enter whose isComposing is still true, and swallowing it would eat the
  // composition instead of saving.
  const onNameKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") onClose();
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      void handleSave();
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

  return (
    <EditorPanel
      layer={layer}
      role="group"
      aria-label={ariaLabel}
      className={className}
    >
      <Input
        ref={nameRef}
        placeholder="名称"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={onNameKeyDown}
      />
      <EditorInput
        placeholder="话术内容"
        value={content}
        rows={3}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={onContentKeyDown}
      />
      {extraFields}
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
    </EditorPanel>
  );
}
