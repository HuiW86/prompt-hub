---
type: manifest
project: prompt-hub
version: v1.21
status: active
created: 2026-05-24
last_modified: 2026-09-03
audience: [human, ai]
description: prompt-hub 项目前期准备文件总清单——按方法论 v1.3 六层架构（L0 宪法 / L1 产品契约 / L2 工程规格 / L3 实施规格 / L4 索引 / L5 协作契约）+ ADR + 实施方案 + 视觉原型 + AI 上下文 + 工程护栏（CI/gate 测试）。AI 进项目读完 CLAUDE.md 后接读本文件能 1 分钟拿全貌；不写行数（参考性强但易过期）。v1.21：2026-09-03 [[028-reversible-delete]] Accepted 登记——ADR 总数 27 → **28**、Accepted 24 → **25**；§8 决策表补齐 022–028 七行（该表自 2026-07-06 起停在 021，表头「21 份」与 §1 概览的 27 长期不符，本版一并订正）。v1.20：2026-09-03 人审批次 ⑦ + 新治理规则「日志不签字」（[[CLAUDE#§5.1.2]]）——product-spec **v0.24 ratified** / design-spec **v0.21 ratified** / test-spec **v0.7 ratified**（首份按 5.1.2 由 AI 反查代码后直接归档的文档，非人审）。v1.16：2026-09-01 文档对账日——features v1.18（合计 88→91、S1/ADR-017 状态纠正、§7 重写）+ prd/ops-spec/user-flows/spec 四份 `pre-code` 转出 + learnings v0.5 收编 HANDOFF 长期风险。v1.15：ADR-027 回流 + 冲突提示 + 密度层立论重写 + ADR-026 两项遗留裁决——product-spec v0.22 / design-spec v0.19 / prd v0.13 / features v1.17 / test-spec v0.5，另修正 prd 行的**版本漂移**（本表记 v0.11，实际早已 v0.12）。⚠️ 其余行仍停在 2026-07-06 口径（未随 ADR-022/025/026 更新），属旧账
related:
  - CLAUDE
  - 02-constitution
  - 产品文档体系方法论
---

# prompt-hub MANIFEST — 前期准备文件清单

> 本文件是 prompt-hub 的**全文件清单**——按方法论 v1.3 六层架构组织。**只写路径 / 主笔人 / 状态 / 上下游链**，不写行数。
>
> bump 规则：新增 / 删除 / 状态变更 → patch；分层结构调整 → minor；方法论本身 bump → 同步检查本文件。

---

## §1 概览（按主笔人分工）

| 主笔人 | 数量 | 状态 |
|---|---|---|
| 🧑 人主笔 | 2 | 2/2 ratified |
| 🤝 共创 | 6 | 5/6 ratified（含 product-spec **v0.24** / design-spec **v0.21**，2026-09-03 人审批次 ⑦）+ user-flows v0.1 draft（六处与 v0.2.0 不符，[[HANDOFF]] 第 22 项待重写）。⚠️ v1.19 前此格记 6/6，与 user-flows 实况不符 |
| 🤖 AI 主笔（人审） | 6 | 4/6 ratified（tech-stack / sitemap / prd v0.13 · 2026-09-01 人审批次 ④ / **test-spec v0.7 · 2026-09-03 按 [[CLAUDE#§5.1.2]] 反查归档**）+ ops-spec draft + features in-progress。⚠️ v1.19 前此格记「ops-spec + test-spec v0.2 人审通过 + prd pre-code」，三处均已漂移 |
| 🤖 AI 派生人审（L5） | 2 | 2/2 active |
| ADR 决策记录 | **28** | **25 Accepted** + 1 Superseded（012 by 019）+ 1 Proposed（005）+ 1 Reserved（011）。2026-09-03 新增 028（删除可撤销）。⚠️ 本行 v1.11 前记「21 / 18 Accepted」已漂移多轮，v1.12 按 `docs/adr/*.md` 逐文件 `status:` 实数重列 |
| 实施方案 | 7 | 5 done + 1 active + 1 phased（adr-017 Phase 6 待办）|
| 技术调研 | 2 | active（索引 + 1 份调研）|
| 视觉原型 | 1 | v1 已归档至 archive/（2026-05-25）|
| 项目 AI 上下文 | 2 | active |
| 反思沉淀 | 2 | active（2026-08-05 新增 postmortems/ 首份；2026-06-04 learnings v0.1）|
| 工程护栏 | 8 | active（ci.yml + **6 个源码级 gate**：token / b2-separation / ipc-contract / doc-refs / density / theme-parity + bench C1 退出码 gate。2026-08-20 校正——v1.10 记「3 个」时 `doc-refs` / `density` / `theme-parity` 尚未登记）|

---

## §2 L0 项目宪法（2 份 · 🧑 人主笔）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/design/01-spec.md` | 项目定位与九条哲学 | v0.6（2026-06-01 M-X.0 涟漪：§8.8 反向 AI 写入边界，对应 ADR-015）|
| `docs/design/02-constitution.md` | 8 条铁律 | ratified v1.1（2026-06-01 M-X.0 涟漪：D1 补反向边界 note，对应 ADR-015）|

---

## §3 L1 产品契约（3 份 · 🤝 共创）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/design/03-product-spec.md` | UI 契约（双形态 / 布局 / 交互） | **ratified v0.24**（2026-09-03 人审批次 ⑦：omar 签「编辑器已打开时再按一次打开它的锚点 = 无事发生」，§13.3 保存语义规则表五行 → 六行，G4 观察 O7 涟漪；前 **ratified v0.23** 2026-09-01 人审批次 ⑤ 旧账回流：区域 4 话术卡 title-only 解剖 + 区域 9 密度档 / ADR-024 默认深色，omar 审阅 v0.10–v0.23 通过；前 v0.22 2026-08-20 ADR-026 遗留裁决：Tab 6→5（SOP 退出）+ 区域 6 目标形态与实现分离；同日 v0.21 冲突提示：§13.3 区域 9 冲突形态 1→2 种；同日 v0.20 ADR-027 涟漪：§13.3 区域 9 新增快捷键页 + 设置持久化归属表 + §13.4 三行；同日 v0.19 ADR-025 涟漪：§13.3 新增「编辑容器统一契约」跨区域小节 + §13.4 两行快捷键；前 v0.18/v0.17 ADR-026 固定空间布局 / v0.16 ADR-022 跨 Scene 移动 / v0.15 交互模式 D-0 / v0.14 ADR-021 三层就地编辑；v0.10 起待 omar 人审，前序 v0.8 已 ratified）|
| `docs/design/04-user-flows.md` | 用户流（边缘 / 异常 / 跨形态） | draft v0.1（2026-09-01 人审批次 ④：保持 draft，§2–§8 六处与 v0.2.0 实装不符，差异见 HANDOFF 第 22 项；此前 MANIFEST 标 ratified 无人审记录，属误标）|
| `docs/design/05-design-spec.md` | 视觉/动效 token 体系 | **ratified v0.21**（2026-09-03 人审批次 ⑦：§10.2.2 接口契约第 6 条「容器拥有锚点二次按下」随 product-spec §13.3 签字通过，第 5 条「首焦点归容器 / `initialFocus`」属施工规范随批通过；2026-09-02 D1 修复涟漪加第 5 条 / 2026-09-03 O7 涟漪加第 6 条；前 **ratified v0.20** 2026-09-01 人审批次 ⑥ ADR-024 回流补账，omar 审阅 v0.11–v0.20 通过：§2.4.6 品牌 token + light 加深、§2.5 订正、§2.1 `--t-15`、§8.1 锚点、§9 v0.15 补账；`--t-18` / `--h-modifier-tray` 退役。旧 ratified 标记与「v0.11–v0.18 待人审」矛盾，改正；前 v0.19 2026-08-20 密度层首次收录 + 立论重写（旧「640px 基准窗口」不存在）；同日 v0.18 ADR-025 涟漪：新增 §2.6 层叠标尺 `--z-*` + §10.2.2 `AnchoredEditor` 接口契约；前 v0.17/v0.16 ADR-026 / v0.14 ADR-021 用户内容色 / v0.13 暗 band / v0.12 ADR-019 推翻 flat 锚点；v0.11 起增量待人审，v0.10 已 omar 审定）|

---

## §4 L2 工程规格（3 份 · 🤖 AI 主笔人审）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/design/06-prd.md` | 数据契约 / API / 状态机 / 错误码 | **ratified v0.13**（2026-09-01 人审批次 ④ omar 审阅 v0.12/v0.13 通过；§6.1 soft-delete drift 已登记，归 HANDOFF 第 21.2 项 ADR；2026-08-20 ADR-027 涟漪：§5.8 补全局唤起键 + 新增 §6.8-bis Setting 表，`user_version` 11→12；前 v0.12 走查修缮 `get_draft` / v0.11 scene-substage-editing §6.4 写入口归属。⚠️ 本表此前记 v0.11 属版本漂移，v1.12 修正。`status: pre-code` 与「表已落地」的矛盾已于 2026-09-01 对账解决）|
| `docs/design/07-features.md` | **91** 功能矩阵 S1–S5 + AE + 自动更新 + Promptscape 吸收 + 结构编辑 + 数据导入导出 + 走查修缮 + Scene 编辑分层 + UX 任务流 A/B + 锚定编辑容器 | in-progress **v1.21**（2026-09-02 第二笔 D1 修复留证，矩阵不变；同日 v1.20 G4 真机走查：32 行升 verified → 69 / 7 / 1 / 14，缺口清单 39→7，三缺陷 D1–D3；前 v1.19 2026-09-01 人审批次 ①：§1 `verified` 判据修订 + 失效引用改指 test-spec §4.1，37 行 `done`→`verified`、39 行缺留证保持 `done`，§7 新增留证索引 + 缺口清单；同日 v1.18 对账：§4 补三行 + 计数规则显式化 88→91、S1 `planned`→`in-progress`、ADR-017 5/5、§7 重写并点名 `verified` 铁律缺口；2026-08-20 v1.17 层 pill 减二留一 + SOP 退出 Tab；同日 v1.16 冲突提示；同日 v1.15 ADR-027：§3.4 全局唤起键可配置 done + §4 节奏表 87→88；同日 v1.14 ADR-025：§3.8 统一锚定编辑容器 done + §4 节奏表 86→87；前 v1.13/v1.12 ADR-026 / v1.11 ADR-022 / v1.10 UX 批次 A / v1.9 ADR-021 Scene 编辑分层化）|
| `docs/design/08-sitemap.md` | 资产对象树 + 区域地图 + 焦点导航 | ratified v0.2（2026-07-02 omar 人审通过；同日全量重写对齐 product-spec v0.13「单窗口一屏全景 + 浮层」现状；前 v0.1 视图清单已失真）|

---

## §5 L3 实施规格（3 份 · 🤖 AI 主笔人审）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/design/09-tech-stack.md` | 全栈技术决议 | ratified v1.3（2026-06-19 ADR-017 涟漪：D14 自动更新 + §4.4 updater 子系统 + plugin-process 依赖锁）|
| `docs/design/10-ops-spec.md` | 运维规格 | draft v0.3（2026-09-01 人审批次 ④：保持 draft，§3 备份未实装 / §7 发布流程 ADR-001 前措辞，随 HANDOFF 第 21.3 项同批重写；此前 MANIFEST 标 ratified 无人审记录，属误标。2026-06-17 ADR-017 C4：§5.2 telemetry 措辞澄清 + §9.4 反向指针）|
| `docs/design/11-test-spec.md` | 测试规格 | **ratified v0.7**（2026-09-03 按 [[CLAUDE#§5.1.2]]「日志不签字」由 AI 反查代码后直接归档，**不经人审**：ts-recheck 62 条核 / 8 处修正 / 21 条真机观测无法从代码核；修正后 §2 前端 **414 / 39 文件**、§4.1 G4 口径改 21 通过 / 2 不可达 / 1 部分。本版沿革：2026-09-03 第七笔 O7 裁决修复；2026-09-02 第二笔 D1 修复：前端 **405**，shim 补 focus 拒绝规则，§4.3 D1 行记修复；同日 v0.6 新增 §4.3 G4 走查记录：24 门项 + 三缺陷 + 六观察 + 四教训，两版合并待人审；v0.5 于 2026-09-01 人审批次 ③ omar 审阅 v0.3–v0.5 通过；2026-08-20 冲突提示：前端 **398**，G3 项 2 由不可达转通过；同日 v0.4 ADR-027 涟漪：前端 395 + Rust **168** + IPC **53** + 新增 §4.2 G3 门四项；同日 v0.3 全量刷新 📊 口径：前端 373 + Rust 158 + **6** 源码级 gate + IPC 51，另加 §4.1 真机验收门 / jsdom `popover` shim，均待人审；前 v0.2 2026-07-02 omar 人审通过，口径 154/135/4）|

---

## §6 L4 索引（2 份）

| 路径 | 内容 |
|---|---|
| `docs/design/README.md` | 13 文档索引表 + 关联目录 + L5 派生上下文索引 |
| `docs/design/CHANGELOG.md` | 设计文档体系修订历史 |

---

## §7 L5 协作契约（2 份 · 🤖 AI 派生人审）

> 派生自 L0 + L1 + ADR，是人/AI 与外部 AI 工具（Claude Design / v0 / Cursor 等）的接口契约。**不能独立起草**，上游变更触发 bump。

| 路径 | 派生自 | 受众 | 状态 |
|---|---|---|---|
| `docs/design/CLAUDE-DESIGN.md` | 02-constitution + 05-design-spec + ADR-019 | claude.ai/design | active v0.2（2026-06-26 ADR-019 涟漪：移除 No box-shadow + 加 Elevation + 颜色降中性默认；⚠️ 待 omar 重传）|
| `docs/workflows/claude-design-prompts.md` | CLAUDE-DESIGN | 人 + AI | active v0.1 |

**L5 触发条件**：
- 视觉质感锚点 ADR 落定（如 ADR-012）→ 必派生 sticky context（`<工具名>-DESIGN.md`）
- sticky context 落盘 → 派生 prompt 模板（`<工具名小写>-prompts.md`）

**L5 失效检测**：
- 用外部工具跑生成后跑迭代 checklist（见 prompts.md §5）
- **连续 2 次不达标** → 强制 bump L5 文件，走方法论 §7 八步

---

## §8 ADR 决策记录（28 份）

| 编号 | 标题 | 状态 |
|---|---|---|
| 000 | 模板 | — |
| 001 | choose-desktop-runtime (Tauri 2.x) | Accepted |
| 002 | choose-frontend-framework (React 19.2) | Accepted |
| 003 | choose-data-persistence (rusqlite 0.32) | Accepted |
| 004 | choose-package-manager (pnpm 10.x) | Accepted |
| 005 | prompt-combiner-reuse | Proposed（待 omar 提供仓库） |
| 006 | choose-state-management (Zustand 5) | Accepted |
| 007 | choose-test-stack (Vitest 4 + cargo test) | Accepted |
| 008 | enable-macos-private-api | Accepted |
| 009 | choose-styling (CSS Modules) | Accepted |
| 010 | doc-directory-restructure | Accepted |
| 011 | search-usagesource（编号预留占位，复议条件：搜索功能进入 plan 时） | Reserved（占位文件 2026-07-02 落盘） |
| 012 | lock-visual-quality-anchor (Linear 整体气质) | Superseded by ADR-019（2026-06-26）；原 Accepted（2026-05-24） |
| 013 | alignment-phrases-tab-inclusion（AlignmentPhrases 独立 region + Tab cycle 6 tab-reachable，追认 ADR-012 Phase 3） | Accepted（2026-05-25） |
| 014 | nspanel-isa-swizzle（NSPanel 子类 override canBecomeKeyWindow + isa-swizzle 取得 borderless key-window 资格，下位于 ADR-008） | Accepted（2026-06-03） |
| 015 | expose-mcp-write-pipeline（暴露 MCP server 给外部 AI 入库，14 tool + workspace 物理拆 4 crate + drafts staging） | Accepted（2026-05-27） |
| 016 | choose-dnd-and-resizable-layout（@dnd-kit/react 0.4 区域内拖排 + react-resizable-panels v4 可拖列布局；补遺 2026-06-25 任务层 3→2 列 + group id `panorama-2col`，见 ADR-018） | Accepted（2026-06-04） |
| 017 | enable-auto-update（tauri-plugin-updater + GitHub Releases + Actions 出包，mac 先行；A2 唯一出站豁免边界） | Accepted（2026-06-17） |
| 018 | absorb-promptscape-design（吸收 Promptscape 设计稿，组合 A1+B1+C1+D+E：保语义色 + 不引 Modifier 右栏 + 改造现有组件 + 接既有 store + 保 prompt-hub 名去头像；三放大决策 3→2 列 / +Header / 省略全局新建） | Accepted（2026-06-25） |
| 019 | supersede-flat-visual-anchor（推翻 ADR-012 反 polish / Bloomberg-flat 锚点，omar 拍板 Option A：引 subtle elevation + 放弃颜色本体论改靠位置+形状，全面对齐 Promptscape；校正：颜色/反阴影住 design-spec 非 constitution，无人主笔门槛） | Accepted（2026-06-26） |
| 020 | restore-protocol-dark-band（恢复协议层暗色 band——调和 ADR-018「吸收暗 band」与 ADR-019「全面中性化」实现冲突：新增 `--band-*` 层级固定色 token 族（双主题恒深底浅字）+ band 作用域整体重映射中性 token + 层级编码修缮（ModifierGrid 层标记 / RecentList 徽标撤 accent 实底）；澄清「层级固定色 ≠ 语义色」不属 ADR-019 废除的颜色本体论） | Accepted（2026-07-01） |
| 021 | scene-layered-editing（废除 ScenePanel 全局 editMode，拆属性/结构/内容三层就地编辑；子决策 1 排序拖拽→按钮，ADR-016 dnd 范围收缩至 MacroGrid/AlignmentPhrases；子决策 2 scene.color 定性「用户内容色」2026-09-01 omar 复核通过） | Accepted（2026-07-06） |
| 022 | cross-scene-phrase-move（跨 Scene 话术移动——新增独立 `move_phrase` 命令含撤销 receipt，而非扩展 `update_phrase`；交互走分层选择器不做拖拽；子决策 2 裁定双路径共存、子决策 3 把 Phrase soft-delete 推给独立立项） | Accepted（2026-07-12） |
| 023 | ui-reshape-before-release（v0.1.0 发布前做 UI + 组件架构系统性重塑，推翻审计 D-6「批次 C/D 放发布后」的排序） | Accepted（2026-07-21；措辞由 omar 2026-09-01 人审批次 ⑧ 复核追认） |
| 024 | dark-cockpit-identity（主形态视觉身份定为深色驾驶舱 + 恒定 violet 品牌色，light 降为显式设置项；推翻 ADR-018 补遗「light 为参考观感」锚点） | Accepted（2026-07-21；措辞由 omar 2026-09-01 人审批次 ⑧ 复核追认） |
| 025 | unified-anchored-editing（编辑器脱离宿主文档流改原生 `popover` top layer 锚定；organize 升级为选择驱动的键盘处理模式；子决策 6 局部修订 ADR-024 的 PhaseBar 主角化；`:125` 立下「撤销优于确认，仅限真正可逆」规矩） | Accepted（2026-08-17，六条子决策全数采纳；P0 + P1-a + P1-b 已落地，P2/P3 待排） |
| 026 | fixed-spatial-layout（`interactionMode` 回归「只改交互语义」，不再驱动区域重排；双布局收敛为单布局 + 用户可拖拽的纵向分配。起因是实现层 dual-layout 越过 product-spec 三处已批准契约且从未开 ADR） | Accepted（2026-08-18；同日落地，2026-08-19 真机走查通过） |
| 027 | configurable-global-hotkey（全局唤起键可配置——绑定存 SQLite `settings` 表，`user_version` 11→12；冲突只有 `register()` 失败一种形态；新增 macOS `RunEvent::Reopen` 逃生口，顺带修掉「点 Dock 图标无反应」） | Accepted（2026-08-20；同日落地 + 回流八步完成，G3 门四项全过） |
| 028 | reversible-delete（删除改为**原地软删除**：七张资产表加 `deleted_at`，行不搬走，恢复是单行 UPDATE，保住 id / created_at / order_index / usage 历史；新增**第七道源码级闸门**强制读路径带过滤；六处「永久删除？」确认框换一键 + 撤销 toast；废纸篓不自动过期、只由用户手动清空） | Accepted（2026-09-03；**实施未开始**，P0/P1/P2 见该 ADR §5） |

---

## §9 实施方案（7 份 · 🤝 共创）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/plans/prompt-hub-mvp.md` | 五阶段任务清单 | v0.8 · active（M0 四项全绿，第一阶段 MVP 收尾中） |
| `docs/plans/mcp-write-pipeline.md` | MCP write pipeline 实施 plan（drafts staging + 14 tool 双层 + workspace 4 crate 物理拆分） | v0.2 · done（2026-06-03 M-X.1–X.3 全收口） |
| `docs/plans/adr-017-auto-update.md` | 自动更新实施 plan（6 阶段：密钥 / 配置接入 / 客户端+UI / Vite 加固 / CI 出包 / 验证）| v0.1（2026-06-19 · Phase 1-4 done，Phase 6 真机待办）|
| `docs/plans/asset-editing-and-adaptive-layout.md` | 资产编辑 + 自适应布局 plan（4 类资产编辑 UI + dnd-kit 区域内排序 + react-resizable-panels 可拖分隔条，分 P1–P4）| v0.6 · done（2026-06-08 P1–P4 全收口，2026-06-11 验收收口）|
| `docs/plans/scene-phrase-editing.md` | Scene 场景话术（Phrase）编辑 plan（CRUD + 拖拽排序 + SubStage 归属，migration 0009 order_index）| done（2026-06-22 收口 9/9）|
| `docs/plans/scene-substage-editing.md` | Scene/SubStage 结构编辑 plan（容器 + 子阶段 CRUD/排序 + seed 0011，补 Phrase 编辑 defer 的死维度）| done（2026-06-27 收口）|
| `docs/plans/scene-layered-editing.md` | Scene 编辑分层化 plan（废除全局 editMode 拆三层就地编辑 + 排序拖拽→按钮，ADR-021）| done（2026-07-06 收口 9/9）|

---

## §10 视觉原型（1 份）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/mockups/archive/v1-engineer-aesthetic.html` | v1 主形态 mockup | 已归档（2026-05-25 ADR-012 Phase 4，保留作为视觉对比基线）|
| `docs/mockups/v2/prompt-hub-design-system/` | v2 Claude Design 生成产物（pending） | 待 omar 上传 [[CLAUDE-DESIGN]] 创建 design system 跑 Task β 后落盘 |

---

## §11 项目 AI 上下文（2 份）

| 路径 | 内容 | 状态 |
|---|---|---|
| `CLAUDE.md` | 项目级行为规范（含三温区映射 / 忌讳清单 / §7 状态指针 / 八步两条例外） | v1.1（2026-07-01 §7 除锈+补账；2026-08-18 增 §5.1.1 减法快车道；2026-09-03 增 **§5.1.2 日志不签字**——记录类内容 AI 反查归档不进人审队列，§6 第 6 条例外同步）|
| `HANDOFF.md` | 会话断点 | 动态（每次 /checkpoint 更新） |

---

## §11.5 反思沉淀（2 份 · 🤝 共创）

> 方法论 v1.3 七层中的「反思层」产物——跨 ADR / 踩坑 / 决策抽出的共性判断，非 13 份核心设计文档之一。不走方法论 §7 八步；若某条信条与 constitution 抵触，须先走 ADR 修订 constitution。
>
> 两种粒度：`learnings.md` 是跨多次踩坑的长期信条，`postmortems/` 是单次事故的完整因果链（信条的候选来源）。

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/learnings.md` | 7 条可迁移信条 + 技术栈速查 + 附录 B 真机走查/发布/本地环境陷阱（2026-09-01 自 HANDOFF Risks 收编） | active v0.6（2026-09-02 B.1 增 G4 走查九条：发布形态构建、点击序列、原生对话框驱动、像素自检等；前 v0.5 2026-09-01）|
| `docs/postmortems/2026-08-05-notarization-fail-open.md` | v0.1.0 公证被静默跳过复盘：fail-open 断言的三个同形实例 + 「能力≠行使」滑移 + 6 问自查清单 | closed v0.1（2026-08-05）|

---

## §11.6 工程护栏（5 份 · CI + 源码级 gate）

> 非文档但属「体系保真」基础设施——CI workflow 与读源码断言的 gate 测试，破坏契约时在 `pnpm test` / CI 层直接报警。gate 测试随 `pnpm test` 全量执行。

| 路径 | 内容 | 状态 |
|---|---|---|
| `.github/workflows/ci.yml` | 测试 CI——push main + 全部 PR，macos-14，frontend job（lint / prettier --check / test / build）+ rust job（fmt / clippy -D warnings / cargo test --workspace），action 全 pin commit SHA | active（2026-07-01 P2-1 新增）|
| `.github/workflows/release.yml` | 发布出包——tag 触发 two-job 隔离，双架构 + minisign 签名 + latest.json（ADR-017） | active（2026-06-19）|
| `src/styles/token-gate.test.ts` | CSS token 纪律 gate——组件 CSS 禁裸 px/hex/ms + 禁 `var(--layer)` 作文字色（P0-1 新规则） | active |
| `src/components/__tests__/b2-separation.test.ts` | B2 源码级 gate——任务层 4 组件零 alignment 引用 + DraftInbox scoped 断言（取代已删 composition-b2-separation.test.ts） | active（2026-07-01 P2-2 新增）|
| `src/ipc/ipc-contract.test.ts` | IPC 三方契约 gate——commands.rs ↔ generate_handler ↔ ipc/index.ts 46 命令双向等价 + 防空转守卫 | active（2026-07-01 P2-3 新增）|

---

## §11.7 技术调研（2 份）

> 编码前的结构化调研产物，支撑 ADR / plan 选型；索引见 `docs/research/README.md`，日期倒序。

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/research/README.md` | 技术调研索引表 | active |
| `docs/research/2026-06-04-resizable-panels.md` | react-resizable-panels 多区域可调布局选型调研（支撑 ADR-016） | 已收口（ADR-016 Accepted 2026-06-04）|

---

## §12 维护规则

1. **新增文件必须先归层** —— 不知道放哪 → 不创建，先讨论分层
2. **L5 派生关系** —— 上游 L0/L1/ADR 变更 → L5 必须 bump → 走方法论 §7 八步流程
3. **L5 命名约定** —— `<工具名大写>-DESIGN.md`（sticky context）+ `<工具名小写>-prompts.md`（per-task 模板）；未来 v0 / Cursor / Galileo 等同样命名
4. **L5 失效检测** —— 见 §7
5. **ADR 编号递增不复用** —— 即便 011 reserved，未来新增也从 013 起
6. **mockup 旧版不删** —— 迁至 `docs/mockups/archive/v<N>-<reason>.html` 保留
7. **本 MANIFEST 同步规则** —— 任何 §2–§11 涉及的物理文件增删 / 状态变更 → 同步 patch bump

---

## §13 相关

- 上游方法论：`~/Vault/知识库/方案模板/产品文档体系方法论.md` v1.3
- 设计文档索引（L4）：[[README]]
- 设计文档变更日志：[[CHANGELOG]]
- 决策追溯：`docs/adr/`
- 实施任务清单：[[prompt-hub-mvp]]
- 项目 AI 上下文：[[CLAUDE]]
- 反思沉淀：[[learnings]]
