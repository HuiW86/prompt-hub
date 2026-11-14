-- ADR-032: panorama columns follow the work stages (the phases, one to one)
-- instead of ADR-031's six intents. SQLite cannot alter a CHECK constraint, so
-- the table is rebuilt and every stored group id is carried across:
--   align → understand, polish → iterate, retain → distill;
--   diverge / converge / execute / cue / tool keep their spelling.
-- No row is dropped and no pin slot moves. `plan` and `generate` are new
-- columns that nothing occupies until the user places something there.
CREATE TABLE panorama_placements_new (
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('macro','phrase','alignment_phrase','modifier','composition')),
  asset_id   TEXT NOT NULL,
  group_id   TEXT CHECK (group_id IN ('understand','diverge','converge','plan','generate','execute','iterate','distill','cue','tool')),
  pin_slot   INTEGER CHECK (pin_slot BETWEEN 1 AND 9),
  PRIMARY KEY (asset_kind, asset_id)
);

INSERT INTO panorama_placements_new (asset_kind, asset_id, group_id, pin_slot)
SELECT asset_kind,
       asset_id,
       CASE group_id
         WHEN 'align'  THEN 'understand'
         WHEN 'polish' THEN 'iterate'
         WHEN 'retain' THEN 'distill'
         ELSE group_id
       END,
       pin_slot
FROM panorama_placements;

DROP TABLE panorama_placements;
ALTER TABLE panorama_placements_new RENAME TO panorama_placements;
CREATE UNIQUE INDEX idx_panorama_pin_slot ON panorama_placements(pin_slot) WHERE pin_slot IS NOT NULL;
