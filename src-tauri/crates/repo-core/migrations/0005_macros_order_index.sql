-- P1.1 macros.order_index (plan asset-editing-and-adaptive-layout §0 Q6).
--
-- Macros gain an explicit user-controlled sort position so MacroGrid can render
-- and reorder them deterministically (dnd-kit, ADR-016). Existing rows are
-- backfilled by creation order (created_at, then rowid as a stable tiebreaker)
-- so the first render matches the historical insertion order rather than
-- collapsing every macro onto order_index = 0.
--
-- forward-only: no DROP COLUMN / down migration.

ALTER TABLE macros ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0 CHECK (order_index >= 0);

WITH ordered AS (
    SELECT id, (ROW_NUMBER() OVER (ORDER BY created_at ASC, rowid ASC) - 1) AS new_order
    FROM macros
)
UPDATE macros
SET order_index = (SELECT new_order FROM ordered WHERE ordered.id = macros.id);

CREATE INDEX idx_macros_order ON macros (order_index);
