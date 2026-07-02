#!/usr/bin/env node
// vendored from ai-dev-lifecycle content-os/doc-governance v0.1, do not edit here — upstream first
// doc-governance v0.1 — deterministic documentation contract checker (CLI host).
// Zero-dependency: node:fs / node:path / node:process only.
// Spec: docs/design/26-北极星流水线.md §6.2 — the day-0 preinstall package puts a
// machine adjudication surface behind every "must"-level documentation rule.
//
// Usage:
//   node content-os/doc-governance/index.mjs --config <path/to/doc-governance.config.mjs>
//
// Six check families (each severity-configurable: error / warn / off):
//   A refs            — wiki-links / relative md links / backtick code paths resolve
//   B inventory       — index file ↔ disk bidirectional coverage
//   C frontmatter     — required fields / description length / status vocabulary
//   D versionPointers — version claims in pointer files match the target doc
//   E numbering       — NN- prefix continuity and duplicate detection
//   F planStaleness   — plans stuck in a forbidden dwell status past a commit budget
//
// Exit code: 1 iff at least one error-level violation exists (warnings never fail).

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { runChecks } from './checks.mjs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') args.config = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
  }
  return args;
}

/** Build a file:// URL by hand (percent-encode each segment) — node:url is off-budget. */
function fileUrl(absPath) {
  return 'file://' + absPath.split(path.sep).map(encodeURIComponent).join('/');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.config) {
    console.log('Usage: node content-os/doc-governance/index.mjs --config <path>');
    process.exit(args.help ? 0 : 2);
  }
  const configPath = path.resolve(process.cwd(), args.config);
  if (!fs.existsSync(configPath)) {
    console.error(`doc-governance: config not found: ${configPath}`);
    process.exit(2);
  }
  const config = (await import(fileUrl(configPath))).default;
  // Repo root defaults to the config file's directory (config.root is relative to it).
  const root = path.resolve(path.dirname(configPath), config.root || '.');

  const { violations, stats } = runChecks(config, root);

  // ---- Report: grouped by file, errors before warnings inside each group ----
  const order = { error: 0, warn: 1 };
  const byFile = new Map();
  for (const v of violations) {
    if (!byFile.has(v.file)) byFile.set(v.file, []);
    byFile.get(v.file).push(v);
  }
  console.log(`doc-governance v0.1 · root: ${root}`);
  console.log(`scanned ${stats.scanned} markdown files (frozen skipped: ${stats.frozenSkipped}, whitelisted refs: ${stats.whitelisted})\n`);
  for (const file of [...byFile.keys()].sort()) {
    console.log(file);
    for (const v of byFile.get(file).sort((a, b) => order[a.severity] - order[b.severity])) {
      const mark = v.severity === 'error' ? '✖ error' : '⚠ warn ';
      console.log(`  ${mark} [${v.check}]${v.line ? ` L${v.line}` : ''} ${v.message}`);
    }
  }
  const errors = violations.filter((v) => v.severity === 'error').length;
  const warns = violations.length - errors;
  console.log(`${violations.length ? '\n' : ''}result: ${errors} error(s), ${warns} warning(s)`);
  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('doc-governance: fatal:', err);
  process.exit(2);
});
