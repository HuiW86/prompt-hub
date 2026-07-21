import { useState } from "react";

import { ActionCluster, Button, Input } from "../primitives";

import styles from "../ScenePanel.module.css";

export interface InlineNameEditorProps {
  initialValue: string;
  ariaLabel: string;
  placeholder?: string;
  onSave: (name: string) => void;
  onCancel: () => void;
}

// Self-contained inline name editor for the view-mode grid (sub-stage rename +
// create). It owns its draft state so the grid header stays presentational.
// Enter commits with an IME guard — committing a pinyin/kana candidate fires
// Enter while isComposing is still true, and swallowing it would eat the
// composition instead of saving.
export function InlineNameEditor({
  initialValue,
  ariaLabel,
  placeholder,
  onSave,
  onCancel,
}: InlineNameEditorProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className={styles.subStageInline}>
      <Input
        autoFocus
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter") {
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            if (value.trim().length > 0) onSave(value);
          }
        }}
      />
      <ActionCluster>
        <Button intent="subtle" onClick={onCancel}>
          取消
        </Button>
        <Button
          layer="task"
          intent="primary"
          onClick={() => onSave(value)}
          disabled={value.trim().length === 0}
        >
          保存
        </Button>
      </ActionCluster>
    </div>
  );
}
