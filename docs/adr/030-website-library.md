---
type: adr
project: prompt-hub
status: Proposed
author: ai
created: 2026-09-23
related: [../design/01-spec, ../design/02-constitution, ../website-tab/prior-art-and-decision]
---

# ADR-030：常用网站作为独立快捷资源

## 背景与决定

用户要在 prompt-hub 增加一个 Tab，整理常用网站并快速打开。需求已授权实施；新增的规格/架构文字仍是 AI 草案，不能替代现有的人写 spec 和 constitution。外部候选与不采用理由见 [先例扫描](../website-tab/prior-art-and-decision.md)。

网站与提示词的三层组合没有关系。建独立 `website_groups`、`websites` 两表，前端独立 Zustand store，进入网站 Tab 后才读库。默认浏览器打开使用官方 Tauri opener；前端仅传 ID，Rust 从库中查未删除行，验证 HTTP(S) 且无凭据，再交给操作系统。成功的含义是“交给系统”，不保证网页加载成功。

分组排序与组内网站排序使用显式次序；删除网站写 `deleted_at`，6 秒 Toast 撤销与持久“已删除”入口都能恢复。删除分组时网站（包括已删除的行）回到未分组。网址不与 Modifier/Macro/Composition 等 prompt 资产混在一起。

SQLite `user_version` 14→15；现有迁移器会在改表前快照。JSON `schema_version` 1.3→1.4，增加顶层 `website_library`，包含组与网站（含已删除项）。导入缺该键保留现有网站，显式空集合清空，`null` 或非法 URL 拒绝；网站替换与其他资产在同一事务中提交/回滚，导入前已有快照仍适用。旧导出不会悄悄擦掉新网站。

## 影响、验证与重开

新增九条 Tauri IPC 命令、界面 Tab、备份字段；提示词原命令保持。验证见 [执行记录](../website-tab/README.md) 与 evidence 日志。人审前保持 Proposed。若需账号、云同步、网页内容抓取、跨应用共享或 URL 协议扩展，应重新扫描与另作边界决策。
