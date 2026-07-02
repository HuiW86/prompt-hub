---
type: features
project: prompt-hub
version: v1.8
created: 2026-05-19
last_modified: 2026-07-01
status: in-progress  # S1 进行中（M0 四项全绿）；进度叙事见 §4 节奏表与 CHANGELOG
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
---

# Features: prompt-hub

> 功能清单的**运营视图**。回答「现在有什么、做到什么程度、测得怎么样」。
> **不重复 prd**：本文件只承载状态/覆盖率，功能定义见 [[06-prd#5]] 各章节。
> **不替代 issue tracker**：单条 bug / task 走 git history，本文件追全局功能层面。
>
> ✅ **当前 S1 in-progress（ADR-012 Phase 1-5 全 done）**：5 模块 + 7 跨模块 P0 已 done（commit `acf8229`）；Phase 4 spec 涟漪已落、Phase 5 视觉+功能验收 11/11 收口（2026-06-03）。
> 覆盖率列暂以「55 集成测试 / 单元未量化」表达，待 [[11-test-spec]] 启动后量化。

---

## §1 状态定义

| 状态 | 含义 | 触发 |
|---|---|---|
| `planned` | 已立项，未开始编码 | spec / prd 收录 |
| `in-progress` | 编码中 | 第一个 commit 提交 |
| `done` | 编码完成，本地跑通 | PR merged to main |
| `verified` | 测试覆盖达标，已上线给真实使用者 | E2E 通过 + 使用者使用 ≥1 周 |
| `deprecated` | 已废弃，待移除 | 开 ADR 决议废弃 |

**铁律**：已发布到生产（自用）的功能必须 `verified`，否则违反 [[01-spec#10.5]] 验收节奏。

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
| 搜索区（⌘K 全局搜索） | P0 | `done` | v1.0 | 55 集成 / 单元未量化 | omar | [[06-prd#5.0]] |
| 相位带（Phase Bar） | P0 | `done` | v1.0 | 55 集成 / 单元未量化 | omar | [[06-prd#5.1]] |
| 对齐话术（AlignmentPhrases）chip 行 | P0 | `done` | v1.0 | 55 集成 / 单元未量化 | omar | [[013-alignment-phrases-tab-inclusion]] |
| Macro 快捷区 | P0 | `done` | v1.0 | 55 集成 / 单元未量化 | omar | [[06-prd#5.2]] |
| Scene 全景区 | P0 | `done` | v1.0 | 55 集成 / 单元未量化 | omar | [[06-prd#5.3]] |
| 最近使用区 | P0 | `done` | v1.0 | 55 集成 / 单元未量化 | omar | [[06-prd#5.5]] |

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
| 数据导入导出（JSON） | P1 | `done` | v1.3 | repo-core export 3 test + repo-write import 5 test（含整库替换 / 含弃用行 / 拒不兼容 major / FK 原子回滚）；前端 SettingsModal 数据页（save/open dialog + 整库替换确认弹窗）；不导出 usage_records（决策 D2）/ 整库替换（决策 D1） | omar | [[06-prd#6.9]] |
| 主形态界面布局可配置 | P1 | `planned` | v1.3 | 0% | omar | [[01-spec#2.9]] |

### 3.5 辅形态副屏（S5 / 第五阶段）

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | prd 引用 |
|---|---|---|---|---|---|---|
| 副屏常驻窗口 | P2 | `planned` | v2.0 | 0% | omar | [[prompt-hub-mvp#第五阶段]] |
| 月度 review 视图 | P2 | `planned` | v2.0 | 0% | omar | [[prompt-hub-mvp#第五阶段]] |
| 副屏 Composition 侧栏 | P2 | `planned` | v2.0 | 0% | omar | [[prompt-hub-mvp#第五阶段]] |

### 3.6 跨模块能力（非单模块功能）

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| 全局快捷键注册（默认 ⌥ Space） | P0 | `done` | v1.0 | M0 手动 verified | omar | [[prompt-hub-mvp#第一阶段]] |
| 主形态唤起 ≤200ms（P95） | P0 | `done` | v1.0 | M0-3 实测 P95=10.49ms ✓ | omar | [[02-constitution#C1]] |
| 复制即隐藏 / ESC 关闭 | P0 | `done` | v1.0 | Phase 5 视觉+功能验收 11/11 ✓（2026-06-03） | omar | [[prompt-hub-mvp#第一阶段]] |
| UsageRecord 持续记录 | P0 | `in-progress` | v1.0 | 数据层 done / 链路待 S2 | omar | [[06-prd#6.8]] |
| 三层资产模型（Modifier/Composition/Macro） | P0 | `planned` | v1.0 | 0% | omar | [[02-constitution#B1]] |
| 协议层与任务层物理分离 | P0 | `done` | v1.0 | 结构分离落地（B2 纯结构）；视觉区分自 ADR-019 改靠位置+形状（弃颜色本体论）/ 数据层待 S2 | omar | [[02-constitution#B2]] |
| 本地数据存储（无服务端） | P0 | `done` | v1.0 | M0-3 SQLite 落盘 / cargo 12 测试 ✓ | omar | [[02-constitution#A2]] |
| 设计 Token 系统（无裸值） | P0 | `done` | v1.0 | Phase 1-3 全量 token 化 ✓ | omar | [[prompt-hub-mvp#§0-T1]] |

### 3.7 MCP write pipeline（M-X / 反向 AI 写入）

> 第二阶段能力：让 Claude Code 通过 MCP stdio 把对话产出的提示词资产写入 drafts 收件箱，omar 在 Scene 草稿 tab 显式 promote 入正式表。决策见 [[015-expose-mcp-write-pipeline]] Accepted，实施步骤见 [[mcp-write-pipeline]] v0.2，接口契约见 [[06-prd#10]]。
>
> 边界 reaffirm：本区不违反 [[06-prd#8.2]] N2/N3——外部 AI 调本工具（方向相反）+ promote 仍需 omar 显式点击。

#### 支撑能力

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| drafts 收件箱数据层（migration 0003 + payload_hash 去重）| P1 | `done` | v1.1 | repo-core 21 test | omar | [[06-prd#10.1]] |
| `prompt-hub-mcp` binary（rmcp 1.7 stdio + tracing→stderr）| P1 | `done` | v1.1 | mcp crate 14 test（8 unit + 5 e2e spawn JSON-RPC + 1 trybuild）；/review 后补 confidence/schema_version 信任边界 + Mutex 恢复 | omar | [[06-prd#10.0]] |
| Cargo workspace 4 crate 物理拆分（编译期写入隔离）| P1 | `done` | v1.1 | trybuild compile_fail | omar | [[09-tech-stack#4.3.1]] |
| Scene 全景区「📥 草稿」tab（promote/discard + Modifier 四象限 popover）| P1 | `done` | v1.1 | promptStore 7 test + App e2e（草稿 tab + DraftInbox 卡片）| omar | [[06-prd#10.3]] |
| 主形态顶部待审 badge（仅 N>0 显示，跳转收件箱，排除 Tab 循环）| P1 | `done` | v1.1 | App e2e render（badge 条件渲染）| omar | [[06-prd#10.3]] |
| promote 跨表事务（4 类 arm）+ 5 Tauri IPC（promote/list/count/update/discard）+ mid-session schema recheck（v1.8 起 +`get_draft` 共 6 IPC，见 §3.12）| P1 | `done` | v1.1 | repo-write 9 test（4 promote arm）+ commands schema-guard 2 test + count_pending 1 test | omar | [[06-prd#10.2]] |

#### 14 MCP tool（5 CRUD + 3 helpers + 6 read）

| 类别 | tool | 优先级 | 状态 | 目标版本 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| CRUD | `create_draft` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.1]] |
| CRUD | `list_drafts` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.1]] |
| CRUD | `get_draft` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.1]] |
| CRUD | `update_draft` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.1]] |
| CRUD | `delete_draft` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.1]] |
| Helper | `bootstrap_from_markdown` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.2]] |
| Helper | `save_conversation_as_macro` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.2]] |
| Helper | `import_json`（6 条加固）| P1 | `done` | v1.1 | omar | [[06-prd#10.4.2]] |
| Read | `list_phases` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.3]] |
| Read | `list_alignment_phrases` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.3]] |
| Read | `list_modifiers` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.3]] |
| Read | `list_compositions` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.3]] |
| Read | `list_macros` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.3]] |
| Read | `list_scenes` | P1 | `done` | v1.1 | omar | [[06-prd#10.4.3]] |

### 3.8 资产编辑 + 自适应布局（AE / asset-editing plan）

> 来源 [[asset-editing-and-adaptive-layout]] plan（P1–P4）+ [[016-choose-dnd-and-resizable-layout]]。摆脱「只读 + 仅草稿流水线」，4 类资产可直接编辑 + 区域内拖动排序；Dashboard 列宽从固定 grid 改为可拖 + 持久化。
>
> 边界 reaffirm：只做「区域内排序 + 区域尺寸可调」，不做跨区域自由拖放 / 跨类型拖动（守 [[02-constitution#B2]]，plan §1 非目标）。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| Macro 编辑（增删改名/改内容）+ dnd-kit 拖动排序（`order_index` 持久化）| P1 | `done` | v1.1 | 73 前端 / repo-write reorder | omar | [[asset-editing-and-adaptive-layout#P1]] |
| AlignmentPhrase 编辑面板（edit-mode toggle + dnd 排序，per-phase `order_index`）| P1 | `done` | v1.1 | 73 前端 | omar | [[asset-editing-and-adaptive-layout#P2]] |
| Scene 话术（Phrase）编辑（edit-mode toggle + 增删改名/改内容/改子阶段 + dnd 排序，per-(scene,sub_stage) `order_index`，schema 8→9）| P1 | `done` | v1.4 | 94 前端 / repo-write phrases 12 测试 | omar | [[scene-phrase-editing]] |
| Scene/SubStage 结构编辑（D1 Scene+SubStage CRUD 一起做 / D2 seed `0011` 灌示范 SubStage / D3 Tauri-only 不上 MCP / D4 删非空 Scene 阻止 · 删 SubStage 解绑 Phrase；Scene 全局序 + SubStage per-scene 序）| P1 | `done` | v1.6 | 后端 74（repo-write scenes/sub_stages 19 单测）/ 前端 109（store 5 + ScenePanel 组件 6）；真机 CRUD 落盘待验 | omar | [[scene-substage-editing]] |
| Modifier / Composition 编辑（增删改名/改内容/排序）| P1 | `withdrawn` | v1.3 | ~~ModifierGrid 6 + CompositionWorkbench 6 + composition-b2 gate~~（v1.3 移除）| omar | [[asset-editing-and-adaptive-layout#P2]] |
| └ v1.3 UI 减负：两编辑面板移出主仪表盘（[[03-product-spec#修订记录]] v0.9）。资产类型、数据层、DraftInbox promote 分支保留（「只进不显」），随时可重挂或落地 ⌘N 子窗口；未改 [[02-constitution#B1]] | — | — | — | — | — | — |
| Dashboard 可拖列布局（react-resizable-panels v4 `Group`/`Panel`/`Separator` + localStorage 持久化）| P1 | `done` | v1.1 | 73 前端 / 手测 拖拽+持久化 ✓（键盘 focus 待补）| omar | [[asset-editing-and-adaptive-layout#P4]] |

### 3.9 自动更新（ADR-017 / auto-update）

> 来源 [[017-enable-auto-update]] Accepted（2026-06-17）+ plan [[adr-017-auto-update]]。`tauri-plugin-updater` + GitHub Releases（`HuiW86/prompt-hub`）+ GitHub Actions 自动出包，mac 先行。隐私披露见 [[10-ops-spec#§9]]，A2 受限豁免边界见 [[06-prd#8.2]] N1。
>
> 边界 reaffirm：唯一显式声明的出站网络例外（守 [[02-constitution#A2]]）——首启 opt-in 默认 off + 总开关零出站 + 不上传话术，仅向 GitHub Releases 拉 `latest.json`。检查走 JS 侧启动一次，不进 ⌥Space 唤起热路径（守 [[02-constitution#C1]]）。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| updater 客户端接入（plugin 注册 + capabilities + pubkey 嵌入）| P1 | `done` | v1.1 | cargo build / 真机待 Phase 6 | omar | [[adr-017-auto-update#Phase-1]] |
| opt-in 总开关 + 检查/下载/安装 UI（updaterStore + UpdaterBanner 四态 + StatusBar 入口）| P1 | `done` | v1.1 | updaterStore 5 test（总开关关闭零触网，守 A2）| omar | [[adr-017-auto-update#Phase-2]] |
| Vite 密钥泄漏加固（`envPrefix` 白名单挡 `TAURI_SIGNING_*`，GHSA-2rcp-jvr4-r259）| P1 | `done` | v1.1 | 源码级 envPrefix 锁 | omar | [[adr-017-auto-update#Phase-3]] |
| CI 自动出包（`release.yml` two-job 隔离 + minisign 签名 + latest.json + draft）| P1 | `done` | v1.1 | dry-run 端到端验证（run 27855601462 全绿，双架构 + 签名 + latest.json 核验）| omar | [[adr-017-auto-update#Phase-4]] |
| 真机验收（opt-in/检查/提示链路 + hotkey-wake 复测守 C1）| P1 | `planned` | v1.1 | Phase 6 待办 | omar | [[adr-017-auto-update#Phase-6]] |

### 3.10 UI 风格一致性治理（design-spec v0.10 A 阶段）

> 来源 [[05-design-spec]] v0.10（§10.2.2 primitive 清单 + §10.6 Card/List 范式矩阵 + §10.7 Button 矩阵 + §11 flash 共享契约）。消除范式漂移：editor 五件套重复 4×、action/confirm 控件重复 4×、「新增」入口分叉（文字 pill vs icon 方块）、flash keyframes 重定义 3×。
>
> 行为变更（非纯去重，真机验证必查）：卡片圆角 `--r-3`→`--r-4`；focus outline 全组件统一 `--protocol`；~~ModifierGrid 绿→紫；CompositionWorkbench box-row→divider list-row~~（v1.3 这两组件已移出主仪表盘，迁移成果随组件删除作废）；DraftCard divider→neutral CardSurface + promote 去 task 绿（neutral ghost）；ScenePanel 复制 flash 收敛到单一 `ph-flash`；PhaseBar `phaseCopyFlash`→共享 `ph-flash`；RecentList/SearchBar focus outline `--task`→`--protocol`。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| primitives 基础层（`CardSurface`/`ListRowSurface`/`Button`/`IconButton`/`Input`+`EditorInput`/`EditorPanel`+`EditorActions`/`Chip`/`ActionCluster`/`ConfirmInline` + `ph-flash` + `--layer-*` 变体）| P1 | `done` | v1.1 | 110 前端（既有组件测试零回归）| omar | [[05-design-spec#10.2.2]] |
| editor 簇迁移（MacroGrid / AlignmentPhrases；~~ModifierGrid / CompositionWorkbench~~ v1.3 删）| P1 | `done` | v1.1 | 94 前端 / 真机验证待补 | omar | [[05-design-spec#10.6]] |
| surface/control 迁移（ScenePanel flash + focus / DraftInbox+DraftCard → neutral CardSurface + ghost Button）| P1 | `done` | v1.1 | 110 前端 / 真机验证待补 | omar | [[05-design-spec#10.4.3]] |
| CSS 裸值 gate（`token-gate.test.ts` 扫 px/hex/ms，仅 tokens.css 豁免）+ SearchBar `outline-offset`→`var(--hairline)` | P1 | `done` | v1.1 | token-gate 18 file scan | omar | [[05-design-spec#10.2.2]] |

### 3.11 Promptscape 设计吸收（ADR-018 / A1+B1+C1+D+E）

> 来源 [[018-absorb-promptscape-design]] Accepted（2026-06-25）。以「改造现有组件」吸收 Claude Design「Promptscape 全景仪表盘」约 90% 视觉收益，组合锁定 A1（保留项目语义色）+B1（不引入 Modifier 右栏）+C1（改造现有组件）+D（接既有 store）+E（保留 prompt-hub 名 + 去头像）。三处放大决策：任务层 3→2 列 / 新增 slim Header / 省略全局「新建」按钮。
>
> B2 复检（[[02-constitution#B2]]）：新增「中性强调色」只染品牌标记 / 主操作 / 焦点环，绝不重染 protocol（紫）/ task（绿）层；accent token 经 `:root.accent-*` 物理隔离。settingsStore 外观偏好 persist localStorage，A2 不出站。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| 主题三态外观系统（settingsStore `themeMode` light/dark/system + `applyAppearance` root class，onRehydrate 应用无首启闪烁）| P1 | `done` | v1.5 | 97 前端 / 真机验证待补 | omar | [[05-design-spec#2.5]] |
| 中性强调色（5 色 swatch neutral/blue/green/violet/amber，只染中性强调面，B2 物理隔离）| P1 | `done` | v1.5 | 97 前端 / token-gate（accent token 落 tokens.css）| omar | [[05-design-spec#2.4.4]] |
| 设置弹窗（`SettingsModal` 外观页 + 更新页两 pane，⌘/Ctrl , 唤起 + ESC/遮罩关闭，更新页复用 updaterStore opt-in 总开关）| P1 | `done` | v1.5 | 97 前端 / 真机验证待补 | omar | [[05-design-spec#10.8.3]] |
| slim Header（logo + 标题 + 内嵌 SearchBar + gear，去头像保留 prompt-hub 名，待审 badge 内嵌）| P1 | `done` | v1.5 | 97 前端 / 真机验证待补 | omar | [[05-design-spec#10.8.1]] |
| ProtocolBand 协议层暗色 band（AlignmentPhrase + Phase 收为顶部暗色带）| P1 | `done` | v1.5 | 97 前端 / 真机验证待补 | omar | [[05-design-spec#10.8.2]] |
| 任务层 3→2 列全景重构（resizable group id `panorama-2col` 丢弃旧三列缓存；Macro 收为顶部紧凑横条 / aside 承载 Recent + SOP）| P1 | `done` | v1.5 | 97 前端 / 真机验证待补 | omar | [[016-choose-dnd-and-resizable-layout#补遗]] |

### 3.12 产品走查修缮批次（2026-07-01 · P0/P2/P3）

> 来源：2026-07-01 产品走查（实体×CRUD 覆盖矩阵反查）收敛的修缮批次。P0 = 可用性/可靠性止血；P3 = 资产生命周期补救 + 设计稿对齐。暗 band 部分开 [[020-restore-protocol-dark-band]]（Accepted 2026-07-01）调和 ADR-018/019 冲突。契约涟漪：design-spec v0.13 / product-spec v0.13 / prd v0.12。
>
> 边界 reaffirm：全批零出站（A2）、启动路径只减不加（C1，bench 未回归）、B2 结构分离零触碰（且本批恢复了源码级 gate 持续证伪）。

| 功能 | 优先级 | 状态 | 目标版本 | 测试覆盖 | 责任人 | 引用 |
|---|---|---|---|---|---|---|
| Draft 促升前编辑（DraftCard「编辑」：`get_draft` 水合 → `update_draft` 全量保存；隐藏字段保留，四象限仍 promote 时人选）| P1 | `done` | v1.7 | promptStore 2 + DraftInbox 3 前端；cargo 全绿 | omar | [[06-prd#10.3]] |
| Composition promote 暂缓止血（归档/编辑 disabled +「该类型暂无 UI 承载」，discard 可用；解锁 = Composition 重获 UI 承载）| P0 | `done` | v1.7 | DraftInbox.test 4 断言 | omar | [[03-product-spec#13.3]] |
| Modifier 最小管理簇（移象限 = `update_modifier` 可选 `group_kind` 入参单事务移位 + 二次确认删除，hover/`:focus-within` 显隐键盘可达）| P1 | `done` | v1.7 | ModifierGrid 2 前端 + repo-write modifiers 3 单测 | omar | [[06-prd#6.1]] |
| AlignmentPhrase「设为默认」（`set_default_alignment_phrase` 单事务换默认 + 同步 phases 指针，编辑态 Star 入口）| P1 | `done` | v1.7 | repo-write 4 单测 + store 乐观 action | omar | [[06-prd#6.6]] |
| Scene / SubStage 排序 UI（Scene 编辑态前移/后移按钮接 `reorder_scenes`；SubStage 结构编辑器内 dnd 拖拽；活动场景 id 追踪排序不中断编辑态）| P1 | `done` | v1.7 | ScenePanel 2 + promptStore 2 前端 | omar | [[03-product-spec#13.3]] |
| 复制失败可见 + Toast intent 分级（useCopy 失败弹 error toast 并中止 record_usage；success 800ms / error 4000ms amber + `role=alert`）| P0 | `done` | v1.7 | useCopy 3 + toastStore 3 前端 | omar | [[05-design-spec#11]] |
| 更新检查失败 auto/manual 分级（auto 静默降级不挂横幅 / manual error+toast）+ Dashboard 加载失败「重试」（role=alert + refreshAll）| P0 | `done` | v1.7 | updaterStore 3 前端 | omar | [[017-enable-auto-update]] |
| 启动 DB 失败优雅兜底（app_data_dir/迁移失败 → 阻断式错误对话框含 DB 路径 + `exit(1)`；manage 未迁移 in-memory 连接防 IPC panic）| P0 | `done` | v1.7 | cargo test --workspace 全绿 + `cargo check --features bench` | omar | [[06-prd#7.7]] |
| 协议层暗色 band 恢复 + 层级编码修缮（`--band-*` token 族 + band 作用域重映射；ModifierGrid「协议层 · 参考」pill；RecentList 徽标中性化）| P1 | `done` | v1.7 | 144 前端全绿（含 token-gate / b2 gate）| omar | [[020-restore-protocol-dark-band]] |
| light 主题明度重绘 + resting elevation（muted canvas + 纯白抬升卡；4 容器 resting `--shadow-1`）| P1 | `done` | v1.7 | 144 前端全绿（token-gate）| omar | [[05-design-spec#2.4.2]] |
| Scene 全景 auto-fit 自适应列宽 + 「未分组」列头（窄面板降列不挤压 + 未归组话术 muted 列头）| P1 | `done` | v1.7 | ScenePanel 2 例 | omar | [[05-design-spec#10.3]] |
| 设计稿像素对齐包（Macro 图标盒全量 accent 填充 + hot Flame 实心；hover `--shadow-1`+`--lift-1` 抬起语言；EmptyState 富空态 icon/title/action/framed/row + Scene 空态 accent CTA + Button intent=accent）| P1 | `done` | v1.7 | 144 前端全绿 | omar | [[05-design-spec#10.7]] |

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

## §4 阶段交付节奏

| 阶段 | 版本 | 功能数 | 状态 |
|---|---|---|---|
| S1 主形态 MVP | v1.0 | 5 模块 + 8 跨模块能力 | `planned` |
| S2 闭环沉淀 | v1.1 | 4 功能 | `planned` |
| M-X MCP write pipeline | v1.1 | 6 支撑能力 + 14 MCP tool | `done` |
| AE 资产编辑 + 自适应布局 | v1.1 | 3 功能 | `done`（3/3 在用：Macro/AlignmentPhrase 编辑+排序 + 可拖列布局；Modifier/Composition 编辑 v1.3 `withdrawn` 移出主仪表盘）|
| ADR-017 自动更新 | v1.1 | 5 功能 | `done`（4/5：客户端 + CI 出包 done / 真机验收 planned）|
| UI 一致性治理（design-spec v0.10 A 阶段）| v1.1 | 4 功能 | `done`（4/4 实装 + 测试零回归；真机验证待补）|
| Promptscape 设计吸收（ADR-018）| v1.5 | 6 功能 | `done`（6/6 实装：主题三态 + 强调色 + 设置弹窗 + Header + ProtocolBand + 2 列全景；真机验证待补）|
| Scene/SubStage 结构编辑（scene-substage-editing）| v1.6 | 1 功能 | `done`（后端 74 / 前端 109 全绿；补 [[scene-phrase-editing]] 当初 defer 的 Scene 容器 + SubStage CRUD；真机 CRUD 落盘待验）|
| 产品走查修缮批次（P0/P3 + ADR-020）| v1.7 | 12 功能 | `done`（12/12 实装 + 前端/后端测试全绿；另 7 项质量/治理不计数；真机视觉复核待补）|
| S3 SOP 导航 | v1.2 | 3 功能 | `planned` |
| S4 配置个性化 | v1.3 | 4 功能 | `in-progress`（1/4：数据导入导出 JSON `done`，真机待验；配置入口 / Phase 编辑 / 布局可配置仍 `planned`）|
| S5 辅形态副屏 | v2.0 | 3 功能 | `planned` |
| **合计** | — | **78 项** | — |

**注**：版本号语义为 prompt-hub 自身版本，与 prd / spec / methodology 各自独立。v1.0 = 第一阶段 MVP 可发布；v2.0 = 辅形态加入（双形态完整）。

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
| 2026-07-01 | v1.8 bump：新增 §3.12 产品走查修缮批次（12 功能 → `done`：Draft 促升前编辑 +get_draft IPC / composition promote 暂缓止血 / Modifier 移象限+删除管理簇 / AlignmentPhrase 设为默认 / Scene·SubStage 排序 UI / 复制失败可见+Toast intent 分级 / 更新失败 auto-manual 分级+Dashboard 重试 / 启动 DB 失败兜底对话框 / 暗 band 恢复 ADR-020 / light 明度重绘+resting elevation / Scene auto-fit+未分组列头 / 设计稿像素对齐包；另 7 项质量/治理不计数：测试 CI ci.yml / B2 源码 gate 恢复 / IPC 三方契约 gate / typography preset 落地+token 收敛 / primary 对比度修复+token-gate 新规 / focus 可见补齐 / bench C1 退出码）；§3.7 IPC 行注 5→6（+get_draft）；§4 节奏表加修缮批次行，合计 66→78 项。前端最终 151 测试 / cargo --workspace 全绿。涟漪 [[05-design-spec]] v0.13 / [[03-product-spec]] v0.13 / [[06-prd]] v0.12，暗 band 锚点 [[020-restore-protocol-dark-band]] | 2026-07-01 产品走查修缮批次收口涟漪 |
| 2026-06-28 | v1.7 bump：§3.4「数据导入导出（JSON）」`planned`→`done`——repo-core `export.rs`（全保真聚合，独立无过滤 SELECT 以纳入弃用/隐藏行，data schema_version `1.1`，**不含 usage_records**=决策 D2）+ repo-write `import.rs`（**整库替换**=决策 D1，`defer_foreign_keys` 破 phases↔alignment_phrases FK 环，按 major 版本拒不兼容备份）；2 path-based Tauri IPC（`export_data`/`import_data`，前端 dialog 选路 + Rust `std::fs` 读写，避开 fs-plugin scope）；接 `tauri-plugin-dialog`（决策 D3）；SettingsModal 新增「数据」页（导出 save dialog / 导入 open dialog + 整库替换确认弹窗 + 完成后 `refreshAll`）。后端 export 3 + import 5 单测，前端 109 测试全绿（clippy/fmt/lint/prettier clean）；**真机导入导出待验**。B2 复检通过（导出/导入按表搬运，不混协议层与任务层）；A2 不出站（仅写用户选定本地路径）。涟漪 [[06-prd#6.9]] | 数据导入导出功能收口涟漪 |

---

## §7 当前阶段说明（in-progress · ADR-012 Phase 1-5 全 done）

- 通过测试: Vitest 57/57 ✓ / cargo test --workspace 48/48 ✓ / pnpm build ✓ / lint 0 errors
- 已落盘 commit: M0-1/M0-2/M0-3 + ADR-012 Phase 1（`b932ab4`）/ Phase 2（`9a822d8`）/ Phase 3（`acf8229`）+ M-X.1/.2/.3 + Phase 5 验收收口
- ADR-012 Phase 5 验收（2026-06-03）: 视觉+功能 11/11 done — screencapture 自动化过 9/11，用户手点 promote/discard 补 2/11，DB 核对落库内容无误
- M0-4 签名公证链路（2026-06-03）: M0 四项全绿 — Developer ID 签名 + 公证 Accepted + Gatekeeper 放行 + release 运行时不黑屏（runbook [[m0-4-macos-signing]]）
- 下一动作：bench 脚本回归（`bench:cold-start`/`hotkey-wake`）；P2 defer：`create_draft` 单写 size-cap（M-X.4）

**同步约定**（v0.3+ 启用）：
- 每次 commit 主分支后**手动**同步本清单状态（原设想的 `scripts/update-features.sh` 自动化脚本从未落地，现状为手动维护；若未来补脚本再回改本条）
- 单元测试覆盖率由 vitest coverage report 直接填入（替换当前「集成 / 单元未量化」占位）
- 责任人字段单人项目暂时全为 `omar`，多人协作时按 commit author 自动填
