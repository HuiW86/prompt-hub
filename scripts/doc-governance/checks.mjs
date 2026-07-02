// vendored from ai-dev-lifecycle content-os/doc-governance v0.1, do not edit here — upstream first
// doc-governance v0.1 — check implementations + shared helpers.
// Zero-dependency: node:fs / node:path only. See index.mjs for the CLI host.
// Spec: docs/design/26-北极星流水线.md §6.2 (day-0 preinstall, adjudication surface).

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

const toPosix = (p) => p.split(path.sep).join('/');

/** Convert a minimal glob (supports **, *, ?, [...]) to a RegExp anchored on both ends. */
export function globToRegExp(glob) {
  let g = glob.replace(/^\.\//, '');
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '[') {
      // Pass bracket expressions through verbatim (e.g. [0-9]).
      const close = g.indexOf(']', i + 1);
      if (close !== -1) {
        re += g.slice(i, close + 1);
        i = close;
        continue;
      }
      re += '\\[';
    } else if (c === '*') {
      if (g[i + 1] === '*') {
        if (g[i + 2] === '/') {
          re += '(?:[^/]+/)*';
          i += 2;
        } else {
          re += '.*';
          i += 1;
        }
      } else re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if ('\\^$.|+()[]{}'.includes(c)) re += '\\' + c;
    else re += c;
  }
  return new RegExp('^' + re + '$');
}

const matchAny = (rel, globs) => (globs || []).some((g) => globToRegExp(g).test(rel));

/**
 * Minimal YAML frontmatter parser: flat `key: value` pairs, inline arrays,
 * trailing `# comment` stripping. Returns null when no frontmatter block.
 */
