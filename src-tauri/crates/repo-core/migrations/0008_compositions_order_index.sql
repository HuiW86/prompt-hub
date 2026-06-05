-- P2c compositions.order_index (plan asset-editing-and-adaptive-layout §0 Q6, decision A + per-phase).
--
-- Compositions gain a user-controlled sort position PER phase (phase_id):
-- order_index restarts at 0 inside each phase, so the per-phase list can be
-- reordered deterministically (dnd-kit, ADR-016). Backfill preserves the prior
-- visible order (most-used first, then oldest) so existing rows keep their
-- current on-screen sequence; rowid is the stable final tiebreaker.
--
-- forward-only: no DROP COLUMN / down migration.

ALTER TABLE compositions ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0);

WITH ordered AS (
    SELECT id,
           (ROW_NUMBER() OVER (
                PARTITION BY phase_id
                ORDER BY usage_count DESC, created_at ASC, rowid ASC
            ) - 1) AS new_order
    FROM compositions
)
UPDATE compositions
SET order_index = (SELECT new_order FROM ordered WHERE ordered.id = compositions.id);

CREATE INDEX idx_compositions_order ON compositions (phase_id, order_index);
