---
type: features
project: prompt-hub
version: v0.6
created: 2026-05-19
last_modified: 2026-06-03
status: in-progress  # S1 主形态 MVP 5 模块 + 跨模块 P0 多项 done（ADR-012 Phase 1-3 已 ship）；M-X 全收口——数据层 + workspace + MCP server + UI 收件箱（草稿 tab + 待审 badge + 5 IPC + schema recheck）done
author: ai  # 🤖 AI 主笔 + 人审（CLAUDE §5.2）
audience: [human, ai]
description: prompt-hub 功能清单运营视图——功能 × 状态 × 测试覆盖 × 版本，单一事实源；v0.6 把 §3.7 草稿 tab + 待审 badge + promote/5 IPC + schema recheck 全转 done（M-X.3 UI 收件箱落地），M-X 阶段整体 done
related:
  - 06-prd
  - prompt-hub-mvp
  - test-spec  # 待 W4 补
  - 012-lock-visual-quality-anchor
  - 013-alignment-phrases-tab-inclusion
  - 015-expose-mcp-write-pipeline
  - mcp-write-pipeline
---

# Features: prompt-hub

> 功能清单的**运营视图**。回答「现在有什么、做到什么程度、测得怎么样」。
> **不重复 prd**：本文件只承载状态/覆盖率，功能定义见 [[06-prd#5]] 各章节。
> **不替代 issue tracker**：单条 bug / task 走 git history，本文件追全局功能层面。
>
> ✅ **当前 S1 in-progress（ADR-012 Phase 1-3 已 ship）**：5 模块 + 7 跨模块 P0 已 done（commit `acf8229`）；Phase 4 spec 涟漪 + Phase 5 manual verify 进行中。
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
| 数据导入导出（JSON） | P1 | `planned` | v1.3 | 0% | omar | [[06-prd#6.9]] |
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
| 复制即隐藏 / ESC 关闭 | P0 | `in-progress` | v1.0 | 行为已落 / Phase 5 manual verify | omar | [[prompt-hub-mvp#第一阶段]] |
| UsageRecord 持续记录 | P0 | `in-progress` | v1.0 | 数据层 done / 链路待 S2 | omar | [[06-prd#6.8]] |
| 三层资产模型（Modifier/Composition/Macro） | P0 | `planned` | v1.0 | 0% | omar | [[02-constitution#B1]] |
| 协议层与任务层物理分离 | P0 | `done` | v1.0 | 视觉层 ADR-012 落地 / 数据层待 S2 | omar | [[02-constitution#B2]] |
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
| promote 跨表事务（4 类 arm）+ 5 Tauri IPC（promote/list/count/update/discard）+ mid-session schema recheck | P1 | `done` | v1.1 | repo-write 9 test（4 promote arm）+ commands schema-guard 2 test + count_pending 1 test | omar | [[06-prd#10.2]] |

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

---

## §4 阶段交付节奏

| 阶段 | 版本 | 功能数 | 状态 |
|---|---|---|---|
| S1 主形态 MVP | v1.0 | 5 模块 + 8 跨模块能力 | `planned` |
| S2 闭环沉淀 | v1.1 | 4 功能 | `planned` |
| M-X MCP write pipeline | v1.1 | 6 支撑能力 + 14 MCP tool | `done` |
| S3 SOP 导航 | v1.2 | 3 功能 | `planned` |
| S4 配置个性化 | v1.3 | 4 功能 | `planned` |
| S5 辅形态副屏 | v2.0 | 3 功能 | `planned` |
| **合计** | — | **47 项** | — |

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

---

## §7 当前阶段说明（in-progress · ADR-012 Phase 1-3 已 ship）

- 通过测试: Vitest 55/55 集成 ✓ / cargo test 12/12 ✓ / pnpm build 911ms ✓ / lint 0 errors
- 已落盘 commit: M0-1/M0-2/M0-3 + ADR-012 Phase 1（commit `b932ab4`）+ Phase 2（commit `9a822d8`）+ Phase 3（commit `acf8229`）
- 下一动作：[[012-lock-visual-quality-anchor]] Phase 4 设计文档涟漪（design-spec v0.7 / product-spec v0.6 / ADR-013，本 commit 序列）+ Phase 5 `pnpm tauri dev` 手动 6 步 verify + M0-4 签名 spike

**自动同步约定**（v0.3+ 启用）：
- 每次 commit 主分支后跑 `scripts/update-features.sh` 同步状态（脚本待 [[11-test-spec]] 启动后加）
- 单元测试覆盖率由 vitest coverage report 直接填入（替换当前「集成 / 单元未量化」占位）
- 责任人字段单人项目暂时全为 `omar`，多人协作时按 commit author 自动填
