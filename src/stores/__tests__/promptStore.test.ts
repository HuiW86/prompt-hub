import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AlignmentPhrase,
  DraftSummary,
  Macro,
  Modifier,
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
    orderIndex: 0,
  },
];

const fakeModifiers: Modifier[] = [
  {
    id: "mod-structured",
    name: "结构化输出",
    content: "请用要点列表回答",
    groupKind: "delivery",
    usageCount: 2,
    lastUsedAt: null,
    createdAt: "2026-05-23T00:00:00Z",
    notes: null,
    deprecated: false,
    orderIndex: 0,
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

const fakeDrafts: DraftSummary[] = [
  {
    id: "draft-1",
    targetType: "macro",
    name: "草稿 · 深挖",
    preview: "expand this fully",
    toolName: "save_conversation_as_macro",
    status: "pending",
    createdAt: "2026-06-03T00:00:00Z",
  },
];

function mockListAll() {
  invokeMock.mockImplementation((cmd: string) => {
    switch (cmd) {
      case "list_phases":
        return Promise.resolve(fakePhases);
      case "list_alignment_phrases":
        return Promise.resolve(fakeAlignments);
      case "list_macros":
        return Promise.resolve(fakeMacros);
      case "list_modifiers":
        return Promise.resolve(fakeModifiers);
      case "list_scenes_with_children":
        return Promise.resolve(fakeScenes);
      case "list_recent_usage":
        return Promise.resolve(fakeRecent);
      case "count_today_usage":
        return Promise.resolve(0);
      case "list_drafts":
        return Promise.resolve(fakeDrafts);
      case "count_pending_drafts":
        return Promise.resolve(fakeDrafts.length);
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
    expect(state.modifiers).toEqual(fakeModifiers);
    expect(state.scenes).toEqual(fakeScenes);
    expect(state.drafts).toEqual(fakeDrafts);
    expect(state.pendingDraftCount).toBe(1);
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

  it("promoteDraft sends groupKind and refreshes the inbox", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();
    expect(usePromptStore.getState().pendingDraftCount).toBe(1);

    // After promote the inbox is empty; refreshDrafts re-pulls list + count.
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "promote_draft":
          return Promise.resolve({
            insertedAssetId: "macro-new",
            insertedAssetType: "macro",
          });
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_modifiers":
          return Promise.resolve(fakeModifiers);
        case "list_scenes_with_children":
          return Promise.resolve(fakeScenes);
        case "list_alignment_phrases":
          return Promise.resolve(fakeAlignments);
        case "list_drafts":
          return Promise.resolve([]);
        case "count_pending_drafts":
          return Promise.resolve(0);
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });

    await usePromptStore
      .getState()
      .promoteDraft({ id: "draft-1", groupKind: "delivery" });

    const promoteCall = invokeMock.mock.calls.find(
      (c) => c[0] === "promote_draft",
    );
    expect(promoteCall?.[1]).toMatchObject({
      id: "draft-1",
      groupKind: "delivery",
    });
    const state = usePromptStore.getState();
    expect(state.drafts).toEqual([]);
    expect(state.pendingDraftCount).toBe(0);
  });

  it("discardDraft refreshes the inbox", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "discard_draft":
          return Promise.resolve({ ok: true });
        case "list_drafts":
          return Promise.resolve([]);
        case "count_pending_drafts":
          return Promise.resolve(0);
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });

    await usePromptStore.getState().discardDraft("draft-1");
    const state = usePromptStore.getState();
    expect(state.drafts).toEqual([]);
    expect(state.pendingDraftCount).toBe(0);
  });

  it("createMacro appends the backend-returned macro", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    const created: Macro = {
      id: "macro-new",
      name: "新建",
      content: "body",
      expandFrom: null,
      native: false,
      role: null,
      task: null,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: "2026-06-04T00:00:00Z",
      notes: null,
      sceneId: null,
      deprecated: false,
      orderIndex: 1,
    };
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "create_macro") return Promise.resolve(created);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore
      .getState()
      .createMacro({ name: "新建", content: "body" });
    const macros = usePromptStore.getState().macros;
    expect(macros).toHaveLength(2);
    expect(macros[1]).toEqual(created);
  });

  it("updateMacro applies optimistically and rolls back on failure", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    invokeMock.mockRejectedValue(new Error("write rejected"));
    await expect(
      usePromptStore
        .getState()
        .updateMacro({ id: "macro-best-practice", name: "改名", content: "x" }),
    ).rejects.toThrow("write rejected");

    // Rolled back to the pre-edit snapshot.
    expect(usePromptStore.getState().macros).toEqual(fakeMacros);
  });

  it("deleteMacro removes optimistically and rolls back on failure", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    invokeMock.mockRejectedValue(new Error("delete rejected"));
    await expect(
      usePromptStore.getState().deleteMacro("macro-best-practice"),
    ).rejects.toThrow("delete rejected");
    expect(usePromptStore.getState().macros).toEqual(fakeMacros);
  });

  it("reorderMacros reorders optimistically and rolls back on failure", async () => {
    const twoMacros: Macro[] = [
      fakeMacros[0],
      { ...fakeMacros[0], id: "macro-2", name: "第二", orderIndex: 1 },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_macros") return Promise.resolve(twoMacros);
      if (cmd === "list_modifiers") return Promise.resolve(fakeModifiers);
      if (cmd === "list_phases") return Promise.resolve(fakePhases);
      if (cmd === "list_alignment_phrases")
        return Promise.resolve(fakeAlignments);
      if (cmd === "list_scenes_with_children")
        return Promise.resolve(fakeScenes);
      if (cmd === "list_recent_usage") return Promise.resolve(fakeRecent);
      if (cmd === "count_today_usage") return Promise.resolve(0);
      if (cmd === "list_drafts") return Promise.resolve(fakeDrafts);
      if (cmd === "count_pending_drafts")
        return Promise.resolve(fakeDrafts.length);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });
    await usePromptStore.getState().refreshAll();

    // Success path: list order follows the supplied id order.
    invokeMock.mockResolvedValue({ ok: true });
    await usePromptStore
      .getState()
      .reorderMacros(["macro-2", "macro-best-practice"]);
    expect(usePromptStore.getState().macros.map((m) => m.id)).toEqual([
      "macro-2",
      "macro-best-practice",
    ]);

    // Failure path: snapshot (current order) is restored.
    invokeMock.mockRejectedValue(new Error("reorder rejected"));
    await expect(
      usePromptStore
        .getState()
        .reorderMacros(["macro-best-practice", "macro-2"]),
    ).rejects.toThrow("reorder rejected");
    expect(usePromptStore.getState().macros.map((m) => m.id)).toEqual([
      "macro-2",
      "macro-best-practice",
    ]);
  });

  it("createModifier appends the backend-returned modifier", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    const created: Modifier = {
      id: "mod-new",
      name: "新约束",
      content: "body",
      groupKind: "constraint",
      usageCount: 0,
      lastUsedAt: null,
      createdAt: "2026-06-04T00:00:00Z",
      notes: null,
      deprecated: false,
      orderIndex: 0,
    };
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "create_modifier") return Promise.resolve(created);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore.getState().createModifier({
      name: "新约束",
      content: "body",
      groupKind: "constraint",
    });
    const modifiers = usePromptStore.getState().modifiers;
    expect(modifiers).toHaveLength(2);
    expect(modifiers[1]).toEqual(created);
  });

  it("updateModifier applies optimistically and rolls back on failure", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    invokeMock.mockRejectedValue(new Error("write rejected"));
    await expect(
      usePromptStore
        .getState()
        .updateModifier({ id: "mod-structured", name: "改名", content: "x" }),
    ).rejects.toThrow("write rejected");
    expect(usePromptStore.getState().modifiers).toEqual(fakeModifiers);
  });

  it("deleteModifier removes optimistically and rolls back on failure", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    invokeMock.mockRejectedValue(new Error("delete rejected"));
    await expect(
      usePromptStore.getState().deleteModifier("mod-structured"),
    ).rejects.toThrow("delete rejected");
    expect(usePromptStore.getState().modifiers).toEqual(fakeModifiers);
  });

  it("reorderModifiers resequences one quadrant optimistically and rolls back", async () => {
    // Two modifiers in the same quadrant + one in another, so we can assert the
    // reorder touches only the targeted quadrant.
    const threeMods: Modifier[] = [
      { ...fakeModifiers[0], id: "mod-a", groupKind: "action", orderIndex: 0 },
      { ...fakeModifiers[0], id: "mod-b", groupKind: "action", orderIndex: 1 },
      {
        ...fakeModifiers[0],
        id: "mod-keep",
        groupKind: "delivery",
        orderIndex: 0,
      },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_modifiers":
          return Promise.resolve(threeMods);
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_phases":
          return Promise.resolve(fakePhases);
        case "list_alignment_phrases":
          return Promise.resolve(fakeAlignments);
        case "list_scenes_with_children":
          return Promise.resolve(fakeScenes);
        case "list_recent_usage":
          return Promise.resolve(fakeRecent);
        case "count_today_usage":
          return Promise.resolve(0);
        case "list_drafts":
          return Promise.resolve(fakeDrafts);
        case "count_pending_drafts":
          return Promise.resolve(fakeDrafts.length);
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
    await usePromptStore.getState().refreshAll();

    // Success: the action quadrant follows the supplied order; delivery is kept.
    invokeMock.mockResolvedValue({ ok: true });
    await usePromptStore
      .getState()
      .reorderModifiers("action", ["mod-b", "mod-a"]);
    const ids = usePromptStore.getState().modifiers.map((m) => m.id);
    expect(ids).toContain("mod-keep");
    expect(ids.filter((id) => id === "mod-a" || id === "mod-b")).toEqual([
      "mod-b",
      "mod-a",
    ]);

    // Failure: snapshot restored.
    const before = usePromptStore.getState().modifiers;
    invokeMock.mockRejectedValue(new Error("reorder rejected"));
    await expect(
      usePromptStore.getState().reorderModifiers("action", ["mod-a", "mod-b"]),
    ).rejects.toThrow("reorder rejected");
    expect(usePromptStore.getState().modifiers).toEqual(before);
  });
});
