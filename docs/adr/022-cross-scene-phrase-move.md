---
type: adr
project: prompt-hub
status: Accepted
description: 跨 Scene 话术移动——新增独立 move_phrase 命令（含撤销 receipt）而非扩展 update_phrase；交互走分层选择器不做拖拽；子决策 2 裁定双路径共存
---

# ADR-022: 跨 Scene 话术移动——独立 move_phrase 命令 + 分层选择器

## 1. 标题与日期

- **标题**：新增独立 `move_phrase` IPC 命令（返回撤销 receipt）承载跨 Scene / 跨 SubStage 话术移动，交互采用分层选择器
- **日期**：2026-07-12
- **决策者**：omar（2026-07-12 Accept，含子决策 2 勾选"保留双路径"；方向性裁决已于同日审计评审中给出：独立 move_phrase + receipt，见 [[2026-07-12-ux-taskflow-audit#§0]]）
- **影响范围**：`repo-write/phrases.rs`（新函数）/ `commands.rs` + `lib.rs`（新命令注册）/ `promptStore.ts` / `ScenePanel.tsx`（动作簇新增"移动到…" + 分层选择器组件）/ [[03-product-spec#13.3]] 移动动作契约 / [[07-features]] 回写 / [[2026-07-12-ux-taskflow-audit]] 问题池 A1-01、A1-06

## 2. Status

`Accepted`

- Last reviewed: 2026-07-12（omar Accept，子决策 2 = 双路径共存）

## 3. Context

- **触发事件**：UX 任务流静态预审（[[2026-07-12-ux-taskflow-audit]]）确认 T6 跨 Scene 移动是**死路**：`update_phrase` 无 scene_id 参数（`phrases.rs:72-107`，SQL 中 scene_id 仅作只读派生）、store 类型无 sceneId（`promptStore.ts:141-146`）、编辑器下拉只列当前 Scene 的子阶段（`ScenePanel.tsx:1085`）。唯一 workaround = 目标 Scene 重建 + 源删除，**丢失 usage_count / last_used_at**——违背 spec「每一次复制都应成为资产的一部分」的沉淀哲学
- **业务约束**：Phrase 属 Scene 任务层资产，移动不涉 AlignmentPhrase / 协议层（[[02-constitution#B2]] 自检通过）；Scene 编辑保持 Tauri-only 不经 MCP（沿 ADR-021 D3）；D-5 裁决要求移动支持短时撤销，且「toast 只是入口，不是恢复能力」——撤销必须能恢复原 Scene、原 SubStage、**原精确排序位**
- **技术约束**：order_index 按 (scene_id, sub_stage_id) 分区管理，现有跨 SubStage 移动采用「目标分区末尾追加 + 源分区留 gap」模式（`phrases.rs:96-105`）；读路径 gap 容忍（仅 ORDER BY）。数据层复杂度以本 ADR 评估为准，不沿用审计早期「小活」预判
- **不决策的代价**：错放场景的话术永久锁死或以丢历史为代价迁移；批次 B（v0.1.0 前，D-6 排期）无法启动

## 4. Options Considered

### Option A: 扩展 `update_phrase` 增加 scene_id 参数

- **描述**：给现有 `update_phrase(id, name, content, sub_stage_id)` 追加 `scene_id`，编辑表单内一并选择目标 Scene。
- **优点**：无新命令；前端复用编辑表单，UI 改动最小。
- **缺点**：
  - **移动被迫混入名称/正文覆盖语义**——调用方必须回传当前 name/content，稍有陈旧即静默覆盖用户内容（移动操作吞掉编辑冲突）
  - 撤销 receipt 塞进"更新"返回值语义混乱；编辑与移动两种意图继续共享一个入口，与本轮"意图分离"主题（D-0）背道而驰
  - 编辑表单需加载全部 Scene 的子阶段树，表单复杂度激增
- **预估成本**：后端 ~0.5 天，但语义债长期存在。

### Option B: 独立 `move_phrase` 命令 + 撤销 receipt + 分层选择器（推荐）

- **描述**：新增 `move_phrase(id, target_scene_id, target_sub_stage_id: Option, target_order_index: Option) -> MoveReceipt`。单事务内：①校验 phrase 存在 ②校验 target_sub_stage_id（若 Some）属于 target_scene_id（防跨 Scene 挂错分组）③写入新 scene_id/sub_stage_id，order_index 取 `target_order_index`（撤销回填用）或目标分区 MAX+1（常规移动末尾追加）。返回 `MoveReceipt { phrase_id, from_scene_id, from_sub_stage_id, from_order_index }`。**撤销 = 用 receipt 反向调同一命令**（`move_phrase(id, from_scene, from_ss, Some(from_index))`）；因源分区留 gap，原槽位大概率仍空，被占时该值仅致同槽并列、由既有 tie-break（created_at, rowid）稳定排序，无需额外处理。名称/正文完全不经手。
- **优点**：
  - 移动是独立动词，不与编辑混流；receipt 即撤销能力本体（D-5 合规）
  - 同一命令同时覆盖跨 Scene 与同 Scene 跨 SubStage——审计 A1-06（移动藏在编辑表单里）顺带收口，动作簇获得独立"移动到…"入口
  - 校验/写入单事务原子，失败无半完成态；usage 历史全程保留
- **缺点**：
  - 新增一个 IPC 命令 + store action + 选择器组件（约 5 文件）
  - `update_phrase` 既有的 sub_stage_id 迁移分支与 move_phrase 形成双路径（保留：编辑表单内改分组仍是合法就地场景；文档需写明两径语义等价）
- **预估成本**：后端（函数+测试）~0.5 天；前端（选择器+动作簇+撤销 toast+测试）~1-1.5 天。

### Option C: 前端组合 create + delete 重建

- **描述**：不动后端，前端"移动"= 目标分区 create_phrase 副本 + 源 delete_phrase。
- **优点**：零后端改动。
- **缺点**：**丢失 usage_count / last_used_at / created_at / id**（正是当前 workaround 的缺陷，等于把 bug 固化为实现）；两命令非原子，中途失败产生副本+原件并存或双失；撤销需再反向重建，历史仍然回不来。
- **预估成本**：~0.5 天，交付一个错误的东西。

## 5. Decision

> **一句话拍板**：选择 Option B——新增独立 `move_phrase` 命令，单事务校验+落位并返回撤销 receipt，交互走分层选择器。

**为什么不选其他**：
- 不选 A 因为：移动混入内容覆盖是静默数据破坏源；且违背本轮意图分离方向
- 不选 C 因为：丢使用历史 + 非原子，是把 workaround 的缺陷产品化

**子决策 1 — 交互形态：分层选择器，不做拖拽**：动作簇新增"移动到…" → 选目标 Scene → 选该 Scene 下 SubStage（含"未分组"）→ 确认 → toast「已移至 X / Y」+ 撤销按钮（短时）。目标 Scene 在移动时不可见（tab 隐藏另一 Scene 的看板），拖拽无落点，分层选择器是唯一稳定形态——与 ADR-021 子决策 1（视图网格 copy 主动作与拖拽 affordance 互斥）同理。

**子决策 2 — 移动升为独立动作，双路径共存**：动作簇"移动到…"为主入口（覆盖跨/同 Scene）；编辑表单内子阶段下拉保留（编辑中顺手改分组的就地场景），两径底层语义等价（均落目标分区末尾）。**裁决（omar，2026-07-12 Accept 时勾选）：保留双路径**——编辑表单下拉维持可用，不收敛；代价照 §6 反向后果执行：product-spec 移动动作契约必须写明两径语义等价，否则成为下一轮走查的"语义分叉"问题。

**子决策 3 — 撤销窗口实现**：撤销驻留于 toast 生命周期（沿现有 toast dwell 机制），过期后 receipt 丢弃、移动即定格。不做持久撤销栈（超出 D-5 范围，Phrase soft-delete 独立立项时再议）。

## 6. Consequences

### 正向后果
- T6 死路打通且零历史损失；A1-01（P1）+ A1-06（P2）同批收口
- MoveReceipt 模式为后续「Draft discard 撤销」（D-5 第二路）提供同构参照
- 移动/编辑/复制三个动词在 UI 上各有独立入口，支撑 D-0 意图分离叙事

### 反向后果
- phrase 写命令从 4 个变 5 个，promptStore 相应增一个 action；测试面扩大（后端分区校验矩阵 + 前端选择器/撤销链路）
- update_phrase 迁移分支与 move_phrase 双路径并存（子决策 2 若不收敛），文档必须写清两者等价否则成为下一轮走查的"语义分叉"问题
- 撤销的精确位恢复依赖"源分区留 gap"这一现状设计——若未来引入分区压缩（gap 回收），receipt 的 from_order_index 语义需同步重审（在压缩 ADR 里必须引用本条）

### 未来反悔成本
- **代码改造规模**：下架 move_phrase ≈ 删 1 个后端函数 + 1 个命令注册 + 1 个 store action + 选择器组件，约 ±400 行；无既有调用方锁定
- **数据迁移**：无——不动 schema，order_index 语义不变
- **学习成本**：无新依赖
- **不可逆点**：无硬不可逆；receipt 结构一旦被 Draft 撤销复用则升级为跨模块契约，改动需连带评估

---

## 相关链接

- 触发本决策的文档：[[2026-07-12-ux-taskflow-audit]]（§0 裁决 D-5、§3 A1-01/A1-06、§6 批次 B）
- 被本决策影响的文档：[[03-product-spec#13.3]]（移动动作契约）/ [[07-features]]（回写）
- 相关 ADR：[[021-scene-layered-editing]]（按钮化移动先例、Tauri-only 边界）/ [[011-search-usagesource]]（无关联，移动不产生 usage 事件——移动**不**计入 usage_count，仅复制计入）
