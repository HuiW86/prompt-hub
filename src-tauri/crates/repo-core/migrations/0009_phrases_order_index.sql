-- Scene phrases.order_index (plan scene-phrase-editing, decision ①/②).
--
-- Scene phrases gain a user-controlled sort position PER (scene_id, sub_stage_id)
-- partition: order_index restarts at 0 inside each group, so the per-group phrase
-- list can be reordered deterministically (dnd-kit, ADR-016). Unlike alignment
-- phrases (phase_id NOT NULL), a phrase's sub_stage_id is NULLABLE — phrases with
-- no sub-stage form their own "ungrouped" partition.
--
-- NULL partition note: SQLite window functions treat ALL rows with NULL
-- sub_stage_id as one partition (NULL is not distinct from NULL in PARTITION BY),
-- which is exactly the "ungrouped" group we want — this is implicit SQLite
-- behavior, locked in by this comment.
--
-- Backfill preserves the prior visible order (most-used, then oldest); rowid is
-- the stable final tiebreaker, matching list_phrases_by_scene's pre-migration
-- ORDER BY usage_count DESC, created_at ASC.
--
-- forward-only: no DROP COLUMN / down migration.

ALTER TABLE phrases ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0);

WITH ordered AS (
    SELECT id,
           (ROW_NUMBER() OVER (
                PARTITION BY scene_id, sub_stage_id
                ORDER BY usage_count DESC, created_at ASC, rowid ASC
            ) - 1) AS new_order
    FROM phrases
)
UPDATE phrases
SET order_index = (SELECT new_order FROM ordered WHERE ordered.id = phrases.id);

CREATE INDEX idx_phrases_order ON phrases (scene_id, sub_stage_id, order_index);
