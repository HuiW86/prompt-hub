import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Macro, PanoramaPlacement, Phase } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { usePanoramaStore } from "../../stores/panoramaStore";
import { usePromptStore } from "../../stores/promptStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import { PanoramaView } from "../panorama/PanoramaView";

const promptInitial = usePromptStore.getState();
const panoramaInitial = usePanoramaStore.getState();
const recent = new Date().toISOString();

const phases: Phase[] = [];

function macro(id: string, name: string): Macro {
  return {
    id,
    name,
    content: `${name} 正文`,
    expandFrom: null,
    native: true,
    role: null,
    task: null,
    usageCount: 3,
    lastUsedAt: recent,
    createdAt: "2025-01-01T00:00:00Z",
    notes: null,
    sceneId: null,
    deprecated: false,
    orderIndex: 0,
  };
}

const macros = [
  macro("a", "审查改动"),
  macro("b", "补测试"),
  macro("c", "列风险"),
];

// In-memory stand-in for the Rust side: upsert, both-null deletes, taking an
// occupied slot clears the holder (and drops it if that leaves it empty).
let table: PanoramaPlacement[] = [];
function setPlacementBackend(input: PanoramaPlacement): PanoramaPlacement[] {
  const same = (p: PanoramaPlacement) =>
    p.assetKind === input.assetKind && p.assetId === input.assetId;
  table = table.filter((p) => !same(p));
  if (input.pinSlot != null) {
    table = table
      .map((p) => (p.pinSlot === input.pinSlot ? { ...p, pinSlot: null } : p))
      .filter((p) => p.groupId != null || p.pinSlot != null);
  }
  if (input.groupId != null || input.pinSlot != null) table.push({ ...input });
  return table.map((p) => ({ ...p }));
}

const setCalls = () =>
  invokeMock.mock.calls
    .filter((c) => c[0] === "set_panorama_placement")
    .map((c) => (c[1] as { input: PanoramaPlacement }).input);

