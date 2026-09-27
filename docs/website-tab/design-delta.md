---
type: design-delta
project: prompt-hub
version: v0.1
status: draft
author: ai
created: 2026-09-23
related: [../design/03-product-spec, ../design/06-prd, ../design/07-features, ../design/08-sitemap, ../design/11-test-spec, ../adr/030-website-library]
---

# 常用网站 Tab · 设计增量（待人审）

本页是本轮代码对应的增量说明；已 ratified 的设计文档版本与人审状态不变。人审后由文档维护者将采用部分并回原文，或保留本页为已采用附录。

| 受影响文档 | 建议增量 / 实现事实 | 待核问题 |
| --- | --- | --- |
| product-spec | 顶层工作区为“提示词 / 常用网站”；网站页有全部网站、分组、已删除、搜索、添加/编辑、显式打开与排序；网站不参与提示词组合或调用模式。 | 顶层 Tab 名称与窗口尺度是否合意？ |
| prd | `website_groups`、`websites`；schema 15；URL 仅 HTTP(S)，无账号密码；按 ID 通过 Tauri IPC 打开；JSON 1.4 的 `website_library` 缺失=保留、空=清空、null=拒绝。 | 是否未来需要浏览器书签批量导入？本轮不预留虚假契约。 |
| features | 新能力“常用网站快捷入口”处于 in-progress；代码和自动测试已落地，但没有目标环境真机走查与用户验收，不能标 verified。 | 人审/真机后再升级。 |
| sitemap | 顶层增加网站工作区，下面是“全部网站 → 组 / 已删除”，无 URL 路由；原提示词空间布局不搬动。 | 是否要改变全局导航次序？ |
| test-spec | 自动：URL 校验、CRUD/排序/删除恢复、旧包导入、显式空与 null、回滚、IPC 名称、UI 增删查开；真机：默认浏览器接收网址、窗口切换与键盘焦点、C1 唤起延迟。 | 原真机门基线需新版本重跑，不从自动测试推断。 |

## 交互契约

1. 用户切入网站页才读取网站库；`⌘K` 在当前页聚焦网站搜索，`Esc` 先清查询。提示词的相位快捷键在网站页无效。
2. 名称必填，网址须完整填写 `http://` 或 `https://`；编辑时可改组。组删除保留网站并移至未分组。上下排序只在同组生效；搜索时禁排序。
3. 点击“打开”只发送网站 ID；Rust 重新读取和校验，并调用系统默认浏览器。成功反馈“已交给默认浏览器”，不承诺网站可访问。删除后“撤销”可用 6 秒；超时后“已删除”页可恢复。
4. 旧 1.3 JSON 缺网站键时网站保持；1.4 导出含所有网站与已删除项。导入的原有 pre-import 备份及事务边界继续生效。

## 图卡

[架构源图](architecture.mmd) · [SVG](architecture.svg) · [PNG](architecture.png)。问题：新增网站能力如何从 UI 经 IPC、SQLite 到系统浏览器，并如何进入备份？边界：prompt-hub 本机单用户，不画浏览器网页加载。深度：模块/关键链路。版本：本轮工作区，SQLite 15 / JSON 1.4，2026-09-23。维护责任：本项目代码变更者；修改 `WebsitePanel`、网站 IPC、数据库迁移、导入导出时复核本图。旧[逆向架构图](../architecture-system-pilot/2026-09-22/diagrams/architecture-map.md)固定在 317106d 基线，本图不是旧图的自动更新。
