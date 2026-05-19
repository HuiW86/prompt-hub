---
type: adr
project: prompt-hub
id: ADR-001
status: Accepted
date: 2026-05-19
description: 选择 Tauri 2.x 作为 prompt-hub 桌面运行时——Electron 内存常驻 200-500MB 与 C1 200ms 唤起冲突，Wails 多窗口弱与 spec §2.3 副屏常驻冲突
related:
  - constitution
  - spec
  - tech-stack
  - plan
---

# ADR-001: 选择 Tauri 2.x 作为桌面运行时

## 1. 标题与日期

- **标题**：选择 Tauri 2.x 而非 Electron 30+ / Wails 2.x 作为桌面运行时
- **日期**：2026-05-19
- **决策者**：omar
- **影响范围**：[[tech-stack#§3-D1]]（resolved）/ 后续 ADR-002（前端框架，解锁独立决策）/ ADR-004（包管理）/ ADR-005（prompt-combiner 复用，前端组件可迁移评估）/ ADR-007（D7 全局快捷键自动锁定 tauri-plugin-global-shortcut）/ [[plan#§0]] 跨阶段先决条件解锁 / [[ops-spec#§1.2]] 打包签名章节方向锁定

## 2. Status

`Accepted`（2026-05-19）

## 3. Context

### 触发事件
第一阶段 MVP 建仓阻塞 — [[tech-stack#§3]] `D1 桌面运行时` 未决导致：
- AI 无法生成 import 语句（违反 [[产品文档体系方法论#§5.3]] tech-stack 验收④）
- [[CLAUDE#§2]] 关键命令无法回填（dev / build / test 命令依赖运行时选择）
- [[plan#§0]] 跨阶段先决条件 T1（design token）以外的任务全部阻塞
- 后续 D2 / D4 / D5 / D7 决策连锁阻塞

### 业务约束（来自 constitution）
- **A1 桌面原生 only** — 排除 Web / PWA / 浏览器扩展
- **A2 本地优先 + 无服务端** — 数据存本地，话术含隐私指纹，运行时默认沙箱越严越契合
- **A3 单人单机** — 不引入用户系统，运行时无需鉴权 / IAM 集成

### 技术约束（来自 spec + constitution）
- **C1 主形态唤起 ≤ 200ms P95**（[[constitution#C1]]）—— 隐性内存预算约束：常驻进程内存越低，系统调度越快、唤起越稳
- **主形态全屏覆盖窗口 + 全局快捷键唤起**（[[spec#2.3]]）—— 需要 global-shortcut + 全屏 + 透明背景 + always-on-top 组合
- **辅形态副屏常驻视图**（[[spec#2.3]] [[spec#2.8]]）—— 需要多窗口 + 多显示器 API

### 不决策的代价
- tech-stack 永远 stub，违反 §5.3 验收 ①②④（v1.2 §5.3 stub 例外限期升 v1.0）
- 第一阶段 MVP 无法启动
- D2 / D4 / D5 / D7 / D8 全部连锁阻塞，技术债越积越深

## 4. Options Considered

### Option A: Tauri 2.x

- **描述**：Rust 后端 + OS WebView（macOS WKWebView / Windows WebView2 / Linux WebKitGTK）+ TypeScript 前端，v2 于 2024 年 GA
- **优点**：
  - 包体 5–15 MB（macOS .app），内存常驻 50–100 MB — **C1 200ms 唤起的隐性预算最宽松**
  - 默认严格沙箱 + IPC 显式白名单 — 契合 A2 本地优先 + 隐私敏感
  - 官方 plugin 覆盖全部 prompt-hub 必需能力（global-shortcut / updater / fs / dialog / store / window）
  - macOS codesign + notarization 集成在 `tauri.conf.json`，简化 ops-spec §4 打包签名流程
  - AI 工具链（Claude Code / Cursor）2025 起对 Rust + Tauri 模板支持成熟
- **缺点**：
  - Rust 学习成本（但 prompt-hub 后端逻辑简单 — 本地存储 CRUD + 快捷键 + 窗口控制，估 Rust 部分 ≤ 500 LOC）
  - 跨平台 WebView 行为差异（CSS / JS API 不一致）— 但 prompt-hub macOS 优先，差异推迟到 v2.0+ 跨平台时再处理
  - 复杂托盘菜单 / 系统集成 API 偶有缺失，可能需要手写小型 plugin
- **预估成本**：MVP 建仓 1 周（含 Rust 模板搭建 + 学习），后续业务逻辑迭代速度与 Electron 相当

### Option B: Electron 30+

- **描述**：Node.js 后端 + 内置 Chromium + TypeScript 前端，10+ 年成熟生态
- **优点**：
  - 生态最成熟，第三方组件库完备
  - Chromium 一致性 — 跨 OS 行为统一，无 WebView 差异
  - Node.js 生态可直接复用（npm 任何包）
  - 团队对 Node.js 更熟，MVP 建仓更快（3–5 天）
- **缺点**：
  - 包体 80–150 MB / 内存常驻 200–500 MB — **C1 200ms 唤起在 macOS 内存压力大时不稳**
  - 默认沙箱松散（需手动配置 contextIsolation / nodeIntegration）— A2 隐私语境下额外加固成本
  - 长期常驻的桌面工具（prompt-hub 主形态预期一直在后台）体感差，用户对内存占用敏感
  - Chromium 内核每次升级带来安全补丁压力（运维成本）
- **预估成本**：MVP 建仓 3–5 天（更熟悉的栈），但后续内存优化 / 打包瘦身的反向成本可能抵消

### Option C: Wails 2.x（Go）

- **描述**：Go 后端 + OS WebView + TypeScript 前端
- **优点**：包体小、Go 部署友好、并发模型简单
- **缺点**：
  - **多窗口支持弱**（仍在实验）—— 直接冲突 [[spec#2.3]] 辅形态副屏常驻视图
  - 生态比 Tauri 更浅，AI 工具链对 Go + Wails 组合支持一般
  - 全局快捷键无官方插件，需手写跨平台抽象
- **预估成本**：MVP 可达，但辅形态实现时高概率撞墙

## 5. Decision

> **一句话拍板**：选择 **Tauri 2.x**，理由是它是唯一同时满足 C1 200ms 唤起隐性内存预算 + A2 本地优先严格沙箱 + spec §2.3 多窗口副屏的运行时。

**为什么不选其他**：
- 不选 Electron 因为：内存常驻 200–500MB 让 C1 200ms 唤起在 macOS 内存压力大时不稳；默认松散沙箱与 A2 隐私语境不契合
- 不选 Wails 因为：多窗口支持弱，[[spec#2.3]] 辅形态副屏常驻在 Wails 上要踩坑

## 6. Consequences

### 正向后果
- 解 [[tech-stack#§3-D1]]，第一阶段 MVP 建仓可启动
- **D5 构建工具**自动锁定为 Vite（Tauri 官方推荐栈）— 节省 ADR-005 决策
- **D7 全局快捷键**自动锁定为 `@tauri-apps/plugin-global-shortcut` — 节省 ADR-007 决策
- 解锁 D2（前端框架）/ D3（数据持久化）/ D4（包管理）独立决策
- [[ops-spec#§1.2]] 打包/签名流程可照 Tauri 官方文档落地（不需自建）
- 默认沙箱契合 A2，可在 ADR-001 后续的安全加固决策中省去额外步骤

### 反向后果
- 引入 Rust 学习成本（虽控制在 ≤500 LOC，但任何 Rust panic / borrow checker / cargo 编译错误需要 debug 时间）
- 锁死 OS WebView 路线：未来若需要某个 Chromium 独有 API（如 WebUSB / WebSerial / WebGPU 高级特性），需重新评估
- Tauri v2 生态相对新：少数边缘需求（如复杂托盘菜单、系统级集成）可能需要手写小型 plugin
- 跨平台时（v2.0+ 计划支持 Windows / Linux）需要为 WebView 差异预算调试时间

### 未来反悔成本

> 如果 6 个月 / 1 年后想推翻这个决策，需要付出什么代价？

- **代码改造规模**：约 30–50 个文件
  - Rust 后端（≤500 LOC）→ Node.js + IPC 桥（commands.rs → preload.ts），完全重写
  - UI 部分（React/Vue + TypeScript）几乎可零改动（仅 IPC 调用接口适配）
  - tauri.conf.json → electron-builder 配置重写
- **数据迁移**：无 — 数据存本地 SQLite / JSON，运行时切换不影响 schema
- **学习成本**：团队需重新熟悉 Electron 安全模型（contextIsolation / nodeIntegration / sandbox）
- **不可逆点**：
  - 代码签名证书已绑定 Tauri updater 流程，迁移需重新发布完整版本（用户首次升级走全量包，不能走增量）
  - 若用户基数已大，强制从 Tauri 版本升级到 Electron 版本需要 migration installer 工程
  - macOS notarization ticket 与 bundle ID 绑定，运行时切换需新 bundle ID 或重新签名

---

## 反模式（写完自检）

- ✅ Options ≥ 2 个（A/B/C 三选一）
- ✅ Decision 一句话
- ✅ Consequences 含反向后果 + 反悔成本
- ✅ 未写成需求文档（聚焦决策本身）
- ✅ 引用 constitution + spec 章节锚点

## 相关链接

- **触发本决策的文档**：[[tech-stack#§3-D1]] / [[spec#1.3]] / [[spec#2.3]] / [[spec#2.8]] / [[constitution#A1]] / [[constitution#A2]] / [[constitution#C1]]
- **被本决策影响的文档**：[[tech-stack]]（D1 resolved，§4 等所有 D 全决议后回填升 v1.0）/ [[plan#§0]]（解锁 T1 之后任务）/ [[ops-spec#§1.2]]（签名流程方向锁定 Tauri）/ [[CLAUDE#§2]]（建仓后关键命令回填 `pnpm tauri dev` 等）
- **相关 ADR**：
  - 前置：无
  - 后续独立：ADR-002（前端框架 React/Vue/Svelte/Solid）/ ADR-003（数据持久化 SQLite/JSON）/ ADR-004（包管理 pnpm/bun）
  - 后续依赖本决策：ADR-005（prompt-combiner 复用，需评估前端组件迁移成本）/ ADR-006（状态管理）
  - 自动锁定（无需独立 ADR）：D5 构建 = Vite / D7 全局快捷键 = `@tauri-apps/plugin-global-shortcut`
