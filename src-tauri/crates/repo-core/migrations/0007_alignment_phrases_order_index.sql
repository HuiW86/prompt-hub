-- P2b alignment_phrases.order_index (plan asset-editing-and-adaptive-layout §0 Q6, decision D-c).
--
-- Alignment phrases gain a user-controlled sort position PER phase (phase_id):
-- order_index restarts at 0 inside each phase, so the per-phase chip row can be
-- reordered deterministically (dnd-kit, ADR-016) without touching is_default.
-- Backfill preserves the prior visible order (is_default first, then most-used,
-- then oldest) so existing rows keep their current on-screen sequence; rowid is
-- the stable final tiebreaker.
--
-- forward-only: no DROP COLUMN / down migration.

ALTER TABLE alignment_phrases ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0);

WITH ordered AS (
    SELECT id,
           (ROW_NUMBER() OVER (
                PARTITION BY phase_id
                ORDER BY is_default DESC, usage_count DESC, created_at ASC, rowid ASC
            ) - 1) AS new_order
    FROM alignment_phrases
)
UPDATE alignment_phrases
SET order_index = (SELECT new_order FROM ordered WHERE ordered.id = alignment_phrases.id);

CREATE INDEX idx_alignment_phrases_order ON alignment_phrases (phase_id, order_index);
