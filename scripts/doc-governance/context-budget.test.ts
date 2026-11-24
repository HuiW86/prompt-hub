import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Context-budget gate — the 8th source-level gate (#38).
//
// CLAUDE.md is the only file auto-injected into every AI session. It grew to
// 36 KB, 61% of it a dated changelog under a heading that said "pointers only,
// no chronicle"; its "latest change" bullet was two months stale. HANDOFF.md
// grew the same way into a 75-item backlog with no single objective. Nothing
// stopped either: every round of work appended one more paragraph of "current
// state", and prose rules ("keep this short") do not execute.
//
// This gate makes the layering executable:
//   CLAUDE.md  = protocol layer: hard byte budget, no dates (any common
//                format; frontmatter only on created/last_modified), no test
//                counts, and the §-headings that 100+ `[[CLAUDE#§N]]` refs
//                point at (outside code fences).
//   HANDOFF.md = task layer: hard byte budget, ≤ 5 Next Actions.
// History goes to docs/design/CHANGELOG.md, backlog to GitHub Issues.
//
// Raising a budget is allowed but must be a deliberate, reviewed edit of the
// constant below, with the reason in the commit — never a silent drift.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const CLAUDE_MAX_BYTES = 12_000;
const HANDOFF_MAX_BYTES = 8_000;
const HANDOFF_MAX_NEXT_ACTIONS = 5;

// Headings that other docs link to as [[CLAUDE#§…]]; removing one silently
// orphans those references (the doc-refs gate checks files, not anchors).
const CLAUDE_REQUIRED_HEADINGS = [
  /^## §1 /m,
  /^## §2 /m,
  /^## §3 /m,
  /^## §4 /m,
  /^### 4\.1 /m,
  /^### 4\.2 /m,
  /^### 4\.3 /m,
  /^### 4\.4 /m,
  /^## §5 /m,
  /^### 5\.1 /m,
  /^#### 5\.1\.1 /m,
  /^#### 5\.1\.2 /m,
  /^### 5\.2 /m,
  /^### 5\.3 /m,
  /^### 5\.4 /m,
  /^## §6 /m,
  /^## §7 /m,
];

// Any common date spelling: 2026-11-23 / 2026/11/23 / 2026.11.23 /
// 2026 年 11 月 23 日 / month-level 2026-11. Version strings (v0.2.5) and
// sizes (36 KB) do not match: they lack a 20xx year followed by a separator.
const DATE = /\b20\d{2}\s*[-/.年]\s*\d{1,2}(?:\s*[-/.月]\s*\d{1,2})?/g;

// Test counts are records (test-spec §2), and every merge makes them stale.
const TEST_COUNT =
  /\d+\s*(?:条|个)?\s*(?:用例|测试)|\d+\s*(?:passed|tests?)\b/gi;

// Frontmatter keys whose value is legitimately a date.
const DATED_FRONTMATTER_KEY = /^(created|last_modified):/;

// A Next Actions item: `1. ` / `1) ` / `- ` / `* ` / `+ `, at most one space
// of indentation (two or more = nested detail, which is free).
const LIST_ITEM = /^ ?(?:\d+[.)]|[-*+]) /;

function read(rel: string): string {
  return readFileSync(resolve(repoRoot, rel), "utf8");
}

function splitFrontmatter(text: string): { front: string; body: string } {
  if (!text.startsWith("---\n")) return { front: "", body: text };
  const end = text.indexOf("\n---\n", 4);
  if (end === -1) return { front: "", body: text };
  return { front: text.slice(4, end), body: text.slice(end + 5) };
}

function stripCodeFences(text: string): string {
  return text.replace(/^```[\s\S]*?^```/gm, "");
}

/** Lines of the `## <title>` section, up to the next `## ` heading. */
function section(text: string, title: string): string[] | null {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => l.trim() === `## ${title}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith("## "));
  return end === -1 ? rest : rest.slice(0, end);
}

describe("context-budget gate — CLAUDE.md stays a protocol layer", () => {
  const raw = read("CLAUDE.md");
  const { front, body } = splitFrontmatter(raw);

  it(`is at most ${CLAUDE_MAX_BYTES} bytes`, () => {
    const bytes = Buffer.byteLength(raw, "utf8");
    expect(
      bytes,
      `CLAUDE.md is ${bytes} bytes (budget ${CLAUDE_MAX_BYTES}). Move state ` +
        `to HANDOFF.md, history to docs/design/CHANGELOG.md, procedures to ` +
        `.claude/skills/ — do not just raise the budget.`,
    ).toBeLessThanOrEqual(CLAUDE_MAX_BYTES);
  });

  it("carries no dates (frontmatter: only created / last_modified)", () => {
    const frontDates = front
      .split("\n")
      .filter((l) => !DATED_FRONTMATTER_KEY.test(l))
      .flatMap((l) => l.match(DATE) ?? []);
    const dates = [...frontDates, ...(body.match(DATE) ?? [])];
    expect(
      dates,
      `CLAUDE.md contains dates ${JSON.stringify(dates)}. A date in the ` +
        `always-injected layer is a chronicle entry that will go stale; ` +
        `put it in CHANGELOG / HANDOFF and point to it.`,
    ).toEqual([]);
  });

  it("carries no test counts", () => {
    const counts = raw.match(TEST_COUNT) ?? [];
    expect(
      counts,
      `CLAUDE.md contains test counts ${JSON.stringify(counts)}. Counts are ` +
        `records: they live in docs/design/11-test-spec.md §2 and HANDOFF Verify.`,
    ).toEqual([]);
  });

  it("keeps every §-heading that [[CLAUDE#§…]] references point at", () => {
    const prose = stripCodeFences(body);
    const missing = CLAUDE_REQUIRED_HEADINGS.filter(
      (re) => !re.test(prose),
    ).map(String);
    expect(missing, "CLAUDE.md lost referenced headings").toEqual([]);
  });
});

describe("context-budget gate — HANDOFF.md stays a task layer", () => {
  const raw = read("HANDOFF.md");

  it(`is at most ${HANDOFF_MAX_BYTES} bytes`, () => {
    const bytes = Buffer.byteLength(raw, "utf8");
    expect(
      bytes,
      `HANDOFF.md is ${bytes} bytes (budget ${HANDOFF_MAX_BYTES}). Finished ` +
        `work goes to CHANGELOG, backlog to GitHub Issues, long-lived ` +
        `pitfalls to docs/learnings.md appendix B.`,
    ).toBeLessThanOrEqual(HANDOFF_MAX_BYTES);
  });

  it("has an Objective section", () => {
    expect(section(raw, "Objective"), "missing `## Objective`").not.toBeNull();
  });

  it(`lists at most ${HANDOFF_MAX_NEXT_ACTIONS} Next Actions`, () => {
    const lines = section(raw, "Next Actions");
    expect(lines, "missing `## Next Actions`").not.toBeNull();
    const items = lines!.filter((l) => LIST_ITEM.test(l));
    expect(
      items.length,
      `HANDOFF has ${items.length} Next Actions (max ${HANDOFF_MAX_NEXT_ACTIONS}). ` +
        `A handoff names what to do next; the backlog lives in GitHub Issues.`,
    ).toBeLessThanOrEqual(HANDOFF_MAX_NEXT_ACTIONS);
  });
});
