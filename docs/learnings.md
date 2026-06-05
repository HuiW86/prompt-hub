---
type: learnings
project: prompt-hub
version: v0.3
created: 2026-06-04
last_modified: 2026-06-05
status: living
author: co  # 🤝 人机共创（CLAUDE §5.2），人审
related:
  - CLAUDE
  - 02-constitution
  - 09-tech-stack
  - 016-choose-dnd-and-resizable-layout
  - 014-nspanel-isa-swizzle
  - 008-enable-macos-private-api
  - 015-expose-mcp-write-pipeline
  - m0-4-macos-signing
description: prompt-hub 走到 M0 收口为止，反复出现、被真实踩坑或决策验证过的判断，提炼成 7 条可迁移信条 + 技术栈速查。不是变更日志、不是工程 checklist；新会话/新成员进项目读 CLAUDE.md 之后接读，理解"这个项目用什么方式做判断"。
---

# Learnings — prompt-hub 开发经验沉淀

> 这份文档**不是**变更日志，也**不是**工程 checklist。它把项目走到 M0 收口为止，反复出现、被真实踩坑或决策验证过的判断，提炼成可迁移的**信条**——每条先讲为什么（心智模型），再挂真实证据（出处），最后给可操作落点。
>
> 读法：CLAUDE.md 告诉你"项目的规矩是什么"，这份文档告诉你"这些规矩背后是怎么想的、踩过哪些坑换来的"。规矩会变，判断方式相对稳定。
>
> 维护：living 文档。新踩坑/新决策若印证或推翻某条信条，更新对应条目而非另起炉灶；信条数量保持收敛（宁可深化已有，不轻易新增）。

---

## 七条信条

### 信条一：把纪律交给编译器，别只交给文档

**心智模型**：写在文档里的规矩会被遗忘、被"好心"违反；写进类型系统和依赖图的规矩，违反时直接编译失败。能让编译器替你守的约束，就别只写进 CLAUDE.md。

**证据**：
- **三层资产模型（B1）** → 引入第 4 类资产时 enum variant 不存在，**编译失败**，而非靠人记得"不许加第 4 层"。
- **协议/任务物理分离（B2）** → 初期是文档约束，MCP 阶段升级为 `prompt-hub-mcp/Cargo.toml` **不依赖 `repo-write`** 的依赖图红线 + trybuild `compile_fail` 测试守护（ADR-015 补遗）。AlignmentPhrase 写不进 Composition，不是因为有人盯着，是因为那条代码路径不存在。
- **schema 漂移** → 所有写命令经 `guard_schema_then` 中间件，mid-session `PRAGMA user_version` recheck，drift 返 `SchemaVersionMismatch`；MCP server 启动校验不兼容直接 exit code 2。

**落点**：每立一条"不许做 X"的规矩时，先问一句——能不能让它在编译期/类型层就做不到？

---

### 信条二：决策时就把价码标在台面上（反悔成本 + 不可逆点）

**心智模型**：技术决策的真实代价不在"现在选哪个好用"，而在"将来想换时要付多少"。把反悔成本和不可逆点写进 ADR，未来的人（包括自己）才不会问"当初为什么这么定"。

**证据**：项目所有 ADR 统一格式——一句话 Decision + 三条反向 Consequences + **反悔成本表**（代码规模 / 迁移 / 学习 / 不可逆点）。
- ADR-003（rusqlite 不整库加密）明示不可逆点：「事后追溯销毁明文副本不可能」。
- ADR-008（启用 macos-private-api）明示软成本：「用户习惯私有 API 视觉效果后回退会感降级」——技术上可回退 ~50-100 LOC，体验上不可逆。
- ADR-016 §5 把**有意的不一致**写进文档：dnd-kit 精确锁 `0.4.0`（0.x minor 会 break）/ resizable-panels caret `^4`（major 稳定），显式标注「非笔误」，防后人"统一"成同一策略。

**落点**：任何二选一的不可逆决策开 ADR；ADR 里最该写满的不是"为什么选它"，是"将来想换时要付什么"。

---

### 信条三：不可逆的事先证伪，别等到发布

**心智模型**：高风险、不可逆、且"要么全对要么全错"的事，最贵的失败是发布时才发现。先做最小 spike 主动证伪最坏假设，把不确定性提前关掉。

