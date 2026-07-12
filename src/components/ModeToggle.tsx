import { MousePointerClick, PencilRuler } from "lucide-react";

import {
  type InteractionMode,
  useSettingsStore,
} from "../stores/settingsStore";

import styles from "./ModeToggle.module.css";

// D-0 interaction-mode switch. An always-visible segmented control (never
// hover-only) so the user can answer "which mode am I in" at any moment: the
// active segment lifts to the primary surface and carries aria-pressed. Both
// segments are real buttons, so the control is keyboard-reachable via Tab.
const OPTIONS: Array<{
  value: InteractionMode;
  label: string;
  hint: string;
  icon: typeof MousePointerClick;
}> = [
  {
    value: "invoke",
    label: "调用",
    hint: "点卡即复制，复制后自动隐藏",
    icon: MousePointerClick,
  },
  {
    value: "organize",
    label: "整理",
    hint: "点卡展开预览，复制为显式动作，窗口驻留",
    icon: PencilRuler,
  },
];

export function ModeToggle() {
  const interactionMode = useSettingsStore((s) => s.interactionMode);
  const setInteractionMode = useSettingsStore((s) => s.setInteractionMode);

  return (
    <div className={styles.segment} role="group" aria-label="交互模式">
      {OPTIONS.map(({ value, label, hint, icon: Icon }) => {
        const active = interactionMode === value;
        return (
          <button
            key={value}
            type="button"
            className={active ? `${styles.item} ${styles.active}` : styles.item}
            aria-pressed={active}
            title={hint}
            onClick={() => setInteractionMode(value)}
          >
            <Icon size={13} strokeWidth={2} aria-hidden />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
