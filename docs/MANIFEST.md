---
type: manifest
project: prompt-hub
version: v1.7
status: active
created: 2026-05-24
last_modified: 2026-06-27
audience: [human, ai]
description: prompt-hub 项目前期准备文件总清单——按方法论 v1.3 六层架构（L0 宪法 / L1 产品契约 / L2 工程规格 / L3 实施规格 / L4 索引 / L5 协作契约）+ ADR + 实施方案 + 视觉原型 + AI 上下文。AI 进项目读完 CLAUDE.md 后接读本文件能 1 分钟拿全貌；不写行数（参考性强但易过期）
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
| 🤝 共创 | 6 | 6/6 ratified（2026-06-01 product-spec v0.7 / design-spec v0.8 omar 审定升 ratified）|
| 🤖 AI 主笔（人审） | 6 | 4/6 ratified + prd pre-code + features in-progress |
| 🤖 AI 派生人审（L5） | 2 | 2/2 active |
| ADR 决策记录 | 18 | 16 Accepted + 1 Superseded（012）+ 1 Proposed（005）（+ 011 Reserved）|
| 实施方案 | 1 | active |
| 视觉原型 | 1 | v1 已归档至 archive/（2026-05-25）|
| 项目 AI 上下文 | 2 | active |
| 反思沉淀 | 1 | active（2026-06-04 新增 learnings v0.1）|

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
| `docs/design/03-product-spec.md` | UI 契约（双形态 / 布局 / 交互） | ratified v0.11（2026-06-27 scene-substage-editing 涟漪：§13.3 区域 4 +管理结构编辑器；前 v0.10 ADR-018 §13 +Header +设置弹窗 +任务层 2 列 / v0.8 Tab cycle 6→8）|
| `docs/design/04-user-flows.md` | 用户流（边缘 / 异常 / 跨形态） | ratified |
| `docs/design/05-design-spec.md` | 视觉/动效 token 体系 | ratified v0.12（2026-06-26 ⚠️ ADR-019 涟漪：推翻 flat 锚点——§8.2 撤 box-shadow + §8.2.1 elevation / §2.4.1 颜色本体论降视觉选择级转中性 / §13 重定向；前 v0.11 ADR-018 中性强调色 + 主题三态）|

---

## §4 L2 工程规格（3 份 · 🤖 AI 主笔人审）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/design/06-prd.md` | 数据契约 / API / 状态机 / 错误码 | pre-code v0.11（2026-06-27 scene-substage-editing 涟漪：§6.4 +写入口归属指派；前 v0.10 ADR-017 C3 §8.3 updater 例外）|
| `docs/design/07-features.md` | 66 功能矩阵 S1–S5 + AE + 自动更新 + Promptscape 吸收 + 结构编辑 | in-progress v1.6（2026-06-27 scene-substage-editing：§3.8 Scene/SubStage 结构编辑 done，合计 65→66；前 2026-06-26 ADR-019 / 2026-06-25 ADR-018 Promptscape / v1.4 Scene 话术编辑）|
| `docs/design/08-sitemap.md` | 资产对象树 + 视图导航图 | ratified |

---

## §5 L3 实施规格（3 份 · 🤖 AI 主笔人审）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/design/09-tech-stack.md` | 全栈技术决议 | ratified v1.3（2026-06-19 ADR-017 涟漪：D14 自动更新 + §4.4 updater 子系统 + plugin-process 依赖锁）|
| `docs/design/10-ops-spec.md` | 运维规格 | ratified v0.3（2026-06-17 ADR-017 C4：§5.2 telemetry 措辞澄清 + §9.4 反向指针）|
| `docs/design/11-test-spec.md` | 测试规格 | ratified |

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

## §8 ADR 决策记录（18 份）

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
| 011 | _reserved_（计划：search UsageSource，HANDOFF backlog） | — |
| 012 | lock-visual-quality-anchor (Linear 整体气质) | Superseded by ADR-019（2026-06-26）；原 Accepted（2026-05-24） |
| 013 | alignment-phrases-tab-inclusion（AlignmentPhrases 独立 region + Tab cycle 6 tab-reachable，追认 ADR-012 Phase 3） | Accepted（2026-05-25） |
| 014 | nspanel-isa-swizzle（NSPanel 子类 override canBecomeKeyWindow + isa-swizzle 取得 borderless key-window 资格，下位于 ADR-008） | Accepted（2026-06-03） |
| 015 | expose-mcp-write-pipeline（暴露 MCP server 给外部 AI 入库，14 tool + workspace 物理拆 4 crate + drafts staging） | Accepted（2026-05-27） |
| 016 | choose-dnd-and-resizable-layout（@dnd-kit/react 0.4 区域内拖排 + react-resizable-panels v4 可拖列布局；补遺 2026-06-25 任务层 3→2 列 + group id `panorama-2col`，见 ADR-018） | Accepted（2026-06-04） |
| 017 | enable-auto-update（tauri-plugin-updater + GitHub Releases + Actions 出包，mac 先行；A2 唯一出站豁免边界） | Accepted（2026-06-17） |
| 018 | absorb-promptscape-design（吸收 Promptscape 设计稿，组合 A1+B1+C1+D+E：保语义色 + 不引 Modifier 右栏 + 改造现有组件 + 接既有 store + 保 prompt-hub 名去头像；三放大决策 3→2 列 / +Header / 省略全局新建） | Accepted（2026-06-25） |
| 019 | supersede-flat-visual-anchor（推翻 ADR-012 反 polish / Bloomberg-flat 锚点，omar 拍板 Option A：引 subtle elevation + 放弃颜色本体论改靠位置+形状，全面对齐 Promptscape；校正：颜色/反阴影住 design-spec 非 constitution，无人主笔门槛） | Accepted（2026-06-26） |

---

## §9 实施方案（3 份 · 🤝 共创）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/plans/prompt-hub-mvp.md` | 五阶段任务清单 | v0.8（第一阶段 MVP 收尾中） |
| `docs/plans/mcp-write-pipeline.md` | MCP write pipeline 实施 plan（drafts staging + 14 tool 双层 + workspace 4 crate 物理拆分） | v0.2（2026-05-27 · pre-code） |
| `docs/plans/adr-017-auto-update.md` | 自动更新实施 plan（6 阶段：密钥 / 配置接入 / 客户端+UI / Vite 加固 / CI 出包 / 验证）| v0.1（2026-06-19 · Phase 1-4 done，Phase 6 真机待办）|

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
| `CLAUDE.md` | 项目级行为规范（含三温区映射 / 忌讳清单 / §7 状态指针） | v1.0 |
| `HANDOFF.md` | 会话断点 | 动态（每次 /checkpoint 更新） |

---

## §11.5 反思沉淀（1 份 · 🤝 共创）

> 方法论 v1.3 七层中的「反思层」产物——跨 ADR / 踩坑 / 决策抽出的共性判断，非 13 份核心设计文档之一。不走方法论 §7 八步；若某条信条与 constitution 抵触，须先走 ADR 修订 constitution。

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/learnings.md` | 7 条可迁移信条 + 技术栈速查（M0 阶段经验提炼） | active v0.1（2026-06-04）|

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
