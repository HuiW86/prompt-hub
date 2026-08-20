import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Scene } from "../../ipc/types";
import {
  ScenePropertiesEditor,
  type ScenePropertiesEditorProps,
} from "../ScenePropertiesEditor";

const baseScene: Scene = {
  id: "scene-plan",
  name: "方案设计",
  icon: "drafting-compass",
  orderIndex: 0,
  visible: true,
  rolePresets: ["架构师"],
  color: null,
};

function setup(overrides: Partial<ScenePropertiesEditorProps> = {}) {
  // A real trigger to pin to: since ADR-025 P1-b the panel is anchored, and an
  // anchorless panel has no honest place to be, so it renders
  // `visibility: hidden` until the first measurement lands — which would make
  // every query below fail on accessibility grounds rather than on behaviour.
  const anchor = document.createElement("button");
  document.body.appendChild(anchor);
  const props: ScenePropertiesEditorProps = {
    scene: baseScene,
    anchor,
    canMoveLeft: true,
    canMoveRight: true,
    onSave: vi.fn(),
    onMoveScene: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<ScenePropertiesEditor {...props} />);
  return props;
}

describe("ScenePropertiesEditor — validation & save", () => {
  it("disables save when the name is blank", () => {
    setup({ scene: { ...baseScene, name: "" } });
    expect(screen.getByRole("button", { name: "保存" })).toBeDisabled();
  });

  it("re-enables save once a non-empty name is typed", () => {
    setup({ scene: { ...baseScene, name: "" } });
    fireEvent.change(screen.getByLabelText("场景名称"), {
      target: { value: "新场景" },
    });
    expect(screen.getByRole("button", { name: "保存" })).toBeEnabled();
  });

  it("save payload carries all fields (icon / color / rolePresets)", () => {
    const onSave = vi.fn();
    setup({ scene: { ...baseScene, color: "#4c8dff" }, onSave });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith({
      name: "方案设计",
      icon: "drafting-compass",
      color: "#4c8dff",
      rolePresets: ["架构师"],
    });
  });

  it("trims the name and omits a blank icon on save", () => {
    const onSave = vi.fn();
    setup({ scene: { ...baseScene, name: "  留白  ", icon: null }, onSave });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "留白", icon: undefined }),
    );
  });
});

describe("ScenePropertiesEditor — icon sources", () => {
  it("selecting a lucide preset sends its name", () => {
    const onSave = vi.fn();
    setup({ scene: { ...baseScene, icon: null }, onSave });
    fireEvent.click(screen.getByLabelText("图标 wrench"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ icon: "wrench" }),
    );
  });

  it("typing an emoji in the free-text field sets the icon", () => {
    const onSave = vi.fn();
    setup({ scene: { ...baseScene, icon: null }, onSave });
    fireEvent.change(screen.getByLabelText("自定义图标"), {
      target: { value: "🚀" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ icon: "🚀" }),
    );
  });

  it("echoes a free-text value that collides with a lucide preset name", () => {
    // Fix 5b: typing "wrench" (a preset name) into the free-text field must not
    // be blanked mid-keystroke by an `icon in SCENE_LUCIDE` value filter.
    const onSave = vi.fn();
    setup({ scene: { ...baseScene, icon: null }, onSave });
    const field = screen.getByLabelText("自定义图标");
    fireEvent.change(field, { target: { value: "wrench" } });
    expect(field).toHaveValue("wrench");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ icon: "wrench" }),
    );
  });

  it("seeds the free-text field from a non-preset scene icon", () => {
    // A stored emoji icon must round-trip into the editable free-text field.
    setup({ scene: { ...baseScene, icon: "🚀" } });
    expect(screen.getByLabelText("自定义图标")).toHaveValue("🚀");
  });

  it("choosing 无 clears the icon", () => {
    const onSave = vi.fn();
    setup({ onSave });
    fireEvent.click(screen.getByLabelText("无图标"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ icon: undefined }),
    );
  });
});

