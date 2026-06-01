-- M-X.1 compositions table (ADR-015 / PRD §10.2).
--
-- Reconciles a PRD tension: §6.2 says a *workbench* Composition is transient
-- (assembled in memory, discarded or upgraded to a Macro — still true). But
-- §10.2's promote contract routes a `composition` draft to
-- AssetRepo::insert_composition and lists `compositions` among the real asset
-- tables holding the source of truth. A Claude-proposed, omar-promoted
-- Composition is therefore a deliberately persisted asset with its own
-- lifecycle, distinct from the throwaway workbench instance.
--
-- forward-only: no DROP TABLE / down migration.

CREATE TABLE compositions (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    modifier_ids  TEXT NOT NULL,                 -- JSON array of modifier ids
    phase_id      TEXT NOT NULL REFERENCES phases(id),
    scene_id      TEXT REFERENCES scenes(id),
    usage_count   INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
    last_used_at  TEXT,
    created_at    TEXT NOT NULL,
    notes         TEXT,
    deprecated    INTEGER NOT NULL DEFAULT 0 CHECK (deprecated IN (0,1))
);

CREATE INDEX idx_compositions_by_phase ON compositions (phase_id);
CREATE INDEX idx_compositions_by_scene ON compositions (scene_id);
