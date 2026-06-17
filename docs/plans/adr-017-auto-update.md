---
type: plan
project: prompt-hub
version: v0.1
created: 2026-06-17
last_modified: 2026-06-17
status: in-progress
author: co  # 🤝 人机共创（CLAUDE §5.2）
related: [[017-enable-auto-update]], [[10-ops-spec]], [[06-prd]], [[09-tech-stack]], [[07-features]], [[02-constitution]]
description: ADR-017 自动更新实现任务清单——tauri-plugin-updater + GitHub Releases，分 6 阶段（密钥前置 / 配置接入 / 客户端逻辑+UI / Vite 加固 / CI 出包 / 文档涟漪+验证）
---

# Plan: ADR-017 自动更新实现

> 决策依据见 [[017-enable-auto-update]]（Accepted 2026-06-17）。本文承载 §6 落地清单的实施追踪。
> 执行纪律：客户端逻辑守 [[02-constitution#C1]] 200ms（检查走后台 spawn）+ [[02-constitution#A2]] 受限豁免（首启 opt-in + 总开关零出站）。

---

## 依赖关系

- **Phase 0（密钥）阻塞 Phase 1 的 pubkey + Phase 4 的 secret**——keypair 由人执行，私钥进 GitHub Environment secret。
- **Phase 5（文档涟漪）defer 到实现后**——ADR Risks 明确勿在 updater 未落地时回写「已有功能」，避免 features/tech-stack 与代码 drift。
- 决策：提示 UI **纯自建**（toastStore），不引入 `tauri-plugin-dialog`（贴手动挡 + 少一依赖）。

---

## Phase 0 — 密钥前置 🧑 人执行 [BLOCKING]

- [ ] `tauri signer generate -w ~/.tauri/prompt-hub.key`（带 password，离线存，绝不进同步盘/repo）
- [ ] 公钥内容交 AI → 填进 `tauri.conf.json` `plugins.updater.pubkey`
- [ ] 私钥 + password 进 GitHub Environment secret（`TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`）+ 挂 required reviewer（第二人，非发版触发者）
- [ ] 确认发布仓库 public（ADR §4 已拍板）+ 仓库内无真实话术 / 隐私指纹 / 私钥

## Phase 1 — 配置接入（本地可验）✅

- [x] `Cargo.toml`：`tauri-plugin-updater = 2.10`（实装 2.10.1）+ `tauri-plugin-process` + **`serde_json`**（generate_context! 嵌 pubkey 需直接依赖）
- [x] `package.json`：`@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process`（2.10.1 / 2.3.1）
- [x] `tauri.conf.json`：`plugins.updater`（`endpoints` 单一 canonical `releases/latest/download/latest.json` + `pubkey` **占位**）+ `bundle.createUpdaterArtifacts: true`
  - ⚠️ **待你确认**：endpoint 用了占位仓库 `github.com/prompt-hub/prompt-hub`——真实 GitHub owner/repo 待告知后替换；pubkey 待 Phase 0 真公钥替换
- [x] `capabilities/default.json`：`updater:default` / `allow-check` / `allow-download-and-install` / `process:default` / `process:allow-restart`
- [x] Rust toolchain ≥ 1.77.2（实测 1.94.0 ✓）

## Phase 2 — 客户端逻辑 + UI ✅

- [x] `lib.rs`：注册 updater + process plugin
- [x] 检查走 **JS 侧 `updaterStore.check()`**（决策偏离 ADR「Rust spawn」字面，守其 intent）——在 App.tsx 启动 useEffect 跑一次，**不进 ⌥Space 唤起热路径**（该路径是 Rust global-shortcut handler，未动）；ADR 允许「仅启动时一次」
- [x] `updaterStore`（新，zustand persist→localStorage）：「更新检查」总开关 `enabled`（关闭 `check()` 直接短路零出站）+ 首启 `optInDecided` opt-in（默认 off）
- [x] 前端自建 UI：`UpdaterBanner`（opt-in 授权 / 发现新版本 / 下载中 / 错误，protocol 色，非 data-region 不入 Tab 循环）+ StatusBar「检查更新」入口（`tabIndex=-1`，关闭态点击回开 opt-in）+ toast 提示
- [x] 下载/安装由用户显式确认（banner「下载并安装」按钮）；安装后 `relaunch()`
- [x] 默认拒降级——未设 `allowDowngrades` / 未放宽 `version_comparator`
- [x] 测试：`updaterStore.test.ts` +5（核心断言：总开关关闭时 `check()` 零触网，守 A2）

## Phase 3 — Vite 密钥泄漏加固 ✅

- [x] `vite.config.ts`：锁 `envPrefix: ['VITE_', TAURI_ENV_* 白名单]`，严禁 `TAURI_SIGNING_*` 进前端 bundle（GHSA-2rcp-jvr4-r259）

> **Phase 1-3 验证全绿（2026-06-17）**：pnpm build ✓ / pnpm test 92（+5）✓ / lint + prettier clean / cargo test --workspace ✓ / clippy + fmt clean

## Phase 4 — CI 自动出包 [草稿就绪，待 Phase 0 dry-run]

> 仓库已锁定 `HuiW86/prompt-hub`（2026-06-17）。草稿可审查 + 可本地验的部分全绿，但**端到端不可验**——需 Phase 0 密钥 + secret + Environment 配置后跑真实 dry-run。

- [x] `.github/workflows/release.yml`（two-job 隔离）：
  - [x] 仅 `on.push.tags: v*.*.*` 触发；`workflow_dispatch`/`repository_dispatch`/`schedule` 不列入 = 无法旁路触发
  - [x] build 与 sign 拆**独立 job**——build job 无 minisign 钥（投毒依赖偷不到钥）；sign job 挂 `environment: release-signing`（需配 required reviewer，非 tag 作者）
  - [x] 全部第三方 action pin commit SHA；`permissions: contents: write`；`::add-mask::` 屏蔽钥 + 无 `set -x`
  - [x] macOS 顺序：build job `--bundles app --config createUpdaterArtifacts:false` 出**已公证 .app** → sign job 打 `.app.tar.gz` → `tauri signer sign` 出 `.sig` → jq 手装 latest.json（替代 includeUpdaterJson，因签名已拆到 sign job）；aarch64 + x86_64 双架构矩阵
  - [x] provenance 断言（`scripts/assert-provenance.sh`）：tag ↔ latest.json ↔ artifact 三者一致，不过即 fail
  - [x] draft 流程：`gh release create --draft`，人核 hash 后手动 publish 才成 latest
- [x] pre-tag version 校验脚本（`scripts/check-version.sh`，三处 version vs tag）
- [x] 本地验证：check-version（0.1.0 pass / 9.9.9 fail）✓ / assert-provenance（happy/版本不符/缺签名 三态）✓ / YAML 合法 ✓

> **待 Phase 0 后核对**：① pubkey 占位替换 ② secret 配齐（TAURI_SIGNING_* + APPLE_* + APPLE_CERTIFICATE*）③ Environment `release-signing` + required reviewer ④ dry-run 验 `tauri build --bundles app` 的 .app 路径 + `tauri signer sign` CLI 行为 + 公证链路

## Phase 5 — 文档涟漪（方法论 §7，实现后同批）

- [x] C3/C4：`06-prd §8.3` L2 补 updater 例外（v0.10）/ `10-ops-spec §5.2` telemetry 措辞澄清（v0.3，反向指针 §9.4）—— 2026-06-17
- [ ] `07-features` 加自动更新功能项
- [ ] `09-tech-stack` 登记 updater + process 依赖 + Rust ≥1.77.2
- [ ] `CLAUDE.md §7` 状态指针（ADR 14→15 Accepted，017 入列）
- [ ] `CHANGELOG` + `MANIFEST` bump
- [ ] 可选 🧑：`02-constitution` A2 加 ADR-017 指针 note（人主笔）

## Phase 6 — 验证 + 真机

- [ ] `cargo test --workspace` / `pnpm test` / `pnpm build` 全绿
- [ ] `pnpm bench:hotkey-wake` 复测——后台检查不拖慢唤起（守 C1 200ms）
- [ ] 真机：updater opt-in/检查/提示链路 + 遗留 #15170 多屏 re-fit 验收