describe("ScenePropertiesEditor — color swatches", () => {
  it("selecting a swatch sends its hex on save", () => {
    const onSave = vi.fn();
    setup({ onSave });
    fireEvent.click(screen.getByLabelText("颜色 #2f9e6e"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ color: "#2f9e6e" }),
    );
  });

  it("clearing the color omits it from the payload", () => {
    const onSave = vi.fn();
    setup({ scene: { ...baseScene, color: "#4c8dff" }, onSave });
    fireEvent.click(screen.getByLabelText("清除颜色"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ color: undefined }),
    );
  });
});

describe("ScenePropertiesEditor — rolePresets", () => {
  it("Enter adds a role chip and includes it on save", () => {
    const onSave = vi.fn();
    setup({ scene: { ...baseScene, rolePresets: [] }, onSave });
    const input = screen.getByLabelText("添加角色预设");
    fireEvent.change(input, { target: { value: "评审员" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByText("评审员")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ rolePresets: ["评审员"] }),
    );
  });

  it("removing a chip drops it from the payload", () => {
    const onSave = vi.fn();
    setup({ onSave });
    fireEvent.click(screen.getByLabelText("删除角色 架构师"));
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ rolePresets: [] }),
    );
  });

  it("Enter mid-IME-composition does not add a role", () => {
    setup({ scene: { ...baseScene, rolePresets: [] } });
    const input = screen.getByLabelText("添加角色预设");
    fireEvent.change(input, { target: { value: "架构" } });
    // Committing an IME candidate fires Enter with isComposing still true.
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(screen.queryByText("架构")).not.toBeInTheDocument();
  });

  it("does not add a duplicate role", () => {
    const onSave = vi.fn();
    setup({ onSave });
    const input = screen.getByLabelText("添加角色预设");
    fireEvent.change(input, { target: { value: "架构师" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ rolePresets: ["架构师"] }),
    );
  });
});

describe("ScenePropertiesEditor — container actions", () => {
  it("move buttons are disabled at the order boundaries", () => {
    setup({ canMoveLeft: false, canMoveRight: true });
    expect(screen.getByLabelText("场景前移")).toBeDisabled();
    expect(screen.getByLabelText("场景后移")).toBeEnabled();
  });

  it("move buttons invoke onMoveScene with the direction", () => {
    const onMoveScene = vi.fn();
    setup({ onMoveScene });
    fireEvent.click(screen.getByLabelText("场景后移"));
    expect(onMoveScene).toHaveBeenCalledWith(1);
  });

  it("delete requires a second confirmation before firing onDelete", () => {
    const onDelete = vi.fn();
    setup({ onDelete });
    fireEvent.click(screen.getByLabelText("删除场景"));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText("确认删除场景"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("cancel invokes onClose", () => {
    const onClose = vi.fn();
    setup({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// omar, 2026-08-20: this panel is anchored like the other four editors but
// deliberately does NOT adopt "点外 = 保存并关闭". Editing a scene's name, colour
// and role presets is a bounded task that wants an explicit commit, and an
// outside click while the delete confirmation is expanded would swallow the
// confirmation along with the panel.
describe("ScenePropertiesEditor — dismissal (ADR-025 P1-b)", () => {
  const pressEscape = () =>
    fireEvent.keyDown(document, { key: "Escape", bubbles: true });

  it("clicking outside neither saves nor closes", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    setup({ onSave, onClose });
    fireEvent.change(screen.getByLabelText("场景名称"), {
      target: { value: "改了名字" },
    });

    fireEvent.pointerDown(document.body);

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Escape clears a half-typed role preset before it closes anything", () => {
    const onClose = vi.fn();
    setup({ onClose });
    const roleField = screen.getByLabelText("添加角色预设");
    roleField.focus();
    fireEvent.change(roleField, { target: { value: "评审员" } });

    pressEscape();

    // The field's own Escape cannot do this: AnchoredEditor listens on document
    // in the capture phase, so the panel would have torn down first.
    expect(roleField).toHaveValue("");
    expect(onClose).not.toHaveBeenCalled();

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape backs out of the delete confirmation before it closes the panel", () => {
    const onClose = vi.fn();
    const onDelete = vi.fn();
    setup({ onClose, onDelete });
    fireEvent.click(screen.getByLabelText("删除场景"));
    screen.getByLabelText("确认删除场景").focus();

    pressEscape();

    expect(screen.queryByLabelText("确认删除场景")).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    pressEscape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
