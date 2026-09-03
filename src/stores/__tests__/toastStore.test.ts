import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToastStore } from "../toastStore";

const initial = useToastStore.getState();

beforeEach(() => {
  vi.useFakeTimers();
  useToastStore.setState(initial, true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("toastStore", () => {
  it("show populates message and flashTargetId", () => {
    useToastStore.getState().show("已复制", "card-1");
    const s = useToastStore.getState();
    expect(s.message).toBe("已复制");
    expect(s.flashTargetId).toBe("card-1");
  });

  it("auto-clears after 800ms", () => {
    useToastStore.getState().show("已复制");
    vi.advanceTimersByTime(799);
    expect(useToastStore.getState().message).toBe("已复制");
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().message).toBeNull();
  });

  it("second show with identical message is NOT cleared by the first timer", () => {
    // Regression: previously token = message, so two "已复制" toasts in
    // succession let the first 800ms timer wipe the second one prematurely.
    useToastStore.getState().show("已复制", "card-1");
    vi.advanceTimersByTime(500);
    useToastStore.getState().show("已复制", "card-2");
    // First toast's timer fires at t=800ms; the message is still "已复制"
    // but the seq has advanced, so it must NOT clear.
    vi.advanceTimersByTime(300);
    const mid = useToastStore.getState();
    expect(mid.message).toBe("已复制");
    expect(mid.flashTargetId).toBe("card-2");
    // Second toast's own timer fires at t=500+800=1300ms total -> +500 more.
    vi.advanceTimersByTime(500);
    expect(useToastStore.getState().message).toBeNull();
  });

  it("defaults intent to success with the 800ms window", () => {
    useToastStore.getState().show("已复制");
    expect(useToastStore.getState().intent).toBe("success");
    vi.advanceTimersByTime(800);
    expect(useToastStore.getState().message).toBeNull();
  });

  it("error intent stays visible for 4000ms", () => {
    useToastStore.getState().show("复制失败", undefined, "error");
    const s = useToastStore.getState();
    expect(s.message).toBe("复制失败");
    expect(s.intent).toBe("error");
    vi.advanceTimersByTime(3999);
    expect(useToastStore.getState().message).toBe("复制失败");
    vi.advanceTimersByTime(1);
    const cleared = useToastStore.getState();
    expect(cleared.message).toBeNull();
    // Intent resets so the next default toast renders neutral again.
    expect(cleared.intent).toBe("success");
  });

  it("success toast shown after an error is not wiped by the error timer", () => {
    useToastStore.getState().show("复制失败", undefined, "error");
    vi.advanceTimersByTime(1000);
    useToastStore.getState().show("已复制");
    expect(useToastStore.getState().intent).toBe("success");
    // Error timer fires at t=4000 (3000ms later) but seq has advanced —
    // meanwhile the success timer at t=1000+800 clears it first.
    vi.advanceTimersByTime(800);
    expect(useToastStore.getState().message).toBeNull();
    vi.advanceTimersByTime(2200);
    expect(useToastStore.getState().message).toBeNull();
  });

  it("showError shows an error-intent toast with the 4000ms window", () => {
    useToastStore.getState().showError("保存失败");
    const s = useToastStore.getState();
    expect(s.message).toBe("保存失败");
    expect(s.intent).toBe("error");
    expect(s.flashTargetId).toBeNull();
    vi.advanceTimersByTime(3999);
    expect(useToastStore.getState().message).toBe("保存失败");
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().message).toBeNull();
  });

  it("showWithAction carries an action and dwells 6000ms (D-5)", () => {
    const onClick = vi.fn();
    useToastStore.getState().showWithAction("已丢弃「X」", {
      label: "撤销",
      onClick,
    });
    const s = useToastStore.getState();
    expect(s.message).toBe("已丢弃「X」");
    expect(s.intent).toBe("success");
    expect(s.action?.label).toBe("撤销");
    // The action window is longer than a plain success flash so 撤销 stays
    // clickable — still present at 5999ms, gone at 6000ms.
    vi.advanceTimersByTime(5999);
    expect(useToastStore.getState().message).toBe("已丢弃「X」");
    vi.advanceTimersByTime(1);
    const cleared = useToastStore.getState();
    expect(cleared.message).toBeNull();
    expect(cleared.action).toBeNull();
  });

  it("clear() drops a pending action toast", () => {
    useToastStore
      .getState()
      .showWithAction("已丢弃", { label: "撤销", onClick: vi.fn() });
    useToastStore.getState().clear();
    const s = useToastStore.getState();
    expect(s.message).toBeNull();
    expect(s.action).toBeNull();
  });

  // ── ADR-028: a pending undo outranks plain toasts ────────────────────────
  // Before this guard, any later toast overwrote message/action/seq in one set,
  // so a success flash fired inside the 6000ms window silently destroyed the
  // only route back from a delete.

  it("a success toast fired during a pending undo does not clear the undo", () => {
    const onClick = vi.fn();
    useToastStore.getState().showWithAction("已删除「X」", {
      label: "撤销",
      onClick,
    });
    vi.advanceTimersByTime(1000);
    useToastStore.getState().show("已复制", "card-1");
    const s = useToastStore.getState();
    expect(s.message).toBe("已删除「X」");
    expect(s.action?.label).toBe("撤销");
    // The dropped toast leaves no trace at all — including its flash target.
    expect(s.flashTargetId).toBeNull();
  });

  it("an error toast DOES displace a pending undo, because a hidden failure is worse", () => {
    // The shield protects the undo from confirmatory noise, not from bad news.
    // Swallowing an error would tell the user an operation succeeded when it
    // failed; losing the undo button costs a shortcut to a state that is still
    // sitting in the trash (ADR-028 P1 surfaces it).
    useToastStore
      .getState()
      .showWithAction("已删除「X」", { label: "撤销", onClick: vi.fn() });
    useToastStore.getState().showError("复制失败");
    const s = useToastStore.getState();
    expect(s.message).toBe("复制失败");
    expect(s.intent).toBe("error");
    expect(s.action).toBeNull();
  });

  it("the undo still expires on its own schedule after being shielded", () => {
    useToastStore
      .getState()
      .showWithAction("已删除「X」", { label: "撤销", onClick: vi.fn() });
    vi.advanceTimersByTime(1000);
    // A dropped toast must neither extend nor shorten the original window.
    useToastStore.getState().show("已复制");
    vi.advanceTimersByTime(4999);
    expect(useToastStore.getState().message).toBe("已删除「X」");
    vi.advanceTimersByTime(1);
    const cleared = useToastStore.getState();
    expect(cleared.message).toBeNull();
    expect(cleared.action).toBeNull();
  });

  it("a plain toast is shown again once the undo window has closed", () => {
    useToastStore
      .getState()
      .showWithAction("已删除「X」", { label: "撤销", onClick: vi.fn() });
    vi.advanceTimersByTime(6000);
    useToastStore.getState().show("已复制", "card-1");
    const s = useToastStore.getState();
    expect(s.message).toBe("已复制");
    expect(s.flashTargetId).toBe("card-1");
  });

  it("a second undo replaces the first (one pending undo at a time)", () => {
    const first = vi.fn();
    const second = vi.fn();
    useToastStore
      .getState()
      .showWithAction("已删除「X」", { label: "撤销", onClick: first });
    vi.advanceTimersByTime(1000);
    useToastStore
      .getState()
      .showWithAction("已删除「Y」", { label: "撤销", onClick: second });
    expect(useToastStore.getState().message).toBe("已删除「Y」");
    useToastStore.getState().action?.onClick();
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    // The replacement runs a FULL window from its own arm time, and the first
    // toast's timer must not cut it short at t=6000.
    vi.advanceTimersByTime(5999);
    expect(useToastStore.getState().message).toBe("已删除「Y」");
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().message).toBeNull();
  });

  it("clear() reopens the channel so an undo's own follow-up toast lands", () => {
    // The Toast component runs action.onClick() then clear(); the undo handler
    // then toasts its own result. That confirmation must not be swallowed.
    useToastStore
      .getState()
      .showWithAction("已删除「X」", { label: "撤销", onClick: vi.fn() });
    useToastStore.getState().clear();
    useToastStore.getState().show("已恢复「X」");
    expect(useToastStore.getState().message).toBe("已恢复「X」");
  });

  it("clear() invalidates pending timers", () => {
    useToastStore.getState().show("已复制");
    useToastStore.getState().clear();
    expect(useToastStore.getState().message).toBeNull();
    // The original timer will fire but seq has advanced, so it must not
    // wipe a subsequently-shown toast.
    useToastStore.getState().show("新提示");
    vi.advanceTimersByTime(801);
    // Both the original timer (no-op due to seq mismatch) and the new
    // timer (fires at 801ms, message gets cleared) have fired.
    expect(useToastStore.getState().message).toBeNull();
  });
});
