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
  const props: ScenePropertiesEditorProps = {
    scene: baseScene,
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