function row(name: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${name}`) });
}

/** A row by asset key — stable while its accessible name changes (a pinned
 *  row's name starts with its slot badge). */
function rowOf(key: string): HTMLElement {
  const el = document.querySelector(`[data-item-key="${key}"] button`);
  if (!(el instanceof HTMLElement)) throw new Error(`no row ${key}`);
  return el;
}

function menu(): HTMLElement {
  return screen.getByRole("group", { name: /的位置$/ });
}

async function renderView() {
  render(<PanoramaView />);
  await waitFor(() => expect(usePanoramaStore.getState().loaded).toBe(true));
}

function selectByClickingPlace(name: string) {
  fireEvent.click(
    screen.getByRole("button", { name: `调整「${name}」的位置` }),
  );
}

describe("PlacementMenu — adjusting group and pin slot in the panorama", () => {
  beforeEach(() => {
    table = [{ assetKind: "macro", assetId: "c", groupId: null, pinSlot: 3 }];
    usePromptStore.setState(promptInitial, true);
    usePromptStore.setState({
      phases,
      macros,
      scenes: [],
      alignmentPhrasesByPhase: {},
      modifiers: [],
      compositionsByPhase: {},
      alignmentAxisValuesById: {},
      loadState: "ready",
    });
    usePanoramaStore.setState(panoramaInitial, true);
    useSettingsStore.setState({
      interactionMode: "organize",
      settingsOpen: false,
    });
    useToastStore.getState().clear();
    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string, args?: unknown) => {
      switch (cmd) {
        case "list_panorama_placements":
          return Promise.resolve(table.map((p) => ({ ...p })));
        case "set_panorama_placement":
          return Promise.resolve(
            setPlacementBackend((args as { input: PanoramaPlacement }).input),
          );
        default:
          return Promise.resolve(undefined);
      }
    });
  });

  it("changing the group sends the full placement and closes the menu", async () => {
    await renderView();
    selectByClickingPlace("审查改动");
    fireEvent.click(within(menu()).getByRole("button", { name: "收敛" }));
    await waitFor(() =>
      expect(setCalls()).toEqual([
        {
          assetKind: "macro",
          assetId: "a",
          groupId: "converge",
          pinSlot: null,
        },
      ]),
    );
    expect(screen.queryByRole("group", { name: /的位置$/ })).toBeNull();
  });

  it("「按默认」 sends groupId: null and keeps the pin slot", async () => {
    table.push({
      assetKind: "macro",
      assetId: "a",
      groupId: "tool",
      pinSlot: 5,
    });
    await renderView();
    selectByClickingPlace("审查改动");
    fireEvent.click(within(menu()).getByRole("button", { name: "按默认" }));
    await waitFor(() =>
      expect(setCalls()).toEqual([
        { assetKind: "macro", assetId: "a", groupId: null, pinSlot: 5 },
      ]),
    );
  });

  it("marks the current choices and names who holds an occupied slot", async () => {
    await renderView();
    selectByClickingPlace("审查改动");
    const m = menu();
    expect(within(m).getByRole("button", { name: "按默认" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(m).getByRole("button", { name: "不占用" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(m).getByRole("button", { name: "常用位 3，当前为「列风险」" }),
    ).toBeInTheDocument();
    expect(
      within(m).getByRole("button", { name: "常用位 4" }),
    ).toBeInTheDocument();
  });

  it("taking an occupied slot shows an undo naming the previous holder; undo restores both", async () => {
    table.push({
      assetKind: "macro",
      assetId: "a",
      groupId: "understand",
      pinSlot: 1,
    });
    await renderView();
    selectByClickingPlace("审查改动");
    fireEvent.click(
      within(menu()).getByRole("button", {
        name: "常用位 3，当前为「列风险」",
      }),
    );
    await waitFor(() =>
      expect(useToastStore.getState().message).toBe(
        "常用位 3 已从「列风险」让给「审查改动」",
      ),
    );
    expect(usePanoramaStore.getState().placements).toEqual(
      expect.arrayContaining([
        { assetKind: "macro", assetId: "a", groupId: "understand", pinSlot: 3 },
      ]),
    );

    const action = useToastStore.getState().action;
    expect(action?.label).toBe("撤销");
    act(() => action?.onClick());
    await waitFor(() => expect(setCalls()).toHaveLength(3));
    expect(setCalls().slice(1)).toEqual([
      { assetKind: "macro", assetId: "a", groupId: "understand", pinSlot: 1 },
      { assetKind: "macro", assetId: "c", groupId: null, pinSlot: 3 },
    ]);
    await waitFor(() =>
      expect(usePanoramaStore.getState().placements).toEqual(
        expect.arrayContaining([
          {
            assetKind: "macro",
            assetId: "a",
            groupId: "understand",
            pinSlot: 1,
          },
          { assetKind: "macro", assetId: "c", groupId: null, pinSlot: 3 },
        ]),
      ),
    );
  });

  it("taking a free slot shows no undo toast", async () => {
    await renderView();
    selectByClickingPlace("审查改动");
    fireEvent.click(within(menu()).getByRole("button", { name: "常用位 4" }));
    await waitFor(() => expect(setCalls()).toHaveLength(1));
    expect(useToastStore.getState().action).toBeNull();
  });

  it("M opens the selected item's menu", async () => {
    await renderView();
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    fireEvent.keyDown(document.body, { key: "m" });
    expect(menu()).toHaveAccessibleName(/的位置$/);
  });

  it("⌥3 pins the selected item to slot 3 and ⌥0 unpins it", async () => {
    await renderView();
    act(() => usePanoramaStore.getState().select("macro:b"));
    // macOS turns ⌥3 into 「£」, so the key is read from `code`.
    fireEvent.keyDown(document.body, {
      key: "£",
      code: "Digit3",
      altKey: true,
    });
    await waitFor(() =>
      expect(setCalls()).toEqual([
        { assetKind: "macro", assetId: "b", groupId: null, pinSlot: 3 },
      ]),
    );
    // 列风险 held slot 3 and had no group, so it lost its row entirely.
    await waitFor(() =>
      expect(
        within(rowOf("macro:b")).getByLabelText("常用位 3"),
      ).toBeInTheDocument(),
    );
    fireEvent.keyDown(document.body, {
      key: "º",
      code: "Digit0",
      altKey: true,
    });
    await waitFor(() =>
      expect(setCalls()[1]).toEqual({
        assetKind: "macro",
        assetId: "b",
        groupId: null,
        pinSlot: null,
      }),
    );
  });

  it("closing the menu returns focus to the item", async () => {
    await renderView();
    selectByClickingPlace("补测试");
    expect(menu()).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: "Escape" });
    expect(screen.queryByRole("group", { name: /的位置$/ })).toBeNull();
    expect(row("补测试")).toHaveFocus();
  });

  it("in invoke mode there is no 位置 button and M opens nothing", async () => {
    useSettingsStore.setState({ interactionMode: "invoke" });
    await renderView();
    expect(screen.queryByRole("button", { name: /^调整「/ })).toBeNull();
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    fireEvent.keyDown(document.body, { key: "m" });
    fireEvent.keyDown(document.body, {
      key: "£",
      code: "Digit3",
      altKey: true,
    });
    await act(async () => {});
    expect(screen.queryByRole("group", { name: /的位置$/ })).toBeNull();
    expect(setCalls()).toHaveLength(0);
  });
});
