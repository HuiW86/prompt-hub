import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AlignmentPhrase } from "../../ipc/types";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { useAppStore } from "../../stores/appStore";
import { usePromptStore } from "../../stores/promptStore";
import { useToastStore } from "../../stores/toastStore";
import { AlignmentPhrases } from "../AlignmentPhrases";

const promptInitial = usePromptStore.getState();
const appInitial = useAppStore.getState();

function makePhrase(over: Partial<AlignmentPhrase>): AlignmentPhrase {
  return {
    id: "ap-1",
    phaseId: "phase-1",
    name: "默认协议",
    content: "请遵循协议对齐。",
    isDefault: true,
    usageCount: 0,
    lastUsedAt: null,
    createdAt: "2026-05-23T00:00:00Z",
    notes: null,
    deprecated: false,
    orderIndex: 0,
    ...over,
  };
}

function seed() {
  usePromptStore.setState(promptInitial, true);
  useAppStore.setState(appInitial, true);
  usePromptStore.setState({
    alignmentPhrasesByPhase: {
      "phase-1": [
        makePhrase({ id: "ap-1", name: "默认协议", isDefault: true }),
      ],
    },
  });
  useAppStore.setState({ activePhaseId: "phase-1" });
  useToastStore.getState().clear();
  invokeMock.mockReset();
  invokeMock.mockResolvedValue({ ok: true });
}

const call = (name: string) => invokeMock.mock.calls.find((c) => c[0] === name);

// The pointerdown listener is registered on document in the capture phase, so
// firing on document.body reaches it exactly as a real outside click would.
const clickOutside = () => fireEvent.pointerDown(document.body);

describe("AnchoredEditor — top-layer container (ADR-025 子决策 1)", () => {
  beforeEach(seed);

  it("renders the editor as a manual popover and opens it", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    const panel = screen.getByRole("group", { name: "编辑对齐话术" });
    expect(panel.getAttribute("popover")).toBe("manual");
    // Exercised through the jsdom shim — this proves the open/close plumbing is
    // wired, NOT that a real top layer escapes the band's overflow: hidden.
    // That belongs to the G1 真机验收门.
    expect(panel.matches(":popover-open")).toBe(true);
  });

  it("keeps the trigger chip mounted while its editor is open", () => {
    render(<AlignmentPhrases />);
    // Pre-ADR-025 the editor REPLACED the chip; it is now the anchor, so it has
    // to survive — a vanished anchor would leave the panel with nothing to pin
    // to and would collapse the row slot under it.
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    expect(
      screen.getByRole("button", { name: "默认协议" }),
    ).toBeInTheDocument();
  });

  it("returns focus to the trigger chip after closing", () => {
    render(<AlignmentPhrases />);
    const chip = screen.getByRole("button", { name: "默认协议" });
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    fireEvent.keyDown(screen.getByPlaceholderText("名称"), { key: "Escape" });
    expect(document.activeElement).toBe(chip);
  });

  it("treats pressing the anchor itself as a toggle, not an outside dismissal", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "改名协议" },
    });
    fireEvent.pointerDown(screen.getByRole("button", { name: "默认协议" }));
    // Saving here would fight the chip's own click handler and re-open the
    // editor on the very element that dismissed it.
    expect(call("update_alignment_phrase")).toBeUndefined();
  });
});

