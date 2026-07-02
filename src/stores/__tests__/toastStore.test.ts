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
