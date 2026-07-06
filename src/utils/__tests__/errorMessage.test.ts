import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toUserMessage } from "../errorMessage";

describe("toUserMessage", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Silence and observe the raw-error logging the funnel must always do.
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it("always console.error's the raw value it was given", () => {
    const raw = new Error("io: No such file or directory (os error 2)");
    toUserMessage(raw, "fallback");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(raw);
  });

  it("passes an already-Chinese message through untouched (whitelist)", () => {
    // Frontend fallbacks (and any future Chinese Rust string) are user-facing.
    const err = new Error("场景仍有子阶段，无法删除");
    expect(toUserMessage(err, "删除失败")).toBe("场景仍有子阶段，无法删除");
  });

  it("maps a known English business reject to actionable Chinese", () => {
    // RepoError::SceneNotEmpty as it serializes over IPC.
    const err = new Error(
      "scene `s1` is not empty (has phrases or sub-stages) and cannot be deleted",
    );
    expect(toUserMessage(err, "删除失败")).toBe(
      "该场景仍有子阶段或话术，请先清空后再删除。",
    );
  });

  it("maps the default-alignment-phrase reject", () => {
    // RepoError::DefaultAlignmentPhraseProtected.
    const err = new Error(
      "alignment phrase `p1` is its phase default and cannot be deleted",
    );
    expect(toUserMessage(err, "删除失败")).toBe(
      "该话术是当前阶段的默认协议，不能删除；请先将其他话术设为默认。",
    );
  });

  it("maps the payload-too-large reject", () => {
    // RepoError::PayloadTooLarge.
    const err = new Error("payload is 70000 bytes, over the 65536-byte limit");
    expect(toUserMessage(err, "保存失败")).toBe(
      "内容体积超出上限（64KB），请精简后再保存。",
    );
  });

  it("falls back for unknown / IO / SQLite errors", () => {
    // English debug forms unfit to show a user → caller's fallback wins.
    expect(
      toUserMessage(
        new Error("io: No such file or directory (os error 2)"),
        "导出失败：无法写入所选位置",
      ),
    ).toBe("导出失败：无法写入所选位置");
    expect(
      toUserMessage(new Error("sqlite: database is locked"), "保存失败"),
    ).toBe("保存失败");
  });

  it("falls back for a non-Error thrown value", () => {
    expect(toUserMessage("boom", "删除失败")).toBe("删除失败");
    expect(toUserMessage(undefined, "删除失败")).toBe("删除失败");
    expect(toUserMessage({ code: 42 }, "删除失败")).toBe("删除失败");
    // Even non-Error inputs are logged raw for triage.
    expect(errorSpy).toHaveBeenCalledWith("boom");
  });

  it("reads a raw IPC string error the same as an Error message", () => {
    // Tauri IPC rejects with a plain string, not an Error instance.
    const rejected = "scene `s1` is not empty and cannot be deleted";
    expect(toUserMessage(rejected, "删除失败")).toBe(
      "该场景仍有子阶段或话术，请先清空后再删除。",
    );
  });
});
