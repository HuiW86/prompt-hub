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
import { PhraseFormEditor } from "../primitives/PhraseFormEditor";

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

  it("does not treat a press on the anchor as an outside dismissal", () => {
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    fireEvent.change(screen.getByPlaceholderText("名称"), {
      target: { value: "改名协议" },
    });
    fireEvent.pointerDown(screen.getByRole("button", { name: "默认协议" }));
    // The anchor is the container's own footprint: pressing it neither saves
    // nor closes, it just stays put.
    expect(call("update_alignment_phrase")).toBeUndefined();
    expect(screen.getByRole("group", { name: "编辑对齐话术" })).toBeTruthy();
  });

  it("still answers Escape after a focused descendant unmounts", () => {
    // Guarding Escape on "the panel currently contains activeElement" is too
    // strict: dismissing an inline confirmation by pressing its own cancel
    // button unmounts the focused node, focus falls to <body>, and no focusin
    // fires to say so. The panel would go permanently deaf to Escape until the
    // user clicked back into it — reachable today in the scene properties
    // panel, whose delete confirmation collapses exactly that way.
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    expect(screen.getByRole("group", { name: "编辑对齐话术" })).toBeTruthy();

    // Simulate the focused descendant going away without a replacement.
    act(() => {
      (document.activeElement as HTMLElement | null)?.blur();
    });
    expect(document.activeElement).toBe(document.body);

    fireEvent.keyDown(document, { key: "Escape", bubbles: true });
    expect(screen.queryByRole("group", { name: "编辑对齐话术" })).toBeNull();
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

describe("AnchoredEditor — first focus follows placement (G4 缺陷 D1)", () => {
  beforeEach(seed);

  it("test environment: focus() refuses a hidden element", () => {
    // Guards the setup.ts focus shim. Without it the two tests below pass for
    // the wrong reason — stock jsdom focuses hidden elements, which is exactly
    // how D1 shipped behind a green suite.
    const box = document.createElement("div");
    box.style.visibility = "hidden";
    const input = document.createElement("input");
    box.appendChild(input);
    document.body.appendChild(box);
    try {
      input.focus();
      expect(input).not.toHaveFocus();
      box.style.visibility = "visible";
      input.focus();
      expect(input).toHaveFocus();
    } finally {
      box.remove();
    }
  });

  it("opens with the name field focused", () => {
    // The first thing a user does after opening an editor is type. No 真机门
    // asked this before G4, and v0.2.0 shipped with every editor opening blind.
    render(<AlignmentPhrases />);
    fireEvent.click(screen.getByLabelText("编辑 默认协议"));
    expect(screen.getByPlaceholderText("名称")).toHaveFocus();
  });

  it("refuses focus on display:none, on the element and on any ancestor", () => {
    // The popover's pre-showPopover state is UA-sheet `display: none`, and
    // `display` does not inherit — so this is the shim path that guards the
    // container itself, and the one a careless "simplification" (stop at
    // body, check inline style only) would break without any test noticing.
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    const input = document.createElement("input");
    inner.appendChild(input);
    outer.appendChild(inner);
    document.body.appendChild(outer);
    try {
      outer.style.display = "none";
      input.focus();
      expect(input).not.toHaveFocus();
      outer.style.removeProperty("display");
      input.style.display = "none";
      input.focus();
      expect(input).not.toHaveFocus();
      input.style.removeProperty("display");
      input.focus();
      expect(input).toHaveFocus();
    } finally {
      outer.remove();
    }
  });

  it("holds focus back until the panel is placed, then moves it in", () => {
    const anchor = document.createElement("button");
    document.body.appendChild(anchor);
    const props = {
      presentation: "anchored" as const,
      layer: "protocol" as const,
      mode: "create" as const,
      ariaLabel: "编辑对齐话术",
      submitLabel: "新增",
      onSubmit: () => {},
      onClose: () => {},
    };
    try {
      // No anchor → never placed → the panel stays hidden. A mount-time focus
      // would fire here, against the hidden panel, and land nowhere.
      const { rerender } = render(
        <PhraseFormEditor {...props} anchor={null} />,
      );
      expect(screen.getByPlaceholderText("名称")).not.toHaveFocus();
      // The anchor settles, the panel is placed and shown, focus follows.
      rerender(<PhraseFormEditor {...props} anchor={anchor} />);
      expect(screen.getByPlaceholderText("名称")).toHaveFocus();
    } finally {
      anchor.remove();
    }
  });

  it("repositioning or swapping the anchor does not re-focus the first field", () => {
    // The effect is keyed on "has a position", not the position itself. Keying
    // on the coordinates would pass every test above and still yank focus back
    // to the name field on every scroll or resize mid-edit.
    //
    // jsdom has no layout, so every rect is 0×0 and a scroll would recompute
    // the SAME coordinates — which would let an effect keyed on `top`/`left`
    // slip through. The anchor's rect is stubbed and moved by hand so each
    // recompute lands somewhere new, and the panel's inline `top` is asserted
    // to prove a recompute actually happened.
    const anchorAt = (top: number) => {
      const node = document.createElement("button");
      let rect = {
        top,
        left: 0,
        right: 40,
        bottom: top + 20,
        width: 40,
        height: 20,
      };
      node.getBoundingClientRect = () => rect as DOMRect;
      Object.assign(node, {
        moveTo: (nextTop: number) => {
          rect = { ...rect, top: nextTop, bottom: nextTop + 20 };
        },
      });
      document.body.appendChild(node);
      return node as HTMLButtonElement & { moveTo: (top: number) => void };
    };
    const anchor = anchorAt(100);
    const anchor2 = anchorAt(400);
    const props = {
      presentation: "anchored" as const,
      layer: "protocol" as const,
      mode: "create" as const,
      ariaLabel: "编辑对齐话术",
      submitLabel: "新增",
      onSubmit: () => {},
      onClose: () => {},
    };
    try {
      const { rerender } = render(
        <PhraseFormEditor {...props} anchor={anchor} />,
      );
      const panel = screen.getByRole("group", { name: "编辑对齐话术" });
      const content = screen.getByPlaceholderText("话术内容");
      content.focus();
      expect(content).toHaveFocus();
      const placedAt = panel.style.top;

      anchor.moveTo(250);
      act(() => {
        window.dispatchEvent(new Event("scroll"));
        window.dispatchEvent(new Event("resize"));
      });
      expect(panel.style.top).not.toBe(placedAt);
      expect(content).toHaveFocus();

      const scrolledTo = panel.style.top;
      rerender(<PhraseFormEditor {...props} anchor={anchor2} />);
      expect(panel.style.top).not.toBe(scrolledTo);
      expect(content).toHaveFocus();
    } finally {
      anchor.remove();
      anchor2.remove();
    }
  });

  it("inline presentation focuses the name field on mount", () => {
    // The in-flow fallback keeps its own mount-time focus; nothing in
    // production renders it today, so this is the only thing keeping that
    // branch honest.
    render(
      <PhraseFormEditor
        presentation="inline"
        layer="protocol"
        mode="create"
        ariaLabel="编辑对齐话术"
        submitLabel="新增"
        onSubmit={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText("名称")).toHaveFocus();
  });
});

describe("AnchoredEditor — the container owns the anchor re-press (G4 缺陷 O7)", () => {
  beforeEach(seed);

  // A bare anchor with its own click handler, so these cases measure the
  // primitive rather than any one host's wiring.
  const mountWithAnchor = () => {
    const anchor = document.createElement("button");
    const onAnchorClick = vi.fn();
    anchor.addEventListener("click", onAnchorClick);
    document.body.appendChild(anchor);
    const onClose = vi.fn();
    render(
      <PhraseFormEditor
        presentation="anchored"
        layer="protocol"
        mode="create"
        ariaLabel="编辑对齐话术"
        submitLabel="新增"
        anchor={anchor}
        onSubmit={() => {}}
        onClose={onClose}
      />,
    );
    return { anchor, onAnchorClick, onClose };
  };

  const pressAnchor = (anchor: HTMLElement) => {
    fireEvent.pointerDown(anchor);
    fireEvent.click(anchor);
  };

  it("swallows the anchor's own click instead of dismissing", () => {
    const { anchor, onAnchorClick, onClose } = mountWithAnchor();
    try {
      pressAnchor(anchor);
      // No host implements a toggle, and on the chip / card hosts this click
      // is COPY — letting it through would copy out from under an open editor
      // (and hide the window in 调用态).
      expect(onAnchorClick).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("group", { name: "编辑对齐话术" })).toBeTruthy();
    } finally {
      anchor.remove();
    }
  });

  it("pulls focus back to the first field when it had fallen out", () => {
    const { anchor } = mountWithAnchor();
    try {
      // O7 as observed: the press moved focus onto the anchor, typing went
      // nowhere and Escape reached the window instead of the panel. jsdom
      // cannot run mousedown's default focus action, so the state it produces
      // is staged directly — focus sitting outside the panel.
      act(() => {
        (document.activeElement as HTMLElement | null)?.blur();
      });
      expect(document.activeElement).toBe(document.body);

      pressAnchor(anchor);
      expect(screen.getByPlaceholderText("名称")).toHaveFocus();
    } finally {
      anchor.remove();
    }
  });

  it("leaves focus alone when it is already inside the panel", () => {
    const { anchor } = mountWithAnchor();
    try {
      const content = screen.getByPlaceholderText("话术内容");
      content.focus();
      expect(content).toHaveFocus();

      // Reclaiming focus unconditionally would yank the caret out of the field
      // being typed into and back to the name — a fix worse than the defect.
      pressAnchor(anchor);
      expect(content).toHaveFocus();
    } finally {
      anchor.remove();
    }
  });
});
