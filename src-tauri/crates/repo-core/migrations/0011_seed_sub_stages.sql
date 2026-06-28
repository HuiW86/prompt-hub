-- Forward-only seed (user_version 10 -> 11). Gives the 方案设计 scene a worked
-- example of SubStage grouping: 4 sub-stages (生成/评审/修订/定版) plus binding the
-- two existing scene-plan phrases into 生成, so the UI shows one populated group
-- and three empty ones. Like 0002, idempotency comes from the migration runner
-- (PRAGMA user_version), not these statements; they assume the 0002 seed rows
-- ('scene-plan', 'phrase-plan-export', 'phrase-plan-permission') still exist. A
-- user who already deleted them simply gets no rows touched (harmless).

INSERT INTO sub_stages (id, scene_id, name, order_index) VALUES
    ('ss-plan-generate', 'scene-plan', '生成', 0),
    ('ss-plan-review',   'scene-plan', '评审', 1),
    ('ss-plan-revise',   'scene-plan', '修订', 2),
    ('ss-plan-final',    'scene-plan', '定版', 3);

UPDATE phrases SET sub_stage_id = 'ss-plan-generate'
    WHERE id IN ('phrase-plan-export', 'phrase-plan-permission');