export function parseFrontmatter(raw) {
  if (!raw.startsWith('---')) return null;
  const end = raw.indexOf('\n---', 3);
  if (end === -1) return null;
  const body = raw.slice(raw.indexOf('\n') + 1, end);
  const fm = {};
  for (const line of body.split('\n')) {
    const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    // Strip trailing comment unless the value is quoted.
    if (!/^["']/.test(v)) v = v.replace(/\s+#.*$/, '').trim();
    v = v.replace(/^["'](.*)["']$/, '$1');
    fm[m[1]] = v;
  }
  return fm;
}

/** Recursively list repo-relative posix file paths, skipping .git / node_modules. */
export function walkFiles(absRoot, rel = '', out = []) {
  const absDir = path.join(absRoot, rel);
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walkFiles(absRoot, childRel, out);
    else out.push(toPosix(childRel));
  }
  return out;
}

/** Precompute line-start offsets so violations can carry 1-indexed line numbers. */
function lineOffsets(text) {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) if (text[i] === '\n') offsets.push(i + 1);
  return offsets;
}

function lineOf(offsets, idx) {
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= idx) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

/**
 * Strip fenced code blocks (content blanked, newlines kept so offsets survive)
 * and extract inline code spans. The returned `text` is used for wiki-link and
 * markdown-link scanning; `inlineSpans` feed the backtick code-path check.
 */
function stripForScan(raw) {
  const lines = raw.split('\n');
  let inFence = false;
  let fenceMark = '';
  const kept = lines.map((line) => {
    const open = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (!inFence && open) {
      inFence = true;
      fenceMark = open[1][0];
      return '';
    }
    if (inFence) {
      if (open && open[1][0] === fenceMark) inFence = false;
      return '';
    }
    return line;
  });
  let text = kept.join('\n');
  const inlineSpans = [];
  // Extract inline code spans (single or double backticks), blank them out.
  text = text.replace(/(`{1,2})([^`\n]+?)\1/g, (whole, _tick, content, idx) => {
    inlineSpans.push({ content, index: idx });
    return ' '.repeat(whole.length);
  });
  return { text, inlineSpans };
}

// ---------------------------------------------------------------------------
// Check A — reference resolution (wiki-links / relative md links / code paths)
// ---------------------------------------------------------------------------

function checkRefs(cfg, ctx, report) {
  const wl = cfg.whitelist || [];
  const whitelisted = (file, ref) =>
    wl.some((w) => (ref === w.ref || ref.endsWith(w.ref)) && (!w.file || w.file === file));
  const isExternal = (t) => (cfg.externalPrefixes || []).some((p) => t.startsWith(p));
  const mdStems = new Map(); // basename-without-.md -> [relPaths]
  for (const f of ctx.mdFiles) {
    const stem = path.posix.basename(f).replace(/\.md$/i, '');
    if (!mdStems.has(stem)) mdStems.set(stem, []);
    mdStems.get(stem).push(f);
  }
  const existsRel = (rel) => fs.existsSync(path.join(ctx.root, rel));

  for (const file of ctx.mdFiles) {
    // Layer resolution: frozen (skip) by glob OR by frontmatter status.
    const fm = ctx.frontmatter(file);
    const status = (fm?.status || '').toLowerCase();
    if (matchAny(file, cfg.layers?.frozen) || (cfg.layers?.frozenStatuses || []).map((s) => s.toLowerCase()).includes(status)) {
      ctx.stats.frozenSkipped++;
      continue;
    }
    const layerSev = matchAny(file, cfg.layers?.authoritative) ? cfg.severity : 'warn';
    const raw = ctx.read(file);
    const offsets = lineOffsets(raw);
    const { text, inlineSpans } = stripForScan(raw);
    const emit = (idx, ref, kind, detail) => {
      if (whitelisted(file, ref)) {
        ctx.stats.whitelisted++;
        return;
      }
      report(file, lineOf(offsets, idx), 'refs', layerSev, `${kind} \`${ref}\` ${detail}`);
    };

    // (a) wiki-links [[target|alias#anchor]] — file-level target only.
    for (const m of text.matchAll(/\[\[([^\[\]]+)\]\]/g)) {
      const target = m[1].split('|')[0].split('#')[0].trim();
      if (!target || isExternal(target)) continue;
      const rule = (cfg.aliasRules || []).find((r) => new RegExp(r.pattern).test(target));
      if (rule) {
        const glob = target.replace(new RegExp(rule.pattern), rule.glob);
        if (!ctx.allFiles.some((f) => globToRegExp(glob).test(f)))
          emit(m.index, target, 'wiki-link', `matches alias rule but no file matches glob \`${glob}\``);
        continue;
      }
      let ok;
      if (target.includes('/')) {
        const fileDir = path.posix.dirname(file);
        ok = [target, `${target}.md`].some(
          (t) => existsRel(t) || existsRel(path.posix.normalize(path.posix.join(fileDir, t)))
        );
      } else {
        ok = mdStems.has(target) || existsRel(target);
      }
      if (!ok) emit(m.index, target, 'wiki-link', 'does not resolve to any file');
    }

    // (b) relative-path markdown links.
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      let url = m[1];
      if (/^(https?:|mailto:|#|\/)/.test(url) || isExternal(url)) continue;
      if (/[{}<*]/.test(url)) continue; // placeholder / template path
      url = url.split('#')[0];
      if (!url) continue;
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(file), decodeURI(url)));
      if (resolved.startsWith('..')) continue; // escapes repo root — treated as external
      if (!existsRel(resolved)) emit(m.index, m[1], 'md-link', `→ \`${resolved}\` not found`);
    }

    // (c) backtick-wrapped repo code paths (configured prefixes only).
    for (const span of inlineSpans) {
      const s = span.content.trim();
      if (!/^[A-Za-z0-9_.@/-]+$/.test(s)) continue; // not a bare path
      if (!(cfg.codePathPrefixes || []).some((p) => s.startsWith(p))) continue;
      if (!existsRel(s)) emit(span.index, s, 'code-path', 'not found on disk');
    }
  }
}

// ---------------------------------------------------------------------------
// Check B — inventory (index file ↔ disk, bidirectional)
// ---------------------------------------------------------------------------

