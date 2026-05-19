---
type: adr
project: prompt-hub
id: ADR-002
status: Accepted
date: 2026-05-19
description: 选择 React 19.2 作为前端框架——借鉴 VaultX 实战栈 + AI 工具链支持最成熟 + React 19 Actions/useOptimistic 契合 prompt-hub 复制即隐藏的乐观更新场景
related:
  - constitution
  - spec
  - tech-stack
  - adr/001-choose-desktop-runtime
---

# ADR-002: 选择 React 19.2 作为前端框架

## 1. 标题与日期

- **标题**：选择 React 19.2（含 React-DOM 19.2）作为前端框架
- **日期**：2026-05-19
- **决策者**：omar
- **影响范围**：[[tech-stack#§3-D2]] resolved / 后续 ADR-006（状态管理 Zustand 与 React 强绑）/ ADR-009（样式方案 CSS Modules + React）

## 2. Status

`Accepted`（2026-05-19）

## 3. Context

### 触发事件
[[adr/001-choose-desktop-runtime]] 锁定 Tauri 2.x 后，前端框架是 MVP 建仓前必须决议的下一个阻塞项。

### 业务约束
- [[constitution#A1]] 桌面原生 — 框架须能在 OS WebView 中无降级运行
- [[constitution#C1]] 主形态 200ms 唤起 — 框架运行时开销越小越好
- [[spec#2.3]] 主形态全屏覆盖窗口 + 辅形态副屏常驻 — 框架须支持多窗口共享状态

### 技术约束
- 与 Tauri 2.x IPC 桥兼容（所有候选都满足）
- AI 协同生成代码（Claude Code / Cursor）友好度
- [[spec]] 项目定位为「AI 协同时代工具」— 生态成熟度直接影响 AI 工具链产出质量

### 参考验证
VaultX（GitHub: HuiW86/VaultX，2026 在维护）已用 React 19.2 + Tauri 2.x + Vite 8.0 完整跑通同形态桌面单机应用。

### 不决策的代价
ADR-006 状态管理 / ADR-009 样式方案 / 后续组件库选型全部连锁阻塞。

## 4. Options Considered

### Option A: React 19.2

- **描述**：Meta 出品，2024 GA，生态最大；Actions + useOptimistic + use() hook 等新特性
- **优点**：
  - AI 工具链（Claude Code / Cursor / Copilot）支持最成熟 — 对「AI 协同时代工具」定位是隐性加分
  - VaultX 实战验证 React 19.2 + Tauri 2.x 组合稳定
  - Actions + useOptimistic 契合 prompt-hub「复制即隐藏」乐观更新（先隐藏窗口、异步写 UsageRecord）
  - 生态最大（lucide-react / framer-motion / TanStack 等借鉴库都基于 React）
  - 团队/AI 已熟悉，无新框架学习成本
- **缺点**：
  - 运行时较 Svelte/Solid 大（但 Tauri OS WebView 场景差异可忽略）
  - JSX 表达能力较 Vue template 弱（但 prompt-hub 不重视 template 约束）
- **预估成本**：MVP 起步 0 学习成本

### Option B: Vue 3.5

- **描述**：尤雨溪团队，2024 GA，Composition API 成熟
- **优点**：包体小、性能优、template 表达力强、中文生态友好
- **缺点**：
  - AI 工具链对 Vue 支持次于 React（Cursor/Claude 生成 Vue 代码质量略低）
  - Tauri 模板默认 React/Vanilla，Vue 需自配
- **预估成本**：MVP 起步无明显劣势，但 AI 协同效率有差距

### Option C: Svelte 5

- **描述**：编译时框架，runes API（2024）；运行时极小
- **优点**：
  - 运行时 ~10KB，对 C1 200ms 唤起加分
  - 单文件组件心智简单
- **缺点**：
  - 生态较小，关键库（如复杂状态管理、动画库）仍需自适配
  - AI 工具链对 runes API 支持仍在追赶
  - VaultX 未验证 Svelte + Tauri 2.x 组合
- **预估成本**：可能在 MVP 中后期撞库支持坑

### Option D: SolidJS

- **描述**：细粒度响应式，无 Virtual DOM
- **优点**：性能顶级、JSX 语法与 React 接近
- **缺点**：
  - 生态最小
  - AI 工具链支持弱
- **预估成本**：高（生态缺口需自填）

## 5. Decision

> **一句话拍板**：选择 **React 19.2**，理由是 AI 协同时代项目对工具链成熟度的需求 > 包体/性能差异，且 VaultX 实战已验证 React 19.2 + Tauri 2.x 组合稳定。

**为什么不选其他**：
- 不选 Vue 因为：AI 工具链支持次于 React，与 prompt-hub「AI 协同时代工具」定位错配
- 不选 Svelte 因为：生态小且未在同形态项目验证，MVP 阶段不冒险
- 不选 Solid 因为：生态最小，关键库缺口需自填

## 6. Consequences

### 正向后果
- 解 [[tech-stack#§3-D2]]
- 解锁 ADR-006（Zustand 5 完美适配 React 19）
- 解锁 ADR-009（CSS Modules + React 是标配组合）
- 后续 UI 库选型自由（lucide-react / framer-motion / TanStack 全部可用）
- AI 协同时 Claude Code 生成 React 代码质量最高

### 反向后果
- 锁死 React 心智 — 未来若想换 Vue/Svelte 需重写全部 .tsx
- React 19 仍在生态磨合期，少数老库可能未升级（如某些 React 18 only 的库）
- Hydration / Suspense / Server Components 等新特性在 Tauri OS WebView 场景部分用不上

### 未来反悔成本
- **代码改造规模**：所有 `.tsx` 重写（视组件数 100-300 个文件）
- **数据迁移**：无 — UI 框架切换不影响 SQLite schema
- **学习成本**：换框架需重新熟悉新框架心智
- **不可逆点**：React 生态依赖（hooks 模式 / Context / Concurrent 等）已渗透组件设计，迁移成本随 LOC 线性增长

---

## 反模式（写完自检）

- ✅ Options 4 个
- ✅ Decision 一句话
- ✅ Consequences 含反向后果 + 反悔成本

## 相关链接

- **触发本决策的文档**：[[tech-stack#§3-D2]] / [[adr/001-choose-desktop-runtime]]
- **被本决策影响的文档**：[[tech-stack]] / [[adr/006-choose-state-management]] / [[adr/009-choose-styling]]
- **相关 ADR**：前置 ADR-001 / 后续 ADR-006（强绑）/ ADR-009（强绑）
