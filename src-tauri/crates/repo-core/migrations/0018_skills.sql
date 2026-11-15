-- ADR-033: the skill index. An independent library like `websites` (ADR-030),
-- not a prompt asset: outside the three-layer model, the trash and the
-- soft-delete gate. Rows are owned by the imported index file; `pin_slot` and
-- `skill_usage` are owned by this app and survive every re-import.
--
-- Enumerated columns (stage / trigger_mode / source / status) are validated in
-- Rust (`repo_core::skills`), not by CHECK: opening a seventh stage column must
-- be a decision, but it should not also cost a table rebuild.
CREATE TABLE skills (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  purpose TEXT NOT NULL DEFAULT '',
  when_to_use TEXT NOT NULL DEFAULT '',
  not_for TEXT NOT NULL DEFAULT '',
  invocation TEXT NOT NULL DEFAULT '',
  stage TEXT,
  trigger_mode TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  pin_slot INTEGER CHECK(pin_slot BETWEEN 1 AND 9),
  order_index INTEGER NOT NULL CHECK(order_index >= 0),
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_skills_pin_slot ON skills(pin_slot) WHERE pin_slot IS NOT NULL;

-- One row per copy. The count and the last-used time are derived from it, so a
-- review can ask "what was used in this period", which a bare counter cannot.
CREATE TABLE skill_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  used_at TEXT NOT NULL
);
CREATE INDEX idx_skill_usage_skill ON skill_usage(skill_id, used_at);
