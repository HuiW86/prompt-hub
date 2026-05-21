---
type: tech-stack
project: prompt-hub
version: v1.1
created: 2026-05-19
updated: 2026-05-20
status: ratified  # ADR-001~004/006~009 全部 Accepted；ADR-005（prompt-combiner 复用）仍 Proposed
author: ai  # 🤖 AI 主笔 + 人审（CLAUDE §5.2）
audience: [ai]
description: prompt-hub 技术栈快照——全栈拍板：Tauri 2.x + React 19.2 + rusqlite 0.32 + pnpm 10.x + Zustand 5 + Vitest 4 + CSS Modules，macos-private-api 启用
related:
  - 02-constitution
  - prompt-hub-mvp
  - 001-choose-desktop-runtime
  - 002-choose-frontend-framework
  - 003-choose-data-persistence
  - 004-choose-package-manager
  - 005-prompt-combiner-reuse
  - 006-choose-state-management
  - 007-choose-test-stack
  - 008-enable-macos-private-api
  - 009-choose-styling
---

# Tech Stack: prompt-hub

> 全栈技术选型已通过 ADR-001~009 拍板（除 ADR-005 prompt-combiner 复用仍 Proposed）。AI 在生成代码前可直接按本文件 §4~§7 操作；遇 dependency major bump 必须先开 ADR（[[#§8-升级流程]]）。
>
> 跨阶段先决条件见 [[prompt-hub-mvp#§0]]；第一阶段 MVP 建仓基线见 [[prompt-hub-mvp#第一阶段]]。

---

## §1 已锁定的技术约束（来自 constitution）

这些不是"选型"，是 constitution 的物理推论，**任何 ADR 不可绕过**：

| 维度 | 约束 | 来源 |
|---|---|---|
| 应用形态 | 桌面原生（非 Web / 非浏览器扩展） | [[02-constitution#A1]] |
| 数据存储 | 本地存储（localStorage / SQLite / 文件）；禁服务端 | [[02-constitution#A2]] |
| 网络权限 | 不调用自有后端 API；不上传话术 | [[02-constitution#A2]] |
| AI SDK | 禁用 anthropic / openai 等 LLM SDK 用于话术生成 | [[02-constitution#D1]] |
| 性能预算 | 主形态唤起 ≤ 200ms P95 | [[02-constitution#C1]] |

---

## §2 已确定的子系统

### 2.1 设计 Token 系统

已在 [[05-design-spec]] v0.6 与 [[prompt-hub-mvp#§0-T1]] 落地，**任何组件 CSS 禁止使用裸 px / 裸 hex / 裸 ms 值**。

- CSS Variables 根样式表见 `plan.md §0 T1`
- 颜色 / 字号 / 间距 / 动画时长全部 token 化
- 关键颜色：
  - 协议层 `--color-protocol-border: #534AB7`
  - 任务层 `--color-task-border: #178561`（替代旧 `#1D9E75`，自检见 plan §0 T2）

### 2.2 设计契约

详见 [[05-design-spec]] v0.6，含 WCAG 对比度要求（Non-text ≥3:1，文字 ≥4.5:1）。

---

## §3 决策项总览（resolved + pending）

| # | 决策项 | 选定 | ADR | 状态 |
|---|---|---|---|---|
| **D1** | 桌面运行时 | Tauri 2.x | [[001-choose-desktop-runtime]] | ✅ Accepted 2026-05-19 |
| **D2** | 前端框架 | React 19.2 | [[002-choose-frontend-framework]] | ✅ Accepted 2026-05-19 |
| **D3** | 数据持久化 | rusqlite 0.32 + bundled SQLite（不启 SQLCipher）| [[003-choose-data-persistence]] | ✅ Accepted 2026-05-19 |
| **D4** | 包管理器 | pnpm 10.x | [[004-choose-package-manager]] | ✅ Accepted 2026-05-19（基线 9.x→10.x 修订 2026-05-20）|
| **D5** | 构建工具 | Vite 7.x | D1 自动锁定（无独立 ADR）| ✅ 由 D1 锁定 |
| **D6** | 状态管理 | Zustand 5（四层 store）| [[006-choose-state-management]] | ✅ Accepted 2026-05-19 |
| **D7** | 全局快捷键 API | @tauri-apps/plugin-global-shortcut | D1 自动锁定（无独立 ADR）| ✅ 由 D1 锁定 |
| **D8** | prompt-combiner 复用 | （待 omar 提供仓库后调研）| [[005-prompt-combiner-reuse]] | ⏳ Proposed |
| **D9** | macOS 私有 API | 启用 macos-private-api（永久弃 App Store）| [[008-enable-macos-private-api]] | ✅ Accepted 2026-05-19 |
| **D10** | 样式方案 | CSS Modules + CSS variables（不引 Tailwind）| [[009-choose-styling]] | ✅ Accepted 2026-05-19 |
| **D11** | 测试栈 | Vitest 4 + Testing Library + jsdom 29 + cargo test + tempfile | [[007-choose-test-stack]] | ✅ Accepted 2026-05-19 |

**仅剩 D8 阻塞**：第一阶段 MVP 建仓不依赖 D8（可走「重写」路径），D8 调研结果只影响迁移节奏。

---

## §4 运行时与框架

| 维度 | 选定 | 版本 | 来源 |
|---|---|---|---|
| **桌面运行时** | Tauri | 2.x | [[001-choose-desktop-runtime]] |
| **Tauri features** | `macos-private-api` 启用 | — | [[008-enable-macos-private-api]] |
| **前端框架** | React + React-DOM | 19.2 | [[002-choose-frontend-framework]] |
| **状态管理** | Zustand | 5.x | [[006-choose-state-management]] |
| **TypeScript** | TS | 5.x（strict mode）| 标配 |
| **Node 版本** | lts/iron | 20.x 或更新 | Tauri 2.x + Vite 7 要求 |
| **Rust MSRV** | rustc | 1.77.2+ | Tauri 2.x 要求 |

### 4.1 Zustand 四层 store

| Store | 职责 | 持久化 |
|---|---|---|
| `appStore` | 窗口形态（main/aux）/ 当前视图 ID / 主形态可见性 | 部分（视图偏好）|
| `promptStore` | Modifier / Composition / Macro / UsageRecord（从 Rust IPC 拉取）| 否（数据源是 SQLite）|
| `searchStore` | query / filter / 高亮结果 | 否（短期态）|
| `settingsStore` | 快捷键 / 主题 / 副屏开关 / Phase 状态 | 是（localStorage + Rust IPC 同步至 SQLite）|

文件结构约定：`src/stores/{name}Store.ts`。完整设计见 [[006-choose-state-management#6]]。

### 4.2 macOS 私有 API 用途

| 私有 API | 用途 | spec 依据 |
|---|---|---|
| NSWindow `level` | 主形态浮于所有应用上方但不抢焦点 | [[01-spec#2.3]] 哲学三时间分离 |
| `setSharingType` | 控制窗口分享行为 | 主形态隐私 |
| `canBecomeMain` / `canBecomeKey` | 唤起后立即接收键盘事件而不切换 active app | [[02-constitution#C1]] 200ms 唤起 |

**不可逆约束**：App Store 上架永久排除（[[008-enable-macos-private-api#6]]）。

---

## §5 数据层

| 维度 | 选定 | 版本 | 备注 |
|---|---|---|---|
| **数据库引擎** | SQLite（rusqlite bundled feature）| 0.32 | bundled SQLite 跨 OS 行为一致 |
| **加密** | 不启 SQLCipher | — | A2 + OS 用户密码 + FileVault 已是隐私底线 |
| **关系/索引** | rusqlite 原生 SQL | — | 外键 / 索引 / 事务全开 |
| **时间** | `chrono` | 0.4.x | UsageRecord 时间戳 |
| **UUID** | `uuid` v4 | 1.x | 实体主键 |
| **测试 fixture** | `tempfile` | 3.x | 临时 .db 文件，测后自动清理 |

### 5.1 数据目录

```
macOS:   ~/Library/Application Support/dev.prompt-hub/
Windows: %APPDATA%\dev.prompt-hub\
```

由 Tauri `path::app_data_dir()` 解析。完整备份策略见 [[10-ops-spec#§3]]（`cp .db + WAL`）。

### 5.2 数据规模与索引基线

| 实体 | 预估上限 | 索引策略 |
|---|---|---|
| Modifier | ≤ 5,000 | 全表 + 标签反查 |
| Composition | ≤ 1,000 | 含 Modifier 引用反查 |
| Macro | ≤ 100 | 主键即可 |
| UsageRecord | 增长无上限（按月归档）| 时间范围 query + 关联实体反查 |
| SOP | ≤ 200 | 主键 |

---

## §6 工具链

| 维度 | 选定 | 版本 | 来源 |
|---|---|---|---|
| **包管理** | pnpm | 10.x | [[004-choose-package-manager]] |
| **构建** | Vite | 7.x | D1 自动锁定（create-tauri-app 模板基线）|
| **样式** | CSS Modules + CSS variables | Vite 内置 | [[009-choose-styling]] |
| **class 拼接** | clsx | 2.x | 变体合并 |
| **前端测试** | Vitest + Testing Library + jsdom | 4 / latest / 29 | [[007-choose-test-stack]] |
| **Rust 测试** | cargo test + tempfile | 内置 / 3.x | [[007-choose-test-stack]] |
| **E2E** | Playwright | 推到 v1.0+ 评估 | [[007-choose-test-stack#5]] |
| **JS Lint** | ESLint | 9.x（flat config）| 标配 |
| **JS Format** | Prettier | 3.x | 标配 |
| **Rust Lint** | clippy（`-D warnings`）| 随 toolchain | 标配 |
| **Rust Format** | rustfmt | 随 toolchain | 标配 |

### 6.1 lockfile 政策

- `pnpm-lock.yaml` **必须提交**；`package-lock.json` / `yarn.lock` / `bun.lockb` **必须 gitignore**
- 严禁混用其他包管理器（npm install 会产生 lockfile 冲突）

### 6.2 CI 测试 step（待 ops-spec 补 workflow）

```bash
pnpm install --frozen-lockfile
pnpm test                          # Vitest 全量
pnpm lint                          # ESLint
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings
```

完整命令见 [[CLAUDE#§2]]。

---

## §7 锁定原因（关键依赖版本约束）

| 包 | 版本锁定 | 原因 | 升级触发 |
|---|---|---|---|
| `tauri` (Rust) | `^2.0` | 2.x 不兼容 1.x；私有 API 行为绑定 macOS 版本 | major bump → ADR |
| `@tauri-apps/api` | `^2.0` | 与 Rust 端协议绑定 | 同上 |
| `@tauri-apps/plugin-global-shortcut` | `^2.0` | Tauri 2.x 插件协议 | 同上 |
| `@tauri-apps/plugin-updater` | `^2.0` | Tauri 2.x 插件协议 | 同上 |
| `react` / `react-dom` | `^19.2` | Actions / useOptimistic 是 19 特性，不可降级 | major bump → ADR |
| `zustand` | `^5.0` | v5 类型推断与 v4 不兼容 | major bump → ADR |
| `rusqlite` | `0.32` | bundled SQLite 版本影响 schema 迁移 | minor bump 即评估 |
| `chrono` | `0.4` | 与 rusqlite 0.32 timestamp 适配 | 与 rusqlite 联动 |
| `uuid` | `^1.0` | 主键格式稳定 | 自由 |
| `pnpm` | `10.x` | lockfile 格式跨 OS 一致；build script 需 `onlyBuiltDependencies` 白名单 | major bump → ADR |
| `vite` | `^7.0` | create-tauri-app 2.x 模板基线（建仓实测 7.3.x）；HMR / 测试共享配置 | major bump → ADR |
| `vitest` | `^4.0` | bench API 用于 C1 benchmark | major bump → ADR |
| `@testing-library/react` | latest | 与 React 19 同步 | 跟随 react |
| `jsdom` | `29.x` | 与 Vitest 4 适配 | 跟随 Vitest |
| `eslint` | `^9.0` | flat config 强制 | major bump → ADR |
| `prettier` | `^3.0` | 与 ESLint 9 协作 | 自由 |
| `clsx` | `^2.0` | 微依赖，CSS Modules 变体组合 | 自由 |

### 7.1 VaultX 借鉴的依赖组合（待建仓 `cargo build` 实测）

prompt-hub 借鉴 VaultX 的 Rust 依赖组合（rusqlite 0.32 + chrono 最新 + uuid 1.x），在 MSRV 1.77.2 下首次 `cargo build` 时需实测兼容性；若失败需在 ADR 补记并锁版本。

---

## §8 升级流程

任何 dependency major version bump 必须走：

1. 开 ADR 评估破坏性变更（含 Options Considered + 反悔成本）
2. 升级后跑 [[prompt-hub-mvp#§0-T2]] 全量自检（含 design token 颜色一致性）
3. 跑 [[prompt-hub-mvp#§0-T1]] 性能 benchmark（C1 200ms 唤起回归）
4. 更新本文件 `§4~§7` 对应条目 + frontmatter `updated`
5. 升 frontmatter `version`（patch bump，如 v1.0 → v1.1）

**禁止行为**：
- 不走 ADR 直接 bump major version
- 不跑 benchmark 就 ship（[[02-constitution#C1]] 200ms 是硬指标）
- 混用其他包管理器（[[004-choose-package-manager#6]]）
