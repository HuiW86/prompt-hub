-- Seed data for the first launch. Idempotency comes from the migration runner
-- (PRAGMA user_version), not from these statements — they assume an empty DB.

-- 8 phases per 01-spec §3.5. default_alignment_phrase_id stays NULL until the
-- companion alignment_phrases rows are inserted below.
INSERT INTO phases (id, name, order_index, color, description) VALUES
    ('phase-diverge',    '发散', 0, '#534AB7', '铺开可能性,暂不收敛'),
    ('phase-understand', '理解', 1, '#534AB7', '先确认上下文与现状'),
    ('phase-plan',       '规划', 2, '#534AB7', '定方向、列步骤,再动手'),
    ('phase-generate',   '生成', 3, '#534AB7', '按方案产出方案或代码'),
    ('phase-execute',    '执行', 4, '#534AB7', '按方案落地,不再发散'),
    ('phase-converge',   '收敛', 5, '#534AB7', '从多方案中选出最优'),
    ('phase-distill',    '沉淀', 6, '#534AB7', '把经验固化为可复用资产'),
    ('phase-iterate',    '迭代', 7, '#534AB7', '回看哪里可以更好');

INSERT INTO alignment_phrases (id, phase_id, name, content, is_default, created_at) VALUES
    ('ap-diverge-default',    'phase-diverge',    '默认 · 发散', '我们做发散,铺开可能性,先不下结论。',         1, '2026-05-23T00:00:00Z'),
    ('ap-understand-default', 'phase-understand', '默认 · 理解', '我们先理解,确认上下文与现状再行动。',         1, '2026-05-23T00:00:00Z'),
    ('ap-plan-default',       'phase-plan',       '默认 · 规划', '我们做规划,先定方向、列步骤,再动手。',         1, '2026-05-23T00:00:00Z'),
    ('ap-generate-default',   'phase-generate',   '默认 · 生成', '我们进入生成模式,按方案产出。',               1, '2026-05-23T00:00:00Z'),
    ('ap-execute-default',    'phase-execute',    '默认 · 执行', '我们进入执行模式,按方案干活,不再发散。',      1, '2026-05-23T00:00:00Z'),
    ('ap-converge-default',   'phase-converge',   '默认 · 收敛', '我们收敛,从已有方案中选出最优解。',           1, '2026-05-23T00:00:00Z'),
    ('ap-distill-default',    'phase-distill',    '默认 · 沉淀', '我们沉淀,把这次经验固化为可复用的资产。',     1, '2026-05-23T00:00:00Z'),
    ('ap-iterate-default',    'phase-iterate',    '默认 · 迭代', '我们迭代,回看哪里可以更好,准备下一轮。',      1, '2026-05-23T00:00:00Z');

UPDATE phases SET default_alignment_phrase_id = 'ap-diverge-default'    WHERE id = 'phase-diverge';
UPDATE phases SET default_alignment_phrase_id = 'ap-understand-default' WHERE id = 'phase-understand';
UPDATE phases SET default_alignment_phrase_id = 'ap-plan-default'       WHERE id = 'phase-plan';
UPDATE phases SET default_alignment_phrase_id = 'ap-generate-default'   WHERE id = 'phase-generate';
UPDATE phases SET default_alignment_phrase_id = 'ap-execute-default'    WHERE id = 'phase-execute';
UPDATE phases SET default_alignment_phrase_id = 'ap-converge-default'   WHERE id = 'phase-converge';
UPDATE phases SET default_alignment_phrase_id = 'ap-distill-default'    WHERE id = 'phase-distill';
UPDATE phases SET default_alignment_phrase_id = 'ap-iterate-default'    WHERE id = 'phase-iterate';

INSERT INTO scenes (id, name, icon, order_index, role_presets) VALUES
    ('scene-plan',     '方案设计', '📐', 0, '["架构师","技术 leader"]'),
    ('scene-research', '调研',     '🔍', 1, '["调研员","技术分析师"]'),
    ('scene-debug',    '排查',     '🔧', 2, '["SRE","值班工程师"]');

INSERT INTO phrases (id, scene_id, name, content, created_at) VALUES
    ('phrase-plan-export',       'scene-plan',     '设计导出模块',     '为 [项目名] 设计数据导出模块,包含格式选择、字段映射、权限校验,先给方案再写代码。', '2026-05-23T00:00:00Z'),
    ('phrase-plan-permission',   'scene-plan',     '设计权限模型',     '为 [项目名] 设计权限模型,先列实体与角色,再给授权流程。',                            '2026-05-23T00:00:00Z'),
    ('phrase-research-survey',   'scene-research', '调研主流方案',     '调研当前主流的 [主题] 方案,给 3-5 个有代表性的选项,标注优缺点。',                  '2026-05-23T00:00:00Z'),
    ('phrase-research-handover', 'scene-research', '接手项目调研',     '接手 [项目名],从架构、依赖、测试覆盖、近期改动四个维度做一次现状摸排,产出一页纸总结。', '2026-05-23T00:00:00Z'),
    ('phrase-debug-rootcause',   'scene-debug',    '定位生产 bug 根因','给你 [告警日志/堆栈],请帮我定位根因,给出最小可验证假设和验证方法。',               '2026-05-23T00:00:00Z'),
    ('phrase-debug-repro',       'scene-debug',    '复现问题',         '请帮我把 [bug 描述] 复现出来,给出最小复现步骤和环境要求。',                          '2026-05-23T00:00:00Z');

INSERT INTO macros (id, name, content, native, created_at) VALUES
    ('macro-best-practice',     '借力最优解',         '调研外部成熟方案,先看主流实现怎么做的,再决定我们怎么做。不要从零发明。',                       1, '2026-05-23T00:00:00Z'),
    ('macro-global-view',       '全局视角出方案',     '先看全景,把所有可行方案铺开比较,给我多个选项 + 取舍说明,我来拍板。',                            1, '2026-05-23T00:00:00Z'),
    ('macro-parallel-subagents','启动子代理并行调研', '启动多个子代理并行调研下述子方向,各自独立完成,最后汇总对比。',                                  1, '2026-05-23T00:00:00Z'),
    ('macro-plan-first',        '先出方案我拍板',     '不要直接动手,先给我方案,我拍板后再动手。方案要包含目标、关键决策、风险、回滚方案。',           1, '2026-05-23T00:00:00Z');
