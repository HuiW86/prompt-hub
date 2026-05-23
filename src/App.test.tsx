import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AlignmentPhrase,
  Macro,
  Phase,
  RecentUsageEntry,
  SceneWithChildren,
} from "./ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import App from "./App";
import { usePromptStore } from "./stores/promptStore";

const fakePhases: Phase[] = [
  "发散",
  "理解",
  "规划",
  "生成",
  "执行",
  "收敛",
  "沉淀",
  "迭代",
].map((name, idx) => ({
  id: `phase-${idx}`,
  name,
  orderIndex: idx,
  color: null,
  description: null,
  visible: true,
  defaultAlignmentPhraseId: `ap-${idx}`,
}));

const fakeAlignments: AlignmentPhrase[] = fakePhases.map((p, idx) => ({
  id: `ap-${idx}`,
  phaseId: p.id,
  name: `默认 · ${p.name}`,
  content: `我们进入 ${p.name}`,
  isDefault: true,
  usageCount: 0,
  lastUsedAt: null,
  createdAt: "2026-05-23T00:00:00Z",
  notes: null,
  deprecated: false,
}));

const fakeMacros: Macro[] = [
  {
    id: "macro-best-practice",
    name: "借力最优解",
    content: "调研外部成熟方案。",
    expandFrom: null,
    native: true,
    role: null,
    task: null,
    usageCount: 7,
    lastUsedAt: "2026-05-23T09:00:00Z",
    createdAt: "2026-05-23T00:00:00Z",
    notes: null,
    sceneId: null,
    deprecated: false,
  },
];

const fakeScenes: SceneWithChildren[] = [
  {
    scene: {
      id: "scene-plan",
      name: "方案设计",
      icon: "📐",
      orderIndex: 0,
      visible: true,
      rolePresets: [],
      color: null,
    },
    subStages: [],
    phrases: [
      {
        id: "phrase-plan-export",
        sceneId: "scene-plan",
        name: "设计导出模块",
        content: "为项目设计数据导出模块。",
        usageCount: 0,
        lastUsedAt: null,
        createdAt: "2026-05-23T00:00:00Z",
        notes: null,
        deprecated: false,
        subStageId: null,
      },
    ],
  },
];

const fakeRecent: RecentUsageEntry[] = [];

const initialStore = usePromptStore.getState();

describe("Dashboard end-to-end render", () => {
  beforeEach(() => {
    usePromptStore.setState(initialStore, true);
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_phases":
          return Promise.resolve(fakePhases);
        case "list_alignment_phrases":
          return Promise.resolve(fakeAlignments);
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_scenes_with_children":
          return Promise.resolve(fakeScenes);
        case "list_recent_usage":
          return Promise.resolve(fakeRecent);
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  function regions(container: HTMLElement) {
    return {
      search: container.querySelector("[role='search']"),
      phaseBar: container.querySelector("[data-region='phase-bar']"),
      macroGrid: container.querySelector("[data-region='macro-grid']"),
      scenePanel: container.querySelector("[data-region='scene-panel']"),
      recentList: container.querySelector("[data-region='recent-list']"),
      sopProgress: container.querySelector("[data-region='sop-progress']"),
      statusBar: container.querySelector("[data-region='status-bar']"),
    };
  }

  it("renders all seven regions after refreshAll resolves", async () => {
    const { container } = render(<App />);
    await waitFor(() =>
      expect(
        container.querySelector("[data-region='phase-bar']"),
      ).not.toBeNull(),
    );
    const r = regions(container);
    expect(r.search).not.toBeNull();
    expect(r.phaseBar).not.toBeNull();
    expect(r.macroGrid).not.toBeNull();
    expect(r.scenePanel).not.toBeNull();
    expect(r.recentList).not.toBeNull();
    expect(r.sopProgress).not.toBeNull();
    expect(r.statusBar).not.toBeNull();
  });

  it("renders all 8 phases inside the phase bar", async () => {
    const { container } = render(<App />);
    await waitFor(() =>
      expect(
        container.querySelector("[data-region='phase-bar']"),
      ).not.toBeNull(),
    );
    const phaseBar = container.querySelector("[data-region='phase-bar']");
    expect(phaseBar).not.toBeNull();
    for (const phase of fakePhases) {
      expect(phaseBar?.textContent).toContain(phase.name);
    }
  });

  it("renders seeded macros with hot indicator", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText("借力最优解")).toBeInTheDocument(),
    );
    expect(screen.getByText("调研外部成熟方案。")).toBeInTheDocument();
    expect(screen.getByText("7 次")).toBeInTheDocument();
  });

  it("renders the first scene's phrases", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText("设计导出模块")).toBeInTheDocument(),
    );
    expect(screen.getByText("为项目设计数据导出模块。")).toBeInTheDocument();
  });
});