function checkInventory(cfg, ctx, report) {
  for (const set of cfg.sets || []) {
    const indexDir = path.posix.dirname(set.indexFile);
    const raw = ctx.read(set.indexFile);
    if (raw === null) {
      report(set.indexFile, 0, 'inventory', cfg.severity, 'index file itself is missing');
      continue;
    }
    const { text } = stripForScan(raw);
    const offsets = lineOffsets(raw);
    const listed = new Map(); // repo-relative path -> match index
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)#\s]+)[^)]*\)/g)) {
      if (/^(https?:|mailto:|\/)/.test(m[1])) continue;
      listed.set(path.posix.normalize(path.posix.join(indexDir, decodeURI(m[1]))), m.index);
    }
    // Direction 1: every listed entry inside scanDirs must exist on disk.
    for (const [rel, idx] of listed) {
      if (!set.scanDirs.some((d) => rel.startsWith(d.replace(/\/$/, '') + '/'))) continue;
      if (!fs.existsSync(path.join(ctx.root, rel)))
        report(set.indexFile, lineOf(offsets, idx), 'inventory', cfg.severity, `index lists \`${rel}\` but it does not exist`);
    }
    // Direction 2: every md file on disk must be listed or covered by a dir pointer.
    for (const dir of set.scanDirs) {
      const prefix = dir.replace(/\/$/, '') + '/';
      for (const f of ctx.mdFiles.filter((f) => f.startsWith(prefix))) {
        if (f === set.indexFile) continue;
        if (matchAny(f, set.exclude)) continue;
        const covered =
          listed.has(f) || (set.dirPointers || []).some((dp) => f.startsWith(dp.replace(/\/$/, '') + '/'));
        if (!covered)
          report(set.indexFile, 0, 'inventory', cfg.severity, `\`${f}\` exists on disk but is not covered by any index entry or dir pointer`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Check C — frontmatter schema per document class
// ---------------------------------------------------------------------------

function checkFrontmatter(cfg, ctx, report) {
  const maxDesc = cfg.descriptionMaxLength ?? 120;
  for (const file of ctx.mdFiles) {
    const cls = (cfg.classes || []).find((c) => matchAny(file, [].concat(c.glob)));
    if (!cls) continue;
    const fm = ctx.frontmatter(file);
    if (!fm) {
      report(file, 1, 'frontmatter', cfg.severity, `missing frontmatter (class: ${cls.name})`);
      continue;
    }
    for (const field of cls.required || []) {
      if (!fm[field]) report(file, 1, 'frontmatter', cfg.severity, `missing required field \`${field}\` (class: ${cls.name})`);
    }
    if (fm.description && [...fm.description].length > maxDesc)
      report(file, 1, 'frontmatter', cfg.severity, `description is ${[...fm.description].length} chars (max ${maxDesc})`);
    if (fm.status && cls.statusVocab && !cls.statusVocab.map((s) => s.toLowerCase()).includes(fm.status.toLowerCase()))
      report(file, 1, 'frontmatter', cfg.severity, `status \`${fm.status}\` not in ${cls.name} vocabulary [${cls.statusVocab.join(', ')}]`);
  }
}

// ---------------------------------------------------------------------------
// Check D — version-pointer consistency
// ---------------------------------------------------------------------------

function extractVersion(raw, fm) {
  const fromFm = fm?.version?.match(/v?(\d+\.\d+(?:\.\d+)?)/);
  if (fromFm) return 'v' + fromFm[1];
  const head = raw.split('\n').slice(0, 40).join('\n');
  const m = head.match(/\bv(\d+\.\d+(?:\.\d+)?)\b/);
  return m ? 'v' + m[1] : null;
}

function checkVersionPointers(cfg, ctx, report) {
  for (const a of cfg.assertions || []) {
    const targetRaw = ctx.read(a.targetDoc);
    if (targetRaw === null) {
      report(a.targetDoc, 0, 'version-pointer', cfg.severity, 'target doc missing');
      continue;
    }
    const actual = extractVersion(targetRaw, ctx.frontmatter(a.targetDoc));
    if (!actual) continue; // target declares no version — nothing to compare
    const pointerRaw = ctx.read(a.pointerFile);
    if (pointerRaw === null) continue;
    const offsets = lineOffsets(pointerRaw);
    const stem = path.posix.basename(a.targetDoc).replace(/\.md$/i, '');
    let idx = -1;
    while ((idx = pointerRaw.indexOf(stem, idx + 1)) !== -1) {
      // Heuristic per spec: nearest vX.Y within ±120 chars of the mention.
      const lo = Math.max(0, idx - 120);
      const window = pointerRaw.slice(lo, idx + stem.length + 120);
      const center = idx - lo + stem.length / 2;
      let nearest = null;
      for (const m of window.matchAll(/\bv\d+\.\d+(?:\.\d+)?\b/g)) {
        const dist = Math.abs(m.index - center);
        if (!nearest || dist < nearest.dist) nearest = { v: m[0], dist };
      }
      if (nearest && nearest.v !== actual)
        report(a.pointerFile, lineOf(offsets, idx), 'version-pointer', cfg.severity,
          `claims \`${nearest.v}\` for \`${stem}\` but the doc says \`${actual}\``);
    }
  }
}

// ---------------------------------------------------------------------------
// Check E — NN- prefix numbering (continuity + duplicates)
// ---------------------------------------------------------------------------

function checkNumbering(cfg, ctx, report) {
  for (const spec of cfg.dirs || []) {
    const prefix = spec.dir.replace(/\/$/, '') + '/';
    const byNum = new Map();
    for (const f of ctx.mdFiles.filter((f) => f.startsWith(prefix) && !f.slice(prefix.length).includes('/'))) {
      if (matchAny(f, spec.exclude)) continue;
      const m = path.posix.basename(f).match(spec.pattern ? new RegExp(spec.pattern) : /^(\d{2,})-/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      if (!byNum.has(n)) byNum.set(n, []);
      byNum.get(n).push(f);
    }
    const nums = [...byNum.keys()].sort((a, b) => a - b);
    for (const n of nums) {
      if (byNum.get(n).length > 1)
        report(spec.dir, 0, 'numbering', cfg.severity, `number ${String(n).padStart(2, '0')} is duplicated: ${byNum.get(n).join(' / ')}`);
    }
    for (let i = 1; i < nums.length; i++) {
      for (let miss = nums[i - 1] + 1; miss < nums[i]; miss++)
        report(spec.dir, 0, 'numbering', cfg.severity, `numbering gap: ${String(miss).padStart(2, '0')} is missing (between ${nums[i - 1]} and ${nums[i]})`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check F — plan staleness (forbidden dwell status × commits since creation)
// ---------------------------------------------------------------------------

/** Approximate commit timestamps from the reflog (.git/logs/HEAD) — fs-only, no git binary. */
function commitTimestamps(root) {
  const reflog = path.join(root, '.git', 'logs', 'HEAD');
  if (!fs.existsSync(reflog)) return null;
  const ts = [];
  for (const line of fs.readFileSync(reflog, 'utf8').split('\n')) {
    const m = line.match(/ (\d{9,11}) [+-]\d{4}\tcommit/);
    if (m) ts.push(parseInt(m[1], 10) * 1000);
  }
  return ts;
}

function checkPlanStaleness(cfg, ctx, report) {
  const commits = commitTimestamps(ctx.root);
  if (!commits) return; // not a git repo (or reflog disabled) — check degrades to no-op
  const forbidden = (cfg.forbiddenStatuses || []).map((s) => s.toLowerCase());
  for (const file of ctx.mdFiles.filter((f) => matchAny(f, [].concat(cfg.glob)))) {
    const fm = ctx.frontmatter(file);
    const status = (fm?.status || '').toLowerCase();
    if (!forbidden.includes(status)) continue;
    const createdMs = fm?.created ? Date.parse(fm.created) : fs.statSync(path.join(ctx.root, file)).mtimeMs;
    if (Number.isNaN(createdMs)) continue;
    const since = commits.filter((t) => t >= createdMs).length;
    if (since > cfg.maxCommitsSinceCreated)
      report(file, 1, 'plan-staleness', cfg.severity,
        `still \`${status}\` after ~${since} commits since created (threshold ${cfg.maxCommitsSinceCreated})`);
  }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

const CHECKS = [
  ['refs', checkRefs],
  ['inventory', checkInventory],
  ['frontmatter', checkFrontmatter],
  ['versionPointers', checkVersionPointers],
  ['numbering', checkNumbering],
  ['planStaleness', checkPlanStaleness],
];

export function runChecks(config, root) {
  const allFiles = walkFiles(root);
  const inc = config.files?.include || ['**/*.md'];
  const exc = config.files?.exclude || [];
  const mdFiles = allFiles
    .filter((f) => f.endsWith('.md') && matchAny(f, inc) && !matchAny(f, exc))
    .sort();

  const textCache = new Map();
  const fmCache = new Map();
  const ctx = {
    root,
    allFiles,
    mdFiles,
    stats: { scanned: mdFiles.length, whitelisted: 0, frozenSkipped: 0 },
    read(rel) {
      if (!textCache.has(rel)) {
        const abs = path.join(root, rel);
        textCache.set(rel, fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null);
      }
      return textCache.get(rel);
    },
    frontmatter(rel) {
      if (!fmCache.has(rel)) {
        const raw = ctx.read(rel);
        fmCache.set(rel, raw === null ? null : parseFrontmatter(raw));
      }
      return fmCache.get(rel);
    },
  };

  const violations = [];
  const report = (file, line, check, severity, message) => {
    if (severity === 'off') return;
    violations.push({ file, line, check, severity, message });
  };

  for (const [key, fn] of CHECKS) {
    const cfg = config[key];
    if (!cfg || cfg.severity === 'off') continue;
    fn({ severity: 'error', ...cfg }, ctx, report);
  }
  return { violations, stats: ctx.stats };
}
