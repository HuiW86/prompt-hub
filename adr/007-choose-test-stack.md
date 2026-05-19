---
type: adr
project: prompt-hub
id: ADR-007
status: Accepted
date: 2026-05-19
description: 选择测试栈——前端 Vitest 4 + Testing Library + jsdom 29；Rust cargo test + tempfile；E2E Playwright 推到 v1.0+ 视需求加
related:
  - tech-stack
  - test-spec
  - adr/001-choose-desktop-runtime
  - adr/002-choose-frontend-framework
---

# ADR-007: 选择测试栈（Vitest 4 + RTL + cargo test）

## 1. 标题与日期

- **标题**：选择 Vitest 4 + Testing Library + jsdom 29 + cargo test + tempfile 为测试栈
- **日期**：2026-05-19
- **决策者**：omar
- **影响范围**：[[tech-stack#§3]] 测试工具行 / [[test-spec]] 用例书写格式 / CI 测试 step / [[features#测试覆盖列]]

## 2. Status

`Accepted`（2026-05-19）

## 3. Context

### 触发事件
[[test-spec]] 定义了金字塔比例与用例格式，但工具未拍板；MVP 建仓前必须确定。

### 业务约束
- [[test-spec#§5]] benchmark 测量 C1 200ms 唤起 — 需要可执行的性能 assertion 工具
- [[constitution#D1]] 不内嵌 LLM — Eval 集对 prompt-hub 是 N/A（[[test-spec#§6]]），但通用单元/集成/E2E 必须有

### 技术约束
- 与 Vite 8.0 集成（共享配置 vite.config.ts）
- 与 React 19.2 + TypeScript 5.x 兼容
- 支持 jsdom 模拟 DOM（无需 Playwright 也能测组件）
- Rust 后端有标准测试方案

### 参考验证
VaultX 实战使用 Vitest 4 + Testing Library（react/jest-dom/user-event）+ jsdom 29 + cargo test + tempfile 完整组合。

### 不决策的代价
- [[test-spec]] 用例格式无法定型
- CI 测试 step 无法实施
- AI 生成测试时不知用哪个框架

## 4. Options Considered

### Option A: Vitest 4 + Testing Library + jsdom 29 + cargo test + tempfile

- **描述**：前端 Vite 原生测试 + React 测试库 + DOM 模拟；Rust 标准库 + 临时文件 fixture
- **优点**：
  - Vitest 与 Vite 8.0 完美集成（共享 plugin / 配置 / transformer）
  - Vitest 4 启动 / 跑速最快（HMR-like watch mode）
  - Testing Library 强制"as user"测试理念（与 prompt-hub UX 优先一致）
  - jsdom 29 满足绝大多数 React 组件测试
  - cargo test 是 Rust 事实标准，零额外依赖
  - tempfile crate 处理 SQLite 文件 fixture（创建临时 .db，测试后自动清理）
  - VaultX 全栈验证
- **缺点**：
  - jsdom 不能测真实快捷键 / 全屏窗口 / 透明背景 — 需要 Tauri 集成测试或 Playwright 补充（推到 v1.0+ 视需求加）
  - Vitest 4 API 与 Jest 不完全兼容（但已成主流，社区例子多）
- **预估成本**：0（VaultX 同栈，AI 工具熟悉）

### Option B: Jest 30 + Testing Library + jsdom

- **描述**：Jest 传统选择
- **优点**：生态最大、文档最全
- **缺点**：
  - 与 Vite 集成需要 vite-jest 桥，配置复杂
  - 启动慢（每个 test 文件 cold start）
  - ESM 支持仍有边角问题
- **预估成本**：中（额外配置）

### Option C: Playwright Component + Playwright E2E

- **描述**：Playwright 同时承担组件测试 + E2E
- **优点**：真实浏览器环境 + 跨浏览器
- **缺点**：
  - 单元测试 overkill — 每个测试启动 Chromium 太慢
  - 与 Vite 集成不如 Vitest 原生
- **预估成本**：高（单元测试场景）

## 5. Decision

> **一句话拍板**：选择 **Vitest 4 + Testing Library + jsdom 29 + cargo test + tempfile**；E2E 推到 v1.0+ 视需求评估 Playwright。

**为什么不选其他**：
- 不选 Jest 因为：与 Vite 集成额外成本，启动慢
- 不选 Playwright 做单元 因为：单元 overkill，启动 Chromium 不必要
- E2E Playwright 推迟因为：MVP 阶段 jsdom + Tauri 手动验证可覆盖核心场景

## 6. Consequences

### 正向后果
- 解 [[test-spec]] 工具选型悬置
- Vitest 与 Vite 共享配置（`vitest.config.ts` 可继承 `vite.config.ts`）
- 测试启动快（HMR-like，watch mode 几乎实时）
- [[test-spec#§5]] 性能 benchmark 可用 Vitest bench API（`bench()` + `expect(...).toBeLessThan(200)`）
- cargo test 与 GitHub Actions 标准 step 集成

### 反向后果
- jsdom 限制：
  - 不测真实快捷键注册（Tauri 全局快捷键路径需 Rust 单元测试 + 手动验收）
  - 不测全屏窗口 / 透明背景（需 Playwright 或手动验收）
  - 不测 IPC 真实往返（mock 之）
- Vitest 4 升 5 时可能有 breaking change（但 ADR 可补 bump）

### 未来反悔成本
- **代码改造规模**：迁移 Vitest → Jest 约 100-200 行测试代码语法调整
- **数据迁移**：无
- **学习成本**：换 Jest 需重新熟悉差异
- **不可逆点**：无 — 测试框架是干净切换

---

## 反模式（写完自检）

- ✅ Options 3 个
- ✅ Decision 一句话（含 v1.0+ E2E 延后说明）
- ✅ Consequences 明确 jsdom 限制 + 补充方向

## 相关链接

- **触发本决策的文档**：[[test-spec]] / [[tech-stack#§3]]
- **被本决策影响的文档**：[[test-spec]] 用例格式 / [[features]] 测试覆盖列定义 / CI workflow（待建）
- **相关 ADR**：前置 ADR-001 / ADR-002 / 未来 E2E 决议 → 新开 ADR-NNN
