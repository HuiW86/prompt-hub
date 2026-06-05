---
type: plan
project: prompt-hub
version: v0.4
created: 2026-06-03
last_modified: 2026-06-05
status: in-progress  # P1/P2 后端 + Macro/AlignmentPhrase UI + P3(X方案)/P4 done；Modifier·Composition UI 落点暂缓（#3/#4），见 §7
author: co  # 🤝 人机共创（CLAUDE §5.2）
related:
  - 01-spec
  - 02-constitution
  - 03-product-spec
  - 05-design-spec
  - 06-prd
  - 09-tech-stack
  - 07-features
  - 012-lock-visual-quality-anchor
  - prompt-hub-mvp
  - mcp-write-pipeline
description: 资产编辑 + 自适应布局实施 plan——4 类资产（Modifier/Composition/Macro/AlignmentPhrase）全覆盖增删改名/改内容/拖动排序，引 dnd-kit 做区域内排序；Dashboard 从固定 grid 改为内容自适应 + 可拖分隔条（react-resizable-panels，布局存 localStorage）。分 4 期：P1 Macro 全链路 → P2 其余 3 类 → P3 内容自适应 → P4 可拖分隔条。先开 ADR-016 锁选型再开工。
---

# Plan: 资产编辑 + 自适应布局

> 调研结论：拖拽库 2026 默认 **@dnd-kit**（react-beautiful-dnd 已废弃），区域内排序用 `@dnd-kit/react` 的 `useSortable` + `@dnd-kit/helpers` 的 `move` helper；可拖分隔条用 `react-resizable-panels`。需求与选型对齐过程见会话记录。
>
> **纪律前置**：dnd-kit / react-resizable-panels 是新技术选型，按 [[CLAUDE#§5.3]] 先开 **ADR-016** 锁定 + 更新 [[09-tech-stack]]，ADR Accepted 后才写依赖。
>
> **v0.2 修订**（2026-06-04，4 路调研合成）：① 锁定 `@dnd-kit/react@0.4.0` + `@dnd-kit/helpers@0.4.0`（新版体系，**无 `SortableContext`/`arrayMove`**，用 `DragDropProvider` + `move` + `isSortable`/`initialIndex`；React 19 必须用此套，禁 legacy `core`/`sortable`）；② `react-resizable-panels` 采 **v4**（API 改名 `Group`/`Separator` + `useDefaultLayout` 持久化，**仅百分比、无 px 约束**）；③ 补设计原则（编辑入口集中 + 拖动为键盘增强层）；④ 补 NSPanel key-window 前置风险（关联 [[ADR-014]]）。详见 §0 / §1.3 / §4。

---

## §0 决策窗口（已锁定 2026-06-03）

| 决策 | 选项 | 来源 |
|---|---|---|
| Q1 布局形态 | 内容自适应 **+** 可拖分隔条（react-resizable-panels，尺寸存 localStorage） | omar |
| Q2 编辑范围 | 4 类资产全覆盖（Modifier / Composition / Macro / AlignmentPhrase）增删改名/改内容/拖动排序 | omar |
| Q3 ADR 纪律 | 先开 ADR-016 锁 dnd-kit + resizable-panels 选型，Accepted 后再写依赖 | omar |
| Q4 分期节奏 | P1 Macro 全链路 → P2 其余 3 类 → P3 内容自适应 → P4 可拖分隔条 | omar |
| Q5 拖拽库 | `@dnd-kit/react@0.4.0` + `@dnd-kit/helpers@0.4.0`（新版体系：`DragDropProvider` + `useSortable` + `move` helper + 8px 激活阈值 + `isSortable`/`initialIndex` 判序；**禁 legacy `core`/`sortable`**） | 调研 v0.2 |
| Q6 排序持久化 | 各资产表补 `order_index` 列，reorder 命令批量写回 | 本 plan |
| Q7 分隔条库版本 | `react-resizable-panels` **v4**（`Group`/`Panel`/`Separator` + `useDefaultLayout` 持久化）。**约束值（min/max/default）支持 px / rem / em / vh / vw 字符串（无单位串按百分比）**，故 token px 可直接传入做 min-size，换算 util 大部分可省；**仅持久化 layout 用百分比 0..100**（重启恢复仍按比例）| 调研 v0.3（核验 d.ts L173-181） |
| Q8 编辑入口 | 集中式编辑（detail/侧栏面板优先，单一编辑入口），**禁多种弹窗模式并存**（Notion 反例） | 调研 v0.2 |

---

## §1 目标与非目标

### 目标
1. 4 类资产在主界面可**新增 / 删除 / 重命名 / 改内容 / 拖动排序**，摆脱当前"只读 + 仅草稿流水线"的状态。
2. Dashboard 布局**不固化**：区域按内容多少自动伸缩（Macro 少不霸占空间），并允许用户拖分隔条手动调比例且记住布局。

### 非目标（本次不做）
- **面板自由布局（任意位置拖放）**——违反 [[02-constitution#B2]] 物理分离与 [[012-lock-visual-quality-anchor]]，本次只做"区域内排序 + 区域尺寸自适应/可调"，不做跨区域自由拖放。
- **跨资产类型拖动**（如把 Macro 拖进对齐区改类型）——违反 B2，不做。
- **撤销/重做（undo/redo）栈**——P1–P4 不引入，留后续。
- **批量编辑 / 多选**——单条编辑优先，批量留后续。
- **修改 MCP 草稿流水线**——本 plan 只动正式资产的直接编辑面，draft promote/discard 链路保持不变。
- **多种弹窗/详情模式并存**——只允许一种编辑入口形态，禁 Notion 式 side/center/full + 多关闭方式混用（视觉一致性反例）。

### §1.3 设计原则（对标调研收敛）
- **编辑入口集中**：Raycast/Linear 守住视觉一致性靠"减少选项 + 集中编辑入口 + 受限组件"——编辑走 detail/侧栏面板保上下文，慎用满屏行内乱编辑。
- **拖动是键盘操作的增强层**：契合本项目快捷键形态——拖动不是唯一手段，须配键盘等价（grab toggle + 方向键 + ARIA live region）；手柄 + 让位动效 + ESC 取消三件套齐全。
- **布局比例必须持久化**（Obsidian 教训：不存盘重启即丢 = 负体验），并设默认/重置回归一致基线。
- **删除分级**：软删（如 `discard`）→ undo toast 不弹窗；硬删（不可逆）→ 二次确认弹窗，文案明示"永久"。

### 验收标准（Given/When/Then 总纲）
- Given 主界面任一资产区域，When 新增/改名/改内容/删除/拖动排序，Then 操作即时生效、持久化到 SQLite、重启后保留。
- Given Macro 数量为 0/1/N，When 渲染 Dashboard，Then 该区域按内容收缩，不固定霸占大块空间。
- Given 用户拖动分隔条调整区域比例，When 重启应用，Then 布局比例从 localStorage 恢复。
- Given 任一写操作，Then 经 `guard_schema_then` mid-session schema recheck（沿用 [[mcp-write-pipeline]] 写面模式）。
- Given 软删（discard），When 触发，Then 出 undo toast 不弹窗；Given 硬删（不可逆），When 触发，Then 弹二次确认且文案明示"永久"。

---

## §2 影响范围（全局）

### 新建文件
- `docs/adr/016-choose-dnd-and-resizable-layout.md`（ADR：dnd-kit + react-resizable-panels 选型）
- `src-tauri/migrations/`（下一递增编号）— 给资产表补 `order_index` 列
- 前端：各资产编辑组件（行内编辑 / 删除确认 / 排序容器），具体文件在分期内列出

### 修改文件（按分期细列，模块级总览）
- 后端：`src-tauri/crates/repo-core`（读）、`crates/repo-write`（写 trait）、`src-tauri/src/commands.rs`（新 IPC）、`db` 版本号（`db::latest_version()`）
- 前端：`src/ipc/types.ts`、`src/ipc/index.ts`、`src/stores/promptStore.ts`、各区域组件、`src/layouts/Dashboard.tsx` + `Dashboard.module.css`
- 文档：`docs/design/09-tech-stack.md`（加依赖）、`docs/design/07-features.md`（功能回写）、按方法论 §7 评估 03-product-spec / 06-prd 涟漪

### 依赖变更（ADR-016 Accepted 后）
- 新增：`@dnd-kit/react@0.4.0`、`@dnd-kit/helpers@0.4.0`、`react-resizable-panels@^4`
- 移除：无

---

## §3 实现步骤（分 4 期，每期含 ①影响范围 ②量化验收 ③风险点）

### P1 — Macro 全链路（最独立，先打通）

**任务**
1. **P1.0 ADR-016 + tech-stack**：起草 [[016-choose-dnd-and-resizable-layout]]——锁定 `@dnd-kit/react@0.4.0` + `@dnd-kit/helpers@0.4.0`（列备选 react-dnd / pragmatic-dnd / 自研 + 否决理由）+ `react-resizable-panels@^4`（记录 v3 vs v4 取舍：选 v4 因 `useDefaultLayout` 持久化更干净，代价是仅百分比需 px 换算）；人审 Accepted；同步 [[09-tech-stack]] 加 3 依赖。**Accepted 前不装包、不写依赖代码。**
2. **P1.1 数据层**：新增 migration（递增编号）给 `macros` 表加 `order_index INTEGER NOT NULL DEFAULT 0`，按现有行 `created_at` 升序回填；bump `db::latest_version()`。
3. **P1.2 后端**：`repo-core` 加 Macro 读支持 `order_index` 排序；`repo-write` 加 `create_macro / update_macro / delete_macro / reorder_macros` trait 方法；`commands.rs` 加 4 个 Tauri IPC，全部写命令经 `guard_schema_then`（drift 返 `SchemaVersionMismatch`）。
4. **P1.3 前端数据**：`types.ts` 给 `Macro` 加 `orderIndex: number`；`ipc/index.ts` 加 `createMacro/updateMacro/deleteMacro/reorderMacros`；`promptStore` 加对应 action（沿用 promote/discard 模式 + 乐观更新）。
5. **P1.4 前端 UI**：装 `@dnd-kit/react@0.4.0` + `@dnd-kit/helpers@0.4.0`；`MacroGrid` 内接入 `useSortable`（8px 激活阈值 + 专用拖拽 `handleRef` + ARIA label）+ `move` helper（仅 `onDragEnd` 写回，`isSortable`/`initialIndex` 判断，处理 `event.canceled`）；**编辑/拖拽防冲突用 handle + `data-no-dnd` 组合**（编辑控件标 `data-no-dnd`，自定义 sensor 检测祖先含此属性则放弃激活）；新增按钮 + 集中式编辑面（改名/改内容）+ 删除（软删→toast / 硬删→确认）。新增 CSS 严守 [[CLAUDE#§4.1]] token（拖拽 handle / overlay 不准裸 px/hex/ms）。

**① 影响范围**：migration ×1、`repo-core`、`repo-write`、`commands.rs`、`types.ts`、`ipc/index.ts`、`promptStore.ts`、`MacroGrid.tsx`(+ 同级编辑/排序子组件 + module.css)、ADR-016、09-tech-stack。

**② 量化验收**：
- `cargo test --workspace` 全绿（含新 create/update/delete/reorder 的 tempfile SQLite 用例 ≥ 4 条）。
- `pnpm test` 全绿（promptStore 新 action 单测 ≥ 4 条）。
- 手测 5 步全通过：新增 1 条 Macro → 改名 → 改内容 → 拖动调序 → 删除（二次确认）。
- reorder 后重启应用，`order_index` 顺序 100% 保留。
- `pnpm bench:hotkey-wake` 唤起 P95 ≤ 200ms（[[02-constitution#C1]] 回归，dnd-kit 不进启动路径，预期无回归）。
- `pnpm lint` + `pnpm exec prettier --check .` + `cargo clippy --workspace --all-targets -- -D warnings` + `cargo fmt --check` 全 clean。

**③ 风险点**：
- ADR-016 评审若推翻 dnd-kit 选型 → P1.4 返工（故 P1.0 前置阻塞）。
- `order_index` 回填若现有 Macro 含 NULL created_at → 回填规则需 fallback 到 rowid（migration 内处理）。
- dnd-kit 乐观排序与 store 刷新竞态（refetch 覆盖拖动中状态，闪回/重复项，**调研最高频坑**）→ 本地 state 为唯一渲染源 + `isDragging` ref 门控（非拖动才回灌）+ 取消/失败快照回滚。
- **NSPanel key-window 前置依赖**：dnd-kit 键盘 sensor 与 resize handle 聚焦依赖窗口可成为 key window（关联 [[ADR-014]] `canBecomeKeyWindow` override）。社区无 NSPanel×本两库公开冲突，但**须在 NSPanel 实测键盘拖拽 + handle 聚焦是否生效**（项目特有验证项）。

---

### P2 — 扩到其余 3 类（Composition / Modifier / AlignmentPhrase）

**任务**
1. **P2.1 数据层**：`alignment_phrases` 表加 `order_index`（migration 递增）；核查 Composition / Modifier 表是否需 `order_index`，需则一并加。
2. **P2.2 读侧补全**：核查 Modifier / Composition 是否缺 Tauri `list_*` 命令（当前 `ipc/index.ts` 只有 list_macros / list_alignment_phrases / list_scenes / list_phases）；缺则在 `repo-core` + `commands.rs` 补读命令 + 前端 list action。
3. **P2.3 后端写**：3 类各加 `create/update/delete/reorder`（共 12 IPC，全部 `guard_schema_then`）。
4. **P2.4 前端**：3 类编辑 UI + dnd-kit 排序，复用 P1 的编辑/排序子组件抽象。
5. **P2.5 B2 自检**：AlignmentPhrase 编辑面只在对齐区出现，**不得**漏进 Composition 工作台 / Macro 区（[[02-constitution#B2]] + [[CLAUDE#§4.3]]）。

**① 影响范围**：migration ×1–2、`repo-core`、`repo-write`、`commands.rs`、`types.ts`、`ipc/index.ts`、`promptStore.ts`、`AlignmentPhrases.tsx` / Composition 区 / Modifier 区组件。

**② 量化验收**：
- 3 类资产各自 CRUD + 排序手测全通过（共 3 × 5 = 15 步）。
- B2 分离检查清单 3 项全过：①AlignmentPhrase 不进 Composition 工作台 ②SOP 不引用 AlignmentPhrase ③Macro 区不展示 AlignmentPhrase。
- `cargo test --workspace` + `pnpm test` 全绿（每类资产新增写测 ≥ 4 条）。
- lint/prettier/clippy/fmt 全 clean。

**③ 风险点**：
- Modifier / Composition 在主界面的呈现位置当前不明确（read 命令缺失）→ P2.2 先探明再开写面，避免做出无处展示的编辑 UI。
- 4 类资产 reorder 抽象若强行统一可能过度工程 → 优先按 P1 模式复制，3 处相似代码可接受（遵循"避免过早抽象"）。

---

### P3 — 内容自适应布局

**任务**
1. **P3.1**：`Dashboard.module.css` 的 `grid-template-columns` 从固定 `1.4fr / 1fr / 0.9fr` 改为 `minmax(min-content, …)` 体系，空/少内容区域收缩、满区域吃满剩余空间；行高同理改 `auto` / `min-content`。
2. **P3.2**：各区域加空态/少态样式，确保收缩后不破版。

**① 影响范围**：`src/layouts/Dashboard.tsx`、`Dashboard.module.css`、各区域组件空态样式。

**② 量化验收**：
- Macro 数量 = 0 / 1 / N 三档下截图验收：少内容区域不固定霸占大块空间。
- [[012-lock-visual-quality-anchor]] Linear 气质视觉验收通过（screencapture 比对）。
- 新增/改动 CSS 100% 用 token（[[CLAUDE#§4.1]]），无裸 px/hex/ms。

**③ 风险点**：
- 自适应可能与 ADR-012 锁定的视觉比例冲突 → 落地后必须做视觉验收，必要时回流 [[05-design-spec]]。

---

### P4 — 可拖分隔条

**任务**
1. **P4.1**：装 `react-resizable-panels@^4`（ADR-016 已锁），`Dashboard` 三列重构为 **v4 API** `Group` + `Panel` + `Separator`（**注意 v4 已废 v3 的 `PanelGroup`/`PanelResizeHandle`/`autoSaveId`/`onLayout`**）；尺寸**仅支持百分比**（v4 移除 px 约束），与 token px 思维处需自行换算。条件渲染的 Panel 必须显式给 `id` + `order`（防布局错乱）。
2. **P4.2**：用 `useDefaultLayout({ groupId, storage: localStorage })` 持久化布局，写盘走 `onLayoutChanged`（释放后触发，**非** `onLayoutChange` 每帧）；改面板数量时 bump groupId 或清旧 key（防 stale）。布局偏好属本地 UI 状态，不入 SQLite、不上传，符合 [[02-constitution#A2]]）。

**① 影响范围**：`src/layouts/Dashboard.tsx`、`Dashboard.module.css`、新增布局持久化 util（localStorage 读写）。

**② 量化验收**：
- 拖动分隔条调整 3 列比例 → 重启应用，比例从 localStorage 100% 恢复。
- `pnpm bench:hotkey-wake` 唤起 P95 ≤ 200ms（C1 回归，resizable 仅运行时）。
- 分隔条 handle CSS 用 token；ARIA / 键盘可达。

**③ 风险点**：
- `Group` 重构可能与 P3 的 grid 自适应叠加产生布局冲突 → P4 在 P3 验收通过后再上，二者择一为最终列布局机制（`Group` 接管列宽，grid 退守行/区域内）。
- ~~v4 仅百分比、token 是 px → 需在 util 内做 px↔% 换算，窗口尺寸变化时换算会 stale，须监听 resize 重算。~~ **（实测推翻，见 §7 #3：v4 扩展支持 px/rem/vh，且全 % 自动随窗口缩放，换算 util 与 resize 监听均不需要）**

---

## §4 关键决策

- **拖拽库 = `@dnd-kit/react@0.4.0` + `@dnd-kit/helpers@0.4.0`**：2026 社区默认，react-beautiful-dnd 已废弃；新版体系无 `SortableContext`/`arrayMove`，用 `DragDropProvider` + `useSortable` + `move` + `isSortable`/`initialIndex`；8px 激活阈值 + 仅 onDragEnd 写回；React 19 必须用此套。→ [[016-choose-dnd-and-resizable-layout]]
- **可拖分隔条 = `react-resizable-panels@^4`**：v4 API（`Group`/`Panel`/`Separator` + `useDefaultLayout`），仅百分比需 px 换算，`onLayoutChanged` 持久化到 localStorage。→ [[016-choose-dnd-and-resizable-layout]]
- **排序持久化 = 各资产表 `order_index` 列 + reorder 批量写回**：沿用 Phase/Scene/SubStage 既有 orderIndex 模式。
- **写面统一经 `guard_schema_then`**：沿用 [[mcp-write-pipeline]] / [[015-expose-mcp-write-pipeline]] 的 mid-session schema recheck。
- **不做面板自由布局**：守 [[02-constitution#B2]] 物理分离，只做区域内排序 + 区域尺寸自适应/可调。
- **编辑入口集中、拖动为键盘增强层**（对标 Raycast/Linear 收敛）：详见 §1.3 设计原则；删除分级（软删 toast / 硬删确认）。

## §5 文档涟漪义务（方法论 §7）
- ADR-016 Accepted → 更新 [[09-tech-stack]]（加 3 依赖 + 版本）。
- 资产"可编辑/可排序"语义变化 → 评估 [[03-product-spec]] / [[06-prd]] 涟漪，[[07-features]] 回写。
- 布局自适应若动视觉比例 → 评估 [[05-design-spec]] 回流（ADR-012 约束下）。

## §6 任务清单
- [x] P1.0 起草 ADR-016 + 同步 09-tech-stack（Accepted）
- [x] P1.1 migration：macros 加 order_index + bump db::latest_version()
- [x] P1.2 后端：repo-core 读排序 + repo-write 4 写方法 + commands.rs 4 IPC（guard_schema_then）
- [x] P1.3 前端数据：types/ipc/promptStore 加 Macro CRUD+reorder
- [x] P1.4 前端 UI：MacroGrid 集中式编辑 + dnd-kit 排序（handle + data-no-dnd 防冲突 + token CSS）
- [x] P1.5 NSPanel 实测：键盘 sensor 经 #6 手测 ✓；分隔条 handle 键盘 focus 经全量重启实机 ✓（指针拖拽 + 键盘 focus 全验，见 §7）
- [x] P2.1 数据层：alignment_phrases 加 order_index + Composition/Modifier 核查（per-phase order_index 全链路）
- [x] P2.2 读侧：补 Modifier/Composition 的 list 命令（按需）
- [x] P2.3 后端写：3 类 × create/update/delete/reorder
- [~] P2.4 前端：AlignmentPhrase 编辑 UI + dnd 排序 done；**Modifier/Composition UI 落点暂缓（#3/#4，见 §7）**
- [x] P2.5 B2 物理分离自检（3 项清单，clean）
- [x] P3.1 Dashboard 列机制（**X 方案**——默认比例+可拖+持久化，放弃空列自动收缩，列机制交 P4，见 §7）
- [x] P3.2 各区域空态/少态样式（既有工作已满足，无新代码）
- [x] P4.1 引 react-resizable-panels@^4 + Dashboard 重构 Group/Panel/Separator（**v4 直接支持 %，免 px↔% 换算 util**——实测推翻 §0/§4 旧假设，见 §7）
- [x] P4.2 useDefaultLayout 持久化 localStorage（onLayoutChanged）+ 启动恢复（手测 拖拽 + 持久化 + 键盘 focus 全 ✓）+ bench 回归（hotkey-wake auto-cycle 修复后 P95=14.696ms，见 §7）

---

## §7 进度快照 + 决策留痕（2026-06-05 收尾 workflow）

**进度**（commit `a347d17` 收口 P4）：
- **P1 Macro 全链路**：CRUD + dnd-kit 排序 + `order_index` 持久化 → **done**。
- **P2 其余 3 类后端**：AlignmentPhrase / Composition per-phase `order_index` 全链路 + Modifier 后端 → **done**（commit `b11ed21`/`f0d8b9c` 等）；AlignmentPhrase 编辑面板（edit-mode + dnd）→ **done**（`f0d8b9c`）。
- **P2.5 B2 物理分离自检**：3 项全过（clean，无代码）——AlignmentPhrase 仅现身专属区 / 全局搜索 / 草稿箱，未漏进 Composition 工作台 / Macro 区 / SOP。
- **P3 内容自适应**：走 **X 方案**——放弃「空列自动收缩」（与持久化拖拽本质互斥），改「默认比例 + 可拖 + 持久化」，列机制交 P4；各区空态既有工作已满足，P3 无新代码。
- **P4 可拖列**：`Group`/`Panel`/`Separator` + `useDefaultLayout` localStorage 持久化 → **done**，手测 拖拽 + 持久化 + 键盘 focus（Tab 聚焦 + ←→ 调宽，经全量重启杜绝 HMR）全 ✓。

**决策留痕**：
1. **#3/#4 ModifierGrid / Composition 落点决策暂缓**（omar 主动搁置，2026-06-05）——Modifier/Composition 后端 `order_index` 全链路已 done，但**编辑 UI 在主界面的落点**未拍板（当前 read 命令呈现位置不明确，见 §3 P2.2 风险）。⚠️ **未来落地建 Composition 工作台时，须复检 [[02-constitution#B2]] 自检清单 ①**（AlignmentPhrase 不得漏进 Composition 工作台）——本次自检 ① 因工作台尚未建而 trivially 成立，建后需重做。
2. **X 方案锁定**：列宽 = 默认比例 + 用户可拖 + 持久化，**放弃空列自动收缩**（与持久化拖拽互斥，omar 已确认选 X）。
3. **P4 实测推翻 plan 旧假设**：§0 Q7 / §4 / §3 P4 风险点曾预判「v4 仅百分比、token 是 px → 需 px↔% 换算 util + 监听 resize 重算」。06-04 research 一手核验 + P4 实装证实 **v4 扩展支持 px/rem/vh 单位、且全用 % 时自动随窗口缩放**，故换算 util 与 resize 监听**均不需要**——比 plan 预估更干净（回流 [[learnings#信条六]]）。
4. **P4 运行时报错复盘**：a347d17 曾在真实 webview 抛错（HMR 中间态挂载顺序），全量重启不复现，非真实 bug，未 revert（回流 [[learnings#信条三]] 附加教训）。
5. **bench 验收 + auto-cycle 主线程 bug 修复**（2026-06-05 收尾 workflow）：跑 `bench:hotkey-wake` 留痕时发现 auto-cycle 版（`bench.rs`）把 wake/hide 放进 tokio worker 线程直调 AppKit `show()`/`order_front`，违反 macOS 主线程约束 → `Must only be used from the main thread` SIGTRAP，**重构后从未在 macOS 跑通过**（HANDOFF baseline 10.49ms 实为 M0-3 旧 inline 版数字）。修复：每次 wake/hide 经 `run_on_main_thread` 派发、timing 放进主线程闭包内测。修复后首次跑通 **P95=14.696ms**（+OS dispatch ~10ms ≈ 25ms，远低于 [[02-constitution#C1]] 200ms）。回流 [[learnings#信条四]]。
