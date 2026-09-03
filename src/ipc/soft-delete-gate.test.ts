import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// ── The seventh source-level gate (ADR-028 sub-decision 2) ────────────────────
// Soft delete only works if EVERY read hides the trashed rows. That is a promise
// spread over dozens of SQL statements in four crates, and the failure mode is
// silent: forget the predicate in one new query and deleted assets quietly come
// back to life in that one surface. ADR-028 chose in-place soft delete on the
// explicit condition that this class of mistake be made structurally impossible
// rather than merely discouraged, so the predicate is enforced here, on the Rust
// source text, the same way the token / density / theme-parity / B2 / IPC gates
// enforce their own invariants.
//
// The rule: a SQL statement that READS one of the seven asset tables must carry
// `deleted_at IS NULL`, once per asset table it reads. A statement that cannot
// obey must say so with an inline `// soft-delete-gate: exempt — <reason>`
// comment on one of the lines just above it, and it then shows up in
// EXPECTED_EXEMPTIONS below, so adding one is a deliberate, reviewable act.
//
// ── What this gate CANNOT do ─────────────────────────────────────────────────
// It is a text scanner, not a SQL parser. Known and accepted limits:
//   1. It only inspects statements whose first keyword is SELECT or WITH. INSERT
//      / UPDATE / DELETE are skipped wholesale, including any subquery inside
//      them — deliberate, because `MAX(order_index) + 1` append subqueries must
//      span trashed rows (so a restore never collides with a slot handed out
//      after it) and because writes address rows by id.
//   2. It counts predicates, it does not bind them. Two reads of two asset
//      tables plus two `deleted_at IS NULL` anywhere in the statement passes,
//      even in the pathological case where both predicates name one table.
//   3. Statements built with a dynamic table name (`format!("… FROM {table}")`)
//      are invisible to it. The two that exist (soft_delete / restore) are
//      exempt-marked anyway; a new one would slip past.
//   4. Rust test modules are not scanned: each file is truncated at its first
//      `#[cfg(test)]`, and `tests/` directories are skipped. Test fixtures
//      legitimately look at trashed rows, and requiring markers on all of them
//      would train everyone to add markers without thinking.
// Limits 1–3 are the price of not shipping a SQL parser; limit 4 is a choice.
// What the gate does catch is the case that actually happens: someone adds a
// list read, or a new column to an existing one, and forgets the predicate.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUST_ROOTS = [
  resolve(repoRoot, "src-tauri/src"),
  resolve(repoRoot, "src-tauri/crates"),
];

// The seven tables migration 0013 gave a `deleted_at` column. `phases`, `sops`,
// `sop_steps`, `usage_records`, `drafts` and `settings` have none, so a read of
// those is none of this gate's business.
const ASSET_TABLES = [
  "modifiers",
  "macros",
  "alignment_phrases",
  "compositions",
  "phrases",
  "scenes",
  "sub_stages",
];

const EXEMPT_MARKER = "soft-delete-gate: exempt";
// How far above a statement the marker may sit. Enough to clear a doc comment
// plus the `conn.prepare(` / `.query_row(` line, short enough that a marker
// can't accidentally cover the next statement down.
const EXEMPT_LOOKBACK_LINES = 8;

// Every exemption the gate currently accepts, as `<path> :: <sql fingerprint>`.
// Adding a line here is the reviewable act ADR-028 asks for: each one is a place
// where trashed rows are visible on purpose.
const EXPECTED_EXEMPTIONS = [
  // Export is a full-fidelity local backup (sub-decision 6): the trash travels
  // with it, so that export-then-import is not a silent permanent delete.
  "src-tauri/crates/repo-core/src/export.rs :: SELECT id, name, content, group_kind, usage_coun",
  "src-tauri/crates/repo-core/src/export.rs :: SELECT id, name, content, expand_from, native, r",
  "src-tauri/crates/repo-core/src/export.rs :: SELECT id, phase_id, name, content, is_default,",
  "src-tauri/crates/repo-core/src/export.rs :: SELECT id, name, modifier_ids, phase_id, scene_i",
  "src-tauri/crates/repo-core/src/export.rs :: SELECT id, name, icon, order_index, visible, rol",
  "src-tauri/crates/repo-core/src/export.rs :: SELECT id, scene_id, name, order_index, deleted_",
  "src-tauri/crates/repo-core/src/export.rs :: SELECT id, scene_id, name, content, usage_count,",
  // The trash view itself — it selects precisely what every other read hides.
  "src-tauri/crates/repo-core/src/trash.rs :: SELECT 'modifier' AS kind, id, name AS label, de",
  // The delete path must see a trashed row to tell "already in the trash" (a
  // no-op) apart from "no such id" (an error).
  "src-tauri/crates/repo-write/src/alignment_phrases.rs :: SELECT is_default, deleted_at FROM alignment_phr",
  // Restore reads the row it is about to bring back.
  "src-tauri/crates/repo-write/src/trash.rs :: SELECT phase_id, is_default FROM alignment_phras",
];

