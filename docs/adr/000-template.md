---
type: adr-template
project: prompt-hub
status: template
description: ADR (Architecture Decision Record) 模板——复制本文件改名为 NNN-kebab-title.md 填写
---

# ADR-NNN: <一句话决策标题>

> **使用方法**：复制本文件 → 改名为 `NNN-kebab-title.md`（NNN 递增三位数，如 `001-choose-tauri.md`）→ 填写下方 6 节 → 提交时与代码改动同 PR。
>
> **铁律**：
> - Options ≥ 2 个，否则不是决策（是布告）
> - Decision 必须一句话能说清
> - Consequences 必须含「未来反悔成本」
> - Status 变化时**不修改原文**，开新 ADR 标 `superseded by NNN`

---

## 1. 标题与日期

- **标题**：<一句话决策（如：选择 Tauri 而非 Electron 作为桌面运行时）>
- **日期**：YYYY-MM-DD
- **决策者**：<人名>
- **影响范围**：<受影响的模块 / 文档 / 后续 ADR>

## 2. Status

`Proposed` / `Accepted` / `Deprecated` / `Superseded by ADR-NNN`

> 状态变化记录方式：
> - Proposed → Accepted：直接改本字段，commit message 标注通过日期
> - Accepted → Deprecated：本字段改 Deprecated，**不删除决策内容**
> - 被替代：本字段改 `Superseded by ADR-NNN`，并在新 ADR 的 Context 里说明替代原因

## 3. Context

> 为什么现在需要这个决策？背景压力是什么？哪些约束让必须二选一/多选一？

- **触发事件**：<什么事件让这个决策无法继续拖延>
- **业务约束**：<哪些业务规则限制了选项空间，引用 constitution / spec>
- **技术约束**：<现有架构 / 性能 / 兼容性约束>
- **不决策的代价**：<如果继续不拍板会发生什么>

## 4. Options Considered（≥2 个）

### Option A: <方案名>

- **描述**：<一段话说清这是什么>
- **优点**：
  - <点 1>
  - <点 2>
- **缺点**：
  - <点 1>
  - <点 2>
- **预估成本**：<工时 / 学习成本 / 运行时成本>

### Option B: <方案名>

- **描述**：
- **优点**：
- **缺点**：
- **预估成本**：

### Option C（可选）：<方案名>

...

## 5. Decision

> **一句话拍板**：选择 Option <X>，理由是 <核心原因>。

**为什么不选其他**：
- 不选 A 因为：<>
- 不选 C 因为：<>

## 6. Consequences

### 正向后果
- <已经获得的能力 / 节省的成本>
- <对后续决策的解锁>

### 反向后果
- <引入的限制 / 技术债 / 维护成本>
- <关闭的可能性>

### 未来反悔成本

> 如果 6 个月 / 1 年后想推翻这个决策，需要付出什么代价？

- **代码改造规模**：<估算 LOC 或文件数>
- **数据迁移**：<是否需要 schema 变更 / 数据导出导入>
- **学习成本**：<团队是否需要换技术栈>
- **不可逆点**：<哪些动作一旦做了就回不去>

---

## 反模式（写完自检）

- ❌ 写成需求文档（这是决策记录，不是功能规格）
- ❌ Options 只有 1 个（不是决策，是通告）
- ❌ Decision 长篇大论（一句话说不清的决策是没想清楚）
- ❌ 决策后修改原文（应开新 ADR 标 superseded）
- ❌ Consequences 只写好处不写坏处（没有反向后果的决策是错觉）

## 相关链接

- 触发本决策的文档：<spec / prd / plan 章节>
- 被本决策影响的文档：<需要 bump 的下游文档>
- 相关 ADR：<前置 ADR-NNN / 后续 ADR-NNN>
