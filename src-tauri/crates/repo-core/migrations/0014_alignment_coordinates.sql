-- ADR-029 P0: alignment coordinates + the drift ledger.
--
-- Four things land together because they are one contract, not four:
--   1. `alignment_axis_values` — the configurable value list for the three
--      coordinate axes (抽象层 / 闭环域 / 模式). NOT an asset table: no
--      `deleted_at`, no `deprecated`, hard delete only (06-prd §6.6-bis). It is
--      the first table in this schema that is "not an asset" yet still user
--      content, so it stays OUT of the seventh source-level gate and IN the
--      export bundle.
--   2. six new columns on `alignment_phrases` — `kind` (opening / cue), the
--      three nullable coordinate ids, `cue_axis` (which axis a cue corrects),
--      and `content_revised_at` (the split point the ledger reports before /
--      after). Coordinates store ids, not names, so renaming an axis value
--      never invalidates a phrase's coordinates (ADR-029 口径 2).
--   3. seed — a 9th phase 「中途」 carrying the six live cues, six form phrases
--      distributed across six existing phases, and 16 axis values. The eight
--      pre-existing phases and their eight default phrases are untouched.
--   4. a full rebuild of `usage_records` — `source` gains `'live_cue'` and the
--      table gains `session_started_at` (the wake-session boundary the
--      attribution algorithm groups by, 06-prd §6.8).
--
-- Ordering is load-bearing: the axis table must exist before the ADD COLUMNs
-- that reference it, and both must exist before the seed rows that fill them.
--
-- WHY the rebuild: `source` is a CHECK-constrained TEXT column and SQLite
-- cannot ALTER a CHECK. Adding an enum value means new table → copy every
-- historical row → drop → rename → recreate the three 0001 indexes. This is the
-- highest-write table in the database and it is NOT covered by `deleted_at`;
-- the `pre-migrate-<unix>.db` snapshot db.rs takes before any pending migration
-- runs is the ONLY way back from it. Every column is copied verbatim, so a row
-- written before this migration comes out the other side byte-identical with
-- `session_started_at` NULL — which the ledger reads as "no session known" and
-- skips, rather than inventing a boundary for history that never had one.
--
-- forward-only: no DROP COLUMN / down migration. The rebuild in particular is
-- the irreversible step named in ADR-029 §6 "不可逆点" ①.

-- ── 1. The axis value table ─────────────────────────────────────────────────
-- No `deleted_at` and no `deprecated`, and that is a decision rather than an
-- omission (06-prd §6.6-bis "删除策略"): the loss a trash can protects against
-- is "I deleted a phrase I wrote", and deleting an axis value loses nothing —
-- `ON DELETE SET NULL` below leaves every phrase intact, merely un-coordinated.
CREATE TABLE alignment_axis_values (
    id           TEXT PRIMARY KEY,
    axis         TEXT NOT NULL CHECK (axis IN ('layer','domain','mode')),
    name         TEXT NOT NULL,
    hint         TEXT,
    order_index  INTEGER NOT NULL CHECK (order_index >= 0)
);

-- order_index is partitioned BY axis (like modifiers by group_kind, phrases by
-- sub_stage_id), so the index that serves every read is the composite one.
CREATE INDEX idx_alignment_axis_values_order ON alignment_axis_values (axis, order_index);

-- ── 2. The six new alignment_phrases columns ────────────────────────────────
-- Every one is nullable or carries a non-NULL default, which is what makes
-- `ADD COLUMN` legal with `PRAGMA foreign_keys = ON` (a REFERENCES column added
-- this way must default to NULL — db.rs::configure turns FKs on, so this is the
-- form the three coordinate columns are required to take).
ALTER TABLE alignment_phrases ADD COLUMN kind TEXT NOT NULL DEFAULT 'opening'
    CHECK (kind IN ('opening','cue'));
ALTER TABLE alignment_phrases ADD COLUMN layer_id TEXT
    REFERENCES alignment_axis_values(id) ON DELETE SET NULL;
ALTER TABLE alignment_phrases ADD COLUMN domain_id TEXT
    REFERENCES alignment_axis_values(id) ON DELETE SET NULL;
ALTER TABLE alignment_phrases ADD COLUMN mode_id TEXT
    REFERENCES alignment_axis_values(id) ON DELETE SET NULL;
-- Which axis a cue corrects. Single-purpose column rather than a reuse of the
-- three coordinates above, because 形态 has no coordinate column at all (it is
-- carried by phase_id) and because the coordinates already mean something on
-- the copy path (ADR-029 口径 3).
ALTER TABLE alignment_phrases ADD COLUMN cue_axis TEXT
    CHECK (cue_axis IN ('form','layer','domain','mode'));
-- Refreshed ONLY when `content` actually changes — not on rename, not on a
-- coordinate edit, not on set-default. A split point moved by noise is not a
-- split point (06-prd §6.6 字段设计理由).
ALTER TABLE alignment_phrases ADD COLUMN content_revised_at TEXT;