// ── Source scanning ──────────────────────────────────────────────────────────

function collectRustFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // `tests/` holds integration fixtures, which may inspect trashed rows.
      if (entry.name === "tests" || entry.name === "target") continue;
      out.push(...collectRustFiles(full));
    } else if (entry.name.endsWith(".rs")) {
      out.push(full);
    }
  }
  return out;
}

interface Literal {
  body: string;
  /** 1-based line of the literal's opening quote. */
  line: number;
}

// Walk the source once, tracking whether we are inside a string literal, a line
// comment or a block comment. A regex can't do this: a `//` inside a SQL string
// and a `"` inside a comment both mislead it, and this gate's whole job is to
// tell code from prose.
export function extractStringLiterals(source: string): Literal[] {
  const literals: Literal[] = [];
  let line = 1;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "\n") {
      line += 1;
      i += 1;
    } else if (c === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
    } else if (c === "/" && source[i + 1] === "*") {
      i += 2;
      while (
        i < source.length &&
        !(source[i] === "*" && source[i + 1] === "/")
      ) {
        if (source[i] === "\n") line += 1;
        i += 1;
      }
      i += 2;
    } else if (c === '"') {
      const startLine = line;
      let body = "";
      i += 1;
      while (i < source.length && source[i] !== '"') {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === "\n") line += 1;
        body += source[i];
        i += 1;
      }
      i += 1;
      literals.push({ body, line: startLine });
    } else {
      i += 1;
    }
  }
  return literals;
}

const READ_RE = new RegExp(
  `\\b(?:FROM|JOIN)\\s+(?:${ASSET_TABLES.join("|")})\\b`,
  "gi",
);
const PREDICATE_RE = /deleted_at\s+IS\s+NULL/gi;

function countMatches(text: string, re: RegExp): number {
  re.lastIndex = 0;
  return [...text.matchAll(re)].length;
}

/** A SELECT / WITH statement is a read; everything else is a write. */
function isReadStatement(sql: string): boolean {
  return /^\s*(?:SELECT|WITH)\b/i.test(sql);
}

/** First line of the statement, squashed, as a stable-ish identity. */
function fingerprint(sql: string): string {
  return sql.trim().replace(/\s+/g, " ").slice(0, 48).trim();
}

export interface Finding {
  file: string;
  line: number;
  sql: string;
  reads: number;
  predicates: number;
  exempt: boolean;
}

export function analyzeSource(source: string, file: string): Finding[] {
  // Rust unit tests live at the bottom of the file they test; cut them off.
  const cfgTest = source.indexOf("#[cfg(test)]");
  const body = cfgTest === -1 ? source : source.slice(0, cfgTest);
  const lines = body.split("\n");

  const findings: Finding[] = [];
  for (const { body: sql, line } of extractStringLiterals(body)) {
    const reads = countMatches(sql, READ_RE);
    if (reads === 0 || !isReadStatement(sql)) continue;
    const from = Math.max(0, line - 1 - EXEMPT_LOOKBACK_LINES);
    const exempt = lines
      .slice(from, line)
      .some((l) => l.includes(EXEMPT_MARKER));
    findings.push({
      file,
      line,
      sql,
      reads,
      predicates: countMatches(sql, PREDICATE_RE),
      exempt,
    });
  }
  return findings;
}

const files = RUST_ROOTS.filter((root) => {
  try {
    return statSync(root).isDirectory();
  } catch {
    return false;
  }
}).flatMap(collectRustFiles);

const findings = files.flatMap((file) =>
  analyzeSource(readFileSync(file, "utf8"), relative(repoRoot, file)),
);

