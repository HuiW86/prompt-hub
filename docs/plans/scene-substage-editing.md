---
type: plan
project: prompt-hub
status: done
created: 2026-06-27
description: Scene/SubStage 结构编辑 plan——容器与子阶段 CRUD + 排序 + seed 0011，补 Phrase 编辑 defer 的死维度；2026-06-27 收口
---

# Plan — Scene / SubStage 结构编辑

> 状态：Done（2026-06-27 收口，真机 CRUD 落盘待验）。补齐 [[scene-phrase-editing]] 当初有意 defer 的另一半——Scene 容器本体 + SubStage 子阶段的增/改/删/排序。契约现成（[[06-prd#6.4]] 已定义 Scene/SubStage 字段、FK、删除语义），不违 [[01-spec#8.4]]（§8.4 只禁嵌套子 Scene，明确「SubStage 是同级分组」）。

## 1. 背景与缺口

产品走查（2026-06-27）发现：`scenes` / `sub_stages` 两张表有 schema + 读路径（`repo.rs::list_sub_stages_by_scene`）+ Phrase 的 `sub_stage_id` 外键，但**无任何写命令、无种子**。后果：

- Scene 3 个（方案设计/调研/排查）写死 seed，用户不可增/删/改名。
- SubStage 是**死维度**——`subStages` 永远 `[]`，每条 Phrase 的 `sub_stage_id` 永远 NULL，ScenePanel 编辑态的「子阶段下拉」永远只有「无分组」。

根因：[[scene-phrase-editing#13]] 明确「范围锁定**仅 Phrase**：不碰 Scene 本身、不碰 SubStage 结构」——诚实 defer，但留下了 UI 死端，本 plan 收尾。

## 2. 范围决策（已确认）

- **D1 范围**：Scene CRUD + SubStage CRUD 一起做（否则子阶段下拉仍死）。
- **D2 种子**：补 forward-only seed migration `0011`，给 `scene-plan`（方案设计）灌 4 个示范 SubStage：生成 / 评审 / 修订 / 定版（[[06-prd#6.4]] 原例），并把 `scene-plan` 现有 2 条 phrase 归入「生成」子阶段，展示一个有内容的分组 + 3 个空分组。
- **D3 MCP 写面**：本次**不上** MCP，保持 Tauri-only，与 [[scene-phrase-editing#13]] 一致（repo-write 不被 MCP binary 依赖）。
- **D4 Scene 删除语义**：**阻止删除非空 Scene**（其下有 Phrase 或 SubStage 时拒绝，返回明确错误），与 [[06-prd#6.4]]「否则应阻止（应用层校验）」一致。SubStage 删除：把其下 Phrase.sub_stage_id 置 NULL（解绑，Phrase 本体保留），同 PRD。

## 3. 无 schema migration

`scenes` / `sub_stages` 表已存在（`0001_initial`），CRUD 不需新列。唯一 migration 是 D2 的 `0011` **纯 seed**（user_version 10→11），按 `id` 精确插入示范 SubStage + UPDATE 现有 2 phrase 的 sub_stage_id，用户改过的不动。

## 4. 删除语义（锁定）

- `delete_scene(id)`：先查 `SELECT COUNT(*) FROM phrases WHERE scene_id=?` 和 `sub_stages WHERE scene_id=?`，任一 > 0 → 返回新错误 `RepoError::SceneNotEmpty { scene_id }`（或复用既有校验错误），不删；否则删 scene 行。
- `delete_sub_stage(id)`：单事务内 `UPDATE phrases SET sub_stage_id=NULL WHERE sub_stage_id=?` 再 `DELETE FROM sub_stages WHERE id=?`，子 Phrase 解绑保留。
- `delete_scene` / `delete_sub_stage` 命中 0 行 → `TargetNotFound`，同 phrases.rs。

## 5. 实现分层（镜像 phrases.rs 范式）

- **后端**（repo-write）：新增 `scenes.rs` + `sub_stages.rs`，各 create/update/delete/reorder。reorder 分区：Scene 全局单序、SubStage per-scene 单序（`order_index` 重写，镜像 `reorder_phrases`）。`lib.rs` 导出。
- **IPC**（commands.rs）：8 命令走 `with_write_conn`；tauri `src-tauri/src/lib.rs` invoke_handler 注册。
- **前端**：`ipc/index.ts` +8 方法 / `ipc/types.ts` 入参 / `promptStore` +8 actions / `ScenePanel` 编辑态加 Scene tab 增改名删 + SubStage 增改名删 + 接活已有下拉。
- **测试**：repo-write 单测镜像 phrases.rs（删除语义/解绑/reorder 分区/非空阻止各一例）+ 前端 store/组件测试。

## 6. 验证

`pnpm test` / build / lint / prettier + `cargo test --workspace` / clippy / fmt 全绿；B2 协议/任务分离复检（Scene 不应引入 AlignmentPhrase）；真机若起验 CRUD 落盘。

## 7. 文档涟漪（方法论 §7）

features.md 标本项 done + 给 [[06-prd#6.4]] SubStage「创建入口=UI」指派 + product-spec §13.3 ScenePanel 编辑态补 Scene/SubStage 管理契约 + CHANGELOG/MANIFEST bump。不开新 ADR（PRD 契约已存，属补实现）。
