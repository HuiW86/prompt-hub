-- Migrate the three seeded Scenes from emoji to lucide name strings so existing
-- databases match the Promptscape design (new installs already seed lucide names
-- via 0002). Scoped by id + original emoji so a user who re-set an icon keeps it.
UPDATE scenes SET icon = 'drafting-compass' WHERE id = 'scene-plan'     AND icon = '📐';
UPDATE scenes SET icon = 'microscope'       WHERE id = 'scene-research' AND icon = '🔍';
UPDATE scenes SET icon = 'wrench'           WHERE id = 'scene-debug'    AND icon = '🔧';