describe("soft-delete gate — every asset read hides trashed rows (ADR-028)", () => {
  it("finds Rust sources and asset-table reads to scan", () => {
    // Guard the scanner itself: a broken path or regex would drain the set and
    // make every assertion below pass vacuously.
    expect(files.length, "no Rust sources found").toBeGreaterThan(10);
    expect(findings.length, "no asset-table reads parsed").toBeGreaterThan(10);
  });

  it("every non-exempt read carries deleted_at IS NULL for each asset table", () => {
    const violations = findings
      .filter((f) => !f.exempt && f.predicates < f.reads)
      .map(
        (f) =>
          `${f.file}:${f.line} reads ${f.reads} asset table(s) but has ` +
          `${f.predicates} deleted_at IS NULL — ${fingerprint(f.sql)}`,
      );
    expect(
      violations,
      "a read of a soft-deletable table is missing its predicate; add " +
        "`deleted_at IS NULL`, or mark the statement " +
        "`// soft-delete-gate: exempt — <reason>` and list it in " +
        "EXPECTED_EXEMPTIONS",
    ).toEqual([]);
  });

  it("accepts exactly the exemptions on record", () => {
    const accepted = findings
      .filter((f) => f.exempt)
      .map((f) => `${f.file} :: ${fingerprint(f.sql)}`)
      .sort();
    // Printed on failure by the diff: this is the list of every place trashed
    // rows are deliberately visible.
    expect(accepted).toEqual([...EXPECTED_EXEMPTIONS].sort());
  });
});

// Self-test: the gate has to fail on the mistake it exists to prevent. Same
// spirit as the token gate's bypass-class suite — a regression in the scanner
// itself would otherwise be indistinguishable from a clean codebase.
describe("soft-delete gate — the check itself", () => {
  const wrap = (rust: string) => analyzeSource(rust, "synthetic.rs");

  it("flags a list read that forgot the predicate", () => {
    const found = wrap(`
      fn list_things(conn: &Connection) {
          let mut stmt = conn.prepare(
              "SELECT id, name FROM phrases
               WHERE scene_id = ?1 AND deprecated = 0
               ORDER BY order_index ASC",
          );
      }
    `);
    expect(found).toHaveLength(1);
    expect(found[0].reads).toBe(1);
    expect(found[0].predicates).toBe(0);
    expect(found[0].exempt).toBe(false);
  });

  it("passes the same read once the predicate is there", () => {
    const found = wrap(`
      let mut stmt = conn.prepare(
          "SELECT id FROM phrases WHERE deprecated = 0 AND deleted_at IS NULL",
      );
    `);
    expect(found[0].predicates).toBeGreaterThanOrEqual(found[0].reads);
  });

  it("requires one predicate per asset table joined", () => {
    const found = wrap(`
      let mut stmt = conn.prepare(
          "SELECT u.id FROM usage_records u
           LEFT JOIN macros m ON u.target_id = m.id AND m.deleted_at IS NULL
           LEFT JOIN phrases p ON u.target_id = p.id",
      );
    `);
    expect(found[0].reads).toBe(2);
    expect(found[0].predicates).toBe(1);
  });

  it("honours an exemption marker above the statement", () => {
    const found = wrap(`
      // soft-delete-gate: exempt — synthetic
      let mut stmt = conn.prepare("SELECT id FROM scenes");
    `);
    expect(found[0].exempt).toBe(true);
  });

  it("does not let a distant marker cover an unrelated statement", () => {
    const filler = "\n".repeat(EXEMPT_LOOKBACK_LINES + 2);
    const found = wrap(
      `// soft-delete-gate: exempt — synthetic${filler}` +
        `let mut stmt = conn.prepare("SELECT id FROM scenes");`,
    );
    expect(found[0].exempt).toBe(false);
  });

  it("ignores writes, whose MAX(order_index) subqueries must span trashed rows", () => {
    const found = wrap(`
      conn.execute(
          "INSERT INTO phrases (id, order_index)
           VALUES (?1, (SELECT COALESCE(MAX(order_index) + 1, 0) FROM phrases))",
      );
      conn.execute("UPDATE macros SET name = ?2 WHERE id = ?1");
    `);
    expect(found).toEqual([]);
  });

  it("ignores tables that have no deleted_at column", () => {
    expect(wrap(`let s = "SELECT id FROM phases WHERE visible = 1";`)).toEqual(
      [],
    );
    expect(wrap(`let s = "SELECT id FROM usage_records";`)).toEqual([]);
  });

  it("does not read SQL out of comments", () => {
    const found = wrap(`
      // Historic note: this used to be "SELECT id FROM phrases".
      /* and "SELECT id FROM macros" lived here */
      let x = 1;
    `);
    expect(found).toEqual([]);
  });

  it("stops scanning at the Rust test module", () => {
    const found = wrap(`
      let live = "SELECT id FROM scenes WHERE deleted_at IS NULL";
      #[cfg(test)]
      mod tests {
          let fixture = "SELECT id FROM scenes";
      }
    `);
    expect(found).toHaveLength(1);
    expect(found[0].predicates).toBe(1);
  });
});
