import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import type { AnchorDrift, AxisTally, DriftLedger } from "../../ipc/types";
import { useToastStore } from "../../stores/toastStore";
import { DriftLedgerView } from "../alignment/DriftLedgerView";

const toastInitial = useToastStore.getState();

function tally(t: Partial<AxisTally>): AxisTally {
  return { form: 0, layer: 0, domain: 0, mode: 0, ...t };
}

function anchor(over: Partial<AnchorDrift> & Pick<AnchorDrift, "name">) {
  return {
    phraseId: over.name,
    revisedAt: null,
    before: tally({}),
    after: tally({}),
    ...over,
  } as AnchorDrift;
}

function ledger(over: Partial<DriftLedger>): DriftLedger {
  return { anchors: [], liveCueTotal: 0, unattributed: 0, ...over };
}

async function renderLedger(value: DriftLedger) {
  invokeMock.mockResolvedValue(value);
  render(<DriftLedgerView />);
  await waitFor(() =>
    expect(invokeMock).toHaveBeenCalledWith("summarize_drift_ledger"),
  );
}

describe("DriftLedgerView — counts, never a verdict (ADR-029 子决策 4)", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    useToastStore.setState(toastInitial, true);
  });

  // 06-prd §5.7: 「没有任何 live_cue 记录时显示空状态文案，而不是 0」 — a zero
  // would be read as "nothing ever went wrong", when the fact is only that the
  // cues have not been used.
  it("shows the empty-state sentence and no table when nothing has been recorded", async () => {
    await renderLedger(ledger({}));

    expect(await screen.findByText("还没有记到中途口令")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByText(/合计/)).not.toBeInTheDocument();
  });

  // ① 哪条开场话术后面跟的口令最多. Ordering is how a table is read; no rank
  // number, medal or superlative is attached to any row.
  it("lists anchors by count, highest first, with a per-axis row and a row total", async () => {
    await renderLedger(
      ledger({
        anchors: [
          anchor({ name: "少的那条", after: tally({ layer: 1 }) }),
          anchor({
            name: "多的那条",
            after: tally({ form: 1, layer: 2, domain: 1, mode: 1 }),
          }),
        ],
        liveCueTotal: 6,
      }),
    );

    const rows = await screen.findAllByRole("row");
    // Header row first, then the anchors in descending order.
    expect(rows[1]).toHaveTextContent("多的那条");
    expect(rows[2]).toHaveTextContent("少的那条");
    // 形态 1 · 层 2 · 域 1 · 模式 1 · 合计 5.
    expect(
      screen.getByRole("row", { name: "多的那条 1 2 1 1 5" }),
    ).toBeInTheDocument();
  });

  // ③ 以 content_revised_at 为界的前后两段. No arrow, no percentage, no
  // improvement wording — two dated rows and nothing else.
  it("splits a revised anchor into 修订前 / 修订后 rows carrying the date", async () => {
    const revisedAt = "2026-09-01T10:00:00+08:00";
    // The calendar day the user is in, computed independently of the component
    // (sv-SE formats as YYYY-MM-DD) so the assertion holds in any timezone the
    // suite runs in rather than only in the author's.
    const day = new Date(revisedAt).toLocaleDateString("sv-SE");

    await renderLedger(
      ledger({
        anchors: [
          anchor({
            name: "改过的那条",
            revisedAt,
            before: tally({ layer: 3 }),
            after: tally({ layer: 1 }),
          }),
        ],
        liveCueTotal: 4,
      }),
    );

    expect(await screen.findByText(`修订前 · ${day} 之前`)).toBeInTheDocument();
    expect(screen.getByText(`修订后 · ${day} 起`)).toBeInTheDocument();
    // The phrase's own row still carries the whole tally: before + after.
    expect(
      screen.getByRole("row", { name: "改过的那条 0 4 0 0 4" }),
    ).toBeInTheDocument();
  });

  it("gives an unrevised anchor a single row and no revision sub-rows", async () => {
    await renderLedger(
      ledger({
        anchors: [anchor({ name: "没改过", after: tally({ mode: 2 }) })],
        liveCueTotal: 2,
      }),
    );

    expect(await screen.findByText("没改过")).toBeInTheDocument();
    expect(screen.queryByText(/修订前/)).not.toBeInTheDocument();
    expect(screen.queryByText(/修订后/)).not.toBeInTheDocument();
  });

  // ② 哪一轴被换得最多 — one line per axis, in the fixed 形态 · 层 · 域 · 模式
  // order, summed across every anchor.
  it("totals each axis across anchors on its own line", async () => {
    await renderLedger(
      ledger({
        anchors: [
          anchor({ name: "甲", after: tally({ layer: 2, mode: 1 }) }),
          anchor({
            name: "乙",
            revisedAt: "2026-09-01T10:00:00+08:00",
            before: tally({ layer: 1 }),
            after: tally({ form: 1 }),
          }),
        ],
        liveCueTotal: 5,
      }),
    );

    expect(await screen.findByText("形态：1 次")).toBeInTheDocument();
    expect(screen.getByText("层：3 次")).toBeInTheDocument();
    expect(screen.getByText("域：0 次")).toBeInTheDocument();
    expect(screen.getByText("模式：1 次")).toBeInTheDocument();
  });

  // 「停」 counts toward the total and lands in no column; a cue with no anchor
  // before it lands under no phrase. Both gaps are named so the table and the
  // total reconcile: 2 filed + 1 axis-less + 1 anchor-less = 4.
  it("names both gaps between the table and the total", async () => {
    await renderLedger(
      ledger({
        anchors: [anchor({ name: "开场", after: tally({ layer: 2 }) })],
        liveCueTotal: 4,
        unattributed: 1,
      }),
    );

    expect(await screen.findByText("未归入任何一轴：1 次")).toBeInTheDocument();
    expect(screen.getByText("未归到任何开场话术：1 次")).toBeInTheDocument();
    expect(screen.getByText("中途口令合计：4 次")).toBeInTheDocument();
  });

  // A broken read must never render as "you have no records" — that reports an
  // absence of data as a fact about the user's history.
  it("reports a failed read instead of falling through to the empty state", async () => {
    invokeMock.mockRejectedValue(new Error("db locked"));
    render(<DriftLedgerView />);

    const alert = await screen.findByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.queryByText("还没有记到中途口令")).not.toBeInTheDocument();
    // Same failure surface as every other view: a toast carrying the message.
    await waitFor(() => {
      const toast = useToastStore.getState();
      expect(toast.intent).toBe("error");
      expect(toast.message).toBe(alert.textContent);
    });
  });
});

