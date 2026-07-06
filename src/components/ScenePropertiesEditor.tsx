import {
  Check,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
  Trash2,
  X,
} from "lucide-react";
import { type KeyboardEvent, useState } from "react";

import type { Scene } from "../ipc/types";

import {
  ActionCluster,
  Button,
  Chip,
  ConfirmInline,
  EditorActions,
  EditorPanel,
  IconButton,
  Input,
} from "./primitives";
import { SCENE_LUCIDE } from "./sceneIcons";
import styles from "./ScenePropertiesEditor.module.css";

// Icon preset order mirrors SCENE_LUCIDE (design-spec §12.4: Scene icons are user
// content rendered from the lean lucide map, not the full registry).
const ICON_PRESETS: Array<{ name: string; Icon: LucideIcon }> = Object.entries(
  SCENE_LUCIDE,
).map(([name, Icon]) => ({ name, Icon }));

// Scene color presets — user-content color presets, not chrome tokens. These are
// the one place bare hex is allowed (plan 任务 1): they paint the scene's own icon
// (design-spec §12.4 precedent), never chrome, so they sidestep ADR-019's
// colour-ontology ban. CSS stays token-only; these ride inline styles.
const COLOR_PRESETS: string[] = [
  "#4c8dff", // blue
  "#2f9e6e", // green
  "#8b7bff", // violet
  "#e0962f", // amber
  "#e05a5a", // red
  "#4bb3c4", // teal
];

// Save payload mirrors the update_scene / create_scene wire shape (ipc.updateScene):
// icon / color are optional-string (absent = cleared), rolePresets always present.
export interface ScenePropertiesPayload {
  name: string;
  icon?: string;
  color?: string;
  rolePresets: string[];
}

export interface ScenePropertiesEditorProps {
  scene: Scene;
  canMoveLeft: boolean;
  canMoveRight: boolean;
  onSave: (payload: ScenePropertiesPayload) => void;
  onMoveScene: (dir: -1 | 1) => void;
  onDelete: () => void;
  onClose: () => void;
}

