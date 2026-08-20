-- ADR-027: machine-local settings the Rust side must read BEFORE the webview
-- exists. The global hotkey is registered in setup() (lib.rs), which runs long
-- before any renderer code — so localStorage, where every other preference
-- lives, is unreachable at the only moment the value is needed.
--
-- Membership rule (mirrored in src/stores/settingsStore.ts): a key belongs here
-- ONLY IF Rust needs it before the frontend mounts. Everything else (theme,
-- accent, density, interaction mode, layout splits) stays in localStorage.
-- This table is NOT part of export/import — it is machine-local configuration,
-- not a portable asset (see repo-core/src/export.rs).
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed the shipped default so the common path is a plain row read. A missing
-- row still falls back to the same literal in code (settings::global_hotkey):
-- hand-editing this table with sqlite3 is the last-resort escape hatch when a
-- bad binding locks the user out, and a stray DELETE there must not brick boot.
INSERT INTO settings (key, value) VALUES ('global_hotkey', 'Alt+Space');
