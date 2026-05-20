---
type: adr
project: prompt-hub
id: ADR-006
status: Accepted
date: 2026-05-19
description: 选择 Zustand 5 作为状态管理；借鉴 VaultX 多 store 分层模式——appStore / promptStore / searchStore / settingsStore 四层
related:
  - 09-tech-stack
  - 03-product-spec
  - 001-choose-desktop-runtime
  - 002-choose-frontend-framework
---

# ADR-006: 选择 Zustand 5 作为状态管理

## 1. 标题与日期

- **标题**：选择 Zustand 5 作为前端状态管理；按业务边界分四层 store
- **日期**：2026-05-19
- **决策者**：omar
- **影响范围**：[[09-tech-stack#§3-D6]] resolved / [[03-product-spec]] 状态机映射 / 后续 React 组件订阅模式

## 2. Status

`Accepted`（2026-05-19）

## 3. Context

### 触发事件
[[002-choose-frontend-framework]] 锁定 React 19.2 后，状态管理是下一个组件实施前必决项。

### 业务约束
- [[01-spec#2.3]] 主形态 + 辅形态共享数据 — 需要跨窗口（Tauri 多 webview）共享 state
- [[01-spec#2.8]] 主辅形态同一份数据 — 状态层须支持响应式同步
- [[02-constitution#C1]] 200ms 唤起 — 状态层运行时开销需可控
- [[03-product-spec]] 状态机（用户态 / 视图态 / 数据态）需要明确分层

### 技术约束
- 与 React 19.2 兼容
- 与 Tauri 2.x IPC（Rust ↔ TypeScript）集成
- 支持持久化（部分 store 需 localStorage 同步）

### 参考验证
VaultX 用 Zustand 5 实战分四层 store：appStore（全局窗口/锁定）/ vaultStore（数据）/ searchStore（query）/ settingsStore（用户偏好）。

### 不决策的代价
- React 组件无法决定订阅模式
- 跨组件数据流（如主形态 → 辅形态）实现不明
- 持久化策略悬置

## 4. Options Considered

### Option A: Zustand 5

- **描述**：单文件 store + hook 订阅 + middleware（persist / immer / devtools）
- **优点**：
  - 简单（无 boilerplate / 无 reducer / 无 action type）
  - 细粒度订阅（selector + shallow compare）— 性能好
  - TypeScript 体验最佳（类型推断完整）
  - VaultX 实战验证多 store 分层模式
  - 中间件丰富（zustand/middleware/persist 直接同步 localStorage）
  - 跨 React Tree 共享 state（适合 Tauri 多 webview 场景）
- **缺点**：
  - 无 time-travel debugging（但有 devtools middleware 补足）
  - 大型嵌套 state 需配 immer middleware
- **预估成本**：0 学习成本（团队/AI 已熟悉）

### Option B: Jotai 2

- **描述**：原子化 state（atom + useAtom）
- **优点**：原子粒度最细、组合性强、与 React Suspense 集成好
- **缺点**：
  - prompt-hub state 粒度较大（按业务域分组），原子化反而碎片化
  - 学习曲线略陡（atom dependency graph 心智）
  - 跨组件大对象 state 不是 Jotai 强项
- **预估成本**：低-中

### Option C: React Context only

- **描述**：useContext + useReducer 原生方案
- **优点**：零依赖
- **缺点**：
  - rerender 不可控（任何 Provider value 变化全树 rerender）
  - 多 context 嵌套地狱
  - 性能差（与 C1 200ms 唤起冲突）
- **预估成本**：0 安装但日常使用代价高

### Option D: Redux Toolkit

- **描述**：Redux 现代版本，去 boilerplate
- **优点**：生态最大、time-travel debugging 完整
- **缺点**：
  - 仍有 reducer / action / slice 心智
  - prompt-hub 规模不需要这么重
  - 与 Zustand 比无明显优势
- **预估成本**：中

## 5. Decision

> **一句话拍板**：选择 **Zustand 5** + 按业务边界分四层 store（appStore / promptStore / searchStore / settingsStore），借鉴 VaultX 实战分层模式。

**为什么不选其他**：
- 不选 Jotai 因为：prompt-hub state 粒度大（按业务域），原子化反碎片化
- 不选 Context 因为：性能不可控，rerender 全树触发与 C1 冲突
- 不选 Redux Toolkit 因为：boilerplate 仍重，prompt-hub 规模不需要

## 6. Consequences

### 正向后果
- 解 [[09-tech-stack#§3-D6]]
- 四层 store 设计明确（与 [[03-product-spec]] 状态机映射一致）：
  | Store | 职责 | 持久化 |
  |---|---|---|
  | **appStore** | 窗口形态（main/aux）/ 当前视图 ID / 主形态可见性 | 部分（视图偏好）|
  | **promptStore** | Modifier / Composition / Macro / UsageRecord（从 Rust IPC 拉取）| 否（数据源是 SQLite）|
  | **searchStore** | query / filter / 高亮结果 | 否（短期态）|
  | **settingsStore** | 快捷键 / 主题 / 副屏开关 / Phase 状态 | 是（localStorage + Rust IPC 同步至 SQLite）|
- persist middleware 直接搞定 settingsStore localStorage
- React 19 + Zustand 5 组合在 VaultX 已验证稳定

### 反向后果
- 跨 store 派生 state 需用 selector 组合（vs Jotai 原生 derivedAtom）
- 大型 immutable update 需 immer（增加 ~10KB）
- store 数量增长后需约定文件结构（推荐 `src/stores/{name}Store.ts` 一致）

### 未来反悔成本
- **代码改造规模**：所有组件中的 `useXxxStore` hook 替换；约 50-150 个组件文件
- **数据迁移**：无 — state 是运行时构造，不影响持久化
- **学习成本**：换 Jotai 需重新熟悉原子心智
- **不可逆点**：无 — 状态管理库切换是相对干净的工程

---

## 反模式（写完自检）

- ✅ Options 4 个
- ✅ Decision 一句话 + 分层设计
- ✅ Consequences 含具体 store 设计表

## 相关链接

- **触发本决策的文档**：[[09-tech-stack#§3-D6]] / [[03-product-spec]]
- **被本决策影响的文档**：所有 React 组件 / [[03-product-spec]] 状态机章节
- **相关 ADR**：前置 ADR-002（强绑 React）/ 独立于其他