// Scene properties panel (plan scene-layered-editing 任务 1): fills PRD §6.4's
// icon / color / rolePresets fields that had no UI. Container-level actions
// (move / delete) live in the footer. Structure/content editing is out of scope
// (任务 5-6). Not yet wired into ScenePanel — 任务 2 does that.
export function ScenePropertiesEditor({
  scene,
  canMoveLeft,
  canMoveRight,
  onSave,
  onMoveScene,
  onDelete,
  onClose,
}: ScenePropertiesEditorProps) {
  const [name, setName] = useState(scene.name);
  const [icon, setIcon] = useState<string | null>(scene.icon);
  const [color, setColor] = useState<string | null>(scene.color);
  const [rolePresets, setRolePresets] = useState<string[]>(scene.rolePresets);
  const [roleDraft, setRoleDraft] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const trimmedIcon = icon?.trim();
    onSave({
      name: trimmedName,
      icon: trimmedIcon ? trimmedIcon : undefined,
      color: color ?? undefined,
      rolePresets,
    });
  };

  const addRole = () => {
    const value = roleDraft.trim();
    if (!value || rolePresets.includes(value)) {
      setRoleDraft("");
      return;
    }
    setRolePresets((prev) => [...prev, value]);
    setRoleDraft("");
  };

  const removeRole = (value: string) => {
    setRolePresets((prev) => prev.filter((r) => r !== value));
  };

  // Enter adds the pending role, but never mid-IME-composition: committing a
  // pinyin/kana candidate fires an Enter whose isComposing is still true, and
  // swallowing it would eat the composition instead of adding a role.
  const onRoleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setRoleDraft("");
      return;
    }
    if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      addRole();
    }
  };

  return (
    <EditorPanel
      layer="task"
      role="group"
      aria-label="场景属性"
      className={styles.panel}
    >
      {/* name — required */}
      <label className={styles.field}>
        <span className={styles.label}>名称</span>
        <Input
          autoFocus
          aria-label="场景名称"
          placeholder="场景名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
      </label>

      {/* icon — lucide presets + free-text (emoji / char) + 无 */}
      <div className={styles.field}>
        <span className={styles.label}>图标</span>
        <div className={styles.iconRow}>
          {ICON_PRESETS.map(({ name: presetName, Icon }) => {
            const active = icon === presetName;
            return (
              <IconButton
                key={presetName}
                aria-label={`图标 ${presetName}`}
                aria-pressed={active}
                className={active ? styles.iconChoiceActive : styles.iconChoice}
                onClick={() => setIcon(presetName)}
              >
                <Icon size={16} aria-hidden strokeWidth={2} />
              </IconButton>
            );
          })}
          <Button
            intent={icon === null ? "subtle" : "ghost"}
            aria-pressed={icon === null}
            aria-label="无图标"
            onClick={() => setIcon(null)}
          >
            无
          </Button>
        </div>
        <Input
          aria-label="自定义图标"
          placeholder="或输入 emoji / 单字"
          // A lucide preset name here would collide with the map; free text is
          // for emoji / single chars, so only surface a non-preset value.
          value={icon && !(icon in SCENE_LUCIDE) ? icon : ""}
          onChange={(e) => setIcon(e.target.value || null)}
        />
      </div>

      {/* color — user-content swatches + clear */}
      <div className={styles.field}>
        <span className={styles.label}>颜色</span>
        <div className={styles.swatchRow}>
          {COLOR_PRESETS.map((hex) => {
            const active = color === hex;
            return (
              <button
                key={hex}
                type="button"
                className={styles.swatch}
                aria-label={`颜色 ${hex}`}
                aria-pressed={active}
                // Inline style is the sanctioned bare-hex site (CSS gate stays
                // clean): the swatch fill is user-content color, not a token.
                style={{ background: hex }}
                onClick={() => setColor(hex)}
              >
                {active && <Check size={12} aria-hidden strokeWidth={3} />}
              </button>
            );
          })}
          <IconButton
            aria-label="清除颜色"
            aria-pressed={color === null}
            className={color === null ? styles.iconChoiceActive : undefined}
            onClick={() => setColor(null)}
          >
            <X size={14} aria-hidden strokeWidth={2} />
          </IconButton>
        </div>
      </div>

      {/* rolePresets — chips + inline add */}
      <div className={styles.field}>
        <span className={styles.label}>角色预设</span>
        {rolePresets.length > 0 && (
          <div className={styles.chips}>
            {rolePresets.map((role) => (
              <Chip key={role} layer="task">
                <span>{role}</span>
                <IconButton
                  plain
                  aria-label={`删除角色 ${role}`}
                  onClick={() => removeRole(role)}
                >
                  <X size={12} aria-hidden strokeWidth={2} />
                </IconButton>
              </Chip>
            ))}
          </div>
        )}
        <Input
          aria-label="添加角色预设"
          placeholder="输入角色后回车添加"
          value={roleDraft}
          onChange={(e) => setRoleDraft(e.target.value)}
          onKeyDown={onRoleKeyDown}
        />
      </div>

      {/* footer — container-level actions + save/cancel */}
      <div className={styles.footer}>
        {confirmingDelete ? (
          <ConfirmInline
            text="删除场景？"
            confirmLabel="确认删除场景"
            cancelLabel="取消删除"
            onConfirm={() => {
              setConfirmingDelete(false);
              onDelete();
            }}
            onCancel={() => setConfirmingDelete(false)}
          />
        ) : (
          <ActionCluster className={styles.footerActions}>
            <IconButton
              aria-label="场景前移"
              disabled={!canMoveLeft}
              onClick={() => onMoveScene(-1)}
            >
              <ChevronLeft size={13} aria-hidden strokeWidth={2} />
            </IconButton>
            <IconButton
              aria-label="场景后移"
              disabled={!canMoveRight}
              onClick={() => onMoveScene(1)}
            >
              <ChevronRight size={13} aria-hidden strokeWidth={2} />
            </IconButton>
            <IconButton
              aria-label="删除场景"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 size={13} aria-hidden strokeWidth={2} />
            </IconButton>
          </ActionCluster>
        )}
        <EditorActions className={styles.saveActions}>
          <Button intent="subtle" onClick={onClose}>
            取消
          </Button>
          <Button
            layer="task"
            intent="primary"
            onClick={handleSave}
            disabled={!canSave}
          >
            保存
          </Button>
        </EditorActions>
      </div>
    </EditorPanel>
  );
}
