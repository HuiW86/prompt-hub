import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Skill } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));
const openMock = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: (...args: unknown[]) => openMock(...args) as unknown,
}));

import { useSettingsStore } from "../../stores/settingsStore";
import { useSkillStore } from "../../stores/skillStore";
import { useToastStore } from "../../stores/toastStore";
import { SkillPanel } from "../skills/SkillPanel";

const skillInitial = useSkillStore.getState();
const RECENT = new Date().toISOString();
const OLD = "2025-01-01T00:00:00Z";

function skill(over: Partial<Skill> & Pick<Skill, "id">): Skill {
  return {
    name: over.id,
    purpose: "",
    whenToUse: "",
    notFor: "",
    invocation: "",
    stage: "diverge",
    trigger: "manual",
    source: "own",
    sourceUrl: "",
    status: "installed",
    pinSlot: null,
    orderIndex: 0,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: OLD,
    ...over,
  };
}

let library: Skill[];
const writeText = () =>
  navigator.clipboard.writeText as ReturnType<typeof vi.fn>;

function fixture(): Skill[] {
  return [
    skill({
      id: "edl",
      name: "EDL",
      stage: "plan",
      invocation: "用 EDL",
      purpose: "借还是造",
      sourceUrl: "ai-colab 仓库 skills/",
      pinSlot: 1,
      usageCount: 5,
      lastUsedAt: RECENT,
      orderIndex: 0,
    }),
    skill({
      id: "deep",
      name: "deep-research",
      stage: "diverge",
      invocation: "用 deep-research 调研 ___",
      purpose: "多来源调研写成报告",
      orderIndex: 1,
    }),
    skill({
      id: "verify",
      name: "verify_deliverable_report",
      trigger: "auto",
      stage: null,
      orderIndex: 2,
    }),
    skill({
      id: "ticket",
      name: "订票",
      source: "muse",
      stage: null,
      orderIndex: 3,
    }),
    skill({ id: "old", name: "旧技能", status: "retired", orderIndex: 4 }),
  ];
}

