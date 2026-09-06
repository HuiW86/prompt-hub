import { describe, expect, it } from "vitest";

import type { AlignmentAxisValue } from "../../ipc/types";
import {
  buildAlignmentCopyText,
  formatAlignmentCoordinates,
} from "../alignmentCopyText";

function value(
  id: string,
  axis: AlignmentAxisValue["axis"],
  name: string,
): AlignmentAxisValue {
  return { id, axis, name, hint: null, orderIndex: 0 };
}

const BY_ID: Record<string, AlignmentAxisValue> = {
  "axv-layer-path": value("axv-layer-path", "layer", "路径"),
  "axv-domain-tech": value("axv-domain-tech", "domain", "技术"),
  "axv-mode-converge": value("axv-mode-converge", "mode", "收敛"),
};

function phrase(
  over: Partial<{
    content: string;
    layerId: string | null;
    domainId: string | null;
    modeId: string | null;
  }> = {},
) {
  return {
    content: "先把边界说清楚。",
    layerId: null,
    domainId: null,
    modeId: null,
    ...over,
  };
}

describe("buildAlignmentCopyText — 06-prd §6.6 复制文本的拼装", () => {
  it("returns the content byte-identical when all three axes are NULL", () => {
    const p = phrase();
    const out = buildAlignmentCopyText(p, BY_ID);
    expect(out).toBe(p.content);
    // Not "starts with" — a stray newline or trailing space would be a
    // regression for every pre-ADR-029 phrase in the user's library.
    expect(out).toBe("先把边界说清楚。");
  });

  it("writes only the layer segment when only the layer is set", () => {
    expect(
      buildAlignmentCopyText(phrase({ layerId: "axv-layer-path" }), BY_ID),
    ).toBe("本轮在路径层。\n先把边界说清楚。");
  });

  it("writes only the domain segment when only the domain is set", () => {
    expect(
      buildAlignmentCopyText(phrase({ domainId: "axv-domain-tech" }), BY_ID),
    ).toBe("只谈技术闭环。\n先把边界说清楚。");
  });

  it("writes only the mode segment when only the mode is set", () => {
    expect(
      buildAlignmentCopyText(phrase({ modeId: "axv-mode-converge" }), BY_ID),
    ).toBe("收敛模式。\n先把边界说清楚。");
  });

  it("joins two segments with 「，」 and drops the empty one entirely", () => {
    expect(
      buildAlignmentCopyText(
        phrase({ layerId: "axv-layer-path", modeId: "axv-mode-converge" }),
        BY_ID,
      ),
    ).toBe("本轮在路径层，收敛模式。\n先把边界说清楚。");
  });

  it("keeps the fixed 层 → 域 → 模式 order with all three set", () => {
    expect(
      buildAlignmentCopyText(
        phrase({
          modeId: "axv-mode-converge",
          domainId: "axv-domain-tech",
          layerId: "axv-layer-path",
        }),
        BY_ID,
      ),
    ).toBe("本轮在路径层，只谈技术闭环，收敛模式。\n先把边界说清楚。");
  });

  // Deleting an axis value blanks the column server-side, so a render between
  // the delete and the re-pull holds an id nobody can name. Treating it as NULL
  // is what the database row already says.
  it("treats an unresolvable id as NULL", () => {
    expect(
      buildAlignmentCopyText(
        phrase({ layerId: "axv-deleted", modeId: "axv-mode-converge" }),
        BY_ID,
      ),
    ).toBe("收敛模式。\n先把边界说清楚。");
    expect(
      buildAlignmentCopyText(phrase({ layerId: "axv-deleted" }), BY_ID),
    ).toBe("先把边界说清楚。");
  });
});

describe("formatAlignmentCoordinates — chip short label", () => {
  it("returns null when nothing resolves, so the chip renders no element", () => {
    expect(formatAlignmentCoordinates(phrase(), BY_ID)).toBeNull();
    expect(
      formatAlignmentCoordinates(phrase({ domainId: "axv-gone" }), BY_ID),
    ).toBeNull();
  });

  it("joins the resolved names with ' · ' in 层 · 域 · 模式 order", () => {
    expect(
      formatAlignmentCoordinates(
        phrase({
          modeId: "axv-mode-converge",
          layerId: "axv-layer-path",
          domainId: "axv-domain-tech",
        }),
        BY_ID,
      ),
    ).toBe("路径 · 技术 · 收敛");
  });

  it("omits an unset axis instead of leaving a separator behind", () => {
    expect(
      formatAlignmentCoordinates(
        phrase({ layerId: "axv-layer-path", modeId: "axv-mode-converge" }),
        BY_ID,
      ),
    ).toBe("路径 · 收敛");
  });
});
