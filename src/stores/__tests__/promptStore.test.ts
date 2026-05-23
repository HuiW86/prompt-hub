import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AlignmentPhrase,
  Macro,
  Phase,
  RecentUsageEntry,
  SceneWithChildren,
  UsageRecord,
} from "../../ipc/types";

// Mock @tauri-apps/api/core BEFORE importing the store/ipc — the store captures
// `invoke` at module load time via the `ipc` object.
const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { usePromptStore } from "../promptStore";

const initial = usePromptStore.getState();

const fakePhases: Phase[] = [
  {
    id: "phase-diverge",
    name: "发散",
    orderIndex: 0,
    color: null,
    description: null,
    visible: true,
    defaultAlignmentPhraseId: "ap-diverge-default",
  },
];

const fakeAlignments: AlignmentPhrase[] = [
  {
    id: "ap-diverge-default",
    phaseId: "phase-diverge",
    name: "默认 · 发散",
    content: "我们做发散",
    isDefault: true,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: "2026-05-23T00:00:00Z",
    notes: null,
    deprecated: false,
  },
];

const fakeMacros: Macro[] = [
  {
    id: "macro-best-practice",
    name: "借力最优解",
    content: "调研外部成熟方案",
    expandFrom: null,
    native: true,
    role: null,
    task: null,
    usageCount: 3,
    lastUsedAt: null,
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
      rolePresets: ["架构师"],
      color: null,
    },
    subStages: [],
    phrases: [
      {
        id: "phrase-plan-export",
        sceneId: "scene-plan",
        name: "设计导出模块",
        content: "为项目设计数据导出模块",
        usageCount: 1,
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

function mockListAll() {
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
      case "count_today_usage":
        return Promise.resolve(0);
      default:
        return Promise.reject(new Error(`unexpected command ${cmd}`));
    }
  });
}

describe("promptStore", () => {
  beforeEach(() => {
    usePromptStore.setState(initial, true);
    invokeMock.mockReset();
  });

  it("refreshAll populates every slice on success", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();
    const state = usePromptStore.getState();
    expect(state.loadState).toBe("ready");
    expect(state.phases).toEqual(fakePhases);
    expect(state.alignmentPhrasesByPhase).toEqual({
      "phase-diverge": fakeAlignments,
    });
    expect(state.macros).toEqual(fakeMacros);
    expect(state.scenes).toEqual(fakeScenes);
  });

  it("refreshAll surfaces error message on IPC failure", async () => {
    invokeMock.mockRejectedValue(new Error("db missing"));
    await usePromptStore.getState().refreshAll();
    const state = usePromptStore.getState();
    expect(state.loadState).toBe("error");
    expect(state.loadError).toBe("db missing");
  });

  it("recordCopy bumps Macro usageCount locally and refetches recent", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    const fakeRecord: UsageRecord = {
      id: "rec-1",
      timestamp: "2026-05-23T10:00:00Z",
      targetType: "macro",
      targetId: "macro-best-practice",
      source: "macro_area",
      modifierIds: null,
      sopId: null,
      sopStepOrder: null,
      phaseId: null,
    };
    const refreshedRecent: RecentUsageEntry[] = [
      { record: fakeRecord, targetName: "借力最优解", targetContent: "..." },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "record_usage") return Promise.resolve(fakeRecord);
      if (cmd === "list_recent_usage") return Promise.resolve(refreshedRecent);
      if (cmd === "count_today_usage") return Promise.resolve(1);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore.getState().recordCopy({
      targetType: "macro",
      targetId: "macro-best-practice",
      source: "macro_area",
      modifierIds: null,
      sopId: null,
      sopStepOrder: null,
      phaseId: null,
    });

    const state = usePromptStore.getState();
    const bumped = state.macros.find((m) => m.id === "macro-best-practice");
    expect(bumped?.usageCount).toBe(4); // was 3, +1
    expect(bumped?.lastUsedAt).toBe("2026-05-23T10:00:00Z");
    expect(state.recentUsage).toEqual(refreshedRecent);
    // B5-6: today count refreshes alongside recents so StatusBar stays live.
    expect(state.todayCount).toBe(1);
  });

  it("recordCopy bumps Phrase usageCount within its scene", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    const fakeRecord: UsageRecord = {
      id: "rec-2",
      timestamp: "2026-05-23T10:01:00Z",
      targetType: "phrase",
      targetId: "phrase-plan-export",
      source: "scene",
      modifierIds: null,
      sopId: null,
      sopStepOrder: null,
      phaseId: null,
    };
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "record_usage") return Promise.resolve(fakeRecord);
      if (cmd === "list_recent_usage") return Promise.resolve([]);
      if (cmd === "count_today_usage") return Promise.resolve(0);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore.getState().recordCopy({
      targetType: "phrase",
      targetId: "phrase-plan-export",
      source: "scene",
      modifierIds: null,
      sopId: null,
      sopStepOrder: null,
      phaseId: null,
    });

    const phrase = usePromptStore.getState().scenes[0].phrases[0];
    expect(phrase.usageCount).toBe(2); // was 1, +1
  });
});
