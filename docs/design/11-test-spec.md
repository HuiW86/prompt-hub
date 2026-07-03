---
type: test-spec
project: prompt-hub
version: v0.2
created: 2026-05-19
last_modified: 2026-07-02
status: ratified # 2026-07-02 人审通过（2026-07-02 实测口径）
author: ai # 🤖 AI 主笔 + 人审（CLAUDE §5.2）
audience: [ai, human]
description: prompt-hub 测试规格——前端 Vitest 154 用例 + Rust workspace 135 + 4 源码级 gate + CI 双 job + C1 bench gate；LLM Eval N/A
related:
  - 06-prd
  - 07-features
  - 10-ops-spec
---

# Test Spec: prompt-hub

> 实际测试盘面 + 分层规格。**LLM Eval 集 N/A**（[[02-constitution#D1]] 禁用 LLM SDK），本文件 §6 说明替代方案。
> 覆盖率目标见 [[07-features#§5]]。
>
> **标注约定**（沿用文档体系三标）：📊 实测（有命令输出背书，标注口径日期）/ 🎯 目标（规格要求，未必已落地）/ ⚠️ 红线（违反即 block）。
> 本版所有 📊 数字口径：2026-07-02 本机 `pnpm test` + `cargo test --workspace` 全绿输出。

---

## §1 测试分层（实际形态）

v0.1 规划的四层金字塔已落地为下表实际形态（Playwright E2E 层**未落地**，见 §4）：

| 层 | 工具（📊 实际在用） | 覆盖范围 | 触发时机 |
|---|---|---|---|
| 前端单元 + 集成 | Vitest 4（jsdom + `src/test/setup.ts`） | stores / hooks / 组件渲染与交互 / App Tab cycle | 本地 `pnpm test` + CI frontend job |
| 源码级 gate | Vitest（文本级解析源码，共 4 个，见 §3） | token 纪律 / B2 物理分离 / IPC 三方契约 / 文档引用契约 | 同上（4 个全部随 `pnpm test` 跑，见 §3.4） |
| Rust 单元 + 集成 | cargo test `--workspace`（tempfile SQLite fixture + trybuild） | repo-core / repo-write / MCP server / 迁移 / 备份 | 本地 + CI rust job |
| 性能基准 | 自研 bench 脚本（`bench/*.bench.mjs`） | 唤起延迟（C1）/ 冷启动 | 主形态路径改动后手动跑；hotkey-wake 兼作自动化 gate（§5） |
| E2E（Playwright） | 🎯 未落地 | 完整用户 flow（快捷键 / 窗口切换） | —— 现由 ADR-012 Phase 5 式真机验收（screencapture + 手点）临时顶位 |

⚠️ **反金字塔禁止**：E2E > 集成 > 单元 数量倒挂时必须重构（违反则 PR 被 block）。

---

## §2 前端 Vitest 盘面

📊 **154 用例 / 17 测试文件，全绿**（2026-07-02 实测；[[CLAUDE#§7]] 2026-07-01 记账为 151，其后 +1 用例 + doc-governance gate 落地 +2 用例 / +1 文件）。

| 分组 | 文件 | 覆盖对象 |
|---|---|---|
| stores（7 文件） | `src/stores/__tests__/{appStore,promptStore,searchStore,settingsStore,toastStore,updaterStore}.test.ts` + `src/hooks/__tests__/useCopy.test.ts` | Zustand store actions / 复制失败可见 + toast intent 分级 / updater 状态机 / draft 计数联动 |
| 组件（6 文件） | `src/components/__tests__/{DraftInbox,ModifierGrid,ScenePanel,SearchOverlay,SettingsModal}.test.tsx` + `src/App.test.tsx` | 组件渲染 / 交互 / Tab cycle 6 区断言（[[03-product-spec#13.4]]） |
| 源码级 gate（4 文件） | `src/styles/token-gate.test.ts` / `src/components/__tests__/b2-separation.test.ts` / `src/ipc/ipc-contract.test.ts` / `scripts/doc-governance/doc-refs-gate.test.ts` | 见 §3 |

🎯 单元测试范围要求（自 v0.1 保留，按现行架构改述）：核心业务逻辑（store actions / promote 语义 / schema 校验）覆盖 ≥90%；状态机转移（draft `pending→promoted/discarded`、SOP `active/paused/completed` 等，见 [[06-prd#7]]）穷举合法转移 + 拒绝非法转移；[[02-constitution]] 边界约束（资产数量上限 / 单条话术 ≤5000 字符 / 恶意 JSON 拒绝）必测。

---

## §3 源码级 gate（4 个）

> 模式：不 mock、不跑运行时，直接以文本级解析源码断言纪律成立——把「靠人肉 review 守的规矩」下沉为测试。4 个全部为 Vitest 用例（随 `pnpm test` 跑）。

### 3.1 token-gate（`src/styles/token-gate.test.ts`）

守护 [[CLAUDE#§4.1]] / design-spec §10.2.2 hard rule：组件 CSS 禁止裸 px / 裸 hex / 裸 ms 字面量，一切长度/颜色/时长必须引用 `tokens.css` token（唯一 allowlist 即 `tokens.css` 本身）。递归扫描 `src/**/*.css`，剥离注释后正则断言。来源：旧 `#1D9E75` 字面量事故（2026-05-18）。

### 3.2 b2-separation（`src/components/__tests__/b2-separation.test.ts`）

守护 [[02-constitution#B2]] 协议层/任务层物理分离：断言任务层组件（MacroGrid / ScenePanel / ModifierGrid / SopProgress）零 alignment 引用 + DraftInbox scoped 断言，5 条用例。豁免名单显式登记（SearchOverlay 跨层检索面 / ProtocolBand 等本身即协议层 / RecentList 历史徽标），每条附依据。前身 `composition-b2-separation.test.ts` 随 CompositionWorkbench 下架被删（`fedb3a8`），本 gate 为其恢复与扩面（2026-07-01 P2-2）。

### 3.3 ipc-contract（`src/ipc/ipc-contract.test.ts`）

守护 Tauri IPC 三方契约：`commands.rs` 的 `#[tauri::command]` 集合 ↔ `lib.rs` 的 `generate_handler![…]` 注册表 ↔ `src/ipc/index.ts` 的 `invoke("…")` 字面量，三向名字集合等价。动因：前端测试 mock `invoke`、Rust 测试打 command 层以下的 repo fn，命令「定义了没注册 / 名字漂移」只会在运行时炸（ADR-015 补遗-2 踩过同类坑）。📊 当前覆盖 **48 个命令**（2026-07-02 实测 `#[tauri::command]` 计数；[[CLAUDE#§7]] 2026-07-01 记账为 46，其后 `get_draft` / `set_default_alignment_phrase` 等入册使集合增长——gate 动态解析源码，无需随命令数改测试）。

### 3.4 doc-governance 引用契约（`scripts/doc-governance/doc-refs-gate.test.ts`，本轮新增）

守护文档体系引用完整性：Vitest gate 以 `spawnSync` 执行 vendored checker（`scripts/doc-governance/index.mjs`，上游 ai-dev-lifecycle content-os，零网络/零 LLM），按 `doc-governance.config.mjs` 契约扫描治理域 markdown（CLAUDE.md / HANDOFF.md / `docs/**`），校验 `[[双链]]` / 相对 md 链接 / 反引号 code-path 引用目标真实存在——把方法论 §7 涟漪更新的「引用不悬空」约束从人工检查下沉为可执行 gate。三层分级：authoritative（编号设计文档 01–11 / CLAUDE.md / MANIFEST，违规 = error 挡门）/ working（plans / HANDOFF / CHANGELOG 等，warn 不挡门）/ frozen（Superseded ADR / mockups / research，跳过）。附反空转护卫（扫描文件数 >20，防 include 漂移致 gate 空跑）。随 `pnpm test` 执行（本地 + CI frontend job）。

---

## §4 Rust workspace 测试盘面

📊 **135 用例，全绿**（2026-07-02 实测 `cargo test --workspace --manifest-path src-tauri/Cargo.toml`）：

| crate / suite | 用例数 📊 | 覆盖对象 |
|---|---|---|
| repo-write（unit） | 86 | 全部写路径 CRUD / promote 4 arm / reorder / 软删（tempfile SQLite fixture） |
| repo-core（unit） | 29 | 读路径 / 迁移 / `count_pending_drafts` 等 free fn |
| prompt-hub-mcp（unit） | 8 | MCP server 工具层 |
| prompt-hub-mcp `tests/e2e.rs` | 6 | MCP 14 tool 端到端 |
| prompt-hub-mcp `tests/trybuild_negative.rs` | 1 | 编译期负例（禁 import repo-write 写面，B 类边界的类型层强制） |
| repo-write `tests/backup_e2e.rs` | 3 | 备份端到端 |
| prompt_hub_lib（bin crate unit） | 2 | app 壳层 |

⚠️ **`--workspace` 必须**：裸 `cargo test` 只测 bin pkg（≈0 用例），真实用例在 repo-core / repo-write / prompt-hub-mcp 三个子 crate（[[CLAUDE#§2]]）。

🎯 数据迁移要求（自 v0.1 保留）：每个 `migrate_X_to_Y` 必须有正向成功 / 注入伪故障回滚 / 备份完整性 / `user_version` 更新 / FK 完整性五类用例，覆盖 100%。

🎯 E2E 用户 flow（v0.1 §4 的 E1–E5 / X1–X4 清单）仍为目标规格，Playwright 未落地；现阶段由真机验收 runbook（screencapture 自动化 + 人工点验，参照 ADR-012 Phase 5 的 11 项模式）临时承接，正式 E2E 层落地时回收该清单。

---

## §5 性能基准（regression test）

| 指标 | 约束 | 测试方法 | 现状 📊（2026-06 口径） | 失败处理 |
|---|---|---|---|---|
| 主形态唤起 P95 | ⚠️ ≤200ms（[[02-constitution#C1]] 死线） | `pnpm bench:hotkey-wake`：`--features bench` Rust auto-cycle 测 `show()+set_focus()`，默认 20 轮（`BENCH_ROUNDS=N` 可调） | P95 ≈ 13–15ms（2026-06-05 主线程修复后口径；2026-06-12 签名后复测 12.9–13.5ms 无回归；不含 OS shortcut dispatch ~10ms） | **P95 > 200ms 时退出码 1**（2026-07-01 P0-6）——可直接作 CI/本地自动化 C1 gate |
| 冷启动 | 🎯 ≤1.5s（非 C1 约束项） | `pnpm bench:cold-start`：subprocess spawn → 首次 CGWindow entry（Swift probe） | debug build P95 ≈ 258ms / p50 ≈ 175ms（2026-06-12） | warning（非 block） |
| 任意点击响应 P95 | 🎯 ≤100ms | 待 E2E 层落地后接 timing | 未测 | 🎯 block PR |
| 数据写入延迟 | 🎯 ≤50ms | UsageRecord 单条写入 | 未单测 | warning |
| 搜索延迟（300 条 Phrase） | 🎯 ≤100ms | tinybench | 未单测 | warning |

**触发**：任何主形态启动路径改动必须附 benchmark 结果（[[CLAUDE#§4.4]]）；本轮（2026-07-01）UI 改动后的 `bench:hotkey-wake` 回归复测仍在待办（[[HANDOFF#Next-Actions]]）。

---

## §6 LLM Eval 集（N/A 说明）

> **本节明确声明 N/A 并说明理由**：方法论 §5.10 要求 test-spec 含 LLM Eval 集，但本项目 [[02-constitution#D1]] 禁用 LLM SDK，工具内部无 LLM 调用——无 LLM 行为可 eval。
>
> **替代方案**：
> - prompt-hub 的"输出"是用户复制到外部 AI 的话术。话术本身的有效性 eval 不在本工具范围（属于用户工作流，应在 Obsidian / 用户笔记内做）
> - 如果未来违反 D1 引入 LLM SDK（须先开 ADR），本节立即升级为完整 LLM Eval 集规范
>
> **方法论盲区**：§5.10 应增加「LLM-free 项目 N/A 子句」，详见 [[~/Vault/.../产品文档体系方法论-实战盲区]]

---

## §7 测试基础设施

### 7.1 CI 流水线（📊 已落地：`.github/workflows/ci.yml`，2026-07-01 P2-1）

双 job，触发 `push` main + 全部 PR，`macos-14` runner（项目仅 macOS，依赖 macos-private-api），第三方 action 全 pin commit SHA，`permissions: contents: read`，concurrency 同 ref 互斥：

- **frontend job**：`pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm exec prettier --check .` → `pnpm test` → `pnpm build`
- **rust job**：`cargo fmt --check` → `cargo clippy --workspace --all-targets -- -D warnings` → `cargo test --workspace`（Swatinem/rust-cache + stub `dist/index.html` 供 tauri codegen）

🎯 尚未接入 CI 的项：coverage 上报（阈值见 features §5）、bench 对比 main baseline（`bench:hotkey-wake` 已具备退出码语义，接入即用，见 §5）。v0.1 规划的 e2e job 随 Playwright 层一并 pending；doc-governance gate（§3.4）已随 `pnpm test` 进入 CI frontend job。

### 7.2 本地 pre-commit / pre-push

🎯 未落地 hooks；现行约定为提交前手动跑 `pnpm test` + `pnpm lint` + `pnpm build`（[[CLAUDE#§2]] 构建预检），CI 兜底。

### 7.3 测试数据策略

- 前端：`src/test/setup.ts` 统一 setup，jsdom 环境；IPC 一律 mock `invoke`（其真实性由 §3.3 契约 gate 补位）
- Rust 集成：每个测试独立 tempfile SQLite，跑全量 migration 后注入 fixture
- 🎯 E2E 固定 seed 数据集（`tests/fixtures/seed.json`）随 Playwright 层落地

---

## §8 不测的项（明确范围）

- ❌ 第三方依赖本身（Tauri / React / dnd-kit 等不在 prompt-hub 测试范围）
- ❌ 视觉回归截图 diff（视觉一致性由 token-gate（§3.1）卡在源码层 + 真机 screencapture 人验承接）
- ❌ A11y 自动化（暂手工检查：focus 顺序 / role=alert 等已在组件测试内点状断言，系统性 a11y 扫描未启用）
- ❌ 多端同步一致性（[[02-constitution#A3]] 单人单机，无多端实时同步）
