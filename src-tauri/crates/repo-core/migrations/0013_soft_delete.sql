-- ADR-028 P0: reversible delete. Every asset row gains a `deleted_at` timestamp;
-- a delete stops being a DELETE and becomes an in-place UPDATE, so id,
-- created_at, order_index and the usage_records that point at the id all survive
-- untouched. NULL means alive; a non-NULL ISO-8601 string means "in the trash",
-- and restore is a single UPDATE back to NULL.
--
-- `deleted_at` (safety: "I never meant to delete this") is deliberately NOT the
-- existing `deprecated` flag (curation: "this is obsolete but its history is an
-- asset", 06-prd §6.1). Two columns, two switches — read paths now carry
-- `deprecated = 0 AND deleted_at IS NULL`, enforced by the seventh source-level
-- gate (src/ipc/soft-delete-gate.test.ts).
--
-- Seven asset tables get the column; `phases`, `sops`, `sop_steps`,
-- `usage_records`, `drafts` and `settings` do not. usage_records in particular is
-- untouched by design (ADR-028 sub-decision 5): the history reconnects by id the
-- moment an asset is restored, and orphan rows are only ever produced by an
-- explicit "empty the trash".
--
-- forward-only: no DROP COLUMN / down migration. Rolling back means leaving the
-- column in place and ignoring it (ADR-028 §6 "未来反悔成本").

ALTER TABLE modifiers          ADD COLUMN deleted_at TEXT;
ALTER TABLE macros             ADD COLUMN deleted_at TEXT;
ALTER TABLE alignment_phrases  ADD COLUMN deleted_at TEXT;
ALTER TABLE compositions       ADD COLUMN deleted_at TEXT;
ALTER TABLE phrases            ADD COLUMN deleted_at TEXT;
ALTER TABLE scenes             ADD COLUMN deleted_at TEXT;
ALTER TABLE sub_stages         ADD COLUMN deleted_at TEXT;

-- Rebuild the one unique index that a hidden row would otherwise poison.
-- The 0001 form was `ON alignment_phrases (phase_id) WHERE is_default = 1`, which
-- cannot see `deleted_at`: a soft-deleted default would keep occupying its
-- phase's single default slot forever and the user could never appoint a new one
-- (ADR-028 §5 "动手前必须先修的两个坑" #1). Trash rows are now excluded from the
-- constraint, which is what lets a phase appoint a new default while the old one
-- sits in the trash — and that in turn is what restore_asset's "clear is_default
-- when a live default already exists" branch exists to land safely. That branch
-- is defensive rather than routine: the in-app write path still refuses to trash
-- a live default (`DefaultAlignmentPhraseProtected`), so today only `import_json`,
-- which writes both columns verbatim from a bundle, can produce a trashed row
-- still carrying is_default = 1.
DROP INDEX idx_alignment_phrase_one_default_per_phase;
CREATE UNIQUE INDEX idx_alignment_phrase_one_default_per_phase
    ON alignment_phrases (phase_id)
    WHERE is_default = 1 AND deleted_at IS NULL;

-- The other two unique indexes in the schema were reviewed and need no change,
-- because neither of their tables gains a `deleted_at` column:
--   * sop_steps UNIQUE (sop_id, order_index)  — 0001_initial.sql; sop_steps is
--     not an asset table (no writes shipped) and stays hard-delete only.
--   * idx_drafts_hash_pending                 — 0003_drafts.sql; drafts already
--     carry their own soft-delete via status='discarded', which the partial index
--     predicate (status = 'pending') already accounts for.
--
-- No index is added on `deleted_at`. Every list read already scans its whole
-- table (a few hundred rows at the 06-prd §11 ceiling) and orders in SQL, so an
-- extra index would buy nothing but write cost. Revisit only if a table ever
-- reaches five figures.
