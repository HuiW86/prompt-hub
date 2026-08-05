import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { useAppStore } from "./stores/appStore";
import { usePromptStore } from "./stores/promptStore";
import { useSearchStore } from "./stores/searchStore";
import { useSettingsStore } from "./stores/settingsStore";

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
  orderIndex: 0,
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
        orderIndex: 0,
      },
    ],
  },
];

const fakeRecent: RecentUsageEntry[] = [];

const initialStore = usePromptStore.getState();
const initialAppStore = useAppStore.getState();

describe("Dashboard end-to-end render", () => {
  beforeEach(() => {
    usePromptStore.setState(initialStore, true);
    useAppStore.setState(initialAppStore, true);
    useSettingsStore.setState({ interactionMode: "invoke" });
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_phases":
          return Promise.resolve(fakePhases);
        case "list_alignment_phrases":
          return Promise.resolve(fakeAlignments);
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_modifiers":
          return Promise.resolve([]);
        case "list_compositions":
          return Promise.resolve([]);
        case "list_scenes_with_children":
          return Promise.resolve(fakeScenes);
        case "list_recent_usage":
          return Promise.resolve(fakeRecent);
        case "count_today_usage":
          return Promise.resolve(0);
        case "list_drafts":
          return Promise.resolve([]);
        case "count_pending_drafts":
          return Promise.resolve(0);
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  function regions(container: HTMLElement) {
    return {
      search: container.querySelector("[role='search']"),
      phaseBar: container.querySelector("[data-region='phase-bar']"),
      alignmentPhrases: container.querySelector(
        "[data-region='alignment-phrases']",
      ),
      macroGrid: container.querySelector("[data-region='macro-grid']"),
      scenePanel: container.querySelector("[data-region='scene-panel']"),
      recentList: container.querySelector("[data-region='recent-list']"),
      sopProgress: container.querySelector("[data-region='sop-progress']"),
      statusBar: container.querySelector("[data-region='status-bar']"),
    };
  }

  it("renders all eight regions after refreshAll resolves", async () => {
    const { container } = render(<App />);
    await waitFor(() =>
      expect(
        container.querySelector("[data-region='phase-bar']"),
      ).not.toBeNull(),
    );
    const r = regions(container);
    expect(r.search).not.toBeNull();
    expect(r.phaseBar).not.toBeNull();
    expect(r.alignmentPhrases).not.toBeNull();
    expect(r.macroGrid).not.toBeNull();
    expect(r.scenePanel).not.toBeNull();
    expect(r.recentList).not.toBeNull();
    expect(r.sopProgress).not.toBeNull();
    expect(r.statusBar).not.toBeNull();
  });

  // B5-5: per 03-product-spec §13.4 the working regions must be Tab-reachable
  // (相位带 / 对齐话术 / Macro / Scene / 最近 / SOP). SearchBar relies on its
  // native input for focus and StatusBar is read-only, so neither carries
  // tabindex. ModifierGrid + CompositionWorkbench were removed from the
  // dashboard (UI declutter; the asset types live on in the data layer), so
  // the cycle dropped from 8 to 6 regions.
  it("six working regions expose tabindex='0' for region-level Tab navigation", async () => {
    const { container } = render(<App />);
    await waitFor(() =>
      expect(
        container.querySelector("[data-region='phase-bar']"),
      ).not.toBeNull(),
    );
    const r = regions(container);
    expect(r.phaseBar?.getAttribute("tabindex")).toBe("0");
    expect(r.alignmentPhrases?.getAttribute("tabindex")).toBe("0");
    expect(r.macroGrid?.getAttribute("tabindex")).toBe("0");
    expect(r.scenePanel?.getAttribute("tabindex")).toBe("0");
    expect(r.recentList?.getAttribute("tabindex")).toBe("0");
    expect(r.sopProgress?.getAttribute("tabindex")).toBe("0");
    // SearchBar wrapper is a role=search div, not tabbable itself.
    expect(r.search?.getAttribute("tabindex")).toBeNull();
    // StatusBar is non-interactive, not in the Tab cycle.
    expect(r.statusBar?.getAttribute("tabindex")).toBeNull();
  });

  it("region DOM order follows the cockpit Tab sequence in 调用态 (reshape v2)", async () => {
    // Dual-layout (ADR-024 ripple): the default invoke mode arranges regions
    // by usage priority — hot zone (macro → recent) before the scene context
    // rail. 03-product-spec §13.4 order update pending human review.
    const { container } = render(<App />);
    await waitFor(() =>
      expect(
        container.querySelector("[data-region='phase-bar']"),
      ).not.toBeNull(),
    );
    const ordered = Array.from(container.querySelectorAll("[data-region]")).map(
      (el) => el.getAttribute("data-region"),
    );
    // SearchBar's wrapper has role=search (no data-region) and is first in the
    // tree; the data-region landmarks below it must appear in cockpit order.
    expect(ordered).toEqual([
      "phase-bar",
      "alignment-phrases",
      "macro-grid",
      "recent-list",
      "scene-panel",
      "sop-progress",
      "status-bar",
    ]);
  });

  it("region DOM order keeps the studio Tab sequence in 整理态", async () => {
    useSettingsStore.setState({ interactionMode: "organize" });
    const { container } = render(<App />);
    await waitFor(() =>
      expect(
        container.querySelector("[data-region='phase-bar']"),
      ).not.toBeNull(),
    );
    const ordered = Array.from(container.querySelectorAll("[data-region]")).map(
      (el) => el.getAttribute("data-region"),
    );
    expect(ordered).toEqual([
      "phase-bar",
      "alignment-phrases",
      "macro-grid",
      "scene-panel",
      "recent-list",
      "sop-progress",
      "status-bar",
    ]);
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
    // The compact macro strip drops the inline body — content moves to the
    // copy button's title tooltip (Promptscape "高频一键入口" form).
    expect(screen.getByRole("button", { name: "借力最优解" })).toHaveAttribute(
      "title",
      "调研外部成熟方案。",
    );
    expect(screen.getByText("7 次")).toBeInTheDocument();
  });

  it("renders the first scene's phrases", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText("设计导出模块")).toBeInTheDocument(),
    );
    expect(screen.getByText("为项目设计数据导出模块。")).toBeInTheDocument();
  });

  // B5-6: the old StatusBar used recentUsage.length (capped at 5) which
  // misrepresented the real day total. Override the mock to return 17 and
  // verify the StatusBar shows it rather than the empty recents length.
  it("StatusBar shows the IPC today count, not the recent list length", async () => {
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_phases":
          return Promise.resolve(fakePhases);
        case "list_alignment_phrases":
          return Promise.resolve(fakeAlignments);
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_modifiers":
          return Promise.resolve([]);
        case "list_compositions":
          return Promise.resolve([]);
        case "list_scenes_with_children":
          return Promise.resolve(fakeScenes);
        case "list_recent_usage":
          return Promise.resolve(fakeRecent); // empty
        case "count_today_usage":
          return Promise.resolve(17);
        case "list_drafts":
          return Promise.resolve([]);
        case "count_pending_drafts":
          return Promise.resolve(0);
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
    const { container } = render(<App />);
    await waitFor(() => {
      const bar = container.querySelector("[data-region='status-bar']");
      expect(bar?.textContent).toContain("今日复制 17 次");
    });
  });

  it("StatusBar shows '当前相位：未选' when no phase is active", async () => {
    const { container } = render(<App />);
    await waitFor(() =>
      expect(
        container.querySelector("[data-region='status-bar']"),
      ).not.toBeNull(),
    );
    const bar = container.querySelector("[data-region='status-bar']");
    expect(bar?.textContent).toContain("当前相位：未选");
  });
});

