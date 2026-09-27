# prompt-hub 0.2.1 本机安装记录

2026-09-24；来源为当前未提交工作区（基底 `317106deaef72b5edc83a74bd63402bd1b4ac6c2`，含本目录网站功能）。这是本机更新记录，不是公开发布或人审结论。

| 检查 | 实际结果 |
| --- | --- |
| 版本锁 | `bash scripts/check-version.sh 0.2.1` 通过；package、Tauri 配置、主 Cargo 一致；MCP crate 同步为 0.2.1 |
| 安装前数据 | schema 14、`integrity_check=ok`、`usage_records=73` |
| 恢复点 | `backups/manual-pre-install-1790233487.db`；旧应用 `backups/prompt-hub-0.2.0-before-0.2.1.app` 和 `backups/prompt-hub-0.2.0-original.app` |
| 构建 | `pnpm tauri build --bundles app --config '{"bundle":{"createUpdaterArtifacts":false}}'` 成功，版本 0.2.1；本地 Developer ID 签名，未公证 |
| 签名与安装 | 新旧包及 `/Applications/prompt-hub.app` 均通过 `codesign --verify --deep --strict`；新包可执行文件 SHA-256 `074bbca01c2d0d4b219422cf10f1972b325d90290b0ff3ffe0943c123448ca02` 与安装版一致 |
| MCP | `cargo build --release --manifest-path src-tauri/Cargo.toml -p prompt-hub-mcp` 通过；产物 SHA-256 `833d4019ebe0cf88b60aa480c63d0b3bbef77eaf689716a868a16c3f4ecb10f9`；未发现正在使用的 MCP 配置 |
| 首启迁移 | 自动快照 `backups/pre-migrate-1790233673.db`；日志：`migration 15 (0015_websites) applied`，`prompt-hub 0.2.1 started ... user_version=15 quick_check=ok` |
| 首启数据 | schema 15、`integrity_check=ok`、`usage_records=73`、网站相关表 2 张 |
| 原生界面 | 已在安装版点击“常用网站”，实际显示空库、搜索、分组、添加网站与已删除入口 |

未验证：真实网站打开后的默认浏览器行为、窗口焦点、唤起 P95、真实导入、第三方下载分发。GitHub 最新公开版本仍是 v0.2.0；0.2.1 未打 tag、未上传 release、未生成签名更新清单。