-- No index on the three coordinate columns. Both tables are tens of rows at the
-- §11 ceiling and every read of them already scans the whole table; an index
-- would buy nothing but write cost.

-- ── 3. Seed ─────────────────────────────────────────────────────────────────
-- 16 axis values. `hint` is taken verbatim from the LAYERS / DOMAINS / MODES
-- constants of docs/mockups/开场对齐台.html.
--
-- 「不限」 is deliberately NOT a row: the prototype's "不限" chip corresponds to
-- the phrase's column being NULL. A row named 不限 would create two spellings of
-- the same idea with two different filter predicates (06-prd §6.6-bis).
INSERT INTO alignment_axis_values (id, axis, name, hint, order_index) VALUES
    ('axv-layer-meaning',        'layer',  '意义',     '这件事为什么重要',           0),
    ('axv-layer-endgame',        'layer',  '终局',     '做成之后世界是什么样',       1),
    ('axv-layer-positioning',    'layer',  '定位',     '主语是什么、为谁、边界在哪', 2),
    ('axv-layer-architecture',   'layer',  '架构',     '系统由哪些部分组成',         3),
    ('axv-layer-path',           'layer',  '路径',     '分几期、每期做什么',         4),
    ('axv-layer-criteria',       'layer',  '判据',     '怎么算做成了、什么情况算失败', 5),
    ('axv-layer-implementation', 'layer',  '实现',     '具体怎么做',                 6),
    ('axv-domain-tech',          'domain', '技术',     '能不能做出来',               0),
    ('axv-domain-business',      'domain', '商业',     '谁买单、多少钱',             1),
    ('axv-domain-user',          'domain', '用户',     '谁用、什么场景触发',         2),
    ('axv-domain-data',          'domain', '数据资产', '沉淀什么、如何复利',         3),
    ('axv-domain-org',           'domain', '组织',     '谁来做、需要什么能力',       4),
    ('axv-domain-compliance',    'domain', '合规',     '法律边界、知情与权属',       5),
    ('axv-mode-diverge',         'mode',   '发散',     '只做加法',                   0),
    ('axv-mode-converge',        'mode',   '收敛',     '做减法与排序',               1),
    ('axv-mode-recon',           'mode',   '侦察',     '先取证再判断',               2);

-- The 9th phase. `phases` gains no column — this is a seed row in a table that
-- has declared itself user-editable since v0.3, which is exactly why ADR-029
-- could give the live cues a real phase instead of making `phase_id` nullable
-- (that would have meant editing 01-spec §3.5, a human-authored document).
-- Same color as the other eight; `description` keeps the half-width comma the
-- other eight seed rows use.
INSERT INTO phases (id, name, order_index, color, description) VALUES
    ('phase-live', '中途', 8, '#534AB7', '对话中途换挡,不在开场');

-- Six form phrases (`kind = 'opening'`, all three coordinates NULL, non-default)
-- distributed across six EXISTING phases. `content` is verbatim from the FORMS
-- constant of the prototype. 理解 and 沉淀 take no new phrase this round.
--
-- order_index 1: migration 0007 partitions order_index per phase and the 0002
-- seed left exactly one phrase (index 0) in each of these phases, so appending
-- means 1. 挑错 landing in 收敛 is the acknowledged compromise (ADR-029 子决策 1)
-- — 8 phases have no seat for it — and its usage relative to the 收敛 default is
-- the first evidence that would justify re-cutting them.
INSERT INTO alignment_phrases (id, phase_id, name, content, kind, is_default, order_index, created_at) VALUES
    ('ap-form-explore',   'phase-diverge',  '探讨',   '这次是探讨，不要给方案。我描述的痛点只是症状，不要直接当作问题定义。请给出竞争性的解释、指出我没有想到的角度，可以自由断言，不必逐条验证。不要动文件。', 'opening', 0, 1, '2026-09-04T00:00:00Z'),
    ('ap-form-path',      'phase-plan',     '定路径', '目标已经确定，是［填目标］。这次要的是实现路径，不要再论证要不要做，也不要质疑前提是否成立。给方案、步骤和取舍。遇到分叉时按你判断的默认值往下走并说明理由，只有会改变整体方向的分叉才停下来问我，一次只问一个。', 'opening', 0, 1, '2026-09-04T00:00:00Z'),
    ('ap-form-asset',     'phase-generate', '出资产', '这次要产出一份可以反复使用的［规范／模板／清单／流程］。用正式文档体，不要口语。必须写清楚三件事：什么场景下调用它、默认值是什么、什么情况下它失效。写完直接给文件，不要先在对话里讨论结构。', 'opening', 0, 1, '2026-09-04T00:00:00Z'),
    ('ap-form-revise',    'phase-iterate',  '改稿',   '这是现成的［文档／方案／代码］，我认为问题在于［填你的判断］。先判断我的诊断是否成立，补上我没有看到的问题，然后直接改一版给我，不要只给修改建议。改动逐条列出，每处说明为什么改。', 'opening', 0, 1, '2026-09-04T00:00:00Z'),
    ('ap-form-execute',   'phase-execute',  '执行',   '直接做［填交付物］。要求是［A、B、C］。不要先与我确认方案，不要问细节。没说清楚的地方按你的判断填上，在最后统一列出来给我核对。', 'opening', 0, 1, '2026-09-04T00:00:00Z'),
    ('ap-form-critique',  'phase-converge', '挑错',   '这是［填对象］，我要的是挑错，不是改进方案。找出站不住的地方、没有说出口的假设、我可能在自欺的地方。不要给替代方案，也不要为了显得平衡而补充优点。', 'opening', 0, 1, '2026-09-04T00:00:00Z');

