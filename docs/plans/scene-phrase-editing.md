# Scene 场景话术（Phrase）编辑功能

Status: active
Progress: 0/9
Date: 2026-06-22

> **命名警示**：本方案的 `Phrase` 指 **scene 绑定的场景话术**（`models.rs` 第 120 行 `scene_id`），与已完成的 `AlignmentPhrase`（phase 绑定，order_index/CRUD 由 ADR-013 + 0007 migration 早已落地）是**两个不同实体**。phrases.rs ≠ alignment_phrases.rs，勿混淆。

## 目标

为 Scene 全景区（`ScenePanel.tsx`）的场景话术补齐增/改/删 + 拖拽排序 + 可选子阶段（SubStage）归属。镜像已验证的 AlignmentPhrases 编辑模式（编辑模式开关 + per-group DragDropProvider + EditorPanel）。

范围锁定**仅 Phrase**：不碰 Scene 本身、不碰 SubStage 结构、不上 MCP 写面。

`Phrase` 当前无 `order_index`，需一次 forward-only migration（schema 8→9）。

## 关键决策

- **order_index 分区 = (scene_id, sub_stage_id)**，与 AlignmentPhrase 的 per-phase 同构；`sub_stage_id = NULL`（未分组）是独立分区。增量风险：Phrase 的 sub_stage_id **可空**，AlignmentPhrase 的 phase_id 非空——空分区的原子性需专门处理（见决策 ②）。
- **backfill**：`ROW_NUMBER() PARTITION BY (scene_id, sub_stage_id) ORDER BY usage_count DESC, created_at ASC, rowid ASC`，保留当前可见顺序。SQLite window 函数视所有 NULL 为同一分区——**隐式行为，migration 内加注释锁定**（评审 A 问题 2）。
- **② 跨组移动原子化**〔评审 A 严重项〕：`update_phrase` 改变 `sub_stage_id` 时，order_index **不用**"读 MAX→写 MAX+1"两步，改用单条 UPDATE 带子查询 `(SELECT COALESCE(MAX(order_index)+1,0) FROM phrases WHERE scene_id=?1 AND (sub_stage_id=?N OR (?N IS NULL AND sub_stage_id IS NULL)))`，与 `create_alignment_phrase`（alignment_phrases.rs:36-37）同构、单语句原子，杜绝并发撞 MAX+1。
- **update 仅改 name/content（sub_stage_id 不变）时 order_index 保持不变**（评审 A 问题 5，与先例一致）。
- **读取排序**：`list_phrases_by_scene` 改 `ORDER BY order_index ASC, created_at ASC, rowid ASC`（评审 A 问题 3 的 tie-break，兜住空洞/重复值下渲染不确定性）。
- **删除**：永久硬删，无默认保护（Phrase 无 `is_default`）。源分区空洞**不压缩**（与先例一致，读路径只 ORDER BY 不依赖连续，评审 A 确认可接受）。
- **store 策略**：mutation 后全量 `ipc.listScenesWithChildren()` refetch（复用 promoteDraft 既有路径，promptStore:275-289），嵌套结构不做乐观更新。
- **NULL 分区 reorder WHERE**：`(sub_stage_id = ?3 OR (?3 IS NULL AND sub_stage_id IS NULL))`，rusqlite `Option::None` 绑定为 SQL NULL，同一占位符可多引用（评审 B 确认可行）。

评审记录：内部事实核查全 ✅；Codex 高强度推理挂死（已知问题，issues #8545/#8402），回退工程判断给出 4 条意见，全部吸收。

## 任务清单

### M1 — 数据层 + 写面 + IPC（后端，独立验收：`cargo test --workspace` 全绿 + clippy `-D warnings` 0 + fmt clean）

- [ ] 写 `0009_phrases_order_index.sql`（`src-tauri/crates/repo-core/migrations/`）：`ALTER TABLE phrases ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0 CHECK(order_index >= 0)` + 分区 backfill（含 NULL 分区注释）+ `CREATE INDEX idx_phrases_order ON phrases(scene_id, sub_stage_id, order_index)`
- [ ] `db.rs` MIGRATIONS 注册第 9 项（`include_str!` + target_version=9，latest_version 自动→9）
- [ ] `models.rs` `Phrase` 加 `pub order_index: i64`；`repo.rs` `list_phrases_by_scene` select order_index + 改 ORDER BY（决策 tie-break）
- [ ] 新建 `repo-write/src/phrases.rs`：`create_phrase` / `update_phrase`（含跨组移动原子子查询）/ `delete_phrase` / `reorder_phrases`（NULL 分区 WHERE）+ 模块测试（create 追加末尾 / update 改名 / update 跨组移动追加目标分区末尾 / update 不改组保 order_index / delete / reorder 拒绝未知 id + 跨分区 id / **NULL 分区 reorder**）；`repo-write/src/lib.rs` 加 `pub mod phrases`
- [ ] `commands.rs` 加 `create_phrase`/`update_phrase`/`delete_phrase`/`reorder_phrases` 4 IPC（全走 `with_write_conn` → guard_schema_then schema recheck）；`src-tauri/src/lib.rs` invoke_handler 注册

### M2 — 前端 UI（独立验收：`pnpm test` 全绿 + lint + prettier `--check .` + build exit 0 + 真机手测增改删排序落盘）

- [ ] `ipc/types.ts` `Phrase` 加 `orderIndex: number`；`ipc/index.ts` 加 4 包装函数；`stores/promptStore.ts` 加 4 action + mutation 后 refetch scenes
- [ ] `ScenePanel.tsx` 加编辑模式：铅笔开关；**每个 subStage 组一个独立 DragDropProvider**（防跨组拖拽）；行级编辑/删除 + ConfirmInline；`PhraseEditor`（name + content + subStage 下拉含「无分组」）
- [ ] `ScenePanel.module.css` 编辑态样式（token 化，禁裸 px/hex/ms，守 CLAUDE §4.1）
- [ ] 文档涟漪（方法论 §7，收尾回流不就地补丁）：product-spec §13.4 + features 备注 Scene 话术可编辑

## 非目标（本次不做）

- Scene 本身（名称/图标/可见性/role presets）CRUD —— 范围 B，排除
- SubStage 增删改名 —— 编辑器只在**已有** subStage 间归类，不新建
- Phrase 软删除（deprecated 复用）—— 直接硬删，与 AlignmentPhrase 一致
- MCP 写面暴露 phrase 编辑 —— repo-write 不进 MCP（守编译期写隔离）

## 风险点

- **migration 不可逆**（forward-only，与 0005-0008 一致）—— backfill SQL 先在 `cargo test` in-memory 库验证
- **跨组移动原子性**（决策 ②）—— phrases.rs 测试必须覆盖：跨组后旧组不留逻辑错乱、新组原子追加、并发不撞 MAX+1
- **NULL 可空分区** —— backfill 与 reorder 均需专门测试 NULL sub_stage_id 路径
- **文档涟漪** —— product-spec §13.4（region 行为）+ features 需备注，按方法论 §7 收尾回流