describe("Dashboard click → IPC flow", () => {
  beforeEach(() => {
    usePromptStore.setState(initialStore, true);
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_phases":
          return Promise.resolve(fakePhases);
        case "list_alignment_phrases":
          return Promise.resolve(fakeAlignments);
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_scenes_with_children":
          return Promise.resolve(fakeScenes);
        case "list_recent_usage":
          return Promise.resolve(fakeRecent);
        case "record_usage":
          return Promise.resolve({
            id: "rec-x",
            timestamp: "2026-05-23T10:00:00Z",
            targetType: "macro",
            targetId: null,
            source: "macro_area",
            modifierIds: null,
            sopId: null,
            sopStepOrder: null,
            phaseId: null,
          });
        case "hide_window":
          return Promise.resolve();
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  function findRecordUsageInputs() {
    return invokeMock.mock.calls
      .filter((call) => call[0] === "record_usage")
      .map(
        (call) => call[1] as { input: { targetType: string; source: string } },
      );
  }

  it("clicking a Macro card triggers record_usage with macro_area source", async () => {
    render(<App />);
    const card = await screen.findByRole("button", { name: "借力最优解" });
    fireEvent.click(card);
    await waitFor(() =>
      expect(findRecordUsageInputs().length).toBeGreaterThan(0),
    );
    const inputs = findRecordUsageInputs();
    expect(inputs[0].input.targetType).toBe("macro");
    expect(inputs[0].input.source).toBe("macro_area");
  });

  it("clicking a Phrase card triggers record_usage with scene source", async () => {
    render(<App />);
    const phrase = await screen.findByRole("button", { name: "设计导出模块" });
    fireEvent.click(phrase);
    await waitFor(() =>
      expect(findRecordUsageInputs().length).toBeGreaterThan(0),
    );
    const last = findRecordUsageInputs().pop();
    expect(last?.input.targetType).toBe("phrase");
    expect(last?.input.source).toBe("scene");
  });

  it("clicking a Phase pill copies its default AlignmentPhrase with phase_bar source", async () => {
    render(<App />);
    const phaseBtn = await waitFor(() => {
      const buttons = screen
        .getAllByRole("button")
        .filter((b) => b.getAttribute("data-phase-id") === "phase-0");
      if (buttons.length === 0) throw new Error("phase button not found");
      return buttons[0];
    });
    fireEvent.click(phaseBtn);
    await waitFor(() =>
      expect(findRecordUsageInputs().length).toBeGreaterThan(0),
    );
    const input = findRecordUsageInputs()[0].input as {
      targetType: string;
      source: string;
      phaseId: string | null;
    };
    expect(input.targetType).toBe("alignment");
    expect(input.source).toBe("phase_bar");
    expect(input.phaseId).toBe("phase-0");
  });

  it("ESC at document level invokes hide_window", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() =>
      expect(invokeMock.mock.calls.some((c) => c[0] === "hide_window")).toBe(
        true,
      ),
    );
  });
});
