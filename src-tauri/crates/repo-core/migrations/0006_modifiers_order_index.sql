-- P2a.1 modifiers.order_index (plan asset-editing-and-adaptive-layout §0 Q6, decision D-a).
--
-- Modifiers gain a user-controlled sort position PER group_kind quadrant
-- (cognition/action/delivery/constraint) so the ModifierGrid can render and
-- reorder within each quadrant deterministically (dnd-kit, ADR-016). Unlike
-- macros (0005, global order), modifiers partition order by group_kind: existing
-- rows backfill per-quadrant by creation order (created_at, then rowid as a stable
-- tiebreaker) so order restarts at 0 inside each group_kind.
--
-- forward-only: no DROP COLUMN / down migration.

ALTER TABLE modifiers ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0);

WITH ordered AS (
    SELECT id,
           (ROW_NUMBER() OVER (PARTITION BY group_kind ORDER BY created_at ASC, rowid ASC) - 1) AS new_order
    FROM modifiers
)
UPDATE modifiers
SET order_index = (SELECT new_order FROM ordered WHERE ordered.id = modifiers.id);

CREATE INDEX idx_modifiers_order ON modifiers (group_kind, order_index);
