import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AlignmentPhrase,
  Composition,
  DraftPayload,
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
    orderIndex: 0,
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

const fakeCompositions: Composition[] = [
  {
    id: "comp-diverge-1",
    name: "发散组合",
    modifierIds: ["mod-structured"],
    phaseId: "phase-diverge",
    sceneId: null,
    usageCount: 1,
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
        orderIndex: 0,
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
      case "list_compositions":
        return Promise.resolve(fakeCompositions);
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
    expect(state.compositionsByPhase).toEqual({
      "phase-diverge": fakeCompositions,
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
        case "list_compositions":
          return Promise.resolve(fakeCompositions);
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

  it("updateDraft patches the inbox card optimistically and sends the full payload", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    // Content longer than the 80-char preview cap so the derived preview is
    // asserted to truncate exactly like the backend's DraftPayload::preview().
    const editedPayload: DraftPayload = {
      target_type: "macro",
      schema_version: 1,
      name: "草稿 · 深挖（改）",
      content: "改".repeat(100),
      phase_id: "phase-diverge",
      scene_id: null,
    };
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "update_draft")
        return Promise.resolve({ ok: true, updatedAt: "2026-07-01T00:00:00Z" });
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore
      .getState()
      .updateDraft({ id: "draft-1", payload: editedPayload });

    expect(invokeMock).toHaveBeenCalledWith("update_draft", {
      id: "draft-1",
      payload: editedPayload,
    });
    const card = usePromptStore.getState().drafts[0];
    expect(card.name).toBe("草稿 · 深挖（改）");
    expect(card.preview).toBe(`${"改".repeat(80)}…`);
    // Metadata not derived from the payload stays untouched.
    expect(card.toolName).toBe("save_conversation_as_macro");
  });

  it("updateDraft rolls back the inbox card on failure", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    invokeMock.mockRejectedValue(new Error("payload too large"));
    await expect(
      usePromptStore.getState().updateDraft({
        id: "draft-1",
        payload: {
          target_type: "macro",
          schema_version: 1,
          name: "不会生效",
          content: "x",
          phase_id: "phase-diverge",
          scene_id: null,
        },
      }),
    ).rejects.toThrow("payload too large");
    expect(usePromptStore.getState().drafts).toEqual(fakeDrafts);
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
      if (cmd === "list_compositions") return Promise.resolve(fakeCompositions);
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

  it("updateModifier with groupKind moves the modifier to the end of the target quadrant", async () => {
    // One resident in the target quadrant so the appended orderIndex is visible.
    const twoQuads: Modifier[] = [
      { ...fakeModifiers[0], id: "mod-move", groupKind: "delivery" },
      { ...fakeModifiers[0], id: "mod-resident", groupKind: "action" },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_modifiers":
          return Promise.resolve(twoQuads);
        case "update_modifier":
          return Promise.resolve({ ok: true });
        case "list_phases":
          return Promise.resolve(fakePhases);
        case "list_alignment_phrases":
          return Promise.resolve(fakeAlignments);
        case "list_compositions":
          return Promise.resolve(fakeCompositions);
        case "list_macros":
          return Promise.resolve(fakeMacros);
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

    await usePromptStore.getState().updateModifier({
      id: "mod-move",
      name: "结构化输出",
      content: "请用要点列表回答",
      groupKind: "action",
    });
    const moved = usePromptStore
      .getState()
      .modifiers.find((m) => m.id === "mod-move");
    expect(moved?.groupKind).toBe("action");
    // Optimistic append mirrors the backend: end of the target quadrant.
    expect(moved?.orderIndex).toBe(1);
    // The wire call carries the target quadrant.
    const call = invokeMock.mock.calls.find((c) => c[0] === "update_modifier");
    expect(call?.[1]).toMatchObject({ id: "mod-move", groupKind: "action" });

    // Failure: quadrant + orderIndex snap back with the snapshot.
    const before = usePromptStore.getState().modifiers;
    invokeMock.mockRejectedValue(new Error("move rejected"));
    await expect(
      usePromptStore.getState().updateModifier({
        id: "mod-resident",
        name: "x",
        content: "y",
        groupKind: "cognition",
      }),
    ).rejects.toThrow("move rejected");
    expect(usePromptStore.getState().modifiers).toEqual(before);
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
        case "list_compositions":
          return Promise.resolve(fakeCompositions);
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

  it("createAlignmentPhrase appends to its phase bucket", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    const created: AlignmentPhrase = {
      id: "ap-diverge-extra",
      phaseId: "phase-diverge",
      name: "补充 · 发散",
      content: "再放开一点",
      isDefault: false,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: "2026-06-04T00:00:00Z",
      notes: null,
      deprecated: false,
      orderIndex: 1,
    };
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "create_alignment_phrase") return Promise.resolve(created);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore.getState().createAlignmentPhrase({
      phaseId: "phase-diverge",
      name: "补充 · 发散",
      content: "再放开一点",
    });
    const bucket =
      usePromptStore.getState().alignmentPhrasesByPhase["phase-diverge"];
    expect(bucket).toHaveLength(2);
    expect(bucket[1]).toEqual(created);
  });

  it("updateAlignmentPhrase applies optimistically and rolls back on failure", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();
    const before = usePromptStore.getState().alignmentPhrasesByPhase;

    invokeMock.mockRejectedValue(new Error("write rejected"));
    await expect(
      usePromptStore.getState().updateAlignmentPhrase({
        id: "ap-diverge-default",
        name: "改名",
        content: "x",
      }),
    ).rejects.toThrow("write rejected");
    expect(usePromptStore.getState().alignmentPhrasesByPhase).toEqual(before);
  });

  it("deleteAlignmentPhrase rolls back when the backend rejects the default", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();
    const before = usePromptStore.getState().alignmentPhrasesByPhase;

    invokeMock.mockRejectedValue(
      new Error("alignment phrase is its phase default and cannot be deleted"),
    );
    await expect(
      usePromptStore.getState().deleteAlignmentPhrase("ap-diverge-default"),
    ).rejects.toThrow("phase default");
    // The optimistic removal is reverted, so the default survives in the bucket.
    expect(usePromptStore.getState().alignmentPhrasesByPhase).toEqual(before);
  });

  it("reorderAlignmentPhrases resequences one phase optimistically and rolls back", async () => {
    // Two phrases in phase-diverge + one in phase-understand, so we can assert the
    // reorder touches only the targeted phase.
    const twoPhase: AlignmentPhrase[] = [
      { ...fakeAlignments[0], id: "ap-a", isDefault: false, orderIndex: 0 },
      { ...fakeAlignments[0], id: "ap-b", isDefault: false, orderIndex: 1 },
      {
        ...fakeAlignments[0],
        id: "ap-keep",
        phaseId: "phase-understand",
        isDefault: false,
        orderIndex: 0,
      },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_alignment_phrases":
          return Promise.resolve(twoPhase);
        case "list_compositions":
          return Promise.resolve(fakeCompositions);
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_modifiers":
          return Promise.resolve(fakeModifiers);
        case "list_phases":
          return Promise.resolve(fakePhases);
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

    // Success: the diverge phase follows the supplied order; understand is kept.
    invokeMock.mockResolvedValue({ ok: true });
    await usePromptStore
      .getState()
      .reorderAlignmentPhrases("phase-diverge", ["ap-b", "ap-a"]);
    const byPhase = usePromptStore.getState().alignmentPhrasesByPhase;
    expect(byPhase["phase-diverge"].map((a) => a.id)).toEqual(["ap-b", "ap-a"]);
    expect(byPhase["phase-understand"].map((a) => a.id)).toEqual(["ap-keep"]);

    // Failure: snapshot restored.
    const before = usePromptStore.getState().alignmentPhrasesByPhase;
    invokeMock.mockRejectedValue(new Error("reorder rejected"));
    await expect(
      usePromptStore
        .getState()
        .reorderAlignmentPhrases("phase-diverge", ["ap-a", "ap-b"]),
    ).rejects.toThrow("reorder rejected");
    expect(usePromptStore.getState().alignmentPhrasesByPhase).toEqual(before);
  });

  it("setDefaultAlignmentPhrase flips the bucket flag + phase pointer and rolls back", async () => {
    // Seed default + a non-default candidate in the same phase.
    const twoPhrases: AlignmentPhrase[] = [
      fakeAlignments[0],
      {
        ...fakeAlignments[0],
        id: "ap-diverge-alt",
        isDefault: false,
        orderIndex: 1,
      },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_alignment_phrases":
          return Promise.resolve(twoPhrases);
        case "list_compositions":
          return Promise.resolve(fakeCompositions);
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_modifiers":
          return Promise.resolve(fakeModifiers);
        case "list_phases":
          return Promise.resolve(fakePhases);
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

    // Success: exactly one default (the new one) and the phases pointer follows.
    invokeMock.mockResolvedValue({ ok: true });
    await usePromptStore
      .getState()
      .setDefaultAlignmentPhrase("phase-diverge", "ap-diverge-alt");
    const bucket =
      usePromptStore.getState().alignmentPhrasesByPhase["phase-diverge"];
    expect(bucket.filter((a) => a.isDefault).map((a) => a.id)).toEqual([
      "ap-diverge-alt",
    ]);
    expect(
      usePromptStore.getState().phases.find((p) => p.id === "phase-diverge")
        ?.defaultAlignmentPhraseId,
    ).toBe("ap-diverge-alt");
    const call = invokeMock.mock.calls.find(
      (c) => c[0] === "set_default_alignment_phrase",
    );
    expect(call?.[1]).toMatchObject({
      phaseId: "phase-diverge",
      id: "ap-diverge-alt",
    });

    // Failure: both the bucket and the phases pointer snap back.
    const beforePhrases = usePromptStore.getState().alignmentPhrasesByPhase;
    const beforePhases = usePromptStore.getState().phases;
    invokeMock.mockRejectedValue(new Error("set default rejected"));
    await expect(
      usePromptStore
        .getState()
        .setDefaultAlignmentPhrase("phase-diverge", "ap-diverge-default"),
    ).rejects.toThrow("set default rejected");
    expect(usePromptStore.getState().alignmentPhrasesByPhase).toEqual(
      beforePhrases,
    );
    expect(usePromptStore.getState().phases).toEqual(beforePhases);
  });

  it("createComposition appends to its phase bucket", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    const created: Composition = {
      id: "comp-diverge-2",
      name: "新组合",
      modifierIds: ["mod-structured"],
      phaseId: "phase-diverge",
      sceneId: null,
      usageCount: 0,
      lastUsedAt: null,
      createdAt: "2026-06-04T00:00:00Z",
      notes: null,
      deprecated: false,
      orderIndex: 1,
    };
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "create_composition") return Promise.resolve(created);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore.getState().createComposition({
      phaseId: "phase-diverge",
      name: "新组合",
      modifierIds: ["mod-structured"],
    });
    const bucket =
      usePromptStore.getState().compositionsByPhase["phase-diverge"];
    expect(bucket).toHaveLength(2);
    expect(bucket[1]).toEqual(created);
  });

  it("updateComposition applies optimistically and rolls back on failure", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();
    const before = usePromptStore.getState().compositionsByPhase;

    invokeMock.mockRejectedValue(new Error("write rejected"));
    await expect(
      usePromptStore.getState().updateComposition({
        id: "comp-diverge-1",
        name: "改名",
        modifierIds: [],
      }),
    ).rejects.toThrow("write rejected");
    expect(usePromptStore.getState().compositionsByPhase).toEqual(before);
  });

  it("deleteComposition removes optimistically and rolls back on failure", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();
    const before = usePromptStore.getState().compositionsByPhase;

    invokeMock.mockRejectedValue(new Error("delete rejected"));
    await expect(
      usePromptStore.getState().deleteComposition("comp-diverge-1"),
    ).rejects.toThrow("delete rejected");
    expect(usePromptStore.getState().compositionsByPhase).toEqual(before);
  });

  it("reorderCompositions resequences one phase optimistically and rolls back", async () => {
    // Two compositions in phase-diverge + one in phase-understand, so we can
    // assert the reorder touches only the targeted phase.
    const twoPhase: Composition[] = [
      { ...fakeCompositions[0], id: "comp-a", orderIndex: 0 },
      { ...fakeCompositions[0], id: "comp-b", orderIndex: 1 },
      {
        ...fakeCompositions[0],
        id: "comp-keep",
        phaseId: "phase-understand",
        orderIndex: 0,
      },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_alignment_phrases":
          return Promise.resolve(fakeAlignments);
        case "list_compositions":
          return Promise.resolve(twoPhase);
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_modifiers":
          return Promise.resolve(fakeModifiers);
        case "list_phases":
          return Promise.resolve(fakePhases);
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

    // Success: the diverge phase follows the supplied order; understand is kept.
    invokeMock.mockResolvedValue({ ok: true });
    await usePromptStore
      .getState()
      .reorderCompositions("phase-diverge", ["comp-b", "comp-a"]);
    const byPhase = usePromptStore.getState().compositionsByPhase;
    expect(byPhase["phase-diverge"].map((c) => c.id)).toEqual([
      "comp-b",
      "comp-a",
    ]);
    expect(byPhase["phase-understand"].map((c) => c.id)).toEqual(["comp-keep"]);

    // Failure: snapshot restored.
    const before = usePromptStore.getState().compositionsByPhase;
    invokeMock.mockRejectedValue(new Error("reorder rejected"));
    await expect(
      usePromptStore
        .getState()
        .reorderCompositions("phase-diverge", ["comp-a", "comp-b"]),
    ).rejects.toThrow("reorder rejected");
    expect(usePromptStore.getState().compositionsByPhase).toEqual(before);
  });

  // ── Scene + sub-stage structure editing (plan scene-substage-editing) ──
  // These re-pull listScenesWithChildren (no optimistic update), so each test
  // asserts both the write command args AND that state.scenes reflects the pull.
  it("createScene sends name + rolePresets and re-pulls scenes", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    const pulled: SceneWithChildren[] = [
      ...fakeScenes,
      {
        scene: {
          id: "scene-new",
          name: "新场景",
          icon: null,
          orderIndex: 1,
          visible: true,
          rolePresets: [],
          color: null,
        },
        subStages: [],
        phrases: [],
      },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "create_scene") return Promise.resolve(pulled[1].scene);
      if (cmd === "list_scenes_with_children") return Promise.resolve(pulled);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore
      .getState()
      .createScene({ name: "新场景", rolePresets: [] });

    const createCall = invokeMock.mock.calls.find(
      (c) => c[0] === "create_scene",
    );
    expect(createCall?.[1]).toMatchObject({ name: "新场景", rolePresets: [] });
    expect(usePromptStore.getState().scenes).toEqual(pulled);
  });

  it("updateScene preserves icon/color/rolePresets and re-pulls", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "update_scene") return Promise.resolve({ ok: true });
      if (cmd === "list_scenes_with_children")
        return Promise.resolve(fakeScenes);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore.getState().updateScene({
      id: "scene-plan",
      name: "方案",
      icon: "📐",
      rolePresets: ["架构师"],
      color: undefined,
    });
    const call = invokeMock.mock.calls.find((c) => c[0] === "update_scene");
    expect(call?.[1]).toMatchObject({
      id: "scene-plan",
      name: "方案",
      icon: "📐",
      rolePresets: ["架构师"],
    });
  });

  it("deleteScene propagates the SceneNotEmpty error", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    invokeMock.mockRejectedValue(
      new Error(
        "scene `scene-plan` is not empty (has phrases or sub-stages) and cannot be deleted",
      ),
    );
    await expect(
      usePromptStore.getState().deleteScene("scene-plan"),
    ).rejects.toThrow("not empty");
  });

  it("createSubStage sends sceneId + name and re-pulls scenes", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    const withSub: SceneWithChildren[] = [
      {
        ...fakeScenes[0],
        subStages: [
          {
            id: "ss-new",
            sceneId: "scene-plan",
            name: "生成",
            orderIndex: 0,
          },
        ],
      },
    ];
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "create_sub_stage")
        return Promise.resolve(withSub[0].subStages[0]);
      if (cmd === "list_scenes_with_children") return Promise.resolve(withSub);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore
      .getState()
      .createSubStage({ sceneId: "scene-plan", name: "生成" });
    const call = invokeMock.mock.calls.find((c) => c[0] === "create_sub_stage");
    expect(call?.[1]).toMatchObject({ sceneId: "scene-plan", name: "生成" });
    expect(usePromptStore.getState().scenes[0].subStages).toHaveLength(1);
  });

  it("deleteSubStage re-pulls scenes after unbinding", async () => {
    mockListAll();
    await usePromptStore.getState().refreshAll();

    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "delete_sub_stage") return Promise.resolve({ ok: true });
      if (cmd === "list_scenes_with_children")
        return Promise.resolve(fakeScenes);
      return Promise.reject(new Error(`unexpected ${cmd}`));
    });

    await usePromptStore.getState().deleteSubStage("ss-old");
    const call = invokeMock.mock.calls.find((c) => c[0] === "delete_sub_stage");
    expect(call?.[1]).toMatchObject({ id: "ss-old" });
    expect(usePromptStore.getState().scenes).toEqual(fakeScenes);
  });
});
