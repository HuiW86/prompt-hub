#!/usr/bin/env node
// Hotkey-wake benchmark — measure show()+set_focus() Rust call latency.
//
// Builds src-tauri with `--features bench`, spawns the resulting binary
// which auto-cycles show/hide N times and emits JSON-line samples to
// stdout. Parses samples and reports P50/P95/P99 in milliseconds.
//
// Scope caveat: this measures the Rust window API call path. It does NOT
// include OS global-shortcut event dispatch (~10ms per M0-3 manual vs
// automated delta). Real ⌥Space P95 = this number + ~10ms overhead.
//
// Run: pnpm bench:hotkey-wake

import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const SRC_TAURI = resolve(REPO, "src-tauri");
const BINARY = resolve(SRC_TAURI, "target/debug/prompt-hub");
const BUILD_TIMEOUT_MS = 300_000;
const RUN_TIMEOUT_MS = 60_000;
// Constitution C1: 主形态唤起 ≤ 200ms P95. Exceeding it exits non-zero so
// this script can gate CI / pre-release checks, not just print a verdict.
const C1_BUDGET_MS = 200;

function build() {
  console.log("cargo build --features bench …");
  const res = spawnSync(
    "cargo",
    ["build", "--manifest-path", "src-tauri/Cargo.toml", "--features", "bench"],
    {
      cwd: REPO,
      stdio: "inherit",
      timeout: BUILD_TIMEOUT_MS,
    },
  );
  if (res.status !== 0) {
    console.error("cargo build failed");
    process.exit(res.status ?? 1);
  }
  if (!existsSync(BINARY)) {
    console.error(`Missing binary after build: ${BINARY}`);
    process.exit(1);
  }
}

function runAndCollect() {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn(BINARY, [], { stdio: ["ignore", "pipe", "pipe"] });
    const samples = [];
    let buf = "";
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        try {
          proc.kill("SIGKILL");
        } catch {}
        rejectP(new Error(`bench did not finish within ${RUN_TIMEOUT_MS}ms`));
      }
    }, RUN_TIMEOUT_MS);

    proc.stdout.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        try {
          const obj = JSON.parse(trimmed);
          if (typeof obj.show_us === "number") {
            samples.push(obj.show_us);
          } else if (obj.done === true) {
            done = true;
          } else if (obj.error) {
            rejectP(new Error(obj.error));
          }
        } catch {
          // non-JSON line — ignore
        }
      }
    });
    proc.stderr.on("data", (chunk) => {
      process.stderr.write(chunk);
    });
    proc.on("exit", (code) => {
      clearTimeout(timer);
      if (samples.length === 0) {
        rejectP(new Error(`no samples collected (exit code ${code})`));
        return;
      }
      resolveP(samples);
    });
  });
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function main() {
  build();
  console.log(`spawn ${BINARY} (auto-cycle bench mode) …`);
  const samples = await runAndCollect();
  const ms = samples.map((us) => us / 1000);
  const sorted = [...ms].sort((a, b) => a - b);
  const mean = ms.reduce((s, x) => s + x, 0) / ms.length;
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  const overBudget = p95 > C1_BUDGET_MS;
  const verdict = overBudget
    ? "✗ OVER BUDGET"
    : "✓ within constitution C1 200ms budget";
  console.log("");
  console.log("hotkey-wake results (show()+set_focus() Rust call):");
  console.log(`  n      = ${ms.length}`);
  console.log(`  mean   = ${mean.toFixed(3)} ms`);
  console.log(`  p50    = ${p50.toFixed(3)} ms`);
  console.log(`  p95    = ${p95.toFixed(3)} ms`);
  console.log(`  p99    = ${p99.toFixed(3)} ms`);
  console.log(`  ${verdict}`);
  console.log(
    "  caveat: excludes OS global-shortcut dispatch (~10ms per M0-3 baseline).",
  );
  if (overBudget) {
    console.error(
      `hotkey-wake P95 ${p95.toFixed(3)} ms exceeds the C1 budget of ${C1_BUDGET_MS} ms`,
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