**证据**：
- **M0-4 签名公证**：把"私有 API 会被 Apple 公证拒绝"当最坏假设主动验证——`spctl: accepted / source=Notarized Developer ID` + release 包双击无黑屏 → 证伪。结论是"不阻塞功能开发、只阻塞对外发布"，于是没让它卡住主线。
- **NSPanel key-window**（ADR-014）：borderless NSPanel 默认 `canBecomeKeyWindow=false` 收不到键盘，是个会"全做完才发现键盘全废"的坑。先验证 isa-swizzle 子类方案可行再铺开。
- **已实机验证回流**（2026-06-05）：① dnd-kit 键盘 sensor 经 #6 手测通过（PhaseBar 点击解耦后窗口驻留 → AlignmentPhrase 管理面板增删改排序，commit `441764b`）；② `react-resizable-panels` 分隔条**指针拖拽 + localStorage 持久化**经 P4 手测通过（拖出比例 → 退出重进恢复，commit `a347d17`）；③ 分隔条**键盘 focus（Tab 聚焦 + ←→ 调宽）**经**全量重启后**实机确认通过（2026-06-05，先冷启动杜绝 HMR 中间态干扰再测）——至此 dnd 键盘层 + 分隔条指针/键盘三项全部实测闭环。这条印证了出口要预先写好——验证逐项落地、不一次性结案。
- **附加教训**（2026-06-05）：P4 改动曾在真实 Tauri webview 抛运行时报错、被误判为 bug，全量重启后不复现——根因是 `Group`/`Panel` 在 **HMR 热替换**时挂载顺序错乱（jsdom 测不到、build/test 全绿也不代表 webview 不报错）。落点：resizable/布局类组件改动若 HMR 期间报错，先全量 reload 复核再判 bug，别急着 revert。

**落点**：遇到"不可逆 + 全有全无"的点，先问能不能用一个下午的 spike 证伪它；并预先写好"如果失败，降级到什么"。

---

### 信条四：性能预算是一条红线，且只信测量、不信推断

**心智模型**：性能是这个产品的身份（主形态唤起 ≤200ms 是 constitution C1）。预算一旦设为红线，所有触碰启动路径的决策都要让路；而"应该没影响"永远不能代替一次实测。

**证据**：
- ADR-003 选 rusqlite **不启 SQLCipher 整库加密**，直接理由是"master password 解锁会破坏 200ms 唤起"——性能预算反向约束了安全方案的形态（未来若需私密分类，做字段级而非整库）。
- dnd-kit / resizable-panels 是运行时库、不进启动路径，**预期**无回归——但 plan 仍要求 `pnpm bench:hotkey-wake` 回归证伪，不靠推断结案。
- bench 方法论本身被认真对待：cold-start 走 subprocess + Swift CGWindow probe，hotkey-wake 走 Rust auto-cycle，P95 而非均值（M0-3 inline instrumentation 版 P95=10.49ms）。
- **「有 bench 脚本 ≠ 测量发生过」**（2026-06-05）：hotkey-wake auto-cycle 版（替换 M0-3 已剥离的 inline instrumentation）把 wake/hide 放进 tokio worker 线程直调 AppKit `show()`/`order_front`，违反 macOS 主线程约束 → `Must only be used from the main thread` SIGTRAP、零样本，**重构后从未在 macOS 真正跑通过**；HANDOFF 沿用的 baseline 10.49ms 实为旧 inline 版数字。修复（每次 wake/hide 经 `run_on_main_thread` 派发、timing 在主线程闭包内测）后首次跑通 auto-cycle 版：**P95=14.696ms**（+OS dispatch ~10ms ≈ 25ms，仍远低于 200ms）。脚本存在、注释完整、build 全绿，都不等于那条路径被测量过——这正是本信条的自指注脚。

**落点**：凡触碰启动路径的改动，附 benchmark；"应该不影响性能"这句话不算数，跑一次 P95 才算数；且"有 bench 脚本"不等于"跑通过"，定期实跑确认它没在某次重构里悄悄坏掉。

---

### 信条五：状态要有唯一来源，乐观更新必须能回滚

**心智模型**：本地交互的流畅感来自乐观更新，但乐观更新的头号 bug 是"本地改了一半，后端刷新把它覆盖回去"。解法不是更复杂的同步，而是确立单一渲染源 + 明确的回滚路径。

**证据**：
- **dnd-kit 乐观排序竞态**（社区头号坑，plan §3 P1.4）：本地 state 为唯一渲染源 + `isDragging` ref 门控 refetch（拖动中不接后端刷新）+ `onDragStart` 快照、`event.canceled` 回滚，否则拖动中被刷新覆盖 → 闪回/重复项。
- **promote 用软删不用 DELETE**（ADR-015 补遗-2）：`status='discarded'` 保留 provenance，状态可追溯、可审计、可回滚，而非一删了之。
- Zustand store 沿用既有 promote/discard 模式作唯一渲染源，新增编辑 action 不另立一套状态机。

**落点**：任何"先改本地、后台同步"的交互，先想清两件事——谁是唯一渲染源、失败/竞态时回滚到哪个快照。

---

### 信条六：跟着生态走，但要锁死它、理解它，并亲自核验二手认知

**心智模型**（呼应全局"借力最优解"）：默认采用社区事实标准而非自建，但"采用"不等于"信任"——要锁死版本、读 changelog、并对二手认知做一手核验。生态信息会过时、会以讹传讹。

