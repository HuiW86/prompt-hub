#!/usr/bin/env node
// Cold-start benchmark — measure spawn → first window visible.
//
// Each iteration spawns a fresh debug binary, polls CGWindowList via Swift
// inline until a prompt-hub-owned window appears, records elapsed ms, then
// kills the process. Reports P50/P95/P99 across N rounds.
//
// Scope: measures process spawn + Tauri runtime init + first window creation.
// Excludes manual ⌥Space wake (see bench/hotkey-wake.bench.mjs).
//
// Run: pnpm bench:cold-start

import { spawn, spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, "..");
const BINARY = resolve(REPO, "src-tauri/target/debug/prompt-hub");
const CACHE_DIR = resolve(__dirname, ".cache");
const PROBE_SRC = resolve(CACHE_DIR, "probe.swift");
const PROBE_BIN = resolve(CACHE_DIR, "probe");
const ROUNDS = Number(process.env.BENCH_ROUNDS ?? 20);
const POLL_INTERVAL_MS = 5;
const TIMEOUT_MS = 10_000;

if (!existsSync(BINARY)) {
  console.error(`Missing binary: ${BINARY}`);
  console.error(
    "Run `pnpm tauri build --debug` or `pnpm tauri dev` once first.",
  );
  process.exit(1);
}

const SWIFT_PROBE_SRC = `import CoreGraphics
if let list = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] {
  for w in list {
    let owner = w[kCGWindowOwnerName as String] as? String ?? ""
    if owner.lowercased().contains("prompt-hub") { exit(0) }
  }
}
exit(1)
`;

function ensureProbe() {
  mkdirSync(CACHE_DIR, { recursive: true });
  const needsBuild =
    !existsSync(PROBE_BIN) ||
    !existsSync(PROBE_SRC) ||
    statSync(PROBE_BIN).mtimeMs < statSync(PROBE_SRC).mtimeMs;
  if (existsSync(PROBE_SRC)) {
    // Rewrite only if source content drifted (avoids needless rebuild).
    const cur = spawnSync("cat", [PROBE_SRC], { encoding: "utf8" }).stdout;
    if (cur !== SWIFT_PROBE_SRC) writeFileSync(PROBE_SRC, SWIFT_PROBE_SRC);
  } else {
    writeFileSync(PROBE_SRC, SWIFT_PROBE_SRC);
  }
  if (needsBuild) {
    console.log("compiling probe…");
    const r = spawnSync("swiftc", ["-O", PROBE_SRC, "-o", PROBE_BIN], {
      stdio: "inherit",
    });
    if (r.status !== 0) {
      console.error("swiftc failed");
      process.exit(1);
    }
  }
}

function probeWindow() {
  const res = spawnSync(PROBE_BIN, [], { encoding: "utf8" });
  return res.status === 0;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function killTree(pid) {
  // SIGTERM first, give it 200ms, then SIGKILL fallback.
  try {
    process.kill(pid, "SIGTERM");
  } catch {}
  await sleep(200);
  try {
    process.kill(pid, "SIGKILL");
  } catch {}
}

async function runOnce() {
  const t0 = performance.now();
  const proc = spawn(BINARY, [], {
    stdio: "ignore",
    detached: false,
  });
  let elapsed = null;
  const deadline = t0 + TIMEOUT_MS;
  while (performance.now() < deadline) {
    if (probeWindow()) {
      elapsed = performance.now() - t0;
      break;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  await killTree(proc.pid);
  // Wait until CGWindow drops the entry so the next round starts clean.
  while (probeWindow()) await sleep(50);
  if (elapsed == null)
    throw new Error(`Window did not appear within ${TIMEOUT_MS}ms`);
  return elapsed;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function main() {
  ensureProbe();
  console.log(`cold-start bench — ${ROUNDS} rounds, binary=${BINARY}`);
  const samples = [];
  // Warm-up round (often slower due to disk cache miss); discarded.
  console.log("warm-up…");
  await runOnce();
  for (let i = 0; i < ROUNDS; i++) {
    const ms = await runOnce();
    samples.push(ms);
    console.log(
      `  round ${String(i + 1).padStart(2, "0")}: ${ms.toFixed(2)} ms`,
    );
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = samples.reduce((s, x) => s + x, 0) / samples.length;
  const p50 = percentile(sorted, 50);
  const p95 = percentile(sorted, 95);
  const p99 = percentile(sorted, 99);
  console.log("");
  console.log("cold-start results (spawn → first CGWindow entry):");
  console.log(`  n      = ${samples.length}`);
  console.log(`  mean   = ${mean.toFixed(2)} ms`);
  console.log(`  p50    = ${p50.toFixed(2)} ms`);
  console.log(`  p95    = ${p95.toFixed(2)} ms`);
  console.log(`  p99    = ${p99.toFixed(2)} ms`);
  console.log(
    "  note: constitution C1 200ms applies to ⌥Space wake, NOT cold-start.",
  );
  console.log(
    "        cold-start budget undefined; tracked here as regression baseline.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
