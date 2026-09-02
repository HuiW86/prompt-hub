---
type: features
project: prompt-hub
version: v1.21
created: 2026-05-19
last_modified: 2026-09-02
status: in-progress  # S1 进行中；v0.2.0 已发布（2026-08-20）；进度叙事见 §4 节奏表与 CHANGELOG，当前基线见 §7；v1.19 矩阵（37 verified / 39 done / 1 in-progress / 14 planned）omar 2026-09-01 人审批次 ⑦ 认可
author: ai  # 🤖 AI 主笔 + 人审（CLAUDE §5.2）
audience: [human, ai]
description: prompt-hub 功能清单运营视图——功能 × 状态 × 测试覆盖 × 版本的单一事实源；查/改功能状态时召回。版本叙事见 CHANGELOG
related:
  - 06-prd
  - prompt-hub-mvp
  - test-spec  # 待 W4 补
  - 012-lock-visual-quality-anchor
  - 019-supersede-flat-visual-anchor
  - 013-alignment-phrases-tab-inclusion
  - 015-expose-mcp-write-pipeline
  - mcp-write-pipeline
  - asset-editing-and-adaptive-layout
  - 016-choose-dnd-and-resizable-layout
  - 017-enable-auto-update
  - 018-absorb-promptscape-design
  - 020-restore-protocol-dark-band
  - 027-configurable-global-hotkey
---

# Features: prompt-hub