// 03-product-spec 区域 7 「措辞是刻意的」 + 「对齐坐标与漂移账契约」 d: the copy
// states counts and nothing else. 「复制口令 ≈ 发生了一次漂移」 is an unverified
// assumption, so any word that decides the preceding turn had gone wrong would
// be the app judging alignment — 01-spec §8.1 forbids that permanently.
//
// The source files are scanned as well as the rendered output: a banned word
// sitting in a class name, a comment or an aria-label is one refactor away from
// reaching the screen.
describe("cue-tally copy — the banned vocabulary appears nowhere", () => {
  const BANNED = /纠偏|漂移|出错|偏离|不好|建议|效果不佳|排名|评价/;
  const here = dirname(fileURLToPath(import.meta.url));
  const FILES = [
    "../alignment/DriftLedgerView.tsx",
    "../alignment/DriftLedgerPanel.tsx",
    "../alignment/driftLedger.module.css",
    "../StatusBar.tsx",
    "../StatusBar.module.css",
  ];

  for (const file of FILES) {
    it(`${file} carries none of them`, () => {
      const source = readFileSync(resolve(here, file), "utf8");
      const hit = source.match(BANNED);
      expect(hit?.[0], `${file} uses a judging word`).toBeUndefined();
    });
  }

  it("the rendered detail view carries none of them", async () => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(
      ledger({
        anchors: [
          anchor({
            name: "开场",
            revisedAt: "2026-09-01T10:00:00+08:00",
            before: tally({ layer: 1 }),
            after: tally({ form: 1, domain: 1, mode: 1 }),
          }),
        ],
        liveCueTotal: 6,
        unattributed: 1,
      }),
    );
    const { container } = render(<DriftLedgerView />);
    await screen.findByRole("table");

    expect(container.textContent ?? "").not.toMatch(BANNED);
    // And the word the product DOES use is present.
    expect(container.textContent).toContain("中途口令");
  });
});
