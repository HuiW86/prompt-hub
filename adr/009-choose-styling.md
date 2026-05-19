---
type: adr
project: prompt-hub
id: ADR-009
status: Accepted
date: 2026-05-19
description: 选择纯 CSS variables + CSS Modules 作为样式方案；不引入 Tailwind——避免与 CLAUDE §4.1 禁止裸值铁律冲突；第二阶段（组件复杂度上升后）重评估
related:
  - design-spec
  - CLAUDE
  - plan
  - tech-stack
  - adr/002-choose-frontend-framework
---

# ADR-009: 选择 CSS Modules + CSS variables（不引入 Tailwind）

## 1. 标题与日期

- **标题**：选择纯 CSS variables + CSS Modules 作为样式方案；MVP 阶段不引入 Tailwind / vanilla-extract / 其他 CSS-in-JS
- **日期**：2026-05-19
- **决策者**：omar
- **影响范围**：[[design-spec]] token → CSS variables 直接映射 / [[CLAUDE#§4.1]] 禁止裸值铁律可机械检测 / 第一阶段所有组件实现 / 第二阶段（[[plan#第二阶段]]）触发重评估

## 2. Status

`Accepted`（2026-05-19）

## 3. Context

### 触发事件
[[adr/002-choose-frontend-framework]] 锁定 React 19.2 后，组件样式方案是 MVP 第一个组件落地前必决项。

### 业务约束
- [[CLAUDE#§4.1]] CSS 必须用 token — 任何组件 CSS / 内联样式禁止裸 px / 裸 hex / 裸 ms 值
- [[design-spec]] v0.6 已定义完整 token 体系（CSS variables 形式）+ [[plan#§0-T1]] 已落根样式表
- 历史事件：[[plan#§0-T2]] `#1D9E75` 字面量混入代码导致颜色不一致（2026-05-18 全量替换）— 「禁止裸值」是事故沉淀的规则

### 技术约束
- 与 React 19.2 + Vite 8.0 集成
- 与 [[adr/002-choose-frontend-framework]] 选定的 lucide-react / framer-motion（按需）兼容
- 不破坏 Tauri 2.x OS WebView 一致性

### 参考验证
VaultX 用 Tailwind CSS 4.2 + CSS variables design tokens（混合方案）—— 但 VaultX 没有 prompt-hub 这种「禁止裸值」铁律，无冲突源。

### 不决策的代价
- 第一阶段所有组件无法写样式
- token 与代码的映射方式不明
- AI 生成组件代码时无样式工具锚点

## 4. Options Considered

### Option A: 纯 CSS variables + CSS Modules

- **描述**：每个组件配 `Component.module.css`，全部值引用 `var(--*)` token；无 utility class、无 CSS-in-JS
- **优点**：
  - 与 [[CLAUDE#§4.1]] 「禁止裸值」铁律 100% 契合 — 任何裸 px / 裸 hex 在 `.module.css` 中可机械检测
  - 局部作用域（CSS Modules 自动 hash class name），无全局污染
  - 零运行时（与 CSS-in-JS 相比，避免运行时计算）
  - 与 [[design-spec]] token 直接映射（无中间层）
  - 学习成本最低（CSS Modules 是 Vite 内置支持，零配置）
  - AI 生成代码时只需引用 `var(--*)`，规则清晰
- **缺点**：
  - 开发速度比 Tailwind 慢（无 utility class 快速组合）
  - 需要手写 class 名而非 utility
  - 复杂组件状态变体需要 class 组合工具（如 clsx）
- **预估成本**：0 学习成本，工程速度中等

### Option B: Tailwind CSS 4.2 + token preset

- **描述**：引入 Tailwind 4，通过 preset 将 utility class 全部映射到 [[design-spec]] token
- **优点**：
  - utility class 开发速度快
  - 生态丰富（社区组件库 / 文档 / 示例）
  - VaultX 实战验证
- **缺点**：
  - 与 [[CLAUDE#§4.1]] 「禁止裸值」铁律**结构性冲突**：
    - Tailwind 默认提供 `p-4` `text-base` 等"预定义裸值别名"
    - 必须配 preset 将所有 utility 改为 `p-space-4`（带 token 名）才合规，破坏 Tailwind 习惯
    - 任何团队成员/AI 写 `p-4` 都会"看起来正确"但违反铁律
  - 即使配 preset，仍需机械检测 `class` 中是否含未授权的 utility
  - 引入额外构建步骤（Tailwind plugin + 配置）
- **预估成本**：preset 设计 1-2 天 + 持续维护成本

### Option C: vanilla-extract

- **描述**：TypeScript 写 CSS，类型安全 + 零运行时
- **优点**：类型安全顶级、与 token 系统天然契合
- **缺点**：
  - 学习曲线（独特 API）
  - 生态较小
  - 与 CSS Modules 优势重叠但学习成本高
- **预估成本**：中

### Option D: Emotion / styled-components（CSS-in-JS）

- **描述**：运行时 CSS-in-JS
- **优点**：动态样式表达力强
- **缺点**：
  - 运行时开销（与 C1 200ms 唤起冲突）
  - SSR / RSC 兼容性问题（虽 Tauri 不涉及，但生态趋势远离 runtime CSS-in-JS）
- **预估成本**：中-高

## 5. Decision

> **一句话拍板**：选择 **纯 CSS variables + CSS Modules**，理由是与 [[CLAUDE#§4.1]] 「禁止裸值」铁律结构性契合，铁律可机械检测，token 直接映射零中间层；第二阶段（[[plan#第二阶段]] 组件复杂度上升后）重评估 Tailwind token-only 模式。

**为什么不选其他**：
- 不选 Tailwind 因为：utility class 习惯与「禁止裸值」铁律结构性冲突，preset 修补成本 > MVP 阶段收益
- 不选 vanilla-extract 因为：学习成本高于带来的边际收益
- 不选 CSS-in-JS 因为：运行时开销与 C1 200ms 唤起冲突

## 6. Consequences

### 正向后果
- 解 [[tech-stack#§3]] 样式方案悬置
- [[CLAUDE#§4.1]] 铁律可用简单 lint 规则机械检测（`/[\d.]+px|#[0-9a-fA-F]{3,6}|\d+ms/` 在 `.module.css` 中报警）
- [[design-spec]] token 直接映射 CSS variables，无 preset 中间层
- 零运行时开销，对 C1 200ms 唤起最友好
- 学习成本最低，AI 生成组件代码规则清晰

### 反向后果
- 开发速度比 Tailwind 慢（中等组件需要写 10-30 行 .module.css）
- 需要 clsx / classnames 工具处理变体（轻量依赖）
- 第二阶段若组件数 >100 且复用频繁，可能感受到 utility class 缺失的痛点

### 未来反悔成本
- **代码改造规模**：迁移 CSS Modules → Tailwind preset 模式约 50-200 个组件文件改写 class
- **数据迁移**：无
- **学习成本**：迁移到 Tailwind 需团队/AI 适应 utility 心智
- **不可逆点**：无 — 样式工具切换是干净的工程
- **第二阶段触发条件**：组件数 >100 / 主形态视图密度上升 / Component variant 数量爆炸时重评估

---

## 反模式（写完自检）

- ✅ Options 4 个
- ✅ Decision 一句话 + 明确第二阶段触发条件
- ✅ Consequences 含「第二阶段触发条件」预案

## 相关链接

- **触发本决策的文档**：[[CLAUDE#§4.1]] / [[design-spec]] / [[plan#§0-T1]]
- **被本决策影响的文档**：所有 React 组件 .module.css / 待补的 lint 规则
- **相关 ADR**：前置 ADR-002（React + CSS Modules 标配组合）/ 第二阶段重评估可能开 ADR-NNN superseding
