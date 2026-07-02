import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// IPC contract gate — the Tauri command boundary is a double-mock blind spot:
// frontend tests mock `invoke`, Rust tests call repo fns below the command
// layer, so a command that is defined but not registered (or invoked under a
// drifted name) fails only at runtime (ADR-015 addendum-2 hit exactly this
// class of drift). This test parses the three sources of truth at the text
// level and asserts the command-name sets match:
//   ① src-tauri/src/commands.rs   — every `#[tauri::command]` fn
//   ② src-tauri/src/lib.rs        — the `invoke_handler(generate_handler![…])` list
//   ③ src/ipc/index.ts            — every `invoke("…")` command-name literal
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const COMMANDS_RS = resolve(repoRoot, "src-tauri/src/commands.rs");
const LIB_RS = resolve(repoRoot, "src-tauri/src/lib.rs");
const IPC_TS = resolve(repoRoot, "src/ipc/index.ts");

// ── Allowlists ────────────────────────────────────────────────────────────────
// Frontend-invoked names that intentionally have no #[tauri::command] here
// (e.g. plugin commands invoked by raw name). `plugin:` prefixed invokes are
// auto-exempt; anything else must be listed explicitly.
const FRONTEND_ONLY_ALLOWLIST = new Set<string>([]);
// Backend commands intentionally not called from src/ipc/index.ts (e.g. a
// command reserved for a non-ipc call site). Keep empty until one exists.
const BACKEND_ONLY_ALLOWLIST = new Set<string>([]);

// Strip `//` line comments and `/* … */` block comments so names mentioned in
// prose can never register as commands. Heuristic (no string-literal parsing),
// which is fine: command names never legitimately live inside string literals
// on the Rust side, and on the TS side we extract from literals BEFORE
// stripping.
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

// ① commands.rs: `#[tauri::command]` (optionally with args) followed by any
// number of further attributes (#[cfg(...)], #[allow(...)], …), then the fn
// signature — `pub`, optional visibility scope, optional `async`.
function parseDefinedCommands(source: string): string[] {
  const re =
    /#\[tauri::command(?:\([^)]*\))?\]\s*(?:#\[[^\]]*\]\s*)*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z0-9_]+)/g;
  const names: string[] = [];
  for (const m of stripComments(source).matchAll(re)) names.push(m[1]);
  return names;
}

// ② lib.rs: the single `invoke_handler(tauri::generate_handler![ … ])` block.
// Entries are path-qualified (`commands::list_phases`); keep the last segment.
function parseRegisteredCommands(source: string): string[] {
  const block = stripComments(source).match(
    /invoke_handler\s*\(\s*tauri::generate_handler!\[([\s\S]*?)\]\s*,?\s*\)/,
  );
  if (!block) return [];
  return block[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => entry.split("::").pop() as string);
}

// ③ index.ts: every `invoke("name")` / `invoke<T>("name", …)` literal. The
// generic parameter never contains `(` in this codebase (object/array/union
// types only), so `[^(]*?` safely skips it without crossing into the call.
function parseInvokedCommands(source: string): string[] {
  const re = /\binvoke\s*(?:<[^(]*?>)?\s*\(\s*["'`]([^"'`]+)["'`]/g;
  const names: string[] = [];
  for (const m of source.matchAll(re)) names.push(m[1]);
  return names;
}

// Count raw `invoke…(` call sites so a dynamic (non-literal) command name —
// which the extractor above cannot see — fails loudly instead of silently
// shrinking the invoked set.
function countInvokeCallSites(source: string): number {
  return [...source.matchAll(/\binvoke\s*(?:<[^(]*?>)?\s*\(/g)].length;
}

function diff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((x) => !b.has(x)).sort();
}

const commandsRs = readFileSync(COMMANDS_RS, "utf8");
const libRs = readFileSync(LIB_RS, "utf8");
const ipcTs = readFileSync(IPC_TS, "utf8");

const defined = new Set(parseDefinedCommands(commandsRs));
const registered = new Set(parseRegisteredCommands(libRs));
const invokedRaw = parseInvokedCommands(ipcTs);
const invoked = new Set(
  invokedRaw.filter(
    (name) => !name.startsWith("plugin:") && !FRONTEND_ONLY_ALLOWLIST.has(name),
  ),
);

describe("IPC contract — commands.rs / lib.rs / ipc/index.ts stay in sync", () => {
  it("parses a plausible number of commands from each side", () => {
    // Guard the parsers themselves: if a refactor breaks a regex, the sets
    // would drain to zero and the equality checks below would pass vacuously.
    expect(defined.size, "no #[tauri::command] fns parsed").toBeGreaterThan(10);
    expect(
      registered.size,
      "no generate_handler! entries parsed",
    ).toBeGreaterThan(10);
    expect(invoked.size, "no invoke('…') literals parsed").toBeGreaterThan(10);
  });

  it("extracts a literal command name from every invoke() call site", () => {
    expect(
      invokedRaw.length,
      "some invoke() call sites use a dynamic/non-literal command name — " +
        "the contract gate can't see them; use a string literal",
    ).toBe(countInvokeCallSites(ipcTs));
  });

  it("every #[tauri::command] fn is registered in lib.rs invoke_handler", () => {
    expect(
      diff(defined, registered),
      "defined in commands.rs but MISSING from lib.rs generate_handler![] — " +
        "register them or delete the dead command",
    ).toEqual([]);
  });

  it("every invoke_handler entry has a #[tauri::command] fn", () => {
    expect(
      diff(registered, defined),
      "registered in lib.rs generate_handler![] but no #[tauri::command] fn " +
        "in commands.rs — stale registration or renamed fn",
    ).toEqual([]);
  });

  it("every frontend invoke() name is a registered command", () => {
    expect(
      diff(invoked, registered),
      "invoked from src/ipc/index.ts but NOT registered in lib.rs — " +
        "frontend command-name drift (would throw at runtime)",
    ).toEqual([]);
  });

  it("every registered command is invoked from src/ipc/index.ts", () => {
    const backendOnly = diff(registered, invoked).filter(
      (name) => !BACKEND_ONLY_ALLOWLIST.has(name),
    );
    expect(
      backendOnly,
      "registered in lib.rs but never invoked from src/ipc/index.ts — " +
        "add the ipc wrapper or list it in BACKEND_ONLY_ALLOWLIST",
    ).toEqual([]);
  });
});
