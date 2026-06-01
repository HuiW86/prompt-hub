-- M-X.1 drafts staging inbox (ADR-015 / plan §4.1).
-- Claude Code writes proposed assets here via the MCP server; omar promotes
-- them into the real asset tables from the Scene "📥 草稿" tab. The MCP server
-- may only INSERT/UPDATE drafts (never the real tables) — that boundary is
-- enforced by the Cargo dependency graph (plan §3.3), not by this schema.
--
-- forward-only: no DROP TABLE / down migration. Retiring drafts needs a new
-- migration and an ADR-015 superseded link.

CREATE TABLE drafts (
    id              TEXT PRIMARY KEY,
    target_type     TEXT NOT NULL CHECK (target_type IN
                    ('modifier','composition','macro','alignment_phrase')),
    schema_version  INTEGER NOT NULL,
    payload_json    TEXT NOT NULL,
    payload_hash    TEXT NOT NULL,           -- SHA-256(payload_json); dedups pending bulk imports
    provenance      TEXT NOT NULL,           -- JSON (source_app / conversation_ref / tool_name / ...)
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','discarded')),
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX idx_drafts_status_created
    ON drafts (status, created_at DESC);
CREATE INDEX idx_drafts_target_type
    ON drafts (target_type);
-- Dedup only pending drafts; discarded rows are kept for audit history.
CREATE UNIQUE INDEX idx_drafts_hash_pending
    ON drafts (payload_hash)
    WHERE status = 'pending';
