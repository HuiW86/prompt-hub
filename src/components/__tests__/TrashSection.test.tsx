import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssetKind, PurgeSummary, TrashEntry } from "../../ipc";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// SettingsModal pulls in the native dialogs at module load; the trash tests
// never reach them, but the import has to resolve under jsdom.
vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(),
  open: vi.fn(),
  confirm: vi.fn(),
}));

import { usePromptStore } from "../../stores/promptStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import { SettingsModal } from "../SettingsModal";

const promptInitial = usePromptStore.getState();
const settingsInitial = useSettingsStore.getState();
const toastInitial = useToastStore.getState();

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

function entry(
  kind: AssetKind,
  id: string,
  label: string,
  days = 1,
): TrashEntry {
  return { kind, id, label, deletedAt: daysAgo(days) };
}

// One row per asset kind — the trash is the only surface that renders all seven
// in the same list, so a missing KIND_LABEL would show up here and nowhere else.
const ALL_KINDS: TrashEntry[] = [
  entry("modifier", "m1", "简洁措辞", 1),
  entry("macro", "k1", "每日站会", 2),
  entry("composition", "c1", "重构套装", 3),
  entry("alignment_phrase", "a1", "先给方案", 4),
  entry("phrase", "p1", "补充上下文", 5),
  entry("scene", "s1", "写作", 6),
  entry("sub_stage", "b1", "初稿", 7),
];