> 功能清单的**运营视图**。回答「现在有什么、做到什么程度、测得怎么样」。
> **不重复 prd**：本文件只承载状态/覆盖率，功能定义见 [[06-prd#5]] 各章节。
> **不替代 issue tracker**：单条 bug / task 走 git history，本文件追全局功能层面。
>
> ✅ **当前 S1 in-progress，v0.2.0 已签名公证发布（2026-08-20）**：§3.1 六模块全 `done`，§3.6 跨模块 6/8 `done`；ADR 001–027 中 24 Accepted。计数规则与各阶段进度见 §4，当前基线见 §7。
> 覆盖率列里「55 集成 / 单元未量化」「73 前端」「144 前端全绿」这类数字是**该行落地当时的全量测试数**，不是该功能专属用例数，不再逐行追更；当前全量基线只在 §7 维护，量化口径待 [[11-test-spec]] §5。

---

## §1 状态定义

| 状态 | 含义 | 触发 |
|---|---|---|
| `planned` | 已立项，未开始编码 | spec / prd 收录 |
| `in-progress` | 编码中 | 第一个 commit 提交 |
| `done` | 编码完成，本地跑通 | PR merged to main |
| `verified` | 已进入 publish 的 release，且有**留证**的验证通过，发布后自用 ≥1 周无回归 | ① 真机验收门通过（行为 / 布局类：ADR §6 编号门项或 runbook 留证）**或**持续运行的自动化 gate（结构 / 纪律类：源码级 gate、真实进程 e2e）+ ② 进入过一次已 publish 的 release + ③ 自用 ≥1 周无回归。留证逐行登记在 §7 索引。Playwright E2E 层落地后加回「E2E 通过」 |
| `deprecated` | 已废弃，待移除 | 开 ADR 决议废弃 |

**铁律**：已进入 publish 的 release 的功能，满足上述三条者**必须**标 `verified`；不满足者保持 `done`，并在 §7 留证索引写明缺哪条。`verified` **不等于**外部使用者验证——外部验证是下一级门槛（[[HANDOFF]] 第 19 项），本表不设该状态。留证机制见 [[11-test-spec#4.1]]（真机验收门临时承接 E2E）。

## §2 优先级定义

| 优先级 | 含义 | 例子 |
|---|---|---|
| **P0** | MVP 核心，缺失则产品不成立 | 主形态唤起、Macro 调用、相位带 |
| **P1** | 重要但可延后，缺失则体验打折 | SOP 导航、配置入口、数据导入导出 |
| **P2** | 增强型，覆盖少数场景 | 辅形态副屏、月度 review 视图 |

## §3 功能矩阵

### 3.1 主形态 MVP（S1 / 第一阶段）

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | prd 引用 |
|---|---|---|---|---|---|---|
| 搜索区（⌘K 全局搜索） | P0 | `verified` | v1.0 | 55 集成 / 单元未量化 | omar | [[06-prd#5.0]] |
| 相位带（Phase Bar） | P0 | `verified` | v1.0 | 55 集成 / 单元未量化 | omar | [[06-prd#5.1]] |
| 对齐话术（AlignmentPhrases）chip 行 | P0 | `verified` | v1.0 | 55 集成 / 单元未量化 | omar | [[013-alignment-phrases-tab-inclusion]] |
| Macro 快捷区 | P0 | `verified` | v1.0 | 55 集成 / 单元未量化 | omar | [[06-prd#5.2]] |
| Scene 全景区 | P0 | `verified` | v1.0 | 55 集成 / 单元未量化 | omar | [[06-prd#5.3]] |
| 最近使用区 | P0 | `verified` | v1.0 | 55 集成 / 单元未量化 | omar | [[06-prd#5.5]] |

### 3.2 闭环沉淀（S2 / 第二阶段）

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | prd 引用 |
|---|---|---|---|---|---|---|
| Composition 组合工作台（⌘N） | P0 | `planned` | v1.1 | 0% | omar | [[06-prd#5.4]] |
| 状态仪表区（相位分布） | P0 | `planned` | v1.1 | 0% | omar | [[06-prd#5.7]] |
| 「未分类草稿」识别 | P0 | `planned` | v1.1 | 0% | omar | [[prompt-hub-mvp#第二阶段]] |
| 「保存为 Macro」自动提示 | P0 | `planned` | v1.1 | 0% | omar | [[prompt-hub-mvp#第二阶段]] |

### 3.3 SOP 导航（S3 / 第三阶段）

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | prd 引用 |
|---|---|---|---|---|---|---|
| SOP 导航区 | P1 | `planned` | v1.2 | 0% | omar | [[06-prd#5.6]] |
| SOP 模板的创建和编辑 | P1 | `planned` | v1.2 | 0% | omar | [[prompt-hub-mvp#第三阶段]] |
| 从使用历史录制 SOP | P1 | `planned` | v1.2 | 0% | omar | [[prompt-hub-mvp#第三阶段]] |

### 3.4 配置与个性化（S4 / 第四阶段）

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | prd 引用 |
|---|---|---|---|---|---|---|
| 配置入口 | P1 | `planned` | v1.3 | 0% | omar | [[06-prd#5.8]] |
| Phase 可配置编辑 | P1 | `planned` | v1.3 | 0% | omar | [[06-prd#6.5]] |
| 数据导入导出（JSON） | P1 | `verified` | v1.3 | repo-core export 3 test + repo-write import 5 test（含整库替换 / 含弃用行 / 拒不兼容 major / FK 原子回滚）；前端 SettingsModal 数据页（save/open dialog + 整库替换确认弹窗）；不导出 usage_records（决策 D2）/ 整库替换（决策 D1） | omar | [[06-prd#6.9]] |
| 主形态界面布局可配置 | P1 | `planned` | v1.3 | 0% | omar | [[01-spec#2.9]] |
| **全局唤起键可配置** | P1 | `verified` | v1.3 | repo-core settings 4 test（seed 默认 / upsert 不重复行 / 缺行回落）+ commands 5 test（accelerator 校验：默认可注册 / 拒裸键 / 拒乱码 / 多修饰键 / seed 与解析器不脱节）+ repo-write 1 test（导入不清 settings）+ 前端 accelerator 9 test + HotkeyRecorder 10 test + settingsStore 4 test + HotkeyBanner 2 test。**注册/回滚与 Reopen 逃生口不可自动化**，归 G3 真机门 —— **2026-08-20 走查四项全通过**（项 2 一度判不可达，补冲突提示后转为可观测并通过，见 [[11-test-spec#4.2]]）| omar | [[06-prd#5.8]] · [[06-prd]] §6.8-bis |

### 3.5 辅形态副屏（S5 / 第五阶段）

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | prd 引用 |
|---|---|---|---|---|---|---|
| 副屏常驻窗口 | P2 | `planned` | v2.0 | 0% | omar | [[prompt-hub-mvp#第五阶段]] |
| 月度 review 视图 | P2 | `planned` | v2.0 | 0% | omar | [[prompt-hub-mvp#第五阶段]] |
| 副屏 Composition 侧栏 | P2 | `planned` | v2.0 | 0% | omar | [[prompt-hub-mvp#第五阶段]] |

### 3.6 跨模块能力（非单模块功能）

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| 全局快捷键注册（默认 ⌥ Space） | P0 | `verified` | v1.0 | M0 手动 verified；v1.15 起绑定读自 SQLite `settings` 而非硬编码，注册失败仍走 `HotkeyBanner` 告警。**改绑能力见 §3.4「全局唤起键可配置」** | omar | [[prompt-hub-mvp#第一阶段]] · [[027-configurable-global-hotkey]] |
| 主形态唤起 ≤200ms（P95） | P0 | `verified` | v1.0 | `bench:hotkey-wake` P95=13.708ms ✓（2026-08-20，auto-cycle 主线程口径；旧 10.49ms 是 M0-3 inline 版数字，见 [[learnings]] 信条四）| omar | [[02-constitution#C1]] |
| 复制即隐藏 / ESC 关闭 | P0 | `verified` | v1.0 | Phase 5 视觉+功能验收 11/11 ✓（2026-06-03） | omar | [[prompt-hub-mvp#第一阶段]] |
| UsageRecord 持续记录 | P0 | `in-progress` | v1.0 | 数据层 done / 链路待 S2 | omar | [[06-prd#6.8]] |
| 三层资产模型（Modifier/Composition/Macro） | P0 | `planned` | v1.0 | 0% | omar | [[02-constitution#B1]] |
| 协议层与任务层物理分离 | P0 | `verified` | v1.0 | 结构分离落地（B2 纯结构）；视觉区分自 ADR-019 改靠位置+形状（弃颜色本体论）/ 数据层待 S2。**v1.17 起不再叠文字标签**——「协议层」「任务层」两枚 pill 删除（位置+形状已冗余编码），仅 `ModifierGrid` 保留「协议层 · 参考」（aside 列无 band 无位置线索，是唯一标识）| omar | [[02-constitution#B2]] · [[05-design-spec#5]] |
| 本地数据存储（无服务端） | P0 | `verified` | v1.0 | M0-3 SQLite 落盘 / cargo 12 测试 ✓ | omar | [[02-constitution#A2]] |
| 设计 Token 系统（无裸值） | P0 | `verified` | v1.0 | Phase 1-3 全量 token 化 ✓ | omar | [[prompt-hub-mvp#§0-T1]] |

### 3.7 MCP write pipeline（M-X / 反向 AI 写入）

> 第二阶段能力：让 Claude Code 通过 MCP stdio 把对话产出的提示词资产写入 drafts 收件箱，omar 在 Scene 草稿 tab 显式 promote 入正式表。决策见 [[015-expose-mcp-write-pipeline]] Accepted，实施步骤见 [[mcp-write-pipeline]] v0.2，接口契约见 [[06-prd#10]]。
>
> 边界 reaffirm：本区不违反 [[06-prd#8.2]] N2/N3——外部 AI 调本工具（方向相反）+ promote 仍需 omar 显式点击。

#### 支撑能力

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| drafts 收件箱数据层（migration 0003 + payload_hash 去重）| P1 | `verified` | v1.1 | repo-core 21 test | omar | [[06-prd#10.1]] |
| `prompt-hub-mcp` binary（rmcp 1.7 stdio + tracing→stderr）| P1 | `verified` | v1.1 | mcp crate 14 test（8 unit + 5 e2e spawn JSON-RPC + 1 trybuild）；/review 后补 confidence/schema_version 信任边界 + Mutex 恢复 | omar | [[06-prd#10.0]] |
| Cargo workspace 4 crate 物理拆分（编译期写入隔离）| P1 | `verified` | v1.1 | trybuild compile_fail | omar | [[09-tech-stack#4.3.1]] |
| Scene 全景区「📥 草稿」tab（promote/discard + Modifier 四象限 popover）| P1 | `verified` | v1.1 | promptStore 7 test + App e2e（草稿 tab + DraftInbox 卡片）| omar | [[06-prd#10.3]] |
| 主形态顶部待审 badge（仅 N>0 显示，跳转收件箱，排除 Tab 循环）| P1 | `verified` | v1.1 | App e2e render（badge 条件渲染）| omar | [[06-prd#10.3]] |
| promote 跨表事务（4 类 arm）+ 5 Tauri IPC（promote/list/count/update/discard）+ mid-session schema recheck（v1.8 起 +`get_draft` 共 6 IPC，见 §3.12）| P1 | `verified` | v1.1 | repo-write 9 test（4 promote arm）+ commands schema-guard 2 test + count_pending 1 test | omar | [[06-prd#10.2]] |

#### 14 MCP tool（5 CRUD + 3 helpers + 6 read）

| 类别 | tool | 优先级 | 状态 | 目标版本 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| CRUD | `create_draft` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.1]] |
| CRUD | `list_drafts` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.1]] |
| CRUD | `get_draft` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.1]] |
| CRUD | `update_draft` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.1]] |
| CRUD | `delete_draft` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.1]] |
| Helper | `bootstrap_from_markdown` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.2]] |
| Helper | `save_conversation_as_macro` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.2]] |
| Helper | `import_json`（6 条加固）| P1 | `verified` | v1.1 | omar | [[06-prd#10.4.2]] |
| Read | `list_phases` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.3]] |
| Read | `list_alignment_phrases` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.3]] |
| Read | `list_modifiers` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.3]] |
| Read | `list_compositions` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.3]] |
| Read | `list_macros` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.3]] |
| Read | `list_scenes` | P1 | `verified` | v1.1 | omar | [[06-prd#10.4.3]] |

### 3.8 资产编辑 + 自适应布局（AE / asset-editing plan）

> 来源 [[asset-editing-and-adaptive-layout]] plan（P1–P4）+ [[016-choose-dnd-and-resizable-layout]]。摆脱「只读 + 仅草稿流水线」，4 类资产可直接编辑 + 区域内拖动排序；Dashboard 列宽从固定 grid 改为可拖 + 持久化。
>
> 边界 reaffirm：只做「区域内排序 + 区域尺寸可调」，不做跨区域自由拖放 / 跨类型拖动（守 [[02-constitution#B2]]，plan §1 非目标）。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| Macro 编辑（增删改名/改内容）+ dnd-kit 拖动排序（`order_index` 持久化）| P1 | `verified` | v1.1 | 73 前端 / repo-write reorder | omar | [[asset-editing-and-adaptive-layout#P1]] |
| AlignmentPhrase 编辑面板（edit-mode toggle + dnd 排序，per-phase `order_index`）| P1 | `verified` | v1.1 | 73 前端 | omar | [[asset-editing-and-adaptive-layout#P2]] |
| Scene 话术（Phrase）编辑（edit-mode toggle + 增删改名/改内容/改子阶段 + dnd 排序，per-(scene,sub_stage) `order_index`，schema 8→9）| P1 | `verified` | v1.4 | 94 前端 / repo-write phrases 12 测试 | omar | [[scene-phrase-editing]] |
| Scene/SubStage 结构编辑（D1 Scene+SubStage CRUD 一起做 / D2 seed `0011` 灌示范 SubStage / D3 Tauri-only 不上 MCP / D4 删非空 Scene 阻止 · 删 SubStage 解绑 Phrase；Scene 全局序 + SubStage per-scene 序）| P1 | `verified` | v1.6 | 后端 74（repo-write scenes/sub_stages 19 单测）/ 前端 109（store 5 + ScenePanel 组件 6）；真机 CRUD 落盘待验 | omar | [[scene-substage-editing]] |
| Modifier / Composition 编辑（增删改名/改内容/排序）| P1 | `withdrawn` | v1.3 | ~~ModifierGrid 6 + CompositionWorkbench 6 + composition-b2 gate~~（v1.3 移除）| omar | [[asset-editing-and-adaptive-layout#P2]] |
| └ v1.3 UI 减负：两编辑面板移出主仪表盘（[[03-product-spec#修订记录]] v0.9）。资产类型、数据层、DraftInbox promote 分支保留（「只进不显」），随时可重挂或落地 ⌘N 子窗口；未改 [[02-constitution#B1]] | — | — | — | — | — | — |
| Dashboard 可拖列布局（react-resizable-panels v4 `Group`/`Panel`/`Separator` + localStorage 持久化）| P1 | `verified` | v1.1 | 73 前端 / 手测 拖拽+持久化 ✓（键盘 focus 待补）| omar | [[asset-editing-and-adaptive-layout#P4]] |
| Scene 编辑分层化（废除全局 editMode → 属性面板 `ScenePropertiesEditor`：name/icon/color/rolePresets 首获 UI 承载 + 场景前移/后移/删除收编；子阶段列头 / 话术卡 hover+`:focus-within` 就地动作簇 + ghost 新增入口；空子阶段列常显；排序拖拽→按钮等价）| P1 | `verified` | v1.9 | 前端 222 全绿（ScenePanel 34 含 12 格实体×CRUD 矩阵/异步失败/键盘可达 + ScenePropertiesEditor 18）；真机观感待验 | omar | [[021-scene-layered-editing]] |
| └ v1.9 分层化推翻上方 v1.4/v1.6 两行及 §3.12「Scene/SubStage 排序 UI」行的**编辑态 UI 承载**（能力零回退：同 IPC 链路，SubStage dnd → ←→ 按钮）——旧行保留作历史；契约见 [[03-product-spec#13.3]] 区域 4 v0.14 | — | — | — | — | — | — |
| 固定空间布局（`interactionMode` 停止驱动区域重排；两态共用一套区域图 + 同一组持久化键；task 列新增用户可拖纵向分配 `task-2row`，Macro 46%/min `132px` · Scene 54%/min `288px`——**下限取像素不取百分比**；两区下限语义一致 = 一个完整单元 + 下一个露半截）| P1 | `verified` | v1.12 | 335 前端全绿（`App.test.tsx` 两条模式分歧断言合并为不分模式 `it.each`）+ **真机走查三项通过**（纵向下限 / Separator 命中与光标 / PhaseBar 等宽后活动相位）| omar | [[026-fixed-spatial-layout]] |
| 统一锚定编辑容器（编辑器脱离宿主文档流 → 原生 `popover` top layer 锚定；四个编辑面共用 `AnchoredEditor` + `PhraseFormEditor`；Macro / 草稿两份手搓表单删除收编，净删约 180 行；保存语义规则表五行；Scene 属性面板点外拒绝关闭 + Esc 逐层退栈为唯一例外；提交键统一 A1-08）| P1 | `verified` | v1.14 | 373 前端全绿（新增 `AnchoredEditor` 17 / `useAnchoredPosition` 13，11 条 P1-b 新测逐条反向验证）+ **真机验收门 G1 六项 + P1-b 门两项全通过**，其中项 5 与项 2-B 取得逐像素证据 | omar | [[025-unified-anchored-editing]] |
| └ v1.14 本行覆盖 ADR-025 的 **P0 + P1-a + P1-b**；**P2 键盘动作层（子决策 3.1–3.4 + 4）与 P3 合流未落地**，验收门 G2 五项未跑。清单纠偏：ADR 原写「其余五个编辑面」，逐文件核实后**只有 4 个**——`RecentList.tsx` 是只读复制列表、根本没有编辑器，被 §1 影响范围（P2 键盘层口径）误收进迁移清单。契约见 [[03-product-spec#13.3]] 编辑容器统一契约 v0.19 / [[05-design-spec#2.6]] + §10.2.2 v0.18 | — | — | — | — | — | — |
| └ v1.12 本行**移除**上方 v1.1「Dashboard 可拖列布局」行的按态分列键（`panorama-2col` / `cockpit-2col` → `dashboard-2col`），并退役 `--h-macro-strip` 硬封顶（token 改名 `--h-modifier-card-max`）；能力零回退，列宽可拖与持久化不变。**走查 3 项缺陷 v1.13 已裁**：Scene 下限 `196px`→`288px`（非取舍，是未满足 ADR-026 子决策 2 的验收条件，实测 0 条话术）；Separator 9px 死区记为已知可接受（扩 hover 会吞点击）；`--brand-dim` 对比度 `1.145:1` 不调色，改为把 `.phase.active::after` 标注承重件防减法快车道误删 | — | — | — | — | — | — |

### 3.9 自动更新（ADR-017 / auto-update）

> 来源 [[017-enable-auto-update]] Accepted（2026-06-17）+ plan [[adr-017-auto-update]]。`tauri-plugin-updater` + GitHub Releases（`HuiW86/prompt-hub`）+ GitHub Actions 自动出包，mac 先行。隐私披露见 [[10-ops-spec#§9]]，A2 受限豁免边界见 [[06-prd#8.2]] N1。
>
> 边界 reaffirm：唯一显式声明的出站网络例外（守 [[02-constitution#A2]]）——首启 opt-in 默认 off + 总开关零出站 + 不上传话术，仅向 GitHub Releases 拉 `latest.json`。检查走 JS 侧启动一次，不进 ⌥Space 唤起热路径（守 [[02-constitution#C1]]）。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| updater 客户端接入（plugin 注册 + capabilities + pubkey 嵌入）| P1 | `verified` | v1.1 | cargo build / 真机待 Phase 6 | omar | [[adr-017-auto-update#Phase-1]] |
| opt-in 总开关 + 检查/下载/安装 UI（updaterStore + UpdaterBanner 四态 + StatusBar 入口）| P1 | `verified` | v1.1 | updaterStore 5 test（总开关关闭零触网，守 A2）| omar | [[adr-017-auto-update#Phase-2]] |
| Vite 密钥泄漏加固（`envPrefix` 白名单挡 `TAURI_SIGNING_*`，GHSA-2rcp-jvr4-r259）| P1 | `verified` | v1.1 | 源码级 envPrefix 锁 | omar | [[adr-017-auto-update#Phase-3]] |
| CI 自动出包（`release.yml` two-job 隔离 + minisign 签名 + latest.json + draft）| P1 | `verified` | v1.1 | dry-run 端到端验证（run 27855601462 全绿，双架构 + 签名 + latest.json 核验）| omar | [[adr-017-auto-update#Phase-4]] |
| 真机验收（opt-in/检查/提示链路 + hotkey-wake 复测守 C1）| P1 | `verified` | v1.1 | **Phase 6 于 2026-08-20 随 v0.2.0 发布实测**：已装 0.1.1 →「发现新版本 0.2.0」→ 下载安装 → 进程重启 → 安装目录 0.2.0；更新后复验签名链（`codesign --verify --strict` / `stapler validate` / `spctl accepted`）；`bench:hotkey-wake` p95 13.708ms 守 C1 | omar | [[adr-017-auto-update#Phase-6]] |

### 3.10 UI 风格一致性治理（design-spec v0.10 A 阶段）

> 来源 [[05-design-spec]] v0.10（§10.2.2 primitive 清单 + §10.6 Card/List 范式矩阵 + §10.7 Button 矩阵 + §11 flash 共享契约）。消除范式漂移：editor 五件套重复 4×、action/confirm 控件重复 4×、「新增」入口分叉（文字 pill vs icon 方块）、flash keyframes 重定义 3×。
>
> 行为变更（非纯去重，真机验证必查）：卡片圆角 `--r-3`→`--r-4`；focus outline 全组件统一 `--protocol`；~~ModifierGrid 绿→紫；CompositionWorkbench box-row→divider list-row~~（v1.3 这两组件已移出主仪表盘，迁移成果随组件删除作废）；DraftCard divider→neutral CardSurface + promote 去 task 绿（neutral ghost）；ScenePanel 复制 flash 收敛到单一 `ph-flash`；PhaseBar `phaseCopyFlash`→共享 `ph-flash`；RecentList/SearchBar focus outline `--task`→`--protocol`。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| primitives 基础层（`CardSurface`/`ListRowSurface`/`Button`/`IconButton`/`Input`+`EditorInput`/`EditorPanel`+`EditorActions`/`Chip`/`ActionCluster`/`ConfirmInline` + `ph-flash` + `--layer-*` 变体）| P1 | `verified` | v1.1 | 110 前端（既有组件测试零回归）| omar | [[05-design-spec#10.2.2]] |
| editor 簇迁移（MacroGrid / AlignmentPhrases；~~ModifierGrid / CompositionWorkbench~~ v1.3 删）| P1 | `verified` | v1.1 | 94 前端 / 真机验证待补 | omar | [[05-design-spec#10.6]] |
| surface/control 迁移（ScenePanel flash + focus / DraftInbox+DraftCard → neutral CardSurface + ghost Button）| P1 | `verified` | v1.1 | 110 前端 / 真机验证待补 | omar | [[05-design-spec#10.4.3]] |
| CSS 裸值 gate（`token-gate.test.ts` 扫 px/hex/ms，仅 tokens.css 豁免）+ SearchBar `outline-offset`→`var(--hairline)` | P1 | `verified` | v1.1 | token-gate 18 file scan | omar | [[05-design-spec#10.2.2]] |

### 3.11 Promptscape 设计吸收（ADR-018 / A1+B1+C1+D+E）

> 来源 [[018-absorb-promptscape-design]] Accepted（2026-06-25）。以「改造现有组件」吸收 Claude Design「Promptscape 全景仪表盘」约 90% 视觉收益，组合锁定 A1（保留项目语义色）+B1（不引入 Modifier 右栏）+C1（改造现有组件）+D（接既有 store）+E（保留 prompt-hub 名 + 去头像）。三处放大决策：任务层 3→2 列 / 新增 slim Header / 省略全局「新建」按钮。
>
> B2 复检（[[02-constitution#B2]]）：新增「中性强调色」只染品牌标记 / 主操作 / 焦点环，绝不重染 protocol（紫）/ task（绿）层；accent token 经 `:root.accent-*` 物理隔离。settingsStore 外观偏好 persist localStorage，A2 不出站。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| 主题三态外观系统（settingsStore `themeMode` light/dark/system + `applyAppearance` root class，onRehydrate 应用无首启闪烁）| P1 | `verified` | v1.5 | 97 前端 / 真机验证待补 | omar | [[05-design-spec#2.5]] |
| 中性强调色（5 色 swatch neutral/blue/green/violet/amber，只染中性强调面，B2 物理隔离）| P1 | `verified` | v1.5 | 97 前端 / token-gate（accent token 落 tokens.css）| omar | [[05-design-spec#2.4.4]] |
| 设置弹窗（`SettingsModal` 外观页 + 更新页两 pane，⌘/Ctrl , 唤起 + ESC/遮罩关闭，更新页复用 updaterStore opt-in 总开关）| P1 | `verified` | v1.5 | 97 前端 / 真机验证待补 | omar | [[05-design-spec#10.8.3]] |
| slim Header（logo + 标题 + 内嵌 SearchBar + gear，去头像保留 prompt-hub 名，待审 badge 内嵌）| P1 | `verified` | v1.5 | 97 前端 / 真机验证待补 | omar | [[05-design-spec#10.8.1]] |
| ProtocolBand 协议层暗色 band（AlignmentPhrase + Phase 收为顶部暗色带）| P1 | `verified` | v1.5 | 97 前端 / 真机验证待补 | omar | [[05-design-spec#10.8.2]] |
| 任务层 3→2 列全景重构（resizable group id `panorama-2col` 丢弃旧三列缓存；Macro 收为顶部紧凑横条 / aside 承载 Recent + SOP）| P1 | `verified` | v1.5 | 97 前端 / 真机验证待补 | omar | [[016-choose-dnd-and-resizable-layout#补遗]] |

### 3.12 产品走查修缮批次（2026-07-01 · P0/P2/P3）

> 来源：2026-07-01 产品走查（实体×CRUD 覆盖矩阵反查）收敛的修缮批次。P0 = 可用性/可靠性止血；P3 = 资产生命周期补救 + 设计稿对齐。暗 band 部分开 [[020-restore-protocol-dark-band]]（Accepted 2026-07-01）调和 ADR-018/019 冲突。契约涟漪：design-spec v0.13 / product-spec v0.13 / prd v0.12。
>
> 边界 reaffirm：全批零出站（A2）、启动路径只减不加（C1，bench 未回归）、B2 结构分离零触碰（且本批恢复了源码级 gate 持续证伪）。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| Draft 促升前编辑（DraftCard「编辑」：`get_draft` 水合 → `update_draft` 全量保存；隐藏字段保留，四象限仍 promote 时人选）| P1 | `verified` | v1.7 | promptStore 2 + DraftInbox 3 前端；cargo 全绿 | omar | [[06-prd#10.3]] |
| Composition promote 暂缓止血（归档/编辑 disabled +「该类型暂无 UI 承载」，discard 可用；解锁 = Composition 重获 UI 承载）| P0 | `verified` | v1.7 | DraftInbox.test 4 断言 | omar | [[03-product-spec#13.3]] |
| Modifier 最小管理簇（移象限 = `update_modifier` 可选 `group_kind` 入参单事务移位 + 二次确认删除，hover/`:focus-within` 显隐键盘可达）| P1 | `done` | v1.7 | ModifierGrid 2 前端 + repo-write modifiers 3 单测 | omar | [[06-prd#6.1]] |
| AlignmentPhrase「设为默认」（`set_default_alignment_phrase` 单事务换默认 + 同步 phases 指针，编辑态 Star 入口）| P1 | `verified` | v1.7 | repo-write 4 单测 + store 乐观 action | omar | [[06-prd#6.6]] |
| Scene / SubStage 排序 UI（Scene 编辑态前移/后移按钮接 `reorder_scenes`；SubStage 结构编辑器内 dnd 拖拽；活动场景 id 追踪排序不中断编辑态）| P1 | `done` | v1.7 | ScenePanel 2 + promptStore 2 前端 | omar | [[03-product-spec#13.3]] |
| 复制失败可见 + Toast intent 分级（useCopy 失败弹 error toast 并中止 record_usage；success 800ms / error 4000ms amber + `role=alert`）| P0 | `done` | v1.7 | useCopy 3 + toastStore 3 前端 | omar | [[05-design-spec#11]] |
| 更新检查失败 auto/manual 分级（auto 静默降级不挂横幅 / manual error+toast）+ Dashboard 加载失败「重试」（role=alert + refreshAll）| P0 | `done` | v1.7 | updaterStore 3 前端 | omar | [[017-enable-auto-update]] |
| 启动 DB 失败优雅兜底（app_data_dir/迁移失败 → 阻断式错误对话框含 DB 路径 + `exit(1)`；manage 未迁移 in-memory 连接防 IPC panic）| P0 | `done` | v1.7 | cargo test --workspace 全绿 + `cargo check --features bench` | omar | [[06-prd#7.7]] |
| 协议层暗色 band 恢复 + 层级编码修缮（`--band-*` token 族 + band 作用域重映射；ModifierGrid「协议层 · 参考」pill；RecentList 徽标中性化）| P1 | `verified` | v1.7 | 144 前端全绿（含 token-gate / b2 gate）| omar | [[020-restore-protocol-dark-band]] |
| light 主题明度重绘 + resting elevation（muted canvas + 纯白抬升卡；4 容器 resting `--shadow-1`）| P1 | `verified` | v1.7 | 144 前端全绿（token-gate）| omar | [[05-design-spec#2.4.2]] |
| Scene 全景 auto-fit 自适应列宽 + 「未分组」列头（窄面板降列不挤压 + 未归组话术 muted 列头）| P1 | `verified` | v1.7 | ScenePanel 2 例 | omar | [[05-design-spec#10.3]] |
| 设计稿像素对齐包（Macro 图标盒全量 accent 填充 + hot Flame 实心；hover `--shadow-1`+`--lift-1` 抬起语言；EmptyState 富空态 icon/title/action/framed/row + Scene 空态 accent CTA + Button intent=accent）| P1 | `verified` | v1.7 | 144 前端全绿 | omar | [[05-design-spec#10.7]] |

**质量 / 治理项（不计入功能数，治理性改动惯例同 2026-06-21）**：

| 项 | 状态 | 说明 / 覆盖 |
|---|---|---|
| 测试 CI（`.github/workflows/ci.yml`）| `done` | push main + 全部 PR，macos-14 双 job（frontend: lint/prettier/test/build；rust: fmt/clippy/test + rust-cache），action 全部 pin commit SHA；全部命令本地核验通过 |
| B2 源码级 gate 恢复（`b2-separation.test.ts`）| `done` | 5 例：MacroGrid/ScenePanel/ModifierGrid/SopProgress 零 alignment 引用；DraftInbox scoped 断言（仅放行 `alignment_phrase` 判别符）；SearchOverlay 按 ADR-013 豁免留注 |
| IPC 三方契约冒烟（`src/ipc/ipc-contract.test.ts`）| `done` | 6 断言：commands.rs `#[tauri::command]` ↔ lib.rs `generate_handler!` ↔ 前端 `invoke("…")` 三方 46 命令双向等价 + 动态命令名守卫 |
| typography preset 落地 + token 纪律收敛 | `done` | `src/styles/typography.module.css` 7 preset（composes 引用）+ Chip transparent/`--w-chip-max` + focus offset 三取值归一；151 前端全绿 |
| primary 按钮对比度修复 + token-gate 新规则 | `done` | `.btnPrimary` 文字 `var(--layer)`→`var(--fg-1)`；token-gate 增「裸 color 禁取 var(--layer)」规则（含 fallback 写法）|
| AlignmentPhrases region / UpdaterBanner 按钮 focus 可见补齐 | `done` | 与其余 region / primitives 同口径 `:focus-visible` accent outline（design-spec §11 focused hard rule 欠账）|
| bench:hotkey-wake C1 gate（P95 > 200ms → exit 1）| `done` | `bench/hotkey-wake.bench.mjs` 加 `C1_BUDGET_MS` 常量，可作 CI gate；未真跑 bench |

---

### 3.13 UX 任务流批次 A（2026-07-12 · 整理模式）

> 来源：2026-07-12 UX 任务流静态预审 v2（[[2026-07-12-ux-taskflow-audit]]，裁决 D-0~D-6 见其 §0）。契约涟漪：product-spec v0.15 新增 §4.0.7 交互模式契约。verifier 对抗审查 PASS（前端 301/301、cargo workspace 147 全绿、clippy 零告警）。
>
> ⚠️ NEEDS HUMAN 4 项（整理态连续整理 / ModeToggle 窄 Header / 长话术展开溢出 / 撤销 toast 6s）真机未确认前，整理模式不写进对外发布说明。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| 显式整理模式（D-0：`interactionMode` 持久化 + Header ModeToggle segmented/`aria-pressed` + 整理态整卡=选择/预览、复制降显式动作 + `record_usage` suppressHide 门控——隐藏与 usage 统计解耦；点击语义变更仅限 Scene 话术卡）| P1 | `verified` | v1.10 | ModeToggle 3 + ScenePanel/settingsStore/useCopy 前端；`hide_after_copy` 纯函数单测 | omar | [[03-product-spec#4.0.7]] |
| 草稿 promote 落地定位（自动切目标 Phase + flash 高亮落地资产；A1-03）| P1 | `verified` | v1.10 | promptStore + DraftInbox 前端 | omar | [[2026-07-12-ux-taskflow-audit#§3]] |
| 草稿 discard 可撤销（undo toast + `restore_draft` 软状态反向写，dedup 冲突诚实报错；A1-04，D-5 第二路）| P2 | `verified` | v1.10 | DraftInbox + toastStore 前端 + repo-core draft_repo 单测 | omar | [[2026-07-12-ux-taskflow-audit#§0]] |
| 话术保存成功 toast（A1-07）| P2 | `done` | v1.10 | ScenePanel / AlignmentPhrases 前端 | omar | [[03-product-spec#4.4]] |
| 提交键统一 ⌘/Ctrl+Enter + Enter 移焦（A1-08）| P2 | `verified` | v1.10 | PhraseFormEditor 相关前端 | omar | [[2026-07-12-ux-taskflow-audit#§3]] |
| 编辑器 footer flex-wrap（`.editorActions`；A3-02，D-6 发布前项）| P1 | `done` | v1.10 | 结构性 CSS 修复，随既有编辑器用例回归 | omar | [[2026-07-12-ux-taskflow-audit#§3]] |

---

### 3.14 UX 任务流批次 B（2026-07-12 · 跨 Scene 话术移动）

> 来源：[[022-cross-scene-phrase-move]] Accepted（2026-07-12，子决策 2 = 双路径共存）。T6 死路打通且零历史损失，A1-01（P1）+ A1-06（P2）同批收口。verifier 对抗审查 PASS（独立复跑七项门禁全绿）。真机移动/撤销视觉链路待验。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| 跨 Scene / 跨子阶段话术移动（`move_phrase` 单事务校验 target SubStage∈target Scene + MoveReceipt 撤销回填精确排序位；动作簇「移动到…」分层选择器 + 撤销 toast；同目标确认禁用防空移动；不碰 name/content、不计 usage）| P1 | `verified` | v1.11 | repo-write move_phrase 8+ 单测（校验矩阵 + 撤销往返 + 不计 usage）+ ScenePanel 8 前端（选择器/撤销/失败/键盘/同目标禁用）；ipc-contract gate 覆盖新命令 | omar | [[022-cross-scene-phrase-move]] / [[03-product-spec#13.3]] |

---

## §4 阶段交付节奏

**计数规则（v1.18 起显式）**：§3 每个功能行计 1；`withdrawn` 行、`└` 注释行、§3.12 治理项表不计。合计按此规则从 §3 逐行重数，不再累加历史 delta——v1.9 / v1.12 两次「合计 +1」都没有对应的表行，累加口径已经对不上。

| 阶段 | 版本 | 功能数 | 状态 |
|---|---|---|---|
| S1 主形态 MVP | v1.0 | 6 模块 + 8 跨模块能力 = 14 | `in-progress`（§3.1 六模块 6/6 `done`；§3.6 6/8 `done`，UsageRecord 链路 `in-progress`、三层资产模型 `planned`。**已发布自用但无一行 `verified`**，见 §7 铁律缺口）|
| S2 闭环沉淀 | v1.1 | 4 | `planned` |
| M-X MCP write pipeline | v1.1 | 6 支撑能力 + 14 MCP tool = 20 | `done`（⚠️ v0.2.0 release 不含 MCP 二进制；`user_version` 12 与主进程共库，下次分发 MCP 须同批）|
| AE 资产编辑 + 自适应布局 | v1.1 | 3 | `done`（3/3 在用：Macro/AlignmentPhrase 编辑+排序 + 可拖列布局；Modifier/Composition 编辑 v1.3 `withdrawn` 不计）|
| Scene 话术（Phrase）编辑（scene-phrase-editing）| v1.4 | 1 | `done`（**v1.18 补行**：v1.4 落地时只进 §3.8 未进本表）|
| Scene/SubStage 结构编辑（scene-substage-editing）| v1.6 | 1 | `done`（后端 74 / 前端 109 当时全绿；真机 CRUD 落盘待验）|
| Scene 编辑分层化（ADR-021）| v1.9 | 1 | `done`（**v1.18 补行**：v1.9 日志记「合计 78→79」但未加行；真机观感待验；`scene.color` 用户内容色定性 2026-09-01 omar 复核通过）|
| ADR-017 自动更新 | v1.1 | 5 | `done`（**5/5**：Phase 6 真机验收 2026-08-20 随 v0.2.0 发布实测通过，见 §3.9）|
| UI 一致性治理（design-spec v0.10 A 阶段）| v1.1 | 4 | `done`（4/4 实装 + 测试零回归；真机验证待补）|
| Promptscape 设计吸收（ADR-018）| v1.5 | 6 | `done`（6/6 实装：主题三态 + 强调色 + 设置弹窗 + Header + ProtocolBand + 2 列全景；真机验证待补）|
| 产品走查修缮批次（P0/P3 + ADR-020）| v1.7 | 12 | `done`（12/12 实装；另 7 项质量/治理不计数；真机视觉复核待补）|
| UX 任务流批次 A（整理模式）| v1.10 | 6 | `done`（6/6 实装 + verifier 对抗审查 PASS；NEEDS HUMAN 4 项真机待验）|
| UX 任务流批次 B（跨 Scene 移动，ADR-022）| v1.11 | 1 | `done`（verifier 对抗审查 PASS；真机移动/撤销链路待验）|
| 固定空间布局（ADR-026）| v1.12 | 1 | `done`（**v1.18 补行**：v1.12/v1.13 落地时只进 §3.8 未进本表；真机走查三项通过，三项缺陷 v1.13 已裁）|
| 统一锚定编辑容器（ADR-025）| v1.14 | 1 | `done`（P0+P1-a+P1-b 落地并合入 `main`；**P2 键盘动作层 + P3 合流 `planned`**，omar 2026-08-20 明示暂不做；G2 未跑）|
| S3 SOP 导航 | v1.2 | 3 | `planned` |
| S4 配置个性化 | v1.3 | 5 | `in-progress`（2/5：数据导入导出 JSON `done`，真机待验；全局唤起键可配置 `done`，G3 四项全通过；配置入口 / Phase 编辑 / 布局可配置 `planned`）|
| S5 辅形态副屏 | v2.0 | 3 | `planned` |
| **合计** | — | **91** | — |

**注**：版本号语义为 prompt-hub 自身版本，与 prd / spec / methodology 各自独立。v1.0 = 第一阶段 MVP 可发布；v2.0 = 辅形态加入（双形态完整）。

> **v1.18 对账（2026-09-01）**：旧表合计 88 与 §3 逐行数 91 不符。差额来自三行从未进表（Phrase 编辑 v1.4 / 分层化 v1.9 / 固定空间布局 v1.12）与 S1 模块数 5→6（对齐话术 chip 行 v0.2 追认时未改本表），减去旧表把 ADR-017 的「真机验收」计成已数的 1。ADR-027 不单开行，落在 S4 既有分区内（4→5），是刻意归位不是漏记。

---

## §5 测试覆盖目标

> 详细测试策略见 [[11-test-spec]]（W4 待补）。本节定门槛：

| 优先级 | 目标版本时的最低覆盖 | 备注 |
|---|---|---|
| P0 | 单元 ≥80% + E2E 覆盖核心路径 | MVP 前必须达成 |
| P1 | 单元 ≥60% + E2E 覆盖主路径 | 发布前必须达成 |
| P2 | 单元 ≥40% | 发布后 1 个月内补齐 |

**违反**：低于目标但仍标 `verified` → bug，必须降级为 `done` 并补测。

---

## §6 变更日志（追加型，禁止修改历史）

| 日期 | 变更 | 触发 |
|---|---|---|
| 2026-05-19 | features.md v0.1 初版，27 项功能全部 `planned` | W2 实战验证落盘 |
| 2026-05-25 | v0.2 bump：S1 主形态 MVP 5 模块 + 跨模块 6 项 P0 → `done`（ADR-012 Phase 1-3 ship / commit `acf8229`）；新增「对齐话术 chip 行」条目 P0 done（追认 [[013-alignment-phrases-tab-inclusion]]）；status pre-code → in-progress | ADR-012 Phase 4 涟漪 |
| 2026-06-01 | v0.3 bump：新增 §3.7 MCP write pipeline 区（6 支撑能力 + 14 MCP tool，全 `planned`）；§4 节奏表加 M-X 行，合计 27→47 项 | ADR-015 Accepted M-X.0 涟漪 |
| 2026-06-03 | v0.4 bump：§3.7 drafts 数据层 + workspace 4 crate → `done`（repo-core 21 / trybuild 守）；`prompt-hub-mcp` binary + promote 跨表事务 → `in-progress`（skeleton + 4 promote arm done，rmcp/14 tool/IPC 属 M-X.2）| M-X.1 落地 + ADR-015 补遗涟漪 |
| 2026-06-03 | v0.5 bump：§3.7 `prompt-hub-mcp` binary + 14 MCP tool → `done`（rmcp stdio + e2e spawn 测试 / commit `da8b682`+`e58d71a`）；/review 通过（scope clean，无 P0/P1），后补 confidence 有限性+clamp / schema_version 拒绝 / Mutex 中毒恢复 3 项加固 | M-X.2 落地 + /review 收口涟漪 |
| 2026-06-03 | v0.6 bump：§3.7 草稿 tab + 待审 badge + promote 5 Tauri IPC（含 mid-session schema recheck）全 → `done`；§4 M-X 阶段 → `done`（DraftInbox/ScenePanel/SearchBar 前端 + commands.rs schema-guard）| M-X.3 UI 收件箱落地涟漪 |
| 2026-06-03 | v0.7 bump：「复制即隐藏 / ESC 关闭」P0 → `done`（ADR-012 Phase 5 视觉+功能验收 11/11 收口：screencapture 自动化 9/11 + 用户手点 promote/discard 补 2/11；DB 核对 modifier 落 group_kind / alignment_phrase 落 phase / macro 丢弃不入库 / inbox 排空回落 Scene）；ADR-012 Phase 1-5 全链路 done | Phase 5 验收收口涟漪 |
| 2026-06-03 | v0.8 bump：M0-4 Developer ID 签名公证链路收口（M0 四项全绿）——空壳 DMG 走 Developer ID 签名 + hardened runtime + 三项 JIT entitlements → 公证 Accepted → staple → Gatekeeper `accepted/Notarized Developer ID` → release 透明窗口运行时不黑屏；证伪「macos-private-api 与公证冲突」最坏假设；runbook [[m0-4-macos-signing]] | M0-4 收口涟漪 |
| 2026-06-05 | v0.9 bump：新增 §3.8 资产编辑 + 自适应布局区（4 功能：Macro/AlignmentPhrase 编辑+排序 done / Modifier·Composition 后端 done·UI 落点暂缓 / Dashboard 可拖列布局 done）；§4 节奏表加 AE 行，合计 47→51 项 | [[asset-editing-and-adaptive-layout]] P1–P4 收口涟漪 |
| 2026-06-08 | v1.0 bump：§3.8 Modifier/Composition 编辑 UI 落地（原 #3/#4 deferred 项收口），状态 in-progress→done；§4 AE 行 in-progress→done（4/4）；前端测试 75→87（+ModifierGrid 6 / CompositionWorkbench 6） | [[asset-editing-and-adaptive-layout#§7]] #7 落地涟漪 |
| 2026-06-19 | v1.1 bump：新增 §3.9 自动更新区（5 功能：updater 客户端接入 / opt-in 总开关+UI / Vite 加固 / CI 出包 → done，真机验收 → planned）；§4 节奏表加 ADR-017 行，合计 51→56 项 | [[017-enable-auto-update]] 客户端 + CI dry-run 端到端验证收口涟漪 |
| 2026-06-21 | UI 一致性治理（design-spec v0.10 涟漪记录，**非功能矩阵新增**）：诊断主形态风格不一致根因 = 缺共享 primitives 层（9 组件复制 Card/Button/Editor CSS 漂移）；design-spec 落定 §2.2 圆角归一 + §10.2 完整 primitive 清单 + §10.6 Card/List 范式矩阵 + §10.7 Button 形态矩阵 + §11 flash 共享契约。**A 阶段实施（`primitives.module.css` + 9 组件迁移）仍 planned**，待 omar 审 design-spec v0.10 后启动；合计仍 56 项（治理性改动不计入功能数）| design-spec v0.10 UI 一致性治理涟漪 |
| 2026-06-21 | v1.2 bump：§3.10 A 阶段实装收口（primitives 基础层 + 9 组件迁移 + surface/control 迁移 + CSS 裸值 gate，4 功能 → `done`，110 前端零回归）；§4 节奏表加 UI 一致性治理行，合计 56→60 项 | design-spec v0.10 A 阶段 primitives 迁移落地涟漪 |
| 2026-06-22 | v1.3 bump：UI 减负——主仪表盘移除 Composition/Modifier 编辑面板（删 ModifierGrid/CompositionWorkbench 组件 + 测试，Tab cycle 8→6）。§3.8 Modifier/Composition 编辑 → `withdrawn`；§3.10 editor 簇迁移行删两组件、测试 110→94；§4 AE 行 4→3 功能，合计 60→59。**不改 [[02-constitution#B1]]**：资产类型/数据层/promote 分支保留（选项 2「保本体·收 UX」）。涟漪 [[03-product-spec]] v0.9 | 资产分类复盘（外部最佳实践 + 内部立意调研收敛）→ 选项 2 执行 |
| 2026-06-23 | v1.4 bump：§3.8 新增「Scene 话术（Phrase）编辑」→ `done`——镜像 AlignmentPhrase 编辑模式，补 forward-only migration（schema 8→9）加 per-(scene,sub_stage) `order_index`，repo-write `phrases.rs` 4 写函数 + 12 测试，4 IPC，ScenePanel 编辑态（每 SubStage 组独立 DnD + 子阶段下拉）。后端 55 测试 / 前端 94 测试全绿。涟漪 [[03-product-spec]] §13.3 区域 4 行为 | [[scene-phrase-editing]] M1+M2 收口涟漪 |
| 2026-06-25 | v1.5 bump：新增 §3.11 Promptscape 设计吸收区（6 功能 → `done`：主题三态外观系统 / 中性强调色 / 设置弹窗 / slim Header / ProtocolBand / 任务层 3→2 列全景）；§4 节奏表加 Promptscape 行，合计 59→65 项。B2 复检通过（accent 只染中性强调面，`:root.accent-*` 物理隔离）；A2 不出站（外观偏好 persist localStorage）。涟漪 [[03-product-spec]] v0.10 / [[05-design-spec]] v0.11 / [[016-choose-dnd-and-resizable-layout]] 补遗 | [[018-absorb-promptscape-design]] 吸收落地涟漪 |
| 2026-06-26 | 文档涟漪（**非功能矩阵新增**）：ADR-019 推翻 flat 视觉锚点（omar 拍板 Option A——引入 subtle elevation + 放弃颜色本体论）。「协议层与任务层物理分离」条备注更新（视觉区分改靠位置+形状，B2 仍为纯结构铁律，状态不变）；ADR-012 标 Superseded。design-spec v0.11→v0.12 / CLAUDE-DESIGN v0.1→v0.2（待重传）/ tokens.css 加 `--shadow-*`。组件 CSS 改造另行落地。合计仍 65 项 | [[019-supersede-flat-visual-anchor]] Option A 落地涟漪 |
| 2026-06-27 | v1.6 bump：§3.8 新增「Scene/SubStage 结构编辑」→ `done`，补齐 [[scene-phrase-editing]] 当初 defer 的另一半（D1 Scene+SubStage CRUD / D2 seed `0011` 灌示范 SubStage / D3 Tauri-only / D4 删非空 Scene 阻止 · 删 SubStage 解绑 Phrase）。无 schema migration（表已存于 `0001`，唯一 migration 是纯 seed `0011`，user_version 10→11）；repo-write `scenes.rs`/`sub_stages.rs` 各 CRUD+reorder + 19 单测，8 IPC，ScenePanel 编辑态加 Scene 增改名删 + SubStage 增改名删 + 空子阶段可见。后端 74 测试 / 前端 109 测试全绿（clippy/fmt/lint/prettier clean）；**真机 CRUD 落盘待验**。契约现成（[[06-prd#6.4]] 已定 Scene/SubStage 字段+FK+删除语义，本次补「写入口=UI 编辑态」指派 + product-spec §13.3 结构编辑契约），不开新 ADR。§4 节奏表加结构编辑行，合计 65→66 项 | [[scene-substage-editing]] 收口涟漪 |
| 2026-07-06 | v1.9 bump：§3.8 新增「Scene 编辑分层化」→ `done`——废除 ScenePanel 全局 editMode（1706→949 行，删 SceneStructureEditor 等 4 组件 + Scene 链路 dnd，@dnd-kit 留 MacroGrid/AlignmentPhrases），拆三层就地编辑：属性面板（PRD §6.4 icon/color/rolePresets 三字段首获 UI 承载 + 场景移动/删除收编）/ 子阶段列头动作簇（改名/←→交换/删 + ghost 新增列）/ 话术卡动作簇（原位编辑/↑↓交换/删 + ghost 添加卡，`stopPropagation` 守 copy 主动作）；空子阶段视图态常显；新建场景迁 tabs 尾＋并自动开属性面板。**零后端/IPC/MCP 改动**。前端 222 测试全绿（12 格实体×CRUD 矩阵逐格钉死 + 异步失败路径 + 键盘可达），cargo --workspace 全绿；scene.color 用户内容色定性**待 omar 复核**（否决降级仅存储）；真机观感（空列密度/icon 染色/hover 显隐）列复验批次。合计 78→79 项。涟漪 [[03-product-spec]] v0.14 / [[05-design-spec]] v0.14 | [[021-scene-layered-editing]] · plan [[scene-layered-editing]] 收口涟漪 |
| 2026-07-01 | v1.8 bump：新增 §3.12 产品走查修缮批次（12 功能 → `done`：Draft 促升前编辑 +get_draft IPC / composition promote 暂缓止血 / Modifier 移象限+删除管理簇 / AlignmentPhrase 设为默认 / Scene·SubStage 排序 UI / 复制失败可见+Toast intent 分级 / 更新失败 auto-manual 分级+Dashboard 重试 / 启动 DB 失败兜底对话框 / 暗 band 恢复 ADR-020 / light 明度重绘+resting elevation / Scene auto-fit+未分组列头 / 设计稿像素对齐包；另 7 项质量/治理不计数：测试 CI ci.yml / B2 源码 gate 恢复 / IPC 三方契约 gate / typography preset 落地+token 收敛 / primary 对比度修复+token-gate 新规 / focus 可见补齐 / bench C1 退出码）；§3.7 IPC 行注 5→6（+get_draft）；§4 节奏表加修缮批次行，合计 66→78 项。前端最终 151 测试 / cargo --workspace 全绿。涟漪 [[05-design-spec]] v0.13 / [[03-product-spec]] v0.13 / [[06-prd]] v0.12，暗 band 锚点 [[020-restore-protocol-dark-band]] | 2026-07-01 产品走查修缮批次收口涟漪 |
| 2026-07-12 | v1.10 bump：新增 §3.13 UX 任务流批次 A（6 功能 → `done`：显式整理模式 D-0 / promote 落地定位 A1-03 / discard 可撤销 A1-04 / 保存 toast A1-07 / ⌘Enter 统一 A1-08 / footer wrap A3-02）；§4 节奏表加批次 A 行，合计 79→85 项（附带修正 §4 合计行 2026-07-06 漏更的 78→79）。前端 301 测试（+24）/ cargo --workspace 147 全绿，verifier 对抗审查 PASS；NEEDS HUMAN 4 项真机待验，确认前整理模式不入对外发布说明。涟漪 [[03-product-spec]] v0.15（新增 §4.0.7 交互模式契约 + §4.3 整理态行 + §4.4 三条新反馈）；同日 [[022-cross-scene-phrase-move]] Accepted（子决策 2 = 双路径共存，批次 B 启动）| 2026-07-12 UX 任务流审计批次 A 收口涟漪 |
| 2026-07-12 | v1.11 bump：新增 §3.14 UX 任务流批次 B（1 功能 → `done`：跨 Scene/跨子阶段话术移动 `move_phrase` + MoveReceipt 撤销 + 分层选择器，A1-01/A1-06 收口）；§4 节奏表加批次 B 行，合计 85→86。前端 308→309 测试 / cargo 155 全绿，verifier 对抗审查 PASS（P2 空移动已修：同目标确认禁用）；真机移动/撤销链路待验。涟漪 [[03-product-spec]] v0.16 §13.3 移动动作契约（双路径语义等价显式记档） | [[022-cross-scene-phrase-move]] 批次 B 收口涟漪 |
| 2026-08-20 | v1.14 bump：§3.8 新增「统一锚定编辑容器」→ `done`（ADR-025 的 P0+P1-a+P1-b）——编辑器脱离宿主文档流改原生 `popover` top layer 锚定，四个编辑面共用 `AnchoredEditor`+`PhraseFormEditor`；Macro / 草稿两份手搓表单删除收编（净删约 180 行，各自重复实现过草稿状态/autofocus/IME 护栏/提交键）；顺带修掉两处 P1-a 既存缺陷（超高面板 footer 出界 → `maxHeight` 按 frame 相对上报；焦点后代卸载后 Esc 失聪）。**零后端/IPC/schema 改动**。前端 373 全绿 / cargo 158 全绿；**真机验收门 G1 六项 + P1-b 门两项全通过**，项 5 与项 2-B 首取 AI 侧逐像素证据（P1-a 三轮 135 帧从未拍到浮层，改窗口 ID 定向 + 按需截图后一次拍中）。**清单纠偏**：ADR 原写「其余五个编辑面」，核实后只有 4 个（`RecentList` 无编辑器，属 P2 键盘层口径被误收）。§4 节奏表加 ADR-025 行，合计 86→87 项。**P2 键盘动作层 + P3 合流未落地**，G2 五项未跑。涟漪 [[03-product-spec]] v0.19（新增 §13.3 编辑容器统一契约 + §13.4 两行快捷键）/ [[05-design-spec]] v0.18（新增 §2.6 层叠标尺 + §10.2.2 `AnchoredEditor` 接口契约）/ [[11-test-spec]] v0.3 | [[025-unified-anchored-editing]] P1 收口涟漪 |
| 2026-08-20 | v1.15 bump：§3.4 新增「全局唤起键可配置」→ `done`（ADR-027）——**销一笔自 product-spec v0.5 起挂了三个月的账**：§13.4「⌥ Space 默认值，可配置」在册，实现一直硬编码于 `lib.rs:165`。绑定改存 SQLite `settings` 表（migration `0012`，`user_version` 11→12）而非 localStorage——唯一理由是 Rust 在 `setup()` 注册快捷键时 webview 尚不存在；localStorage 方案会让每次启动必然先错误注册一次，而改键者正是默认键冲突的那批人。新增 `get_global_hotkey`/`set_global_hotkey` 两 IPC（51→**53**），改绑走「校验→注销旧→注册新→落库」并在任一步失败回滚。**顺带修掉「点 Dock 图标无反应」**——`RunEvent::Reopen` 既是该 bug 的修复，也是「把自己锁在门外」的逃生口。前端 373→**395** / cargo 158→**168** 全绿，lint/tsc/build/clippy/fmt clean，`bench:hotkey-wake` p95 `13.708ms` 无回归。§4 节奏表 S4 行 4→5 功能，合计 87→**88** 项。**G3 四项未跑**，其中 reopen 逃生口与重启持久化 jsdom/CI 均不可验。涟漪 [[03-product-spec]] v0.20（§13.3 区域 9 快捷键页 + 设置持久化归属表 + §13.4 两行）/ [[06-prd]] v0.13（§5.8 补项 + 新增 §6.8-bis Setting）/ [[11-test-spec]] v0.4 | [[027-configurable-global-hotkey]] 收口涟漪 |
| 2026-08-20 | v1.16 bump：§3.4「全局唤起键可配置」补**冲突提示**（omar 走查后拍板）——真机证明冲突有两种形态，而只有一种能报错：`register()` 被拒会报「已被占用」，但**更常见的是按键压根没到**（占用方在系统层截走），此时既无错误也无反应，用户只看到「按下去没反应而另一个应用跳出来」。判据不用计时器（会误伤犹豫的用户），用「**修饰键按下又抬起、期间没收到任何主键**」。前端 395→**398**。**G3 项 2 由「不可达」转为「通过」**——该场景补上提示后才终于可观测。涟漪 [[03-product-spec]] v0.21（§13.3 区域 9 冲突形态改写）/ [[11-test-spec]] v0.5 | omar 走查裁决（不新开 ADR：单选项、可逆、不改已批子决策）|
| 2026-08-20 | v1.17 bump：ADR-026 两项遗留裁决落地——① **层标记 pill 减二留一**：删 `ProtocolBand`「协议层」+ 任务列「任务层」（层级已由位置+形状冗余编码，文字属解释性 UI），**保留 `ModifierGrid`「协议层 · 参考」**（aside 列无 band 无位置线索，唯一标识，删了真丢信息）——**三枚不是一组对称装饰，其中一枚承重**；② **SOP 退出 Tab cycle**，区域级 6 站→**5 站**：占位区在屏（哲学二）但不值一个键盘停靠点，键盘用户每轮都要在「第三阶段实现」上白停一次，真导航器落地时 `tabIndex` 随它回来。398 测试全绿（`App.test.tsx` 区域 tabindex 断言由 6 改 5 并显式钉「在屏但不可 Tab」）。涟漪 [[03-product-spec]] v0.22 / [[05-design-spec]] v0.19 | omar 裁决（[[026-fixed-spatial-layout]] 当初显式不裁的两项）|
| 2026-06-28 | v1.7 bump：§3.4「数据导入导出（JSON）」`planned`→`done`——repo-core `export.rs`（全保真聚合，独立无过滤 SELECT 以纳入弃用/隐藏行，data schema_version `1.1`，**不含 usage_records**=决策 D2）+ repo-write `import.rs`（**整库替换**=决策 D1，`defer_foreign_keys` 破 phases↔alignment_phrases FK 环，按 major 版本拒不兼容备份）；2 path-based Tauri IPC（`export_data`/`import_data`，前端 dialog 选路 + Rust `std::fs` 读写，避开 fs-plugin scope）；接 `tauri-plugin-dialog`（决策 D3）；SettingsModal 新增「数据」页（导出 save dialog / 导入 open dialog + 整库替换确认弹窗 + 完成后 `refreshAll`）。后端 export 3 + import 5 单测，前端 109 测试全绿（clippy/fmt/lint/prettier clean）；**真机导入导出待验**。B2 复检通过（导出/导入按表搬运，不混协议层与任务层）；A2 不出站（仅写用户选定本地路径）。涟漪 [[06-prd#6.9]] | 数据导入导出功能收口涟漪 |
| 2026-09-01 | v1.18 bump（**对账，不含新功能**）：① §4 节奏表补三行（Phrase 编辑 v1.4 / Scene 编辑分层化 v1.9 / 固定空间布局 v1.12）+ S1 模块数 5→6 + 显式计数规则，合计 88→**91**（按 §3 逐行重数，非累加）；② §4 S1 行 `planned`→`in-progress`（六模块自 v0.2 起全 `done`，本表三个月未改）；③ §3.9「真机验收」`planned`→`done`（ADR-017 Phase 6 2026-08-20 随 v0.2.0 发布实测通过），§4 ADR-017 行 4/5→5/5；④ §3.6 唤起 P95 由失效的 10.49ms 改 13.708ms；⑤ §7 从 ADR-012 时代（57/57）重写为当前基线（398 / 168 / v0.2.0）并**首次点名 §1 `verified` 铁律缺口**待 omar 裁决；⑥ 头部导语与覆盖率列口径说明更新。同批：prd / ops-spec / user-flows / spec 四份 `status: pre-code` 转出（v0.2.0 已发布，pre-code 不再成立）| 2026-09-01 文档对账日（全面评价建议 1）|
| 2026-09-01 | v1.19 bump（**人审批次 ① 裁决落地**）：① §1 `verified` 判据修订——旧判据「E2E 通过 + 使用者 ≥1 周」不可满足（Playwright 未落地，test-spec §4 明写），新判据 = 真机门或持续自动化 gate 留证 + 进过 publish release + 自用 ≥1 周无回归；② 铁律引用 [[01-spec#10.5]]「验收节奏」判为**失效引用**（该节实为「多人使用的可能性」，spec 全文无「验收节奏」），改指 [[11-test-spec#4.1]]；③ 按新判据逐行核对：**37 行 `done`→`verified`**（3.1 四区 / 3.4 唤起键可配置 / 3.6 六行 / 3.7 十七行 / 3.8 三行 / 3.9 五行 / 3.10 裸值 gate），39 行缺留证保持 `done`；④ §7 新增留证索引 + 缺口清单（升 `verified` 必须登记）。矩阵计数 91 不变。v0.2.0 后零代码 commit，全部 `done` 行均在已 publish 的 release 内 | omar 拍板「改规则，然后逐个标」（2026-09-01 人审批次 ①）|
| 2026-09-02 | v1.20 bump（**G4 真机走查落账**）：按 §1 新判据补留证——发布形态（`pnpm tauri build --no-bundle` 裸 release 二进制 + 隔离 `HOME` + MCP 造草稿）覆盖 §7 缺口清单，24 门项 21 通过 / 3 不可达（W13 窄 Header · W20 复制失败 · W22 更新失败路径）。**32 行 `done`→`verified`**（3.1 ×2 / 3.4 / 3.7 ×3 / 3.8 ×5 / 3.10 ×3 / 3.11 ×6 / 3.12 ×7 / 3.13 ×4 / 3.14），7 行保持 `done`。**三个真实缺陷**记入 [[HANDOFF]]：D1 锚定编辑器 autofocus 不生效（`AnchoredEditor` 在定位前 `visibility:hidden`，子组件 `focus()` 静默失败；jsdom shim 不模拟可见性所以 373 测试全绿）· D2 设置弹窗 Esc 连仪表盘一起隐藏 · D3 数据库损坏时阻断式对话框从不出现（`fail_startup` 在后台线程 `blocking_show`）。另答 HANDOFF 第 21 项附带疑问：窗口隐藏期间 MCP 写入的草稿，唤起**不刷新** badge，导入后 `refreshAll` 才刷新。走查记录与门项表见 [[11-test-spec#4.3]] | 2026-09-02 G4 真机走查 |
| 2026-09-02 | v1.21 bump（**D1 修复留证**，矩阵状态不变）：`AnchoredEditor` 新增 `initialFocus` prop，首焦点改在定位后的 layout effect 触发，`PhraseFormEditor` 锚定形态与 `ScenePropertiesEditor` 改走该路径；jsdom shim 补「隐藏元素拒绝 focus」规则——此前 373→398 全绿而 D1 始终在，补规则后 6 条既有用例变红，修后 405 全绿（+7 回归：时序门「`anchor=null` 不聚焦、到位后才聚焦」/ 重定位·换锚点不重聚焦 / shim 三路径自检 / inline 挂载聚焦 + 属性面板首焦点）。**零后端 / IPC / schema 改动**。§7 留证索引 3.8 行与 G4 段落补记；**W3 发布形态复跑待做**，通过后 HANDOFF 第 23 项闭合。涟漪 [[11-test-spec]] v0.7 / [[05-design-spec]] v0.21（§10.2.2 接口契约第 5 条） | HANDOFF 第 23 项 |

---

## §7 当前阶段说明（in-progress · v0.2.0 已发布 · 2026-09-01 对账）

- **当前基线**（2026-09-01 本机实测，`main` @ `9fc9fad`）：Vitest **398/398**（39 文件）/ `cargo test --workspace` **168** / lint · tsc · build · clippy · fmt 全绿 / doc-governance 0 error 6 warn / `bench:hotkey-wake` p95 13.708ms（2026-08-20）
- **已发布**：v0.1.0（2026-08-05 draft，公证被静默跳过未 publish，见 [[2026-08-05-notarization-fail-open]]）/ v0.1.1（2026-08-10）/ **v0.2.0（2026-08-20，Developer ID 签名公证 + 自动更新链路真机跑通）**
- **状态分布**（§3 逐行，§3.12 治理项 7 行不计）：`verified` **69** / `done` **7** / `in-progress` 1 / `planned` 14 / `withdrawn` 1（不计）→ 计数 91，与 §4 一致（2026-09-02 G4 走查后 37→69 / 39→7）
- **G4 真机走查（2026-09-02，v1.20）**：按发布形态（`pnpm tauri build --no-bundle` 裸 release 二进制 + 隔离 `HOME`）覆盖下表缺口清单，24 门项 21 通过、3 不可达、**发现三个真实缺陷**（D1 锚定编辑器打开后 autofocus 不生效 · P1 / D2 设置弹窗 Esc 连仪表盘一起隐藏 · P2 / D3 数据库损坏时阻断式对话框从不出现 · P1），明细见 [[11-test-spec#4.3]]；32 行升 `verified`，7 行保持 `done`（其中 1 行因缺陷未通过）。**D1 已修（v1.21，同日第二笔）**：jsdom 回归 +7，发布形态 W3 复跑待做
- **§1 `verified` 判据已修订（v1.19，omar 2026-09-01 拍板）**：旧判据「E2E 通过 + 使用者 ≥1 周」不可满足（Playwright 未落地），且铁律引用的 [[01-spec#10.5]]「验收节奏」在 spec 里并不存在。新判据见 §1；按新判据逐行核对留证，37 行升 `verified`、39 行因缺留证保持 `done`。**留证索引与缺口清单见下**——它同时是下一次真机走查的待办面
- **下一动作**：见 [[HANDOFF#Next-Actions]]

**`verified` 留证索引（v1.19 起维护；升 `verified` 必须在此登记）**：

| §3 行 | 留证 |
|---|---|
| 3.1 相位带 | ADR-026 走查项 3（等宽后活动相位醒目度，2026-08-19）+ ADR-025 P0 落地 |
| 3.1 对齐话术 chip 行 | G1 项 2（chip 行滚动跟随：A 半 jsdom 5 条反向验证 + B 半 omar 目视，2026-08-19） |
| 3.1 Macro 快捷区 | ADR-026 走查项 1（纵向下限 `132px` 合成拖拽至极限） |
| 3.1 Scene 全景区 | ADR-026 走查项 1 + Scene 下限 `288px` 真机复测（2026-08-19）+ P1-b 门项 2（纵向滚动跟随） |
| 3.4 全局唤起键可配置 | G3 四项全通过（2026-08-20，[[11-test-spec#4.2]] 逐项证据） |
| 3.6 全局快捷键注册 | M0 runbook + G3 项 1（旧键不再唤起）/ 项 4（重启后绑定读自 SQLite） |
| 3.6 主形态唤起 ≤200ms | `bench:hotkey-wake` p95 13.708ms（2026-08-20，G1 项 6 同口径） |
| 3.6 复制即隐藏 / ESC | ADR-012 Phase 5 11/11（2026-06-03）；此后每轮真机走查都以 hide-on-copy / hide-on-blur 为操作约束（[[learnings]] B.1），行为持续在真机被观察 |
| 3.6 协议层与任务层物理分离 | `b2-separation.test.ts` 源码级 gate（CI 持续） |
| 3.6 本地数据存储 | G3 项 4（真实进程重启 + 真实 app data 目录，数据落 SQLite） |
| 3.6 设计 Token 系统 | `token-gate.test.ts`（CI 持续，18 file scan） |
| 3.7 drafts 数据层 / `prompt-hub-mcp` binary / workspace 拆分 / 14 MCP tool | `prompt-hub-mcp tests/e2e.rs` 真实进程 JSON-RPC 端到端（CI 持续）+ trybuild compile_fail |
| 3.8 Dashboard 可拖列布局 | v1.1 手测拖拽+持久化 ✓ + ADR-026 走查项 2（Separator 命中与光标） |
| 3.8 固定空间布局 | ADR-026 走查三项 + `288px` 复测 |
| 3.8 统一锚定编辑容器 | G1 六项 + P1-b 门两项（含逐像素证据） |
| 3.9 五行（客户端 / opt-in UI / Vite 加固 / CI 出包 / 真机验收） | Phase 6：已装 0.1.1 → 发现 0.2.0 → 下载安装 → 重启 → 签名链复验（2026-08-20）；Vite 加固另有 `envPrefix` 源码锁 |
| 3.10 CSS 裸值 gate | `token-gate.test.ts`（CI 持续） |
| 3.1 搜索区 / 最近使用区 | G4 W1–W2（2026-09-02）：⌘K 聚焦 → 分组结果 → Enter 复制并隐藏，`usage_records` +1、剪贴板核对；同资产复制两次最近区去重为 1 条、空态文案 |
| 3.4 数据导入导出 | G4 W24：导出文件 11.8 KB 十表无 `usage_records`；SQL 篡改后导入整库替换回滚、`settings` 表保留、`refreshAll` 清空最近区并刷新 badge |
| 3.7 草稿 tab / 待审 badge / promote IPC | G4 W8–W10：MCP 造 3 条草稿 → badge「3 条待审」+ 草稿 tab 最左；编辑水合 → `update_draft` 落库；归档 → `alignment_phrases` +1 且草稿 `discarded`；丢弃 → 撤销回 `pending`；composition 草稿归档 / 编辑禁用、丢弃可用 |
| 3.8 Macro / AlignmentPhrase / Phrase 编辑 · Scene/SubStage 结构编辑 · 分层化 | G4 W3–W7：每步 SQL 反查——Macro 新建 / 改名 / 删除；对齐话术新建 / 设为默认（`phases` 指针同步）/ 改内容；话术新建 / 上移 / 改名 / 删除；子阶段新建 / 改名 / 删除解绑；Scene 改名 / 颜色 `#2f9e6e` / 角色预设 / 前移 / 删非空被阻止（琥珀 toast）/ 新建空场景自动开面板 / 删空场景。**附带缺陷 D1**：四个锚定编辑面打开后名称框未获焦点——**已修**（`AnchoredEditor.initialFocus`，jsdom 回归 +7，W3 复跑待做） |
| 3.10 primitives / editor 簇 / surface-control | G4 截图 R03–R09：共享 `PhraseFormEditor` 五件套、`ConfirmInline`「永久删除? ✓ ✕」、DraftCard 中性 CardSurface + ghost Button 在发布形态渲染并可操作 |
| 3.11 主题三态 / 强调色 / 设置弹窗 / slim Header / ProtocolBand / 2 列 | G4 W16–W19：首启默认深色（canvas `14,14,16`）、浅色 `#F2F2F0`、跟随系统随 OS 外观翻转、重启保留（localStorage `themeMode`）；强调色绿 / 蓝 / 中性像素采样 logo 与 Macro 芯片同步、Scene 图标不变；`⌘,` 唤起、× 关闭、密度 56→44 逻辑像素列扫描实测；Header / 暗 band / 2 列布局截图 R00。**附带缺陷 D2**：弹窗内 Esc 连仪表盘一起隐藏 |
| 3.12 Draft 编辑 / Composition 暂缓 / 设为默认 / 暗 band / light 明度 / auto-fit / 像素对齐包 | G4：同上各项；暗 band + `ModifierGrid`「协议层 · 参考」pill + 最近区中性徽标（R00）；light 明度 muted canvas + 白卡（R16c）；调研场景两列 auto-fit + 「未分组」列头（R07b）；Macro 图标盒 accent 填充 + 最近区富空态（R24i） |
| 3.13 整理模式 / promote 定位 / discard 撤销 / ⌘Enter | G4 W12–W15：整理态整卡点击展开预览、窗口驻留、usage 不计；连续点两张卡切换选中；长话术展开不溢出列；显式复制按钮 usage +1 且不隐藏；撤销 toast 存活 5.4–6.4 s（`action: 6000`）；归档后新 chip 落到当前相位；名称框 Enter 推进到正文、⌘Enter 提交 |
| 3.14 跨 Scene 话术移动 | G4 W11：移到目标 Scene / 子阶段 → 落分区末尾（order 3）→ 撤销回原 Scene / 未分组 / order 2；不计 usage |

**留证缺口（7 行保持 `done` 的原因；G4 走查后 39 → 7）**：

| §3 行 | 缺什么 |
|---|---|
| 3.12 Modifier 最小管理簇 | 种子库无 Modifier，G4 未能构造移象限 / 删除场景 |
| 3.12 Scene / SubStage 排序 UI | Scene 前移已验；SubStage ←→ 交换因只有一个子阶段未能触发 |
| 3.12 复制失败可见 + Toast 分级 | 剪贴板失败无法构造（G4 W20 不可达） |
| 3.12 更新检查失败分级 | manual 成功路径已验（「已是最新版本」）；失败路径需断网，未构造 |
| 3.12 启动 DB 失败优雅兜底 | **G4 W21 未通过（缺陷 D3）**：损坏库启动后对话框从不出现、进程静默存活，裸二进制与发布 `.app` 均复现 |
| 3.13 话术保存成功 toast | 800 ms 成功 toast 在截图节奏下未拍到，缺留证 |
| 3.13 编辑器 footer flex-wrap | 需窄宽度，主形态窗口恒等于显示器宽（G4 W13 不可达） |

> 前四行是「构造不出」，最后两行是「拍不到 / 达不到」，只有 D3 一行是真失败。补法：Modifier 与 SubStage 两行需要更丰富的种子数据；复制失败与更新失败需要故障注入；footer wrap 与保存 toast 靠 jsdom 断言即可闭合（不必真机）。

**同步约定**（v0.3+ 启用，v1.18 修订）：
- 每次 commit 主分支后**手动**同步本清单状态（原设想的 `scripts/update-features.sh` 从未落地）
- 覆盖率列的全量测试数**不再逐行追更**（会立刻过期），全量基线只在本节维护；单元覆盖率待 vitest coverage report 接入后填
- 责任人字段单人项目暂时全为 `omar`，多人协作时按 commit author 自动填
