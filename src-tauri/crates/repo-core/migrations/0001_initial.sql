-- Initial schema for prompt-hub. Maps 06-prd §6 data model.
-- Timestamps stored as ISO 8601 strings (chrono::DateTime<Utc>).
-- Booleans stored as INTEGER (0/1) per SQLite convention.
-- JSON arrays (expand_from, role_presets, modifier_ids) stored as TEXT.

CREATE TABLE modifiers (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    content      TEXT NOT NULL,
    group_kind   TEXT NOT NULL CHECK (group_kind IN ('cognition','action','delivery','constraint')),
    usage_count  INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    last_used_at TEXT,
    created_at   TEXT NOT NULL,
    notes        TEXT,
    deprecated   INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0,1))
);

CREATE TABLE phases (
    id                            TEXT PRIMARY KEY,
    name                          TEXT NOT NULL,
    order_index                   INTEGER NOT NULL CHECK (order_index >= 0),
    color                         TEXT,
    description                   TEXT,
    visible                       INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
    -- FK back-pointer; we let it reference alignment_phrases(id) but allow NULL.
    -- Cycle between phases.default_alignment_phrase_id and alignment_phrases.phase_id
    -- is resolved by seeding phases with NULL first, inserting phrases, then UPDATE.
    default_alignment_phrase_id   TEXT REFERENCES alignment_phrases(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE alignment_phrases (
    id           TEXT PRIMARY KEY,
    phase_id     TEXT NOT NULL REFERENCES phases(id),
    name         TEXT NOT NULL,
    content      TEXT NOT NULL,
    is_default   INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0,1)),
    usage_count  INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    last_used_at TEXT,
    created_at   TEXT NOT NULL,
    notes        TEXT,
    deprecated   INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0,1))
);

-- At most one is_default=1 per phase (06-prd §6.6 constraint).
CREATE UNIQUE INDEX idx_alignment_phrase_one_default_per_phase
    ON alignment_phrases (phase_id)
    WHERE is_default = 1;

CREATE INDEX idx_alignment_phrase_by_phase ON alignment_phrases (phase_id);

CREATE TABLE scenes (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    icon          TEXT,
    order_index   INTEGER NOT NULL CHECK (order_index >= 0),
    visible       INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0,1)),
    role_presets  TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
    color         TEXT
);

CREATE TABLE sub_stages (
    id          TEXT PRIMARY KEY,
    scene_id    TEXT NOT NULL REFERENCES scenes(id),
    name        TEXT NOT NULL,
    order_index INTEGER NOT NULL CHECK (order_index >= 0)
);

CREATE INDEX idx_sub_stages_by_scene ON sub_stages (scene_id);

CREATE TABLE phrases (
    id            TEXT PRIMARY KEY,
    scene_id      TEXT NOT NULL REFERENCES scenes(id),
    name          TEXT NOT NULL,
    content       TEXT NOT NULL,
    usage_count   INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    last_used_at  TEXT,
    created_at    TEXT NOT NULL,
    notes         TEXT,
    deprecated    INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0,1)),
    sub_stage_id  TEXT REFERENCES sub_stages(id)
);

CREATE INDEX idx_phrases_by_scene ON phrases (scene_id);
CREATE INDEX idx_phrases_by_sub_stage ON phrases (sub_stage_id);

CREATE TABLE macros (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    content       TEXT NOT NULL,
    expand_from   TEXT,  -- JSON array of modifier ids; NULL when native=1
    native        INTEGER NOT NULL DEFAULT 0 CHECK (native IN (0,1)),
    role          TEXT,
    task          TEXT,
    usage_count   INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    last_used_at  TEXT,
    created_at    TEXT NOT NULL,
    notes         TEXT,
    scene_id      TEXT REFERENCES scenes(id),
    deprecated    INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0,1)),
    CHECK ((native = 1 AND expand_from IS NULL) OR native = 0)
);

CREATE INDEX idx_macros_by_scene ON macros (scene_id);

CREATE TABLE sops (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    description       TEXT,
    created_at        TEXT NOT NULL,
    last_executed_at  TEXT,
    execution_count   INTEGER NOT NULL DEFAULT 0 CHECK (execution_count >= 0),
    source            TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','recorded')),
    status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','archived'))
);

CREATE TABLE sop_steps (
    id                TEXT PRIMARY KEY,
    sop_id            TEXT NOT NULL REFERENCES sops(id),
    order_index       INTEGER NOT NULL CHECK (order_index >= 0),
    target_type       TEXT NOT NULL CHECK (target_type IN ('phrase','macro')),
    target_id         TEXT NOT NULL,
    optional          INTEGER NOT NULL DEFAULT 0 CHECK (optional IN (0,1)),
    branch_condition  TEXT,
    note              TEXT,
    UNIQUE (sop_id, order_index)
);

CREATE INDEX idx_sop_steps_by_sop ON sop_steps (sop_id);

CREATE TABLE usage_records (
    id              TEXT PRIMARY KEY,
    timestamp       TEXT NOT NULL,
    target_type     TEXT NOT NULL CHECK (target_type IN ('modifier','macro','phrase','composition','alignment')),
    target_id       TEXT,
    source          TEXT NOT NULL CHECK (source IN ('macro_area','scene','recent','sop','composition','phase_bar')),
    modifier_ids    TEXT,             -- JSON array, only for target_type IN ('composition','macro')
    sop_id          TEXT REFERENCES sops(id),
    sop_step_order  INTEGER,
    phase_id        TEXT REFERENCES phases(id)
);

CREATE INDEX idx_usage_records_timestamp ON usage_records (timestamp DESC);
CREATE INDEX idx_usage_records_target ON usage_records (target_type, target_id);
CREATE INDEX idx_usage_records_phase ON usage_records (phase_id);