describe("TrashSection — settings 数据 page trash view (ADR-028 P1)", () => {
  // Read at call time, so a test can change what the NEXT read returns and
  // prove the list was re-pulled rather than remembered.
  let trashRows: TrashEntry[];
  let purgeResult: PurgeSummary | Error;
  let restoreAssetMock: ReturnType<
    typeof vi.fn<(kind: AssetKind, id: string) => Promise<void>>
  >;

  beforeEach(() => {
    usePromptStore.setState(promptInitial, true);
    useSettingsStore.setState(settingsInitial, true);
    useToastStore.setState(toastInitial, true);
    useSettingsStore.setState({ settingsOpen: true });

    trashRows = [];
    purgeResult = { assets: 0, usageRecords: 0 };
    restoreAssetMock = vi
      .fn<(kind: AssetKind, id: string) => Promise<void>>()
      .mockResolvedValue(undefined);
    usePromptStore.setState({ restoreAsset: restoreAssetMock });

    invokeMock.mockReset();
    invokeMock.mockImplementation((cmd: string) => {
      if (cmd === "list_trash") return Promise.resolve(trashRows);
      if (cmd === "purge_trash") {
        return purgeResult instanceof Error
          ? Promise.reject(purgeResult)
          : Promise.resolve(purgeResult);
      }
      return Promise.resolve(undefined);
    });
  });

  async function openDataTab() {
    render(<SettingsModal />);
    fireEvent.click(screen.getByRole("button", { name: "数据" }));
    // The section reads the trash on mount; wait for that first read to land so
    // no assertion runs against the 正在读取… phase.
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("list_trash"));
    await screen.findByRole("region", { name: "废纸篓" });
  }

  const purgeButton = () => screen.getByRole("button", { name: /清空废纸篓/ });
  const listTrashCalls = () =>
    invokeMock.mock.calls.filter(([cmd]) => cmd === "list_trash").length;

  it("states how many items are in the trash", async () => {
    trashRows = ALL_KINDS;
    await openDataTab();

    expect(await screen.findByText("7 项")).toBeInTheDocument();
  });

  it("lists every asset kind with its label and when it was deleted", async () => {
    trashRows = ALL_KINDS;
    await openDataTab();

    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(7);

    for (const [i, kindLabel] of [
      "Modifier",
      "Macro",
      "Composition",
      "对齐话术",
      "话术",
      "场景",
      "子阶段",
    ].entries()) {
      expect(rows[i]).toHaveTextContent(kindLabel);
      expect(rows[i]).toHaveTextContent(ALL_KINDS[i].label);
      expect(rows[i]).toHaveTextContent(`${i + 1}天前`);
    }
  });

  it("恢复 goes through the store and the row leaves the list", async () => {
    trashRows = [
      entry("macro", "k1", "每日站会"),
      entry("phrase", "p1", "补充上下文"),
    ];
    await openDataTab();

    // The restored row is gone from what the next read returns — the list must
    // reflect the backend, not a local splice.
    restoreAssetMock.mockImplementation(async () => {
      trashRows = [entry("phrase", "p1", "补充上下文")];
    });

    fireEvent.click(screen.getByRole("button", { name: "恢复「每日站会」" }));

    await waitFor(() =>
      expect(restoreAssetMock).toHaveBeenCalledWith("macro", "k1"),
    );
    await waitFor(() =>
      expect(screen.queryByText("每日站会")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("补充上下文")).toBeInTheDocument();
    expect(await screen.findByText("1 项")).toBeInTheDocument();
    expect(useToastStore.getState().message).toBe("已恢复「每日站会」");
  });

  it("a failed 恢复 surfaces an error instead of looking like a success", async () => {
    trashRows = [entry("macro", "k1", "每日站会")];
    await openDataTab();

    // The realistic failure: the row was purged from another window.
    restoreAssetMock.mockRejectedValue("target not found");

    fireEvent.click(screen.getByRole("button", { name: "恢复「每日站会」" }));

    await waitFor(() => expect(useToastStore.getState().intent).toBe("error"));
    expect(useToastStore.getState().message).toBe(
      "目标不存在，可能已被删除，请刷新后重试。",
    );
    // Reconciled either way, so a row that is really gone stops being offered.
    await waitFor(() => expect(listTrashCalls()).toBe(2));
  });

  it("清空废纸篓 destroys nothing until the confirm is taken", async () => {
    trashRows = [entry("macro", "k1", "每日站会")];
    await openDataTab();

    fireEvent.click(purgeButton());

    expect(
      screen.getByRole("alertdialog", {
        name: "彻底删除废纸篓中的 1 项，删除后无法恢复",
      }),
    ).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith("purge_trash");
  });

  it("取消 dismisses the confirm and leaves the trash intact", async () => {
    trashRows = [entry("macro", "k1", "每日站会")];
    await openDataTab();

    fireEvent.click(purgeButton());
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(purgeButton()).toBeInTheDocument();
    expect(invokeMock).not.toHaveBeenCalledWith("purge_trash");
    expect(screen.getByText("每日站会")).toBeInTheDocument();
  });

  it("confirming the purge empties the trash and reports what it destroyed", async () => {
    trashRows = [
      entry("macro", "k1", "每日站会"),
      entry("scene", "s1", "写作"),
    ];
    purgeResult = { assets: 2, usageRecords: 5 };
    await openDataTab();

    fireEvent.click(purgeButton());
    trashRows = [];
    fireEvent.click(screen.getByRole("button", { name: "确认清空" }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("purge_trash"));
    expect(
      await screen.findByText("已彻底删除 2 项资产与 5 条使用记录"),
    ).toBeInTheDocument();
    // Nothing the user could still be looking at survives the purge.
    expect(screen.queryByText("每日站会")).not.toBeInTheDocument();
    expect(await screen.findByText("废纸篓是空的")).toBeInTheDocument();
    expect(screen.getByText("0 项")).toBeInTheDocument();
  });

  it("a double press of 确认清空 purges once", async () => {
    trashRows = [entry("macro", "k1", "每日站会")];
    purgeResult = { assets: 1, usageRecords: 0 };
    await openDataTab();

    fireEvent.click(purgeButton());
    const confirm = screen.getByRole("button", { name: "确认清空" });
    // Both clicks land before React can re-render the confirm away — only the
    // synchronous latch stops the second one.
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(
        invokeMock.mock.calls.filter(([cmd]) => cmd === "purge_trash").length,
      ).toBe(1),
    );
  });

  it("a failed purge says so and keeps the trash on screen", async () => {
    trashRows = [entry("macro", "k1", "每日站会")];
    purgeResult = new Error("database is locked");
    await openDataTab();

    fireEvent.click(purgeButton());
    fireEvent.click(screen.getByRole("button", { name: "确认清空" }));

    expect(
      await screen.findByText("清空废纸篓失败，请稍后重试"),
    ).toBeInTheDocument();
    expect(screen.getByText("每日站会")).toBeInTheDocument();
  });

  it("shows an empty state and no purge control when the trash is empty", async () => {
    await openDataTab();

    expect(await screen.findByText("废纸篓是空的")).toBeInTheDocument();
    expect(screen.getByText("0 项")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "废纸篓条目" })).toBeNull();
    expect(purgeButton()).toBeDisabled();
  });

  it("re-reads the trash every time the 数据 page is opened", async () => {
    await openDataTab();
    expect(listTrashCalls()).toBe(1);
    expect(await screen.findByText("废纸篓是空的")).toBeInTheDocument();

    // Stand-in for a delete made while settings were elsewhere — reopening the
    // page has to show it, which is what the undo window depends on.
    trashRows = [entry("phrase", "p1", "补充上下文", 0)];
    fireEvent.click(screen.getByRole("button", { name: "外观" }));
    fireEvent.click(screen.getByRole("button", { name: "数据" }));

    await waitFor(() => expect(listTrashCalls()).toBe(2));
    expect(await screen.findByText("补充上下文")).toBeInTheDocument();
    expect(screen.getByText("1 项")).toBeInTheDocument();
  });

  it("a failed read never claims the trash is empty", async () => {
    invokeMock.mockImplementation((cmd: string) =>
      cmd === "list_trash"
        ? Promise.reject(new Error("database is locked"))
        : Promise.resolve(undefined),
    );
    await openDataTab();

    expect(
      await screen.findByText("读取废纸篓失败，请重新打开设置"),
    ).toBeInTheDocument();
    expect(screen.queryByText("废纸篓是空的")).toBeNull();
    expect(screen.queryByText("0 项")).toBeNull();
  });
});
