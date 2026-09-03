---
type: test-spec
project: prompt-hub
version: v0.7
created: 2026-05-19
last_modified: 2026-09-02
status: draft # v0.7（2026-09-02 D1 修复留证：§2 398→405、§4.3 D1 行；同日第三笔 W3 发布形态复跑通过，D1 闭合；第四笔 D3 改判修复留证）与 v0.6（同日 G4 走查记录 §4.3）合并待人审；v0.5 于 2026-09-01 人审批次 ③ ratified
author: ai # 🤖 AI 主笔 + 人审（CLAUDE §5.2）
audience: [ai, human]
description: prompt-hub 测试规格——前端 Vitest 405 用例 + Rust workspace 170 + 6 源码级 gate + CI 双 job + C1 bench gate；LLM Eval N/A
related:
  - 06-prd
  - 07-features
  - 10-ops-spec
  - 025-unified-anchored-editing
  - 027-configurable-global-hotkey
---

# Test Spec: prompt-hub

> 实际测试盘面 + 分层规格。**LLM Eval 集 N/A**（[[02-constitution#D1]] 禁用 LLM SDK），本文件 §6 说明替代方案。
> 覆盖率目标见 [[07-features#§5]]。
>
> **标注约定**（沿用文档体系三标）：📊 实测（有命令输出背书，标注口径日期）/ 🎯 目标（规格要求，未必已落地）/ ⚠️ 红线（违反即 block）。
> 本版所有 📊 数字口径：**2026-08-20** 本机 `pnpm test`（JSON reporter 逐文件计数）+ `cargo test --workspace` 全绿输出。
>
> **v0.3 全量刷新**：v0.2 的口径停在 2026-07-02，其间前端 154→**373**、Rust 135→**158**、源码级 gate 4→**6**、IPC 命令 48→**51**。数字标了日期不算说谎，但**差了一个半月和两倍用例量的规格文件已无参考价值**——v0.3 把全部 📊 推到当日实测。
>
> **v0.4（同日第二笔 · ADR-027 涟漪）**：前端 373→**395**、Rust 158→**168**、IPC 命令 51→**53**、新增真机门 **G3 四项**。源码级 gate 仍 6 个。
>
> **v0.5（同日第三笔 · 冲突提示）**：前端 395→**398**（`HotkeyRecorder` +3）。**G3 项 2 由「不可达」转为「通过」**——补上提示后该场景终于可观测，见 §4.2。
>
> **v0.7（2026-09-02 第二笔 · D1 修复）**：前端 398→**405**（AnchoredEditor 17→23 / ScenePanel 53→54）。jsdom shim 新增 **focus 拒绝隐藏元素** 规则——仅此一步 6 条既有用例变红，证明 D1 此前对整个套件不可见；修后 402 全绿。§4.3 D1 行记修复，W3 待发布形态复跑。**同日第三笔**：W3 按发布形态复跑通过（按 `main` 重建裸 release + 隔离 `HOME`，Swift 事件工具驱动 + 窗口定向截图 + SQL 反查；Macro / 场景属性 / 添加话术三入口），D1 闭合，新增观察 O7 / O8，见 §4.3。**同日第四笔**：W21 复跑改判 D3——对话框一直会弹（系统进程持有，窗口定向截图拍不到），真缺陷是点 OK 后退出 panic、码 101；失败分支改同步弹框 + `process::exit(1)`，复跑 `exit=1`，D3 闭合（P1→P2），§4.3 W21 / D3 行与教训 8。`/review` 后 repo-core 补两条 `open_and_migrate` 负路径测试（非 SQLite 文件 / 父路径不是目录 → Err 不 panic），Rust 168→**170**。

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

📊 **405 用例 / 39 测试文件，全绿**（2026-09-02 实测；v0.5 口径 398 于 2026-08-20 逐文件计数，+7 见下）。

> v0.3 记 373 / 37。**+22 的逐文件构成经 worktree 对拍取得，不是估算**：新增 `utils/__tests__/accelerator.test.ts` **9** + `components/__tests__/HotkeyRecorder.test.tsx` **7**；既有文件 `settingsStore` 8→11、`HotkeyBanner` 5→7；**`token-gate` 39→40 是它自己长出来的**——该 gate 按 CSS module 文件枚举用例，新增的 `HotkeyRecorder.module.css` 自动入册并通过。这一条顺带证明 [[CLAUDE#§4]] 4.1 的 token 纪律确实盖住了新组件，而不靠人记得去查。
>
> ⚠️ 手数 `it(` 会漏：多个文件用 `it.each` / 按文件枚举生成用例，源码里的 `it(` 数与运行时用例数**不等**。本轮首次改用 vitest JSON reporter 逐文件对拍，是查出 token-gate 那 +1 的唯一原因。
>
> v0.7 +7（D1 修复回归）：`AnchoredEditor` +6（shim 自检 ×2：visibility 与 display:none 自身/祖先 / 打开即聚焦 / `anchor=null` 时不聚焦、到位后才聚焦 / 滚动·resize·换锚点不重聚焦 / inline 形态挂载聚焦）+ `ScenePanel` 属性面板 +1。后三条来自 `/review` 测试专项与可维护性专项的缺口指认。另 `src/test/setup.ts` 新增 focus 拒绝规则（`visibility: hidden` 或祖先 `display: none` 时 `focus()` 不生效），不计用例但改变了全套件的判定口径——它让 6 条既有用例在修复前变红。

| 分组 | 用例 📊 | 文件 | 覆盖对象 |
|---|---|---|---|
| stores（7 文件） | 73 | `src/stores/__tests__/{appStore 2, promptStore 36, searchStore 4, settingsStore 8, toastStore 10, updaterStore 12}.test.ts` + `src/stores/prompt/__tests__/helpers 1` | Zustand store actions / 复制失败可见 + toast intent 分级 / updater 状态机 / draft 计数联动 |
| hooks（4 文件） | 28 | `src/hooks/__tests__/{useAnchoredPosition 13, useRegionNav 8, useCopy 4, useSearchResults 3}` | **锚定定位与滚动祖先订阅**（ADR-025）/ 区域内漫游导航 / 复制 / 搜索结果派生 |
| 组件（19 文件） | 208 | `src/App.test.tsx` 25 + `src/components/__tests__/*`：ScenePanel 54 / ScenePropertiesEditor 22 / **AnchoredEditor 23** / SearchOverlay 17 / DraftInbox 15 / SettingsModal 8 / AlignmentPhrases 7 / HotkeyBanner 5 / MacroGrid 5 / ScenePanelFocusRestore 5 / ModifierGrid 4 / UpdaterBanner 4 / ErrorBoundary 3 / ModeToggle 3 / PhaseBar 3 / SearchBar 3 / RecentList 1 / StatusBar 1 | 组件渲染 / 交互 / Tab cycle 6 区断言（[[03-product-spec#13.4]]）/ 编辑器关闭规则表分支 |
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

守护 Tauri IPC 三方契约：`commands.rs` 的 `#[tauri::command]` 集合 ↔ `lib.rs` 的 `generate_handler![…]` 注册表 ↔ `src/ipc/index.ts` 的 `invoke("…")` 字面量，三向名字集合等价。动因：前端测试 mock `invoke`、Rust 测试打 command 层以下的 repo fn，命令「定义了没注册 / 名字漂移」只会在运行时炸（ADR-015 补遗-2 踩过同类坑）。📊 当前覆盖 **53 个命令**（2026-08-20 实测：`commands.rs` 53 个 `#[tauri::command]` ↔ `src/ipc/index.ts` 53 个 `invoke<>` 字面量；v0.4 增 `get_global_hotkey` / `set_global_hotkey`。v0.2 记 48，其后 `move_phrase` 等入册使集合增长——gate 动态解析源码，无需随命令数改测试）。

### 3.4 doc-governance 引用契约（`scripts/doc-governance/doc-refs-gate.test.ts`，本轮新增）

守护文档体系引用完整性：Vitest gate 以 `spawnSync` 执行 vendored checker（`scripts/doc-governance/index.mjs`，上游 ai-dev-lifecycle content-os，零网络/零 LLM），按 `doc-governance.config.mjs` 契约扫描治理域 markdown（CLAUDE.md / HANDOFF.md / `docs/**`），校验 `[[双链]]` / 相对 md 链接 / 反引号 code-path 引用目标真实存在——把方法论 §7 涟漪更新的「引用不悬空」约束从人工检查下沉为可执行 gate。三层分级：authoritative（编号设计文档 01–11 / CLAUDE.md / MANIFEST，违规 = error 挡门）/ working（plans / HANDOFF / CHANGELOG 等，warn 不挡门）/ frozen（Superseded ADR / mockups / research，跳过）。附反空转护卫（扫描文件数 >20，防 include 漂移致 gate 空跑）。随 `pnpm test` 执行（本地 + CI frontend job）。

### 3.5 density-gate（`src/styles/density-gate.test.ts`，v0.3 补登记）

守护 `tokens.css` §3c compact 层契约：compact **只允许收紧结构**。两条不变量以文本级解析断言——(1) `:root.compact` 里每个 token 必须**重声明**某个 base `:root` 已定义的 token（禁止孤儿 override，那种写了等于没写）；(2) 每个 override 必须是**严格小于** base 的 px 值（compact 变大或持平即回归）。字号 token `--t-*` 一律禁止出现在 compact 层——**密度不得以可读性为代价**。

> ⚠️ 关联未决项：[[05-design-spec]] §3c compact 层的**立论**待重写（正文的「640px-tall baseline window」不可复现，窗口恒等于显示器高度）。本 gate 守的是「若有 compact 层则必须单调收紧」，**不回答「该不该有 compact 层」**——见 [[HANDOFF#Next-Actions]]。

### 3.6 theme-parity（`src/styles/theme-parity.test.ts`，v0.3 补登记）

守护浅色调色板的**双份手工镜像**不分叉：`tokens.css` 按设计承载浅色两次——`:root.light`（显式选浅色）与 `@media (prefers-color-scheme: light)` guard 内的跟随系统分支。两份手写镜像，**往其一加 token 而忘了另一份，会让「浅色」与「跟随系统」两种外观静默分叉**。gate 解析两组规则并按 selector 后缀（base / `.accent-*`）逐声明断言相等。

---

## §4 Rust workspace 测试盘面

📊 **168 用例，全绿**（2026-08-20 实测 `cargo test --workspace --manifest-path src-tauri/Cargo.toml`）：

| crate / suite | 用例数 📊 | 覆盖对象 |
|---|---|---|
| repo-write（unit） | 95 | 全部写路径 CRUD / promote 4 arm / reorder / `move_phrase` + MoveReceipt / 软删（tempfile SQLite fixture） |
| repo-core（unit） | 44 | 读路径 / 迁移 / `count_pending_drafts` 等 free fn |
| prompt-hub-mcp（unit） | 8 | MCP server 工具层 |
| prompt-hub-mcp `tests/e2e.rs` | 6 | MCP 14 tool 端到端 |
| prompt-hub-mcp `tests/trybuild_negative.rs` | 1 | 编译期负例（禁 import repo-write 写面，B 类边界的类型层强制） |
| repo-write `tests/backup_e2e.rs` | 3 | 备份端到端 |
| prompt_hub_lib（bin crate unit） | 11 | app 壳层 |

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
| **G3（四项）**| ADR-027 全局唤起键可配置 | **四项全通过**（2026-08-20，见 §4.2）。项 2 一度判为「不可达」，补上冲突提示后**转为可观测并通过**。**omar 当日另行真机走查，未发现问题**（人工目视，不可回归；覆盖到哪几项未逐条记录）|
| **G4（二十四项）**| features §7 留证缺口清单（v1.19） | **21 通过 / 3 不可达 / 1 未通过**（2026-09-02，见 §4.3）。首次按**发布形态**走查（裸 release 二进制内嵌 dist，非 dev + vite）；发现三个此前所有门都没抓到的缺陷 D1–D3 |

#### 4.2 G3 门项（v0.4 新增 · 涟漪 [[027-configurable-global-hotkey]]）

前三项**物理不可自动化**：`register()` 要向 macOS 真正申请组合键，`RunEvent::Reopen` 要真实的 Dock 点击，重启持久化要真实的进程生命周期——jsdom 没有 OS，CI 没有窗口服务器。

| # | 门项 | 期望 | 为什么自动化测不了 |
|---|---|---|---|
| 1 | 在设置 › 快捷键把绑定改成 `⌃⇧P`，按新键唤起 | 窗口唤起；旧的 `⌥Space` **不再**唤起 | 需要真实 `RegisterEventHotKey` 与系统级按键分发 |
| 2 | 录键态下按一个已被别的进程占用的组合键 | 出现「没收到完整的组合键…可能已被其他应用占用」提示，**保持录键态**；绑定不变、旧组合键仍能唤起 | 占用方必须是另一个真实进程，且要真实的系统级按键分发 |
| 3 | 退出应用 → 重新打开 `.app` / 点 Dock 图标 | 窗口唤起（reopen 逃生口）；顺带确认「点 Dock 无反应」的旧缺陷已修 | `applicationShouldHandleReopen` 只由真实 AppKit 事件触发 |
| 4 | 改绑后完全退出并重启应用 | 新绑定仍生效（读自 SQLite，非 localStorage） | 需要真实进程重启 + 真实 app data 目录 |

> **走查前置**：须先退出 `/Applications/prompt-hub.app`，否则两个实例争抢同一组合键（同 [[HANDOFF]] 既有告警）。
>
> ⚠️ **`HOME` 覆盖只隔离数据库，隔离不了界面偏好**：SQLite 会落到临时目录，但 WebKit 的 localStorage 不认 `HOME` 覆盖，照旧读写真实的 `~/Library/WebKit/prompt-hub/...`。后果有二——**「空白配置」这一半根本不空白**（2026-08-20 据此误报过一次「首装是浅色」，实为走查者自己的旧偏好），且**走查会写到真实的界面偏好里**（分栏宽度、主题）。要真隔离得连 WebKit 存储目录一起换。

##### 走查结果（2026-08-20 实测，隔离 `HOME` 跑 dev 二进制 + vite）

| # | 结果 | 证据 |
|---|---|---|
| 1 | ✅ **通过** | 点「更改」→ 合成 `⌃⇧P` → DB `Alt+Space` → `Control+Shift+KeyP`，keycap 随之变 `⌃ ⇧ P`、「恢复默认」由禁用转可用；随后 `⌥Space` **连按两次窗口均不出现**，`⌃⇧P` 正常 toggle |
| 2 | ✅ **通过（补提示后复测）** | 首测判为不可达（录键器收不到被占组合键）。补上冲突提示后复测：第二个实例占住 `⌥Space`，在第一个实例录键态按 `⌥Space` → **提示按预期出现**、录键态保持、绑定仍为 `Control+Shift+KeyP`、`⌃⇧P` 事后正常 |
| 3 | ✅ **通过（两次复现）** | 窗口隐藏 → 点 Dock 图标 → 窗口上屏。**同时证实「点 Dock 图标无反应」的旧缺陷已修** |
| 4 | ✅ **通过** | `kill` 后重启，启动无 stderr 告警（注册成功），`⌥Space` 无反应 / `⌃⇧P` 唤起——绑定确实读自 SQLite |

> ⚠️ **项 2 首测判为「不可达」，是门项写错了**（该轮最重要的产出，**问题已于当日修复，门项已按修复后的形态重写**）。原门项设想「按下一个已被占用的组合键 → 报『已被其他应用占用』」。真机上这个场景**按不出来**：被占用的组合键由持有方在 OS 层注册并**消费**，前台应用的 webview 根本收不到该按键。实测用第二个实例占住 `⌥Space`，在第一个实例的录键态按 `⌥Space` —— 结果是**第二个实例的窗口弹了出来**，第一个实例的录键器全程没有任何输入。
>
> 因此 `HotkeyUnavailable` 错误路径**仍然必要且正确**（竞态、系统保留但未被 Carbon 持有的组合键仍会走到它），但它**不是冲突的主要形态**。主要形态是：**用户按下去，本窗口毫无反应，而另一个应用跳了出来**——界面不给任何解释。这是一处真实的 UX 缺口，[[HANDOFF]] 已挂账待裁（属新问题，不在 ADR-027 已批范围内）。
>
> **门项自检的教训又中一次**：§4.1 教训 1 说「门项必须在本阶段跑得起来」，本轮四项确实都「跑得起来」，但项 2 的**前提假设本身**（这个按键能到达应用）没有被检验。**下次起草门项要多问一句：这个操作真的做得出来吗，不只是这个对象存在吗。**
>
> ⚠️ **复测时又踩了一次同类坑，值得单记**：第一次复测「提示没出现」，差点结论成「修复无效」。实为**走查工具不忠实**——`key.swift` 只在主键上打修饰键标志位，**从不发送修饰键自身的按下/抬起事件**，而提示的判据正好依赖那对事件。人手按 ⌥Space 会发，合成的不会。改用 `chord.swift`（先发修饰键 keydown、再发主键、最后反序抬起）后一次复现成功。**「没复现」要先怀疑复现手段，再怀疑被测对象**——这是 §4.1 教训 2 的同一条，换了个面孔。

**三条方法教训**（写进规格以免重犯）：

1. ⚠️ **门项必须在本阶段跑得起来**——G1 项 5 要求「在 hover-lift 的 Macro / Scene 卡上开浮层」，而 P1-a 只接对齐话术一处，那些面当时还没有浮层可开。**门引用了一个迁移后才存在的对象**。起草验收门时逐项自检「这一项现在能跑吗 / 验不过我会看见什么现象」
2. **「拍不到」可能是取证方法的结论，不是被测对象的性质**——P1-a 三轮共 135 帧屏幕捕获从未拍到浮层，结论一度写成「不含 AI 观测证据」；改为按窗口 ID 定向 + 按需截图（不用定时 burst）后一次拍中
3. **真机走查未必要动数据**——本轮全程只点铅笔不点卡片本体（卡片本体是复制热区，会触发 hide-on-copy 并计入 usage），事后核对状态栏「今日复制 0 次」，零写入零回滚。上一轮曾造 14 条临时话术 + 整库备份 + 逐字段 diff

**走查工具链**（可复用）：`screencapture -x -o -l<窗口ID>` 定向截图（⚠️ **禁止全屏截图**；例外：其他进程持有的系统对话框，见 §4.3 教训 8）+ CGEvent 合成鼠标移动/点击/滚轮 + PIL 模板匹配测位移；坐标换算 @2x 下物理像素 ÷ 2 = 逻辑点。

---

### 4.3 G4 走查记录（v0.6 新增 · 2026-09-02 · 覆盖 [[07-features#§7]] 留证缺口清单）

**为什么这次不同**：此前所有真机门都跑在「dev 二进制 + vite」上。本轮先在 dev 上撞见「编辑器打开后键入进不去」，一度归咎 StrictMode 双跑 effect，改跑 release 后**同样复现**——于是全程改用 `pnpm tauri build --no-bundle` 产出的裸 release 二进制（内嵌 `dist`，`tauri://localhost` 源，localStorage 与 dev 不同源、与正式 `.app` 也不同目录），隔离 `HOME` 落库。**`verified` 对着的是发布形态，证据也该来自发布形态。**

**环境**：macOS，1470×956 逻辑 / @2x；正式版 `/Applications/prompt-hub.app` 先退出（组合键独占）；MCP 二进制走 stdio JSON-RPC 造 3 条草稿；每步以 `sqlite3` 反查隔离库为主证据，截图为辅；像素证据用自研 `px`（列扫描测高、区域均值测色）。

| # | 门项 | 结果 | 证据 |
|---|---|---|---|
| W1 | ⌘K 聚焦 / 分组结果 / Enter 复制 | ✅ | 隐藏 + `usage_records` +1 + 剪贴板全文 |
| W2 | 最近使用去重 / 空态 | ✅ | 同资产复制 2 次 → 1 条；导入清空后「复制过的话术会这里出现」 |
| W3 | Macro 新建 / 改名 / 删除 | ✅ | `macros` 逐步反查；删除走 `ConfirmInline`。**D1 修后复跑通过（2026-09-02 第三笔）**：`/review` 对抗审查指出首轮用的 05:08 二进制内嵌 chunk `BA-6NYDY` 与 `main` 产物不同（第二轮审查改过 `heldFocusRef` 运行时逻辑），遂按 `main`（`d2260f6`，代码同 `0f01261`）重建裸 release（chunk `BXzTJiZI`）重跑。**三个入口各一次全新打开**，点开后不做第二次点击直接键入，名称框均自带焦点环、首字符即落字：Macro「新增」（`rerun macro b` 经 Tab → 内容 → ⌘Enter 落库 1 行，`native=0` 与 O5 一致）/ 场景属性面板铅笔（`方案设计` 追加成 `方案设计z`）/ 子阶段「添加话术」（`y` 落字）。对齐话术 / 草稿两面与 Macro 同走 `PhraseFormEditor`，推定通过、未单独真机开。附带发现 O7 / O8（见下）。走查工具注意：macOS 首字母大写建议气泡会吃掉紧随键入之后的第一次 Esc；⌘Enter 在内容为空时由 `handleSave` 静默早退（`canSave` 为 false），不会保存也不提示 |
| W4 | 对齐话术新建 / 设为默认 / 改内容 | ✅ | `alignment_phrases.is_default` + `phases.default_alignment_phrase_id` 同步 |
| W5 | 话术新建 / 上移 / 改名 / 删除 | ✅ | `phrases.order_index` 0→1；删除后 3 条 `usage_records` 成孤儿（见观察 O3） |
| W6 | Scene 属性：改名 / 颜色 / 角色预设 / 前移 / 删非空 | ✅ | `scenes.color=#2f9e6e`、`role_presets` +1、`order_index` 1→0；删非空 → 琥珀 toast「该场景仍有子阶段或话术」 |
| W7 | 子阶段新建 / 改名 / 删除解绑 | ✅ | `sub_stages` 增删；删除后话术 `sub_stage_id` 置空；编辑器下拉第二路径改分组同样落库（ADR-022 双路径） |
| W8 | 待审 badge 仅 N>0 / 草稿 tab 最左 | ✅ | 首启「3 条待审」；归档后 3→2 |
| W9 | 草稿编辑水合 / 归档落地 / 丢弃撤销 | ✅ | `payload_json.name` 更新；归档 → `alignment_phrases` +1、草稿 `discarded`；丢弃 → 撤销 → `pending` |
| W10 | composition 草稿归档 / 编辑禁用、丢弃可用 | ✅ | 截图 R08a |
| W11 | 跨 Scene 移动 → 撤销 | ✅ | `scene_id/sub_stage_id/order_index`：调研/∅/2 → 方案/生成/3 → 撤销回 调研/∅/2；usage 不变 |
| W12 | 整理态整卡点击 = 展开 / 驻留 / 不计 usage；连续整理；显式复制计 usage 不隐藏 | ✅ | usage 5→5→6，窗口始终在屏 |
| W13 | 窄 Header 下 ModeToggle | ⛔ 不可达 | 主形态窗口恒等于显示器宽（`fit_to_active_monitor`），无法缩窄 |
| W14 | 长话术展开不溢出 | ✅ | 275 字正文在列内换行五行，未出卡 / 列（R12b） |
| W15 | 撤销 toast 存活 6 s | ✅ | 逐秒截图：+5.4 s 在、+6.4 s 消失；`toastStore` `action: 6000` |
| W16 | 主题三态 + 重启保留 + 跟随系统 | ✅ | 首启深色 canvas `14,14,16`；浅色 `242,242,240`；跟随系统 + OS 翻转 → `6,6,7`；重启后浅色仍在；localStorage `themeMode` |
| W17 | 强调色接管 brand，语义层不变 | ✅ | logo / Macro 芯片：绿 `50,97,77` / 蓝 `62,90,140` / 中性 `89,82,140`；Scene 图标恒 `19,48,36` |
| W18 | `⌘,` / × / Esc / 密度 | ⚠️ 部分 | `⌘,` 与 × 通过；密度紧凑 Macro 磁贴 111→87 px（56→44 逻辑）通过；**Esc 连仪表盘一起隐藏 → 缺陷 D2** |
| W19 | slim Header / 暗 band / 2 列 | ✅（omar 目视） | R00 首启截图 |
| W20 | 复制失败可见 | ⛔ 不可达 | 剪贴板写失败无法在本机构造 |
| W21 | 启动 DB 失败阻断对话框 | ✅ **通过（第四笔复跑）**；首轮 ❌ 为取证误判 | 4 KB 随机字节当库。首轮记「无任何对话框」，实为对话框由系统进程 `UserNotificationCenter` 持有（rfd 无 parent 时走 `CFUserNotificationDisplayAlert`），窗口定向截图拍不到；按 owner 查 CGWindowList + 全屏截图证实含路径对话框在屏。真缺陷在退出路径（D3 改判）。修后按 `main` 重建裸 release 复跑：对话框在屏 → 点 OK → 进程退出 `exit=1` 无 panic；健康库对照正常建库、⌘Q `exit=0`、WAL 折回 0 字节 |
| W22 | 更新检查 manual 分级 | ⚠️ 部分 | 总开关关时点击零反应（零触网）；开后「已是最新版本」+ StatusBar 入口；失败路径需断网未构造 |
| W23 | 空态 / 未分组列头 / light 明度 / primitives 观感 | ✅（omar 目视） | R07b / R16c / R24i；新建空场景只有「新增子阶段」入口（观察 O4） |
| W24 | 导出 / 导入（原生对话框） | ✅ | `⌘⇧G` 驱动面板；导出十表无 `usage_records`；SQL 篡改后导入回滚、`settings` 保留、`refreshAll` |

**缺陷（三条，全部首次发现）**：

| # | 现象 | 根因（已读代码） | 级别 |
|---|---|---|---|
| D1 | 四个锚定编辑面（Macro / 对齐话术 / 话术 / 草稿）打开后名称框**没有焦点**，键入落空；必须再点一次 | `AnchoredEditor` 在 `useAnchoredPosition` 给出坐标前把面板设为 `visibility: hidden`，而 `PhraseFormEditor` 的挂载 effect在此之前调 `focus()`，对不可见元素静默失败。jsdom `popover` shim 不模拟可见性，故 373 条测试全绿。dev / release 均复现，与 StrictMode 无关。**已修（2026-09-02 第二笔）**：`AnchoredEditor` 新增 `initialFocus` prop，首焦点改在 `position` 首次非空的 layout effect 里触发；shim 补 focus 拒绝规则后 6 条既有用例先红后绿，+7 回归用例；**W3 复跑通过（同日第三笔，按 `main` 重建的裸 release）：Macro 新增 / 场景属性 / 添加话术三入口真机各验一次，对齐话术 / 草稿同走 `PhraseFormEditor` 推定；本缺陷闭合**。Codex 提出的「WebKit 同 commit 样式刷新时序」疑虑随之证伪，不加 rAF 重试。派生观察 O7 | P1 |
| D2 | 设置弹窗开着按 Esc，弹窗与仪表盘**一起**隐藏 | 弹窗 Esc 监听与仪表盘隐藏监听同在 window 冒泡阶段，前者未 `stopPropagation`；与 ADR-025 编辑器「Esc 不冒泡」契约不一致（product-spec 区域 9 写「关闭：Esc」指关弹窗） | P2 |
| D3 | ~~数据库损坏时没有阻断式错误对话框~~ → **改判（第四笔）**：对话框一直会弹，点 OK 后进程 panic、退出码 **101** 而非契约的 1 | 首轮根因「非主线程 NSAlert 不呈现」不成立——tauri-plugin-dialog 本就 `run_on_main_thread`，无 parent 的消息框由 rfd 交给系统进程渲染。真根因是结构性的：失败在 `setup()` 里、事件循环已在跑时被发现，旧实现靠「返回 `Ok(())` 保活 + 内存库顶替 `AppState` + 工作线程 `blocking_show` + `handle.exit(1)`」与半建成的应用共存，而 `RunEvent::Exit` 处理器假定 setup 已完成，`global_shortcut().unregister_all()` 撞上未注册的插件 panic。**已修（第四笔）**：失败分支直接调 `rfd::MessageDialog` 同步弹框（macOS 出进程渲染，阻塞主线程不死锁）后 `std::process::exit(1)`，永不回事件循环；保活的 `return Ok(())` / 内存库 / `window.show()` / 工作线程四件机器全删（`lib.rs` 净删 27 行），`rfd` 升直接依赖（lock 已有同版本同 feature）。W21 复跑通过，**本缺陷闭合**。用户可感知影响为零，级别按事实降 P2 | ~~P1~~ P2 |

**观察（不构成缺陷，供裁决）**：O1 窗口隐藏期间 MCP 写入的草稿，唤起**不刷新** badge，只有导入后 `refreshAll` 才刷新（HANDOFF 第 21 项附带疑问的答案）；O2 焦点不在编辑器内时按 Esc 会隐藏整个仪表盘而编辑器状态保留在 React 里，下次唤起编辑器仍开着——D1 让这种情况更常见；O3 硬删话术后 `usage_records` 成孤儿，最近使用区仍显示墓碑条目（与 prd §6.1 soft-delete 悬案同源，归 HANDOFF 21.2）；O4 新建的空场景只有「新增子阶段」入口，没有「添加话术」；O5 UI 新建的 Macro `native=0`，种子 Macro `native=1`，`native` 语义待 prd 明确；O6 面板宽度随角色 chip 增加而变化、设置弹窗随页面高度重新居中——对人无害，对自动化点击是坑；**O7（第三笔新增，确定性）** Macro 编辑器开着时再点「新增」：`AnchoredEditor` 的外部点击处理跳过锚点（`Editor.tsx:195`），按钮 `data-nav-item tabIndex=-1` 拿走焦点，编辑器不关、焦点却已在面板外——之后键入全部丢失，按 Esc 走 O2 藏掉整个仪表盘（截图 S3 / S3b / R1a）。这正是 D1 留下的肌肉记忆（以为没打开再点一次）会触发的路径；首轮 05:08 构建上同操作后焦点留在名称框（截图 05），两构建差异原因未查；**O8（第三笔新增，OS 行为）** 名称框键入后 macOS 弹首字母大写建议气泡，此时第一次 Esc 只关气泡不关编辑器（截图 S1 → S2）；真人也会碰到，非缺陷但走查与用户认知都要算上。另：用「取消」关编辑器后焦点落到 body，随后的可打印键被路由进搜索框并切到搜索结果视图（截图 S5），是否为有意的 type-to-search 待确认。

**取证方法教训（续 §4.2 三条）**：

4. **发布形态才是 `verified` 的对象**：`cargo build --release` 单独跑出来的二进制仍走 devUrl（空窗口），必须经 `pnpm tauri build --no-bundle`；`tauri://localhost` 源的 localStorage 与 dev 不同源，天然给出「首装」观感（本轮据此验到默认深色）
5. **调用态整卡点击 = 复制 + 隐藏**：唤起后悬停簇尚未出现就点卡片，会误复制并写 usage（本轮误写 3 条）。稳妥序列：唤起 → 空白处点一下取焦 → 悬停 → 截图确认簇位置 → 再点
6. **像素工具先对已知区域自检方向**：自研 `px` 的 y 轴一度上下颠倒，靠「已知 toast 区域读出 canvas 色」发现；列扫描测高（56→44）比目视可靠
7. **状态栏「今日复制」按本机时区计日**：本机为 UTC−7，昨夜 23:59 的复制在「今日」不计，不是 bug
8. **窗口定向截图看不见其他进程持有的窗口**：D3「无任何对话框」的误判源自 §4.2 铁律「禁止全屏截图、只按窗口 ID 定向」——系统级对话框（rfd 无 parent → `CFUserNotificationDisplayAlert`）属于 `UserNotificationCenter`，不在本应用的窗口列表里。走查系统对话框时改按 owner 查 CGWindowList（`kCGWindowOwnerName`），并允许破例全屏截图；「没出现」先问探针能不能看见这类对象（§4.1 教训 2 的第三次现身，应升格为走查前固定自检项）

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
