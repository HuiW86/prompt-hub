-- I-02 (M-01): where each item sits in the panorama view.
--
-- Layout is view state, not an asset, so it lives in its own table instead of
-- adding columns to the five asset tables. That keeps the seventh source-level
-- gate's ASSET_TABLES unchanged and introduces no fourth asset layer
-- (constitution B1). `asset_kind` + `asset_id` is a polymorphic reference and
-- therefore has no FK: liveness is checked on read (list skips rows whose asset
-- is trashed or gone) and dangling rows are dropped on import.
CREATE TABLE panorama_placements (
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('macro','phrase','alignment_phrase','modifier','composition')),
  asset_id   TEXT NOT NULL,
  group_id   TEXT CHECK (group_id IN ('align','diverge','converge','execute','polish','retain','cue','tool')),
  pin_slot   INTEGER CHECK (pin_slot BETWEEN 1 AND 9),
  PRIMARY KEY (asset_kind, asset_id)
);
CREATE UNIQUE INDEX idx_panorama_pin_slot ON panorama_placements(pin_slot) WHERE pin_slot IS NOT NULL;
