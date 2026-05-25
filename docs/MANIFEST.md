---
type: manifest
project: prompt-hub
version: v1.1
status: active
created: 2026-05-24
last_modified: 2026-05-25
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
| 🤝 共创 | 6 | 6/6 ratified |
| 🤖 AI 主笔（人审） | 7 | 7/7 ratified |
| 🤖 AI 派生人审（L5） | 2 | 2/2 active |
| ADR 决策记录 | 13 | 12 Accepted + 1 Proposed |
| 实施方案 | 1 | active |
| 视觉原型 | 1 | v1 已归档至 archive/（2026-05-25）|
| 项目 AI 上下文 | 2 | active |

---

## §2 L0 项目宪法（2 份 · 🧑 人主笔）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/design/01-spec.md` | 项目定位与九条哲学 | ratified |
| `docs/design/02-constitution.md` | 8 条铁律 | ratified |

---

## §3 L1 产品契约（3 份 · 🤝 共创）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/design/03-product-spec.md` | UI 契约（双形态 / 布局 / 交互） | ratified v0.6（2026-05-25 ADR-013 涟漪：AlignmentPhrases 独立 region）|
| `docs/design/04-user-flows.md` | 用户流（边缘 / 异常 / 跨形态） | ratified |
| `docs/design/05-design-spec.md` | 视觉/动效 token 体系 | ratified v0.7（2026-05-25 ADR-012 Phase 4：token sync + §8-§13 bundle 派生 6 章）|

---

## §4 L2 工程规格（3 份 · 🤖 AI 主笔人审）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/design/06-prd.md` | 数据契约 / API / 状态机 / 错误码 | ratified |
| `docs/design/07-features.md` | 28 功能矩阵 S1–S5 | in-progress v0.2（2026-05-25 ADR-012 Phase 1-3 ship 状态回写 + AlignmentPhrases 新条目）|
| `docs/design/08-sitemap.md` | 资产对象树 + 视图导航图 | ratified |

---

## §5 L3 实施规格（3 份 · 🤖 AI 主笔人审）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/design/09-tech-stack.md` | 全栈技术决议 | ratified v1.1 |
| `docs/design/10-ops-spec.md` | 运维规格 | ratified |
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
| `docs/design/CLAUDE-DESIGN.md` | 02-constitution + 05-design-spec + ADR-012 | claude.ai/design | active v0.1 |
| `docs/workflows/claude-design-prompts.md` | CLAUDE-DESIGN | 人 + AI | active v0.1 |

**L5 触发条件**：
- 视觉质感锚点 ADR 落定（如 ADR-012）→ 必派生 sticky context（`<工具名>-DESIGN.md`）
- sticky context 落盘 → 派生 prompt 模板（`<工具名小写>-prompts.md`）

**L5 失效检测**：
- 用外部工具跑生成后跑迭代 checklist（见 prompts.md §5）
- **连续 2 次不达标** → 强制 bump L5 文件，走方法论 §7 八步

---

## §8 ADR 决策记录（12 份）

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
| 012 | lock-visual-quality-anchor (Linear 整体气质) | Accepted（2026-05-24） |
| 013 | alignment-phrases-tab-inclusion（AlignmentPhrases 独立 region + Tab cycle 6 tab-reachable，追认 ADR-012 Phase 3） | Accepted（2026-05-25） |

---

## §9 实施方案（1 份 · 🤝 共创）

| 路径 | 内容 | 状态 |
|---|---|---|
| `docs/plans/prompt-hub-mvp.md` | 五阶段任务清单 | v0.8（第一阶段 MVP 收尾中） |

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