describe("AnchoredEditor — dismissal rules (ADR-025 子决策 2)", () => {
  beforeEach(seed);

  it("click outside with a valid, dirty draft saves and closes", async () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "改名协议" },
    });
    clickOutside();
    await waitFor(() => expect(call("update_alignment_phrase")).toBeTruthy());
    expect(
      (call("update_alignment_phrase")?.[1] as { name: string }).name,
    ).toBe("改名协议");
  });

  it("click outside with an unchanged draft closes without an IPC round trip", async () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    clickOutside();
    await waitFor(() =>
      expect(screen.queryByPlaceholderText("名称")).toBeNull(),
    );
    expect(call("update_alignment_phrase")).toBeUndefined();
  });

  it("click outside with a failing draft holds the panel open and says why", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    const nameField = screen.getByPlaceholderText("名称");
    fireEvent.change(nameField, { target: { value: "  " } });
    clickOutside();
    // Half a phrase must never be dropped just because the user looked away.
    expect(
      screen.getByRole("group", { name: "编辑对齐话术" }),
    ).toBeInTheDocument();
    expect(call("update_alignment_phrase")).toBeUndefined();
    expect(nameField).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("status")).toHaveTextContent("不能为空");
  });

  it("typing clears the refusal marker", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    const nameField = screen.getByPlaceholderText("名称");
    fireEvent.change(nameField, { target: { value: "" } });
    clickOutside();
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.change(nameField, { target: { value: "改名协议" } });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("Escape discards an edit without saving", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "改名协议" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("名称"), { key: "Escape" });
    expect(call("update_alignment_phrase")).toBeUndefined();
    expect(screen.queryByPlaceholderText("名称")).toBeNull();
    // No undo toast: the original row is untouched in the DB, so there is
    // nothing lost to offer back (子决策 2 的规则表最后一行).
    expect(useToastStore.getState().action).toBeNull();
  });

  it("Escape on a dirty create draft offers an undo that restores the text", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("新增对齐话术"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "草稿名" },
    });
    fireEvent.change(screen.getByPlaceholderText("话术内容"), {
      target: { value: "草稿内容" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("名称"), { key: "Escape" });
    expect(call("create_alignment_phrase")).toBeUndefined();

    // A discarded creation exists nowhere else, so the toast is its only route
    // back — and it must return the actual text, not just re-open a blank form.
    const toast = useToastStore.getState();
    expect(toast.message).toBe("已放弃草稿");
    expect(toast.action?.label).toBe("撤销");
    act(() => toast.action?.onClick());

    expect(
      (screen.getByPlaceholderText("名称") as HTMLInputElement).value,
    ).toBe("草稿名");
    expect(
      (screen.getByPlaceholderText("话术内容") as HTMLTextAreaElement).value,
    ).toBe("草稿内容");
  });

  it("Escape on an untouched create form discards silently", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("新增对齐话术"));
    fireEvent.keyDown(screen.getByPlaceholderText("名称"), { key: "Escape" });
    expect(screen.queryByPlaceholderText("名称")).toBeNull();
    // Nothing was typed, so there is nothing to offer an undo for.
    expect(useToastStore.getState().action).toBeNull();
  });

  it("saves an undo-restored draft on click outside", async () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("新增对齐话术"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "草稿名" },
    });
    fireEvent.change(screen.getByPlaceholderText("话术内容"), {
      target: { value: "草稿内容" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("名称"), { key: "Escape" });
    act(() => useToastStore.getState().action?.onClick());

    // The restored draft is prefilled, so measuring dirty against the seed made
    // it read "unchanged" and the not-dirty branch closed the panel without
    // ever calling onSubmit: undo handed the text back, then the documented
    // "click outside = save" destroyed it with no toast and no row.
    clickOutside();
    await waitFor(() => expect(call("create_alignment_phrase")).toBeTruthy());
    expect(
      (call("create_alignment_phrase")?.[1] as { name: string }).name,
    ).toBe("草稿名");
  });

  it("the 取消 button runs the same abandon rule as Escape", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("新增对齐话术"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "草稿名" },
    });
    fireEvent.change(screen.getByPlaceholderText("话术内容"), {
      target: { value: "草稿内容" },
    });
    // 取消 used to be wired straight to onClose, so the identical draft got an
    // undo toast by keyboard and silent destruction by mouse.
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(call("create_alignment_phrase")).toBeUndefined();
    expect(useToastStore.getState().action?.label).toBe("撤销");
  });

  it("reports a save that fails on the way out", async () => {
    // A SQLite-flavoured reject, i.e. the debug-noise class that toUserMessage
    // deliberately replaces with the caller's actionable fallback.
    invokeMock.mockRejectedValue("database is locked");
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "改名协议" },
    });
    // An outside-click save lands after the user has looked away, so silence
    // here is indistinguishable from success — the panel would sit there
    // looking saved while nothing reached the DB.
    clickOutside();
    await waitFor(() =>
      expect(useToastStore.getState().message).toBe("保存失败"),
    );
    expect(useToastStore.getState().intent).toBe("error");
    expect(screen.getByPlaceholderText("名称")).toBeInTheDocument();
  });
});

describe("AnchoredEditor — a refused dismissal locks the press (ADR-025 子决策 2)", () => {
  beforeEach(seed);

  it("does not let the refused press reach another row's edit button", () => {
    usePromptStore.setState({
      alignmentPhrasesByPhase: {
        "phase-1": [
          makePhrase({ id: "ap-1", name: "默认协议", isDefault: true }),
          makePhrase({ id: "ap-2", name: "第二条", isDefault: false }),
        ],
      },
    });
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    const nameField = screen.getByPlaceholderText("名称");
    fireEvent.change(nameField, { target: { value: "  " } });

    // `editingId` is a single slot: pointerdown refuses and holds this panel
    // open, then the very same press lands as a click on the other row's
    // pencil, reassigns the slot and unmounts the panel that just refused —
    // draft and all. "不关闭" has to mean the press does nothing at all.
    const other = screen.getByLabelText("编辑 第二条");
    fireEvent.pointerDown(other);
    fireEvent.click(other);

    expect(screen.getByRole("group", { name: "编辑对齐话术" })).toBeTruthy();
    expect(
      (screen.getByPlaceholderText("名称") as HTMLInputElement).value,
    ).toBe("  ");
    expect(screen.getByRole("status")).toHaveTextContent("不能为空");
  });

  it("re-arms per press, so a later legitimate click still lands", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    const nameField = screen.getByPlaceholderText("名称");
    fireEvent.change(nameField, { target: { value: "" } });
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);

    // The swallow is scoped to the refused press. Fixing the field and pressing
    // again must behave normally — a lock that outlived its cause would be the
    // same defect with the sign flipped.
    fireEvent.change(nameField, { target: { value: "改名协议" } });
    fireEvent.pointerDown(document.body);
    expect(call("update_alignment_phrase")).toBeTruthy();
  });
});