describe("Dashboard click → IPC flow", () => {
  beforeEach(() => {
    usePromptStore.setState(initialStore, true);
    useAppStore.setState(initialAppStore, true);
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_phases":
          return Promise.resolve(fakePhases);
        case "list_alignment_phrases":
          return Promise.resolve(fakeAlignments);
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_modifiers":
          return Promise.resolve([]);
        case "list_compositions":
          return Promise.resolve([]);
        case "list_scenes_with_children":
          return Promise.resolve(fakeScenes);
        case "list_recent_usage":
          return Promise.resolve(fakeRecent);
        case "count_today_usage":
          return Promise.resolve(0);
        case "list_drafts":
          return Promise.resolve([]);
        case "count_pending_drafts":
          return Promise.resolve(0);
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

  it("clicking a Phase pill only activates it — no copy, no record_usage (manage-in-window path)", async () => {
    render(<App />);
    const phaseBtn = await waitFor(() => {
      const buttons = screen
        .getAllByRole("button")
        .filter((b) => b.getAttribute("data-phase-id") === "phase-0");
      if (buttons.length === 0) throw new Error("phase button not found");
      return buttons[0];
    });
    fireEvent.click(phaseBtn);
    // Activation is immediate (highlight via aria-current); the copy-then-hide
    // path is reserved for the ⌘1-8 launcher so the window stays open for
    // entering the AlignmentPhrase manage panel.
    await waitFor(() =>
      expect(phaseBtn.getAttribute("aria-current")).toBe("true"),
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(findRecordUsageInputs().length).toBe(0);
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

  it("⌘1 selects the first visible phase and records phase_bar usage", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    fireEvent.keyDown(document, { key: "1", metaKey: true });
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

  it("after ⌘1 the StatusBar reflects the active phase name", async () => {
    const { container } = render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    const bar = container.querySelector("[data-region='status-bar']");
    expect(bar?.textContent).toContain("当前相位：未选");
    fireEvent.keyDown(document, { key: "1", metaKey: true });
    await waitFor(() => {
      expect(bar?.textContent).toContain("当前相位：发散");
    });
  });

  it("⌘9 does not trigger record_usage (out of range)", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    fireEvent.keyDown(document, { key: "9", metaKey: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(findRecordUsageInputs().length).toBe(0);
  });

  it("plain '1' without metaKey does not trigger phase select", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    fireEvent.keyDown(document, { key: "1" });
    await new Promise((r) => setTimeout(r, 0));
    expect(findRecordUsageInputs().length).toBe(0);
  });

  it("on Linux platform, Ctrl+1 (not ⌘1) triggers phase select", async () => {
    // P1-4: cross-platform modifier — utils/platform.isMacLike reads
    // navigator.platform on each call, so flipping it mid-test exercises the
    // non-mac code path. Restore in afterEach (handled by individual reset).
    const originalPlatform = navigator.platform;
    Object.defineProperty(navigator, "platform", {
      value: "Linux x86_64",
      configurable: true,
      writable: true,
    });
    try {
      render(<App />);
      await screen.findByRole("button", { name: "借力最优解" });
      // ⌘1 should now be IGNORED on Linux
      fireEvent.keyDown(document, { key: "1", metaKey: true });
      await new Promise((r) => setTimeout(r, 0));
      expect(findRecordUsageInputs().length).toBe(0);
      // Ctrl+1 should fire
      fireEvent.keyDown(document, { key: "1", ctrlKey: true });
      await waitFor(() =>
        expect(findRecordUsageInputs().length).toBeGreaterThan(0),
      );
    } finally {
      Object.defineProperty(navigator, "platform", {
        value: originalPlatform,
        configurable: true,
        writable: true,
      });
    }
  });

  it("⌘K focuses the search input and selects existing query text", async () => {
    const { container } = render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    const input = container.querySelector(
      "[role='search'] input",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    // The input now auto-focuses on mount per product-spec §13.4 wake-focus;
    // blur first so ⌘K's re-focus + select is what's actually under test.
    input.blur();
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("hello".length);
  });

  it("shift+⌘K does not focus the search input", async () => {
    const { container } = render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    const input = container.querySelector(
      "[role='search'] input",
    ) as HTMLInputElement;
    // Mount now auto-focuses the search input per product-spec §13.4 wake-focus;
    // blur to body first so the shortcut is tested in isolation.
    input.blur();
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(document, { key: "k", metaKey: true, shiftKey: true });
    expect(document.activeElement).not.toBe(input);
  });

  it("plain 'k' without metaKey does not focus the search input", async () => {
    const { container } = render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    const input = container.querySelector(
      "[role='search'] input",
    ) as HTMLInputElement;
    // Mount now auto-focuses the search input per product-spec §13.4 wake-focus;
    // blur to body first so the shortcut is tested in isolation.
    input.blur();
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(document, { key: "k" });
    expect(document.activeElement).not.toBe(input);
  });

  it("ESC inside SearchBar with non-empty value does NOT hide window", async () => {
    // Regression: App-level ESC listener used to fire even when SearchBar's
    // input had content, because React's synthetic stopPropagation cannot
    // block document-level native listeners. App must check the target.
    const { container } = render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    const input = container.querySelector(
      "[role='search'] input",
    ) as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: "hello" } });
    expect(input.value).toBe("hello");

    fireEvent.keyDown(input, { key: "Escape", bubbles: true });
    // Give microtasks a chance to flush.
    await new Promise((r) => setTimeout(r, 0));
    expect(invokeMock.mock.calls.some((c) => c[0] === "hide_window")).toBe(
      false,
    );

    // Second ESC after the field is empty must fall through and hide.
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Escape", bubbles: true });
    await waitFor(() =>
      expect(invokeMock.mock.calls.some((c) => c[0] === "hide_window")).toBe(
        true,
      ),
    );
  });
});

describe("Wake hygiene — clear search residue on hide (P1-4)", () => {
  const searchInitial = useSearchStore.getState();

  beforeEach(() => {
    usePromptStore.setState(initialStore, true);
    useAppStore.setState(initialAppStore, true);
    useSearchStore.setState(searchInitial, true);
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      switch (cmd) {
        case "list_phases":
          return Promise.resolve(fakePhases);
        case "list_alignment_phrases":
          return Promise.resolve(fakeAlignments);
        case "list_macros":
          return Promise.resolve(fakeMacros);
        case "list_modifiers":
          return Promise.resolve([]);
        case "list_compositions":
          return Promise.resolve([]);
        case "list_scenes_with_children":
          return Promise.resolve(fakeScenes);
        case "list_recent_usage":
          return Promise.resolve(fakeRecent);
        case "count_today_usage":
          return Promise.resolve(0);
        case "list_drafts":
          return Promise.resolve([]);
        case "count_pending_drafts":
          return Promise.resolve(0);
        default:
          return Promise.reject(new Error(`unexpected ${cmd}`));
      }
    });
  });

  // Simulate the Rust-side window hide: flip document.visibilityState to
  // "hidden" (jsdom defaults it to "visible") then dispatch the event App
  // listens on.
  function fireHidden() {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    fireEvent(document, new Event("visibilitychange"));
  }

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("clears a non-empty search query when the window hides", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    useSearchStore.getState().setQuery("借力");
    expect(useSearchStore.getState().query).toBe("借力");
    fireHidden();
    expect(useSearchStore.getState().query).toBe("");
  });

  it("blurs a focused non-text element back to body on hide", async () => {
    render(<App />);
    const card = await screen.findByRole("button", { name: "借力最优解" });
    card.focus();
    expect(document.activeElement).toBe(card);
    fireHidden();
    // Focus归位 so SearchBar's next-wake guard (body-only) can re-grab it.
    expect(document.activeElement).toBe(document.body);
  });

  it("preserves focus on a text input when the window hides (mid-edit exemption)", async () => {
    const { container } = render(<App />);
    await screen.findByRole("button", { name: "借力最优解" });
    const input = container.querySelector(
      "[role='search'] input",
    ) as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);
    fireHidden();
    // A user hiding the window mid-edit keeps the caret; only the query clears.
    expect(document.activeElement).toBe(input);
  });
});
