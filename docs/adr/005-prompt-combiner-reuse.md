---
type: adr
project: prompt-hub
id: ADR-005
status: Proposed
date: 2026-05-19
description: prompt-combiner 旧代码复用决策——Proposed 占位，待调研 prompt-combiner 实际形态后填 Decision；Tauri 2.x（ADR-001）已锁定 Rust 后端，候选自然收窄为「重写 / 部分迁移前端组件 / 不复用」
related:
  - 09-tech-stack
  - CLAUDE
  - prompt-hub-mvp
  - 001-choose-desktop-runtime
  - 002-choose-frontend-framework
---

# ADR-005: prompt-combiner 旧代码复用决策（Proposed 占位）

> ⚠️ **本 ADR 当前为 Proposed 占位**，Decision 留空待调研。本节列出三候选 + 触发调研的下一步动作，避免 [[CLAUDE#§6]] 第 8 项 「不要复用 prompt-combiner 旧代码而不开 ADR」铁律被绕过。

## 1. 标题与日期

- **标题**：prompt-combiner 旧代码复用决策（重写 / 部分迁移 / 全部复用）
- **日期**：2026-05-19（占位创建）
- **决策者**：omar（决议时拍板）
- **影响范围**：[[prompt-hub-mvp#§0-T2]] 旧色替换风险注 / [[09-tech-stack#§3-D8]] / 第一阶段 MVP 实施节奏

## 2. Status

`Proposed`（2026-05-19，待调研后转 Accepted）

## 3. Context

### 触发事件
[[001-choose-desktop-runtime]] 锁定 Tauri 2.x 后，prompt-combiner 若是 Electron/Node.js 栈，**后端代码无法直接迁移**（需 Rust 重写）；前端组件视框架是否一致而定（ADR-002 React 19.2 已选定）。

### 业务约束
- [[02-constitution#A1]] 桌面原生 — 若 prompt-combiner 是 Web 应用，全部不可复用
- [[02-constitution#A2]] 本地优先 — 若 prompt-combiner 依赖远程 API，需剥离
- [[02-constitution#B1]] 资产三层 — 若 prompt-combiner 用不同数据模型，不能直接抄 schema
- [[02-constitution#D1]] 不内嵌 LLM — 若 prompt-combiner 调用过 LLM SDK，须移除

### 技术约束
- ADR-001 锁定 Tauri 2.x（Rust 后端）→ Node.js 后端代码 0 可迁移
- ADR-002 锁定 React 19.2 → 若 prompt-combiner 是 React 16/17/18，组件可迁但需升级；若是 Vue/Svelte，组件 0 可迁
- ADR-003 锁定 rusqlite + SQLite → 数据 schema 可迁但数据访问层需重写

### 待调研项（触发本 ADR Accepted 的前置）
- [ ] prompt-combiner 的技术栈是什么（前端框架版本 / 后端语言 / 数据层）
- [ ] LOC 规模与模块边界
- [ ] 是否存在 [[02-constitution]] 8 条铁律的历史违反点（需在迁移时清理）
- [ ] 关键功能与 prompt-hub Modifier/Composition/Macro 三层模型的契合度

### 不决策的代价
- [[prompt-hub-mvp#§0-T2]] 旧色替换风险注无法收口
- 第一阶段 MVP 实施节奏不确定（重写需 1.5x 工时，部分迁移需评估混搭成本）
- AI 在生成代码时可能擅自参考 prompt-combiner 旧逻辑（违反 [[CLAUDE#§6]] 第 8 项）

## 4. Options Considered（待调研后填具体优劣）

### Option A: 完全重写

- **描述**：忽略 prompt-combiner，按 [[01-spec]] + [[06-prd]] + [[03-product-spec]] 从零实现
- **优点（预估）**：
  - 100% 符合 [[02-constitution]] 8 条铁律，无历史包袱
  - 数据模型按 [[06-prd#数据模型]] 严格三层
  - Rust 后端从零设计，性能可控
- **缺点（预估）**：
  - 实施周期最长（基础 CRUD + 主形态 + 辅形态约 4-6 周）
  - 部分已验证的交互模式需重新设计

### Option B: 部分迁移（仅前端组件）

- **描述**：保留 prompt-combiner 前端组件（如 Modifier 选择器 / Composition 工作台 UI），后端全部用 Rust 重写
- **优点（预估）**：
  - 节省 UI 组件设计 + 实现时间
  - 已验证的 UX 直接复用
- **缺点（预估）**：
  - 前端框架版本可能不匹配（如 React 16/17 → 19 需升级）
  - 旧组件可能含 [[CLAUDE#§4]] 禁止的反模式（裸 px / 裸 hex 等），需 token 化重构
  - 数据流接口需重新对接 Rust IPC

### Option C: 全部复用

- **描述**：完整保留 prompt-combiner，仅将其壳层从 Electron/Web 切换到 Tauri
- **优点（预估）**：
  - 实施周期最短
- **缺点（预估）**：
  - **与 ADR-001 直接冲突** — Tauri 2.x Rust 后端无法承载 Node.js 代码
  - 实质上等于「仅前端复用」即 Option B
  - 若 prompt-combiner 不是 React 19，组件迁移成本可能高于重写
- **结论（预估）**：本选项在 ADR-001 锁定 Tauri 后已不可行，仅作为「为何不选」存档

## 5. Decision

> ⏸ **暂缓**，待调研产出后填。

**触发本 ADR 转 Accepted 的下一步动作**：
1. omar 提供 prompt-combiner 仓库位置 / GitHub URL / 本地路径
2. AI 调研：技术栈 / LOC / 模块结构 / 与 [[01-spec]] 的契合度
3. 输出调研报告 → 在本 ADR §4/§5 填具体优劣 + Decision

## 6. Consequences

> 待 Decision 拍板后填。

### 当前 Proposed 状态的承诺

- 在本 ADR 未转 Accepted 前，AI **不得**自行从 prompt-combiner 复制代码到 prompt-hub 仓库
- [[CLAUDE#§6]] 第 8 项 持续生效
- [[prompt-hub-mvp#§0-T2]] 旧色替换风险注保留警示

---

## 反模式（写完自检）

- ⚠️ Decision 暂缺 — 本 ADR Status `Proposed`，允许暂留
- ✅ Options ≥ 2 — A/B/C 三候选（虽 C 已预判不可行，作为对照保留）
- ✅ Context 显式列出待调研项 + 触发条件

## 相关链接

- **触发本决策的文档**：[[CLAUDE#§6]] 第 8 项 / [[prompt-hub-mvp#§0-T2]] / [[09-tech-stack#§3-D8]]
- **被本决策影响的文档**：[[prompt-hub-mvp#§0]] / [[prompt-hub-mvp#第一阶段]] / [[07-features]]（若复用前端组件，需登记影响范围）
- **相关 ADR**：前置 ADR-001（锁定 Rust 后端，收窄候选）/ ADR-002（锁定 React 19.2，决定前端组件可迁性）
