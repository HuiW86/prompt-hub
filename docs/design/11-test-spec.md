---
type: test-spec
project: prompt-hub
version: v0.3
created: 2026-05-19
last_modified: 2026-08-20
status: draft # v0.2 曾 ratified（2026-07-02 口径）；v0.3 全量刷新数字 + ADR-025 涟漪，待人审
author: ai # 🤖 AI 主笔 + 人审（CLAUDE §5.2）
audience: [ai, human]
description: prompt-hub 测试规格——前端 Vitest 373 用例 + Rust workspace 158 + 6 源码级 gate + CI 双 job + C1 bench gate；LLM Eval N/A
related:
  - 06-prd
  - 07-features
  - 10-ops-spec
  - 025-unified-anchored-editing
---

# Test Spec: prompt-hub

> 实际测试盘面 + 分层规格。**LLM Eval 集 N/A**（[[02-constitution#D1]] 禁用 LLM SDK），本文件 §6 说明替代方案。
> 覆盖率目标见 [[07-features#§5]]。
>
> **标注约定**（沿用文档体系三标）：📊 实测（有命令输出背书，标注口径日期）/ 🎯 目标（规格要求，未必已落地）/ ⚠️ 红线（违反即 block）。
> 本版所有 📊 数字口径：**2026-08-20** 本机 `pnpm test`（JSON reporter 逐文件计数）+ `cargo test --workspace` 全绿输出。
>
> **v0.3 全量刷新**：v0.2 的口径停在 2026-07-02，其间前端 154→**373**、Rust 135→**158**、源码级 gate 4→**6**、IPC 命令 48→**51**。数字标了日期不算说谎，但**差了一个半月和两倍用例量的规格文件已无参考价值**——本版把全部 📊 推到今日实测。

---

## §1 测试分层（实际形态）

v0.1 规划的四层金字塔已落地为下表实际形态（Playwright E2E 层**未落地**，见 §4）：

| 层 | 工具（📊 实际在用） | 覆盖范围 | 触发时机 |
|---|---|---|---|
| 前端单元 + 集成 | Vitest 4（jsdom + `src/test/setup.ts`，含 `popover` shim） | stores / hooks / 组件渲染与交互 / App Tab cycle | 本地 `pnpm test` + CI frontend job |
| 源码级 gate | Vitest（文本级解析源码，共 **6** 个，见 §3） | token 纪律 / B2 物理分离 / IPC 三方契约 / 文档引用契约 / **密度层单调性** / **双光主题对等** | 同上（6 个全部随 `pnpm test` 跑）|
| Rust 单元 + 集成 | cargo test `--workspace`（tempfile SQLite fixture + trybuild） | repo-core / repo-write / MCP server / 迁移 / 备份 | 本地 + CI rust job |
| 性能基准 | 自研 bench 脚本（`bench/*.bench.mjs`） | 唤起延迟（C1）/ 冷启动 | 主形态路径改动后手动跑；hotkey-wake 兼作自动化 gate（§5） |
| E2E（Playwright） | 🎯 未落地 | 完整用户 flow（快捷键 / 窗口切换） | —— 现由 ADR-012 Phase 5 式真机验收（screencapture + 手点）临时顶位 |

⚠️ **反金字塔禁止**：E2E > 集成 > 单元 数量倒挂时必须重构（违反则 PR 被 block）。

---

## §2 前端 Vitest 盘面

📊 **373 用例 / 37 测试文件，全绿**（2026-08-20 实测，逐文件计数）。

| 分组 | 用例 📊 | 文件 | 覆盖对象 |
|---|---|---|---|
| stores（7 文件） | 73 | `src/stores/__tests__/{appStore 2, promptStore 36, searchStore 4, settingsStore 8, toastStore 10, updaterStore 12}.test.ts` + `src/stores/prompt/__tests__/helpers 1` | Zustand store actions / 复制失败可见 + toast intent 分级 / updater 状态机 / draft 计数联动 |
| hooks（4 文件） | 28 | `src/hooks/__tests__/{useAnchoredPosition 13, useRegionNav 8, useCopy 4, useSearchResults 3}` | **锚定定位与滚动祖先订阅**（ADR-025）/ 区域内漫游导航 / 复制 / 搜索结果派生 |
| 组件（19 文件） | 201 | `src/App.test.tsx` 25 + `src/components/__tests__/*`：ScenePanel 53 / ScenePropertiesEditor 22 / **AnchoredEditor 17** / SearchOverlay 17 / DraftInbox 15 / SettingsModal 8 / AlignmentPhrases 7 / HotkeyBanner 5 / MacroGrid 5 / ScenePanelFocusRestore 5 / ModifierGrid 4 / UpdaterBanner 4 / ErrorBoundary 3 / ModeToggle 3 / PhaseBar 3 / SearchBar 3 / RecentList 1 / StatusBar 1 | 组件渲染 / 交互 / Tab cycle 6 区断言（[[03-product-spec#13.4]]）/ 编辑器关闭规则表分支 |
| utils（1 文件） | 8 | `src/utils/__tests__/errorMessage.test.ts` | IPC 错误信息归一 |
| 源码级 gate（6 文件） | 63 | token-gate 39 / theme-parity 8 / ipc-contract 6 / b2-separation 5 / density-gate 3 / doc-refs-gate 2 | 见 §3 |

🎯 单元测试范围要求（自 v0.1 保留，按现行架构改述）：核心业务逻辑（store actions / promote 语义 / schema 校验）覆盖 ≥90%；状态机转移（draft `pending→promoted/discarded`、SOP `active/paused/completed` 等，见 [[06-prd#7]]）穷举合法转移 + 拒绝非法转移；[[02-constitution]] 边界约束（资产数量上限 / 单条话术 ≤5000 字符 / 恶意 JSON 拒绝）必测。

---

## §3 源码级 gate（6 个）

> 模式：不 mock、不跑运行时，直接以文本级解析源码断言纪律成立——把「靠人肉 review 守的规矩」下沉为测试。6 个全部为 Vitest 用例（随 `pnpm test` 跑）。
>
> ⚠️ **v0.3 补记两个漏登记的 gate**：`density-gate` 与 `theme-parity` 早已落地并在 CI 跑，但 v0.2 的「4 个」口径从未更新——**规格文件本身也会漏账**，见 §3.5 / §3.6。

### 3.1 token-gate（`src/styles/token-gate.test.ts`）

守护 [[CLAUDE#§4.1]] / design-spec §10.2.2 hard rule：组件 CSS 禁止裸 px / 裸 hex / 裸 ms 字面量，一切长度/颜色/时长必须引用 `tokens.css` token（唯一 allowlist 即 `tokens.css` 本身）。递归扫描 `src/**/*.css`，剥离注释后正则断言。来源：旧 `#1D9E75` 字面量事故（2026-05-18）。

### 3.2 b2-separation（`src/components/__tests__/b2-separation.test.ts`）

守护 [[02-constitution#B2]] 协议层/任务层物理分离：断言任务层组件（MacroGrid / ScenePanel / ModifierGrid / SopProgress）零 alignment 引用 + DraftInbox scoped 断言，5 条用例。豁免名单显式登记（SearchOverlay 跨层检索面 / ProtocolBand 等本身即协议层 / RecentList 历史徽标），每条附依据。前身 `composition-b2-separation.test.ts` 随 CompositionWorkbench 下架被删（`fedb3a8`），本 gate 为其恢复与扩面（2026-07-01 P2-2）。

### 3.3 ipc-contract（`src/ipc/ipc-contract.test.ts`）

守护 Tauri IPC 三方契约：`commands.rs` 的 `#[tauri::command]` 集合 ↔ `lib.rs` 的 `generate_handler![…]` 注册表 ↔ `src/ipc/index.ts` 的 `invoke("…")` 字面量，三向名字集合等价。动因：前端测试 mock `invoke`、Rust 测试打 command 层以下的 repo fn，命令「定义了没注册 / 名字漂移」只会在运行时炸（ADR-015 补遗-2 踩过同类坑）。📊 当前覆盖 **51 个命令**（2026-08-20 实测：`commands.rs` 51 个 `#[tauri::command]` ↔ `src/ipc/index.ts` 51 个 `invoke<>` 字面量。v0.2 记 48，其后 `move_phrase` 等入册使集合增长——gate 动态解析源码，无需随命令数改测试）。

### 3.4 doc-governance 引用契约（`scripts/doc-governance/doc-refs-gate.test.ts`，本轮新增）

守护文档体系引用完整性：Vitest gate 以 `spawnSync` 执行 vendored checker（`scripts/doc-governance/index.mjs`，上游 ai-dev-lifecycle content-os，零网络/零 LLM），按 `doc-governance.config.mjs` 契约扫描治理域 markdown（CLAUDE.md / HANDOFF.md / `docs/**`），校验 `[[双链]]` / 相对 md 链接 / 反引号 code-path 引用目标真实存在——把方法论 §7 涟漪更新的「引用不悬空」约束从人工检查下沉为可执行 gate。三层分级：authoritative（编号设计文档 01–11 / CLAUDE.md / MANIFEST，违规 = error 挡门）/ working（plans / HANDOFF / CHANGELOG 等，warn 不挡门）/ frozen（Superseded ADR / mockups / research，跳过）。附反空转护卫（扫描文件数 >20，防 include 漂移致 gate 空跑）。随 `pnpm test` 执行（本地 + CI frontend job）。

### 3.5 density-gate（`src/styles/density-gate.test.ts`，v0.3 补登记）

守护 `tokens.css` §3c compact 层契约：compact **只允许收紧结构**。两条不变量以文本级解析断言——(1) `:root.compact` 里每个 token 必须**重声明**某个 base `:root` 已定义的 token（禁止孤儿 override，那种写了等于没写）；(2) 每个 override 必须是**严格小于** base 的 px 值（compact 变大或持平即回归）。字号 token `--t-*` 一律禁止出现在 compact 层——**密度不得以可读性为代价**。

> ⚠️ 关联未决项：[[05-design-spec]] §3c compact 层的**立论**待重写（正文的「640px-tall baseline window」不可复现，窗口恒等于显示器高度）。本 gate 守的是「若有 compact 层则必须单调收紧」，**不回答「该不该有 compact 层」**——见 [[HANDOFF#Next-Actions]]。

### 3.6 theme-parity（`src/styles/theme-parity.test.ts`，v0.3 补登记）

守护浅色调色板的**双份手工镜像**不分叉：`tokens.css` 按设计承载浅色两次——`:root.light`（显式选浅色）与 `@media (prefers-color-scheme: light)` guard 内的跟随系统分支。两份手写镜像，**往其一加 token 而忘了另一份，会让「浅色」与「跟随系统」两种外观静默分叉**。gate 解析两组规则并按 selector 后缀（base / `.accent-*`）逐声明断言相等。

---

## §4 Rust workspace 测试盘面

📊 **158 用例，全绿**（2026-08-20 实测 `cargo test --workspace --manifest-path src-tauri/Cargo.toml`）：

| crate / suite | 用例数 📊 | 覆盖对象 |
|---|---|---|
| repo-write（unit） | 94 | 全部写路径 CRUD / promote 4 arm / reorder / `move_phrase` + MoveReceipt / 软删（tempfile SQLite fixture） |
| repo-core（unit） | 40 | 读路径 / 迁移 / `count_pending_drafts` 等 free fn |
| prompt-hub-mcp（unit） | 8 | MCP server 工具层 |
| prompt-hub-mcp `tests/e2e.rs` | 6 | MCP 14 tool 端到端 |
| prompt-hub-mcp `tests/trybuild_negative.rs` | 1 | 编译期负例（禁 import repo-write 写面，B 类边界的类型层强制） |
| repo-write `tests/backup_e2e.rs` | 3 | 备份端到端 |
| prompt_hub_lib（bin crate unit） | 6 | app 壳层 |

⚠️ **`--workspace` 必须**：裸 `cargo test` 只测 bin pkg（≈0 用例），真实用例在 repo-core / repo-write / prompt-hub-mcp 三个子 crate（[[CLAUDE#§2]]）。

🎯 数据迁移要求（自 v0.1 保留）：每个 `migrate_X_to_Y` 必须有正向成功 / 注入伪故障回滚 / 备份完整性 / `user_version` 更新 / FK 完整性五类用例，覆盖 100%。

🎯 E2E 用户 flow（v0.1 §4 的 E1–E5 / X1–X4 清单）仍为目标规格，Playwright 未落地；现阶段由真机验收 runbook（screencapture 自动化 + 人工点验，参照 ADR-012 Phase 5 的 11 项模式）临时承接，正式 E2E 层落地时回收该清单。

### 4.1 真机验收门（v0.3 新增 · 涟漪 [[025-unified-anchored-editing]]）

E2E 层缺位期间，**布局 / 层叠 / 定位类改动一律由带编号的真机验收门承接**，门项写进对应 ADR §6 并逐项留证。当前状态：

| 门 | 来源 | 状态 📊 |
|---|---|---|
| G1（六项）| ADR-025 P1-a 容器单点验证 | **全通过**。项 1/3/4 为 omar 目视；项 6 为 `bench:hotkey-wake` 实测；项 2 拆两半分别取证；项 5 因「P1-a 阶段该对象尚不存在」deferred 至 P1-b 门后通过 |
| P1-b 门（两项）| ADR-025 P1-b 容器迁移 | **全通过**，且**首次取得 AI 侧逐像素证据**：hover-lift 卡上浮层 diff bbox `None` / 最大通道差 `0`（同帧卡片区 `231`）；纵向滚动位移锚点 `-168px` vs 浮层 `-166px`，差值恒为 1 逻辑点、不累积（已 A/B 排除高度上限成因，记为已知量）|
| G2（五项）| ADR-025 P2 键盘动作层 | **未跑**（P2 未落地）|

**三条方法教训**（写进规格以免重犯）：

1. ⚠️ **门项必须在本阶段跑得起来**——G1 项 5 要求「在 hover-lift 的 Macro / Scene 卡上开浮层」，而 P1-a 只接对齐话术一处，那些面当时还没有浮层可开。**门引用了一个迁移后才存在的对象**。起草验收门时逐项自检「这一项现在能跑吗 / 验不过我会看见什么现象」
2. **「拍不到」可能是取证方法的结论，不是被测对象的性质**——P1-a 三轮共 135 帧屏幕捕获从未拍到浮层，结论一度写成「不含 AI 观测证据」；改为按窗口 ID 定向 + 按需截图（不用定时 burst）后一次拍中
3. **真机走查未必要动数据**——本轮全程只点铅笔不点卡片本体（卡片本体是复制热区，会触发 hide-on-copy 并计入 usage），事后核对状态栏「今日复制 0 次」，零写入零回滚。上一轮曾造 14 条临时话术 + 整库备份 + 逐字段 diff

**走查工具链**（可复用）：`screencapture -x -o -l<窗口ID>` 定向截图（⚠️ **禁止全屏截图**）+ CGEvent 合成鼠标移动/点击/滚轮 + PIL 模板匹配测位移；坐标换算 @2x 下物理像素 ÷ 2 = 逻辑点。

---

## §5 性能基准（regression test）

| 指标 | 约束 | 测试方法 | 现状 📊（2026-06 口径） | 失败处理 |
|---|---|---|---|---|
| 主形态唤起 P95 | ⚠️ ≤200ms（[[02-constitution#C1]] 死线） | `pnpm bench:hotkey-wake`：`--features bench` Rust auto-cycle 测 `show()+set_focus()`，默认 20 轮（`BENCH_ROUNDS=N` 可调） | P95 ≈ 13–15ms（2026-06-05 主线程修复后口径；2026-06-12 签名后复测 12.9–13.5ms 无回归；不含 OS shortcut dispatch ~10ms） | **P95 > 200ms 时退出码 1**（2026-07-01 P0-6）——可直接作 CI/本地自动化 C1 gate |
| 冷启动 | 🎯 ≤1.5s（非 C1 约束项） | `pnpm bench:cold-start`：subprocess spawn → 首次 CGWindow entry（Swift probe） | debug build P95 ≈ 258ms / p50 ≈ 175ms（2026-06-12） | warning（非 block） |
| 任意点击响应 P95 | 🎯 ≤100ms | 待 E2E 层落地后接 timing | 未测 | 🎯 block PR |
| 数据写入延迟 | 🎯 ≤50ms | UsageRecord 单条写入 | 未单测 | warning |
| 搜索延迟（300 条 Phrase） | 🎯 ≤100ms | tinybench | 未单测 | warning |

**触发**：任何主形态启动路径改动必须附 benchmark 结果（[[CLAUDE#§4.4]]）。📊 **最近一次复测 2026-08-20：p95 `14.226ms`**（ADR-025 P1-b 合入后在 `main` 上跑），与 2026-06-12 签名后基线 12.9–13.5ms 同档，无回归——锚定浮层不在唤起路径上，符合预期。

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
- **jsdom `popover` shim**（v0.3 新增 · [[025-unified-anchored-editing]]）：jsdom 29.1.1 不支持原生 `popover`，`setup.ts` 约 20 行 shim 暴露 `showPopover` / `hidePopover` / `togglePopover` 与 `:popover-open`。⚠️ **shim 验不了真实 top layer**——它换来的是渲染 / 提交 / 焦点 / 回调这些**与 top layer 无关**的断言可跑；层叠、`overflow` 逃逸、`transform` 包含块、定位跟随四类**只能靠 §4.1 真机门**。当初的取舍依据是「用测试环境的 shim 去换掉一项平台能力，方向反了」
- Rust 集成：每个测试独立 tempfile SQLite，跑全量 migration 后注入 fixture
- 🎯 E2E 固定 seed 数据集（`tests/fixtures/seed.json`）随 Playwright 层落地

---

## §8 不测的项（明确范围）

- ❌ 第三方依赖本身（Tauri / React / dnd-kit 等不在 prompt-hub 测试范围）
- ❌ 视觉回归截图 diff（视觉一致性由 token-gate（§3.1）卡在源码层 + 真机 screencapture 人验承接）
- ❌ A11y 自动化（暂手工检查：focus 顺序 / role=alert 等已在组件测试内点状断言，系统性 a11y 扫描未启用）
- ❌ **布局与视觉权重**（jsdom 无布局引擎：`offsetParent` 恒 null、无实际盒模型）——由 §4.1 真机门 + token-gate 源码层双向承接。⚠️ **但「jsdom 验不了」常被过度援引**：订阅逻辑、规则表分支、焦点契约都能验且**应当**验。判某项不可验时，先拆开问「**哪一半**不可验」——ADR-025 项 2 曾整项判为「物理不可验」，拆开后订阅逻辑那一半立刻补出 5 条测试，且逐条反向验证（把 hook 分别改坏三种方式，各自只被对应一条测出）
- ❌ 多端同步一致性（[[02-constitution#A3]] 单人单机，无多端实时同步）