**证据**：
- 拖拽选 **dnd-kit**（react-beautiful-dnd 已废弃），分隔条选 **react-resizable-panels**（5.3k★ / shadcn 底座 / React DevTools 作者维护）——都是 2026 事实标准。
- 但 dnd-kit 锁到 React 19 必须用的**新版体系**（`DragDropProvider` + `useSortable` + `move`，**禁** legacy `core`/`sortable`），且精确锁 `0.4.0`（0.x 会 break）。
- **一手核验推翻二手认知**：06-04 research 用官方 CHANGELOG 直读，校正了 plan v0.2"v4 仅百分比、无 px"的误判（实为 v4 **扩展**了 px/rem/vh 单位支持），顺手消解了一个本要自建的"px↔% 换算 util"。同一份 research 还发现同构模板 `dannysmith/tauri-template` 仍锁 v3——一个值得记录的反向信号。

**落点**：选库先查生态共识；定版前精确锁 + 读 changelog；任何"听说这个库不支持 X"的二手判断，去官方 CHANGELOG/源码核一手再写进文档。

---

### 信条七：设计是契约，token 是它的唯一执行路径

**心智模型**：视觉一致性不靠自觉，靠让"裸值"成为非法。设计规范是契约（ADR-012 锁定 Linear 气质），token 是这份契约在代码里的强制执行。

**证据**：
- **CSS 禁裸值**（CLAUDE §4.1）：任何组件 CSS/内联样式禁裸 px/hex/ms，必须引 `--fs-*` / `--space-*` / `--color-*` / `--duration-*`。
- 真实教训：旧 `#1D9E75` 字面量混入代码导致颜色不一致，2026-05-18 全量替换为 `var(--color-task-border)`。一个裸 hex 就能撕开一致性。
- 交互层同源：编辑入口集中（单一编辑形态，禁 Notion 式 side/center/full 多弹窗并存）、删除分级（软删→undo toast / 硬删→明示"永久"二次确认），都是"一致性 > 灵活性"的同一判断。

**落点**：视觉/交互的一致性，优先做成"不一致写不出来"（token、单一入口），而不是写进规范靠人遵守。

---

## 附录：技术栈速查（已验证做法）

> 信条是判断方式，下面是具体落地的"别再踩"清单，按技术栈分。新人配置环境/动手前扫一眼。

### Rust / Tauri
- `cargo test` **必须加 `--workspace`**——4-crate 拆分后不加会静默跑 **0 个测试**（真实用例在 repo-core/repo-write/prompt-hub-mcp）。
- `cargo clippy` **必须加 `--all-targets`**——否则漏掉 test target（含 trybuild）内的 lint。
- schema migration **forward-only**，down migration 不写；migration ownership 由 Tauri 主 app 独占。
- 两进程并发同一 SQLite（MCP + 主进程）**必设 `busy_timeout`**（5000ms），否则一方锁定时另一方快速报错。
- drafts 表用 `payload_hash`（SHA-256）防重复批量导入。

### 前端 / React / Zustand
- dnd-kit 用 2026 新体系，**禁** legacy `core`/`sortable`；8px 激活阈值，只在 `onDragEnd` 写回。
- resizable-panels 持久化用 **`onLayoutChanged`**（pointer 释放触发）而非 `onLayout`（每帧触发），避免高频 localStorage IO。
- 条件渲染 `Panel` 必须显式 `id` + `order`，否则布局错乱。
- CSS 一律 token，禁裸 px/hex/ms。

### macOS 平台
- borderless NSPanel 拿键盘焦点的唯一解：`define_class!` 子类覆写 `canBecomeKeyWindow→true` + isa-swizzle；子类**不加 ivar** 保持 `instance_size` 一致，size assert 做 fail-fast。
- AppKit 窗口 API（`show`/`order_front`/`hide` 等）是 MainThreadOnly：任何 worker/async 线程（含 bench auto-cycle、`tauri::async_runtime::spawn`）调用前**必须 `app.run_on_main_thread()` 派发**，直调触发 `Must only be used from the main thread` SIGTRAP。需要测调用延迟时把计时放进主线程闭包内，结果经 channel 回传。
- macos-private-api **永久放弃 App Store**（决策已知，App Store 标 v2.0+ 才考虑）。
- 公证三件套缺一不可：hardened runtime flag + `allow-jit` + `disable-library-validation` entitlements；通过判据 = `spctl accepted` + `Notarized Developer ID` + 双击无黑屏。详见 runbook [[m0-4-macos-signing]]。

### 测试 / 质量
- jsdom 测不了真实快捷键/全屏窗口/透明背景——这些推到 Playwright/实机，E2E 留 v1.0+。
- 性能基准取 **P95** 而非均值；触碰启动路径必跑 `bench:hotkey-wake` / `bench:cold-start`。

---

## 与其他文档的关系

- **CLAUDE.md** 是规矩（做什么/不做什么），本文件是规矩背后的判断方式（为什么这么定）。冲突时以 CLAUDE.md 和 constitution 的现行条款为准，本文件负责解释。
- **ADR** 是单次决策的完整论证，本文件是跨多个 ADR 抽出的**共性判断**。需要某个决策的细节，回去读对应 ADR。
- 本文件变更不走方法论 §7 八步（它不是 13 份核心设计文档之一，是派生学习沉淀）；但若某条信条与 constitution 抵触，须先走 ADR 修订 constitution。
