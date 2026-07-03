// doc-governance.config.mjs — prompt-hub documentation contract (4th source-level gate).
//
// Consumed by the vendored checker `scripts/doc-governance/index.mjs` (doc-governance
// v0.1, upstream: ai-dev-lifecycle content-os/doc-governance). Executed by the Vitest
// gate `scripts/doc-governance/doc-refs-gate.test.ts` on every `pnpm test`.
//
// Manual run:
//   node scripts/doc-governance/index.mjs --config doc-governance.config.mjs
//
// Three-layer model (per task charter + CLAUDE.md §3 hot/warm/cold zones):
//   authoritative (error) — numbered design docs 01–11, docs/design/README.md,
//                           CLAUDE.md, docs/MANIFEST.md. Broken refs here block the gate.
//   working (warn)        — docs/plans/**, docs/workflows/**, HANDOFF.md, non-Superseded
//                           ADRs, plus everything else scanned (CHANGELOG, CLAUDE-DESIGN,
//                           learnings). Violations print but never fail.
//   frozen (skip)         — Superseded ADRs (via frontmatter status), docs/mockups/**,
//                           docs/research/**, docs/design-handoff/** (archived material).

export default {
  root: ".",

  files: {
    // Governed markdown only: project AI context at repo root + the docs tree.
    // src/, src-tauri/, node_modules etc. carry no governed docs.
    include: ["CLAUDE.md", "HANDOFF.md", "docs/**/*.md"],
    exclude: [],
  },

  // ── A. refs — wiki-links / relative md links / backtick code paths ─────────
  refs: {
    severity: "error", // authoritative layer; working layer is capped to warn by the tool
    layers: {
      authoritative: [
        "docs/design/[0-9][0-9]-*.md",
        "docs/design/README.md",
        "CLAUDE.md",
        "docs/MANIFEST.md",
      ],
      frozen: ["docs/mockups/**", "docs/research/**", "docs/design-handoff/**"],
      // ADRs flip to frozen the moment their frontmatter says Superseded (e.g. ADR-012).
      frozenStatuses: ["superseded"],
    },
    aliasRules: [
      // ADR-NNN prose references resolve to the on-disk decision record.
      { pattern: "^ADR-(\\d{3})$", glob: "docs/adr/$1-*.md" },
    ],
    // References that leave the repo (Vault knowledge base, absolute machine paths).
    externalPrefixes: [
      "~/Vault",
      "../../Vault",
      "/Users/",
      "https://",
      "http://",
    ],
    // Backtick paths with these prefixes must exist on disk (MANIFEST lists files
    // as backtick code paths — this is the "index entry → disk" direction for it).
    codePathPrefixes: [
      "docs/",
      "src/",
      "src-tauri/",
      "scripts/",
      "bench/",
      ".github/",
    ],
    whitelist: [
      // Each entry: { file?, ref, reason }. Reason + recycle condition mandatory.
      {
        ref: "产品文档体系方法论",
        reason:
          "Established convention: Obsidian stem-only wiki-link to the external methodology doc " +
          "(~/Vault/知识库/方案模板/产品文档体系方法论.md, outside this repo). No recycle path — " +
          "external by design; path-prefixed forms are already covered by externalPrefixes.",
      },
      {
        file: "docs/design/07-features.md",
        ref: "scripts/update-features.sh",
        reason:
          "Not a dead link: the doc itself states the script 「从未落地，现状为手动维护」— the backtick " +
          "path names a deliberately never-created file. Recycle: remove this entry when the script " +
          "lands or the clause is deleted.",
      },
    ],
  },

  // ── B. inventory — docs/MANIFEST.md ↔ disk, bidirectional ──────────────────
  //
  // v0.1 parser limitation, declared here on purpose: MANIFEST lists individual
  // files as *backtick code paths* (project convention), which check B cannot see
  // (it only parses markdown links). The "listed → exists" direction for those
  // entries is therefore delegated to refs check (c) via codePathPrefixes above.
  // The "disk → listed" direction is carried by directory-level pointers below:
  // every governed subtree must be pointed at by MANIFEST (§8 ADR / §9 plans /
  // §2–§7 design / §11.7 research …). A brand-new top-level docs/ subdir without
  // a pointer here + a MANIFEST entry will fail the gate. Recycle condition:
  // upstream doc-governance learns backtick index entries → shrink dirPointers
  // to true directory pointers only (docs/adr/).
  inventory: {
    severity: "error",
    sets: [
      {
        indexFile: "docs/MANIFEST.md",
        scanDirs: [
          "docs/design",
          "docs/adr",
          "docs/plans",
          "docs/workflows",
          "docs/research",
        ],
        dirPointers: [
          "docs/design",
          "docs/adr",
          "docs/plans",
          "docs/workflows",
          "docs/research",
        ],
        exclude: [],
      },
    ],
  },

  // ── C. frontmatter — numbered design docs schema ───────────────────────────
  //
  // Vocabulary basis (盘面实际, 2026-07-02): docs/design/01–11 use
  // pre-code (01/04/06/10) · ratified (02/05/08/09/11; 08/11 v0.2 human-reviewed
  // 2026-07-02) · draft (03) ·
  // in-progress (07); done/active/paused reserved as known lifecycle states
  // (MANIFEST/plans use active·done; paused per methodology vocabulary).
  //
  // ADR class is intentionally NOT enforced here: ADR frontmatter vocabulary is
  // Proposed / Accepted / Superseded / Reserved / Deprecated (+ `template` on
  // 000-template), but v0.1 has a single check-global descriptionMaxLength and
  // 8 existing ADRs carry >120-char descriptions by convention (recall-oriented
  // one-liners, up to 318 chars). Recycle condition: upstream gains per-class
  // description budgets → add the ADR class with the vocabulary above.
  frontmatter: {
    severity: "error",
    descriptionMaxLength: 120,
    classes: [
      {
        name: "design-doc",
        glob: "docs/design/[0-9][0-9]-*.md",
        required: ["version", "status", "description"],
        statusVocab: [
          "draft",
          "pre-code",
          "in-progress",
          "ratified",
          "active",
          "done",
          "paused",
        ],
      },
    ],
  },

  // ── D. version-pointer — CLAUDE.md claims vs target doc frontmatter ────────
  // CLAUDE.md (hot zone) carries version claims for the docs it points at; a bump
  // that forgets the pointer file shows up here (methodology §7 ripple step).
  versionPointers: {
    severity: "error",
    assertions: [
      { pointerFile: "CLAUDE.md", targetDoc: "docs/design/01-spec.md" },
      { pointerFile: "CLAUDE.md", targetDoc: "docs/design/02-constitution.md" },
      { pointerFile: "CLAUDE.md", targetDoc: "docs/design/03-product-spec.md" },
      { pointerFile: "CLAUDE.md", targetDoc: "docs/design/05-design-spec.md" },
      { pointerFile: "CLAUDE.md", targetDoc: "docs/design/06-prd.md" },
      { pointerFile: "CLAUDE.md", targetDoc: "docs/design/07-features.md" },
      { pointerFile: "CLAUDE.md", targetDoc: "docs/design/09-tech-stack.md" },
      { pointerFile: "CLAUDE.md", targetDoc: "docs/MANIFEST.md" },
    ],
  },

  // ── E. numbering — NN- prefix continuity (MANIFEST §12 rule 5) ─────────────
  numbering: {
    severity: "error",
    dirs: [{ dir: "docs/adr" }, { dir: "docs/design" }],
  },

  // ── F. planStaleness — intentionally not enabled ────────────────────────────
  // Plans on disk use active / in-progress / done; long-lived `active` plans are
  // legitimate here (prompt-hub-mvp spans all of S1–S5), so there is no forbidden
  // dwell status yet. Enable when the plan lifecycle gains a draft/pre-code stage.
};
