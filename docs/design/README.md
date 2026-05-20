---
type: index
project: prompt-hub
description: docs/design 文档索引——11 篇核心设计文档（契约/状态/知识）的编号、主笔人与内容速查
---

# prompt-hub 设计文档

## 体系概述

prompt-hub 的项目文档体系——主文档分三类：契约层（spec / constitution / product-spec / user-flows / design-spec / prd）、状态层（features / sitemap / tech-stack）、知识层（ops-spec / test-spec + `plans/` + `adr/`）。本目录 `docs/design/` 收录 11 篇编号核心设计文档；实施方案见 `../plans/`，架构决策见 `../adr/`。

> 项目阶段：pre-code（仅设计文档，0 LOC）。AI 进场基线见根目录 `CLAUDE.md`。

## 文档索引

| 编号 | 文档 | 主笔 | 内容 |
|------|------|------|------|
| 01 | [spec](./01-spec.md) | 🧑 人 | 手动 AI 编程仪表盘的产品 spec——What / Why / 九条哲学 / 边界 / 未决决策 |
| 02 | [constitution](./02-constitution.md) | 🧑 人 | 项目宪法——8 条不可违反铁律，违反任一条项目即转型 |
| 03 | [product-spec](./03-product-spec.md) | 🤝 共创 | UI 契约——双形态架构 / 布局 / 点击路径 / 交互频率 / 状态反馈 / 用户旅程 |
| 04 | [user-flows](./04-user-flows.md) | 🤝 共创 | 关键用户流程补充——product-spec §4.5 未覆盖的边缘 / 异常 / 跨形态流程 |
| 05 | [design-spec](./05-design-spec.md) | 🤝 共创 | 视觉规范——字号 / 间距 / 颜色 / 动画 Token 全 CSS Variables 化 + WCAG 实测 + 暗色模式 |
| 06 | [prd](./06-prd.md) | 🤖 AI | 工程契约——数据模型三表式 / 状态机 / 升级回滚 / NFR / Boundaries 三段式 / 安全字段 |
| 07 | [features](./07-features.md) | 🤖 AI | 功能清单运营视图——功能 × 状态 × 测试覆盖 × 版本，单一事实源 |
| 08 | [sitemap](./08-sitemap.md) | 🤖 AI | 资产对象树 + 视图导航图（无 URL 路由，桌面应用语境） |
| 09 | [tech-stack](./09-tech-stack.md) | 🤖 AI | 技术栈快照——Tauri 2.x + React 19.2 + rusqlite 0.32 + pnpm 9.x + Zustand 5 + Vitest 4 + CSS Modules |
| 10 | [ops-spec](./10-ops-spec.md) | 🤖 AI | 运营规格——部署 / 性能预算 / 备份 / 升级回滚 / 监控（本地单人语境） |
| 11 | [test-spec](./11-test-spec.md) | 🤖 AI | 测试规格——单元 / 集成 / E2E 三层 + 性能基准 + LLM Eval 集 |
| — | [变更日志](./CHANGELOG.md) | — | 设计文档体系修订历史 |

## 关联目录

- `../plans/prompt-hub-mvp.md` — 五阶段实施任务清单（🤝 共创）
- `../adr/` — 架构决策记录（ADR-001~010，`000-template.md` 为模板）
- `../../dist/prompt-hub.html` — 全文档单文件阅读型合订（⚠️ 见下方说明）

> **`dist/prompt-hub.html` 已过期**：该合订 HTML 构建于本次目录迁移之前，源文件路径与命名已变更，需重新生成后才与当前文档一致。详见 [ADR-010](../adr/010-doc-directory-restructure.md)。