-- Six live cues (`kind = 'cue'`), all under 中途, name = content (they are one
-- short line each). `cue_axis` says which axis the cue corrects; 「停」 is NULL
-- because it is a halt, not a drift — it still records `live_cue`, it just lands
-- in no axis column (ADR-029 子决策 4 "一处诚实的记账").
--
-- order_index follows the 06-prd §6.6 table order, which puts the default 「停」
-- last. That differs from the other eight phases, where the default happens to
-- sit at 0 — a consequence of 0007's backfill, not a rule anyone wrote down.
INSERT INTO alignment_phrases (id, phase_id, name, content, kind, cue_axis, is_default, order_index, created_at) VALUES
    ('ap-live-shift-form',   'phase-live', '换挡：探讨',       '换挡：探讨',       'cue', 'form',   0, 0, '2026-09-04T00:00:00Z'),
    ('ap-live-shift-layer',  'phase-live', '换层：路径层',     '换层：路径层',     'cue', 'layer',  0, 1, '2026-09-04T00:00:00Z'),
    ('ap-live-back-to-pos',  'phase-live', '回到定位层',       '回到定位层',       'cue', 'layer',  0, 2, '2026-09-04T00:00:00Z'),
    ('ap-live-domain-only',  'phase-live', '本轮只谈商业闭环', '本轮只谈商业闭环', 'cue', 'domain', 0, 3, '2026-09-04T00:00:00Z'),
    ('ap-live-converge',     'phase-live', '切收敛',           '切收敛',           'cue', 'mode',   0, 4, '2026-09-04T00:00:00Z'),
    ('ap-live-stop',         'phase-live', '停',               '停',               'cue', NULL,     1, 5, '2026-09-04T00:00:00Z');

-- Every phase keeps exactly one default (06-prd §6.5), and ⌘9 copies this one.
UPDATE phases SET default_alignment_phrase_id = 'ap-live-stop' WHERE id = 'phase-live';

-- ── 4. usage_records rebuild ────────────────────────────────────────────────
-- The new table is the 0001 definition with two changes: `'live_cue'` appended
-- to the `source` CHECK, and `session_started_at` added. Nothing references
-- usage_records, so dropping it under `PRAGMA foreign_keys = ON` fires no
-- cascade; its own two outbound FKs (sops, phases) are re-declared identically
-- and still hold for every copied row.
--
-- `source` is documented as "the entry point the copy came from". `'live_cue'`
-- breaks that: it is the CLASS of the copied phrase, so a cue copied from the
-- recents strip records `live_cue`, not `recent`. The overload is deliberate
-- and it is cheaper than a column on the busiest, append-only table in the
-- database (ADR-029 口径 7 / 06-prd §6.8). It is also frozen from here on: this
-- table is never rewritten, so redefining a value already in the history would
-- retroactively falsify it.
CREATE TABLE usage_records_new (
    id                  TEXT PRIMARY KEY,
    timestamp           TEXT NOT NULL,
    target_type         TEXT NOT NULL CHECK (target_type IN ('modifier','macro','phrase','composition','alignment')),
    target_id           TEXT,
    source              TEXT NOT NULL CHECK (source IN ('macro_area','scene','recent','sop','composition','phase_bar','live_cue')),
    modifier_ids        TEXT,             -- JSON array, only for target_type IN ('composition','macro')
    sop_id              TEXT REFERENCES sops(id),
    sop_step_order      INTEGER,
    phase_id            TEXT REFERENCES phases(id),
    -- The wake this copy belonged to, stamped by the frontend from the `wake`
    -- window event. NULL for every row written before this migration: the
    -- attribution algorithm skips those groups rather than pretending the whole
    -- of history was one session (06-prd §6.8 step 1).
    session_started_at  TEXT
);

INSERT INTO usage_records_new
    (id, timestamp, target_type, target_id, source, modifier_ids, sop_id, sop_step_order, phase_id, session_started_at)
SELECT id, timestamp, target_type, target_id, source, modifier_ids, sop_id, sop_step_order, phase_id, NULL
FROM usage_records;

DROP TABLE usage_records;
ALTER TABLE usage_records_new RENAME TO usage_records;

-- Dropping the old table dropped its three indexes with it; recreate them
-- exactly as 0001 declared them.
CREATE INDEX idx_usage_records_timestamp ON usage_records (timestamp DESC);
CREATE INDEX idx_usage_records_target ON usage_records (target_type, target_id);
CREATE INDEX idx_usage_records_phase ON usage_records (phase_id);
