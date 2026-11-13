---
type: adr
project: prompt-hub
status: Accepted
author: ai
created: 2026-09-23
last_reviewed: 2026-11-13
related: [../design/01-spec, ../design/02-constitution, ../website-tab/prior-art-and-decision]
---

# ADR-030：常用网站作为独立快捷资源

## 背景与决定

用户要在 prompt-hub 增加一个 Tab，整理常用网站并快速打开。需求已授权实施；新增的规格/架构文字仍是 AI 草案，不能替代现有的人写 spec 和 constitution。外部候选与不采用理由见 [先例扫描](../website-tab/prior-art-and-decision.md)。

网站与提示词的三层组合没有关系。建独立 `website_groups`、`websites` 两表，前端独立 Zustand store，进入网站 Tab 后才读库。默认浏览器打开使用官方 Tauri opener；前端仅传 ID，Rust 从库中查未删除行，验证 HTTP(S) 且无凭据，再交给操作系统。成功的含义是“交给系统”，不保证网页加载成功。

分组排序与组内网站排序使用显式次序；删除网站写 `deleted_at`，6 秒 Toast 撤销与持久“已删除”入口都能恢复。删除分组时网站（包括已删除的行）回到未分组。网址不与 Modifier/Macro/Composition 等 prompt 资产混在一起。

SQLite `user_version` 14→15；现有迁移器会在改表前快照。JSON `schema_version` 1.3→1.4，增加顶层 `website_library`，包含组与网站（含已删除项）。导入缺该键保留现有网站，显式空集合清空，`null` 或非法 URL 拒绝；网站替换与其他资产在同一事务中提交/回滚，导入前已有快照仍适用。旧导出不会悄悄擦掉新网站。

## 影响、验证与重开

新增九条 Tauri IPC 命令、界面 Tab、备份字段；提示词原命令保持。验证见 [执行记录](../website-tab/README.md) 与 evidence 日志。若需账号、云同步、网页内容抓取、跨应用共享或 URL 协议扩展，应重新扫描与另作边界决策。

## 裁决（2026-11-13）

- Last reviewed: 2026-11-13（HuiW86 授权 AI 裁决：「帮我做决定吧，你自己的代码」）
- **结论：Accepted，决策不改。** 裁前逐条对照代码复核（即 HANDOFF 原第 60 项），上文每一条都有实现与测试对应：打开路径 `repo_core::websites::website_url` 只查 `deleted_at IS NULL` 的行并重跑 `normalize_url`（测试覆盖已删除不可打开、`javascript:` / `file:` / 凭据 / 控制字符拒绝）；删除分组时含已删除行一并回到未分组；导入缺键保留 / 空集合清空 / `null` 与非法 URL 拒绝，且与其他资产同一事务；命令恰为九条
- **补充子决策：网站表不进第七道源码级闸门**（`src/ipc/soft-delete-gate.test.ts` 的 `ASSET_TABLES`）。理由：① 网站不是提示词资产，不属三层模型（[[02-constitution#B1]]），闸门守的是「已删资产在某个读面上复活」，那是资产七表的风险；② `list_websites` 刻意返回含已删除的全集，供「已删除」视图与恢复，进清单只会换来一条豁免标记；③ 唯一须过滤的读——打开网址——已带谓词并有测试。若将来网站出现第二条「只读存活行」的查询，再重议
- 导出版本此后已因 [[031-panorama-default-view]] 升至 1.5，`website_library` 三态口径不变
- 本 ADR 的契约回流（prd / product-spec / design-spec 补写网站 Tab，目前只有 `docs/website-tab/design-delta.md`）与全景一并走八步，见 HANDOFF 第 65 项