describe("SkillPanel", () => {
  beforeEach(() => {
    library = fixture();
    useSkillStore.setState(skillInitial, true);
    useSettingsStore.setState({
      interactionMode: "invoke",
      settingsOpen: false,
    });
    useToastStore.getState().clear();
    writeText().mockClear();
    openMock.mockReset();
    invokeMock.mockReset();
    invokeMock.mockImplementation(
      async (cmd: string, args?: Record<string, unknown>) => {
        switch (cmd) {
          case "list_skills":
            return structuredClone(library);
          case "record_skill_use":
            return undefined;
          case "set_skill_pin": {
            const { id, pinSlot } = args as {
              id: string;
              pinSlot: number | null;
            };
            for (const s of library) {
              if (pinSlot != null && s.pinSlot === pinSlot) s.pinSlot = null;
              if (s.id === id) s.pinSlot = pinSlot;
            }
            return structuredClone(library);
          }
          case "import_skill_index":
            library = [
              skill({ id: "new", name: "skill-creator", stage: "distill" }),
            ];
            return { total: 1, added: 1, updated: 0, removed: 5 };
          default:
            return undefined;
        }
      },
    );
  });

  it("shows six stage columns, the two strips, and only installed skills", async () => {
    render(<SkillPanel />);
    await screen.findByText("EDL");
    const titles = Array.from(document.querySelectorAll("[data-column]")).map(
      (el) => el.getAttribute("data-column"),
    );
    expect(titles).toEqual([
      "understand",
      "diverge",
      "plan",
      "generate",
      "iterate",
      "distill",
      "auto",
      "muse",
    ]);
    expect(
      within(screen.getByLabelText("自动触发")).getByText(
        "verify_deliverable_report",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByLabelText("通用能力")).getByText("订票"),
    ).toBeTruthy();
    expect(screen.queryByText("旧技能")).toBeNull();
  });

  it("copies the invocation on click and logs one use", async () => {
    render(<SkillPanel />);
    fireEvent.click(await screen.findByText("deep-research"));
    await waitFor(() =>
      expect(writeText()).toHaveBeenCalledWith("用 deep-research 调研 ___"),
    );
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("record_skill_use", {
        id: "deep",
        suppressHide: false,
      }),
    );
    expect(
      useSkillStore.getState().skills.find((s) => s.id === "deep")!.usageCount,
    ).toBe(1);
  });

  it("a number key copies the pinned skill; organize mode keeps the window", async () => {
    useSettingsStore.setState({ interactionMode: "organize" });
    render(<SkillPanel />);
    await screen.findByText("EDL");
    fireEvent.keyDown(document.body, { key: "1" });
    await waitFor(() => expect(writeText()).toHaveBeenCalledWith("用 EDL"));
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("record_skill_use", {
        id: "edl",
        suppressHide: true,
      }),
    );
  });

  it("filters by purpose without moving anything, and ↵ copies the first match", async () => {
    render(<SkillPanel />);
    await screen.findByText("EDL");
    const input = screen.getByLabelText("筛选技能");
    fireEvent.change(input, { target: { value: "报告" } });
    const row = (id: string) =>
      document.querySelector(`[data-skill-id="${id}"] button`)!;
    // The footer previews the first match by name, so look rows up by id.
    const edl = row("edl");
    const deep = row("deep");
    expect(edl.getAttribute("data-dimmed")).toBe("true");
    expect(deep.getAttribute("data-dimmed")).toBeNull();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(writeText()).toHaveBeenCalledWith("用 deep-research 调研 ___"),
    );
  });

  it("⇧↵ copies the source address and records nothing", async () => {
    render(<SkillPanel />);
    await screen.findByText("EDL");
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    // First column with items is 发散 (deep); move right to 规划 (EDL).
    fireEvent.keyDown(document.body, { key: "ArrowRight" });
    expect(useSkillStore.getState().selectedId).toBe("edl");
    fireEvent.keyDown(document.body, { key: "Enter", shiftKey: true });
    await waitFor(() =>
      expect(writeText()).toHaveBeenCalledWith("ai-colab 仓库 skills/"),
    );
    expect(invokeMock).not.toHaveBeenCalledWith(
      "record_skill_use",
      expect.anything(),
    );
    expect(screen.getByRole("button", { name: /复制源地址/ })).toBeTruthy();
  });

  it("⌥digit pins the selection in organize mode, handing the slot over with undo", async () => {
    useSettingsStore.setState({ interactionMode: "organize" });
    render(<SkillPanel />);
    await screen.findByText("EDL");
    act(() => useSkillStore.getState().select("deep"));
    fireEvent.keyDown(document.body, {
      key: "¡",
      code: "Digit1",
      altKey: true,
    });
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("set_skill_pin", {
        id: "deep",
        pinSlot: 1,
      }),
    );
    await waitFor(() =>
      expect(useToastStore.getState().message).toContain(
        "让给「deep-research」",
      ),
    );
    expect(
      useSkillStore.getState().skills.find((s) => s.id === "edl")!.pinSlot,
    ).toBeNull();
  });

  it("⌥digit does nothing in invoke mode", async () => {
    render(<SkillPanel />);
    await screen.findByText("EDL");
    act(() => useSkillStore.getState().select("deep"));
    fireEvent.keyDown(document.body, {
      key: "¡",
      code: "Digit1",
      altKey: true,
    });
    expect(invokeMock).not.toHaveBeenCalledWith(
      "set_skill_pin",
      expect.anything(),
    );
  });

  it("with no skills, offers the import and reports what it changed", async () => {
    library = [];
    openMock.mockResolvedValue("/tmp/skill-index.json");
    render(<SkillPanel />);
    // Wait for the loaded empty state: the button rendered before the first
    // load resolves is replaced by the empty state's own.
    await screen.findByText(/还没有技能/);
    const button = screen.getByRole("button", { name: /导入技能索引/ });
    fireEvent.click(button);
    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith("import_skill_index", {
        path: "/tmp/skill-index.json",
      }),
    );
    await screen.findByText("skill-creator");
    expect(useToastStore.getState().message).toBe(
      "已导入 1 个技能：新增 1，更新 0，移除 5",
    );
  });

  it("a cancelled file dialog imports nothing", async () => {
    library = [];
    openMock.mockResolvedValue(null);
    render(<SkillPanel />);
    await screen.findByText(/还没有技能/);
    fireEvent.click(screen.getByRole("button", { name: /导入技能索引/ }));
    await waitFor(() => expect(openMock).toHaveBeenCalled());
    expect(invokeMock).not.toHaveBeenCalledWith(
      "import_skill_index",
      expect.anything(),
    );
  });
});
