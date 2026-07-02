import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Doc-refs gate — the 4th source-level gate (alongside token-gate / b2-separation /
// ipc-contract): documentation contracts drift silently because nothing executes
// them. This gate runs the vendored doc-governance checker (deterministic, zero
// network/LLM) against doc-governance.config.mjs on every `pnpm test`, so a broken
// wiki-link in an authoritative doc, a MANIFEST coverage hole, a frontmatter schema
// violation, or a stale version claim in CLAUDE.md fails CI instead of rotting.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const CHECKER = resolve(repoRoot, "scripts/doc-governance/index.mjs");
const CONFIG = resolve(repoRoot, "doc-governance.config.mjs");

describe("doc-governance gate — documentation contract holds", () => {
  const run = spawnSync(process.execPath, [CHECKER, "--config", CONFIG], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 60_000,
  });
  const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;

  it("scans a plausible number of markdown files", () => {
    // Anti-vacuous guard (same idea as the ipc-contract parser guard): if the
    // config's files.include drifts to matching nothing, exit 0 would be
    // meaningless — require a non-trivial scan set.
    const scanned = output.match(/scanned (\d+) markdown files/);
    expect(
      scanned,
      `no scan summary in checker output:\n${output}`,
    ).not.toBeNull();
    expect(Number(scanned![1]), `scan set drained:\n${output}`).toBeGreaterThan(
      20,
    );
  });

  it("exits 0 (no error-level violations)", () => {
    // exit 1 = error-level violations; exit 2 = config/usage failure. Surface the
    // checker's own grouped report so the failing ref is visible in the assertion.
    expect(
      run.status,
      `doc-governance found error-level violations (fix the doc, or whitelist ` +
        `with a reason in doc-governance.config.mjs — never flip a check off):\n${output}`,
    ).toBe(0);
  });
});
