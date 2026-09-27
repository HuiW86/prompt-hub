---
type: execution-package
version: v0.1
status: in-progress
author: ai
created: 2026-09-23
---

# 常用网站 Tab · 首个正向实作

用户已授权实现。本文是执行与验收记录，不替代人写 spec/constitution，也不代表文档已获人审。

目标：在提示词旁快速整理和打开常用网站。第一版包含独立 Tab、名称/网址/说明、分组、手动排序、搜索、系统默认浏览器打开、删除撤销与长期恢复、备份导入导出。无云同步、网站抓取、账号、提示词第四层。

基线：317106deaef72b5edc83a74bd63402bd1b4ac6c2；工作区已有文档及用户未跟踪文件。沿用现有 Tauri / SQLite / Zustand / CSS tokens，网站首次进入时加载。保留旧布局与提示词行为。

验收：新增与编辑保存后重启可读；搜索名称/域名/说明；分组移动与上下排序持久化；打开仅接受 HTTP(S) 且由 Rust 读取已保存 URL；打开失败给反馈；删除可撤销且可从已删除列表恢复；旧备份缺网站键时保留网站，显式空库清空，null 拒绝；损坏导入全部回滚；真实用户数据不作测试夹具。

产出：代码、ADR-030、数据库与 IPC 契约、交互/仓储测试、架构图、原始验证日志、方法反馈。周期按实际记录，不由测试通过推断提速。

## 相关资产与实际状态

- [先例扫描及借造决定](prior-art-and-decision.md) · [ADR-030](../adr/030-website-library.md) · [设计增量](design-delta.md) · [正向实作反馈](practice-feedback.md)。
- [架构源图](architecture.mmd) 已渲染为 [SVG](architecture.svg) / [PNG](architecture.png)，图卡与版本见设计增量。
- 自动验证原始日志位于 `evidence/`；测试不等于真机浏览器打开、窗口焦点或热键唤起延迟通过。

## 架构图依赖检查

对 2026-09-22 逆向图模型执行 `diagram_views.py check --report`：D1/D2/D3 的源码声明范围已变化，状态为 `needs_review`；D4 仍 `current`。原始检查见 [日志](evidence/old-diagrams-check.log) 与[旧图状态](../architecture-system-pilot/2026-09-22/diagrams/view-status.json)。保留旧图的 317106d 历史基线，本轮增量结构由上方新图表示；不把旧图静默改成当前代码图。

## 自动与预览验证（2026-09-23）

| 阶段 | 命令 / 输入 | 结果与边界 |
| --- | --- | --- |
| 前端逻辑及文档门 | `pnpm test` | 46 文件、540 项通过；含网站 UI、IPC 名称、旧备份提示与文档引用门。[原始日志](evidence/frontend-test.log)。 |
| 构建及静态检查 | `pnpm build`、`pnpm lint`、改动前端文件 `prettier --check` | 通过；网站页产物独立 chunk，初始 bundle 不含网站组件。[构建](evidence/frontend-build.log)、[lint](evidence/frontend-lint.log)、[格式](evidence/prettier-check.log)。 |
| Rust 数据行为 | `cargo test --workspace --manifest-path src-tauri/Cargo.toml` | 231 项通过，使用临时 SQLite；含网站 CRUD、排序、删除恢复、非法 URL、导入缺失/空/null 与事务回滚。[原始日志](evidence/rust.log)。 |
| Rust 静态检查 | `cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings` | 通过；新增两个网站模块的 `rustfmt --check` 通过。[clippy](evidence/rust-clippy.log)、[格式](evidence/rust-fmt-new.log)。全工作区 `cargo fmt --check` 因旧文件既有格式差异失败，[原始输出](evidence/rust-fmt.log)，未批量重排无关文件。 |
| 隔离浏览器预览 | 临时 Vite + Playwright，注入内存 Tauri IPC 假数据，不打开真实网址或用户库 | 切 Tab、搜索、添加、按 ID 请求打开通过；预览发现并修复侧栏拉伸问题。[脚本](evidence/visual-smoke.py)、[日志](evidence/visual-smoke.log)、[截图](evidence/website-preview.png)。这只验证前端视觉/交互，不证明原生浏览器接管。 |

## 本机更新（2026-09-24）

已将桌面应用与独立 MCP crate 版本号调至 0.2.1。`pnpm tauri build --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'` 完成 Developer ID 签名构建；`codesign --verify --deep --strict` 通过。构建未公证，也未产生自动更新包，因此本次是本机安装，不是 GitHub 对外发布。

安装前使用 SQLite 在线备份 API 留下 [本机数据库快照](</Users/apple/Library/Application Support/dev.prompt-hub/backups/manual-pre-install-1790233487.db>)（schema 14、`integrity_check=ok`、73 条 `usage_records`），旧 `.app` 另存于本机备份目录。退出旧版后替换 `/Applications/prompt-hub.app`。首次启动自动写入 `pre-migrate-1790233673.db`，日志确认 migration 15 已应用、0.2.1 启动且 `quick_check=ok`；随后独立查询得 schema 15、`integrity_check=ok`、73 条记录及两张新网站表。原生窗口已实际显示“常用网站”Tab 和空库界面。详见 [安装记录](evidence/local-install-2026-09-24.md)。

仍需走查真实系统浏览器交接、窗口焦点、快捷键唤起 P95 与真实导入路径；本轮未新增真实网站记录，也未宣称人审通过。MCP 0.2.1 已构建在 `src-tauri/target/release/prompt-hub-mcp`，未发现本机启用的 MCP 配置，因此没有替换运行中的 MCP 服务。后续若启用 MCP，需使用 schema 15 对应版本。
