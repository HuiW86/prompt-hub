---
type: adr
project: prompt-hub
status: Proposed
author: ai
created: 2026-11-14
description: 全景列由六个意图改为八个工作阶段（与九个相位一一对应，中途仍在底部条）；Composition 与对齐话术一样按相位默认归列；`panorama_placements.group_id` 经 migration `0017` 映射到阶段 id，导出 1.5 → 1.6 且仍能导入 1.5
related:
  - 031-panorama-default-view
  - 03-product-spec
  - 05-design-spec
  - 06-prd
---

# ADR-032：全景按工作阶段分列

## 1. 标题与日期

- **标题**：全景的六个意图列改为八个工作阶段列
- **日期**：2026-11-14
- **决策者**：HuiW86（方向口头裁决 2026-11-14：「应该从工作的阶段来分」；本 ADR 待签字）
- **影响范围**：[[031-panorama-default-view]] 原则 6 与子决策 2 的取值 / 数据层 migration `0017`（`user_version` 16→17）/ 导出 data schema 1.5→1.6 / `src/utils/panorama.ts` / 签字后回流 [[03-product-spec]]、[[05-design-spec]]、[[06-prd]]

## 2. Status

`Proposed`

## 3. Context

- **触发事件**：2026-11-14 在 Notion 提示词库（应用的主副本）里先按六个意图给 76 条做了归组，HuiW86 看完的判断是「这个分法不好，应该从工作的阶段来分」，随即按八个阶段重分并采纳。应用全景仍是意图列，两边口径不一致。
- **意图列的问题**：六列是把九个相位二次归并出来的（规划并入收敛、生成并入执行），用户找条目时脑子里的是「我现在在哪一步」，还得再换算一次「这一步属于哪个意图」——正是 ADR-031 原则 1「识别优于回忆」要消灭的那层回忆。
- **业务约束**：不新增资产类型（[[02-constitution#B1]]）；位置只由用户指定、不按用量自动换位（ADR-031 原则 3）；对齐话术的数据层分离不动（B2 v1.2）。
- **不决策的代价**：Notion 与应用两套分组并存，用户在两处看到不同的列，整理过的位置也无法双向对应。

## 4. Options Considered

### Option A：保留六个意图列

- **优点**：零改动。
- **缺点**：与用户明确表达的心智模型和 Notion 主副本不一致。
- **否决原因**：用户已裁决。

### Option B：八个阶段列，与相位一一对应 ✅

- **描述**：列 = 理解 / 发散 / 收敛 / 规划 / 生成 / 执行 / 迭代 / 沉淀，底部「中途口令」「工具」不变。带相位的条目（对齐话术、Composition）默认进自己相位那一列；不带相位的（Macro、场景话术、Modifier）仍等用户放置。
- **优点**：列名就是相位名，与相位带、Notion「工作阶段」列同一套词；默认规则从「二次归并」变成恒等映射，更简单。
- **缺点**：列数 6→8（有未分组时 9），每列更窄；需要一次表重建迁移与导出版本 bump。

### Option C：阶段列 + 自动推断不带相位条目的阶段

- **描述**：按正文关键词给 Macro / 场景话术猜阶段。
- **否决原因**：违反 ADR-031 原则 3（位置只由用户指定），且猜错的代价是条目出现在用户想不到的地方。

## 5. Decision

> **一句话拍板**：选 Option B——全景列改为与相位一一对应的八个工作阶段，带相位的条目默认归入自己的阶段列。

### 子决策

1. **group id 取值**：`understand / diverge / converge / plan / generate / execute / iterate / distill / cue / tool`，与 `phase-*` 后缀同名。
2. **旧值映射**：`align→understand`、`polish→iterate`、`retain→distill`，其余同名保留；migration `0017` 重建表执行映射，不丢行、不动常用位。
3. **默认规则**：`PHASE_TO_GROUP` 改为恒等映射（`phase-live → cue` 不变）；**Composition 也按 `phaseId` 默认归列**（ADR-031 时代它一律进未分组）。
4. **导出兼容**：data schema 1.5→1.6。1.6 构建导入 1.5 文件时旧 id 经 serde alias 映射；1.5 构建读到含 `plan` / `generate` 的 1.6 文件会整体拒绝（不半读）。
5. **列标题**：直接用相位名（「理解」「发散」……），不另起意图名。

## 6. Consequences

### 正向后果

- 全景、相位带、Notion 三处用同一套阶段词。
- 默认规则少一层归并，带相位的 Composition 不再堆在未分组。

### 负向后果

- 列更窄，长名称更早截断（视觉 pass 需复核 13 英寸屏）。
- 用户在意图时代放进「执行与验收」的条目，迁移后在「执行」——原本属于生成阶段的需要用户手动挪到「生成」。

### 未来反悔成本

- 中等：回到意图列需要反向迁移（`plan→converge`、`generate→execute` 会丢失区分），导出版本再 bump 一次。

### 待回流（签字后按八步走）

- [[03-product-spec]] 全景章节列名与默认规则
- [[05-design-spec]] §10.9 列数与序号 01–08
- [[06-prd]] `panorama_placements` 取值与导出 1.6
