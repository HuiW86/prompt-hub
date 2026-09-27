---
type: prior-art-scan
author: ai
status: draft
created: 2026-09-23
valid_until: 2027-03-23
related: [030-website-library, ../design/01-spec, ../design/02-constitution]
---

# 常用网站能力：先例扫描与借造决定（S1 / L1）

范围是 prompt-hub 内的快捷网址，不是完整书签管理平台。检索词：常用网站/浏览器书签/网址导航/quick links；bookmark manager/local first/desktop launcher；Tauri open URL/default browser；bookmark retrieval study。2026-09-23 完成内部扫描、三轮外部检索及反面检索。候选出现后仍有相近品类，但第二轮未出现需要改变产品边界的新类别；六个月内有效，若要加入浏览器同步、自动抓取、网页归档或跨设备访问则提前重扫。

内部：项目的 [spec](../design/01-spec.md)、[constitution](../design/02-constitution.md)、[PRD](../design/06-prd.md)、[ADR](../adr/)、`src`、现有 SQLite/JSON 备份、Tauri 插件、已安装 skill 与体系 `Reusable-Capabilities.md` 均已查。没有网址资源模型或网站 Tab；有可复用的本地数据、导入事务、Toast 撤销、AnchoredEditor、CSS token 和 IPC 名称门。内部 capability 目录未发现现成的网站组件。已有 `tauri-plugin-dialog` 不承担网址打开。

| 能力 | 已核实候选（A 级一手来源） | 本项目差异与缺口 | 决定 |
| --- | --- | --- | --- |
| 整理与检索 | [Chrome 原生书签](https://support.google.com/chrome/answer/188842?hl=en-UM)已有文件夹、搜索、排序；[linkding](https://github.com/sissbruecker/linkding)有标签、搜索、导出等；[Karakeep](https://github.com/karakeep-app/karakeep)有抓取与全文检索 | 这些产品可直接管理大量网页；当前目标是热键唤起的同一桌面窗口内，和提示词并列的少量快捷入口、随同一 JSON 备份。移植完整管理器会引入额外服务/账号/数据源。 | 借鉴可见分组与快速搜索；仅自建轻量 UI/SQLite 适配。 |
| 打开网址 | [Tauri opener `open_url`](https://docs.rs/tauri-plugin-opener/latest/tauri_plugin_opener/fn.open_url.html)可交给系统默认程序 | 项目尚未安装该插件；直接在前端使用通用外链权限会扩大可打开范围。 | 采用官方 Rust 插件，由 IPC 只按已保存 ID 打开，HTTP(S) 校验。 |
| 恢复与备份 | Chrome [删除不可恢复的说明](https://support.google.com/chrome/answer/188842?hl=en-UM)与 linkding 的[备份易用性讨论](https://github.com/sissbruecker/linkding/issues/454)显示保存和恢复语义需明确；项目已有快照/事务/撤销。 | 外部产品的备份契约无法直接并入 prompt-hub 原有 JSON 导入；旧包没有网址键。 | 复用现有事务与撤销，增加独立可恢复网站集合，明确缺失/空/null。 |
| 浏览器同步、网页抓取与归档 | [Floccus](https://github.com/floccusaddon/floccus)处理跨浏览器同步，linkding/Karakeep 含抓取或归档；[早期个人信息管理研究](https://www.microsoft.com/en-us/research/publication/keeping-found-things-found-web/)指出单纯收藏不一定有助于重新找到资料 | 超出本轮“快速打开常用网站”，会引入同步冲突、网络依赖和维护成本；项目要求本地优先。 | 本轮不建，说明字段保留“为什么收录”的上下文；真实使用后再评估。 |

最大未知：这个入口在实际使用中是否比浏览器书签更容易被看到并使用。通过后续真机行为而非虚构效率数字判断。触发重评：常用网站达到几百条、用户需要同步/批量导入、Tauri opener 大版本变化、或原生浏览器入口直接满足同一热键工作流。
