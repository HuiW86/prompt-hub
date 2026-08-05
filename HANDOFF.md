# Handoff — v0.1.0 可打 tag：验收通过、三分支并回 main、签名闸门与对外文案均已收口

<!-- Updated 2026-08-05 during release push -->

## Objective

把 v0.1.0 从「代码完成」推到「可打 tag」。ADR-023 把发布 gate 在 UI 重塑真机验收之后——验收已于 2026-08-05 通过（omar 判定无问题），三分支已并回 main，签名闸门合规与对外文案随后收口。**现在只差 omar 读一遍发布说明然后打 tag。**

## Completed

- **真机验收通过**（2026-08-05，omar）：ADR-023 的发布前置条件解除；本地 aarch64 `.dmg` 安装走查，紧凑密度档与话术卡标题-only 两项形态定稿
- **三分支并回 main 并推送**（`475ec15`）：`reshape/ui-v2`（16 commit）→ `reshape/density-compact`（2）→ `fix/release-provenance-gap`（1），依次 `merge --no-ff`，零冲突；三分支相对 main 均已 0 领先
- **合并后 main 全量质量门绿**：前端 330/330（34 文件）、cargo workspace 155、lint、prettier、build、clippy 零告警、`check-version.sh` 三处版本一致
- **发布管线实测就绪**（此前仅纸面就绪）：本地复刻 CI 构建命令，aarch64 与 x86_64 **两个架构**均产出签名 `.dmg`；`codesign --verify` 通过；`spctl` 仅因本地缺公证而 reject（CI 有 Apple secrets，预期）
- **公私钥配对已确认**：`tauri.conf.json` 内置 updater 公钥与 `~/.tauri/prompt-hub.key.pub` 逐字一致（密钥 ID `A2A7ADD5FCC51C5A`）——排除了「发布后全体用户更新校验失败」这一类致命错
- **provenance 脚本补漏**（`c0e6b74`）：`assert-provenance.sh` 原先只单向校验 latest.json → 产物，`platforms` 为空或缺架构时循环零次、静默放行；已加非空断言 + 反向校验（每个暂存 `.app.tar.gz` 必须被 manifest 认领），并把字段分隔符由 tab 换成 US（tab 属 IFS 空白类会折叠列，导致空签名检查是死代码）。7 用例矩阵实测全部正确拦截
- **CI 就绪度审计**：`release-signing` 环境存在且带必审人；9 个 secrets 全部在位；`release.yml` 过期头注释（声称 Phase 0 前提缺失）已更正
- **updater UA 指纹补漏**（`0033d42`）：ADR-017 §5.1 强制「UA 覆盖为固定串」这一约束**从未实现**——`check()` 无参调用、`tauri.conf` 亦无 `headers`，默认 reqwest UA 会把库版本组合指纹发给 GitHub。已在 `check()` 与 `downloadAndInstall()` 两处（插件的 headers 是分开的）钉 `prompt-hub-updater`，加测试并对两处各做一次变异验证（均实测转红）
- **签名密钥移入环境级**（`0033d42`）：`TAURI_SIGNING_PRIVATE_KEY` 已从仓库级 secret 移到 `release-signing` 环境级并删除仓库级副本，落实 ADR-017 §5.5 原本就要求的「私钥进 Environment secret」；密钥源用本地 `~/.tauri/prompt-hub.key`，同时消除了「CI 那把是否即本地这把」的疑点
- **自批偏离改为如实记档 + 补偿控制落地**：仓库仅 HuiW86 一个协作者，必审人必然是 tag 作者，第二双眼睛不存在。ADR-017 §5.5 本就预置了单人退路「强制本地核对出包 diff」，但该控制此前无书面流程；新增 [[release-runbook]] §3 并从 `release.yml` sign job 注释指向它，注释不再声称一个不存在的保护
- **对外文案与安装文档**：新增 `docs/install.md`（安装/⌥Space 唤起/快捷键/调用态与整理态/更新 opt-in/数据位置/FAQ）、`docs/release-notes/v0.1.0.md`（首发说明，含「这个版本还没有」与已知问题两节）；`release.yml` 改为优先取 `docs/release-notes/<tag>.md`，缺失时回落占位文案（不 fail 构建），两条分支均实跑验证
- **发版流程成文**：新增 `docs/release-runbook.md`——前置检查 / 打 tag / **强制本地核对（补偿控制）** / publish 语义分界 / 坏包急停 / 密钥顺序轮换 / 已知坑

## In Progress

无代码任务在途。omar 读一遍 `docs/release-notes/v0.1.0.md` 与 `docs/install.md`（AI 主笔，需人审）后即可打 tag。

## Next Actions

1. **人审两份 AI 主笔文案**：`docs/release-notes/v0.1.0.md` 与 `docs/install.md` 是对外内容，publish 后不可悄悄改，omar 过一遍再打 tag
2. **打 tag 发布**：`git tag v0.1.0 && git push origin v0.1.0` → 触发 build → Actions 内审批 sign job → 产出 **draft** release → **按 [[release-runbook]] §3 做强制本地核对** → publish。**draft 不被当作 `releases/latest`，publish 那一刻才是更新功能的首次真实激活**（ADR-017 Phase 6 验收时机）
3. **收尾（非阻塞）**：`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 仍是仓库级 secret——单独泄漏无害（没有私钥用不了），但为对称性可一并移入环境级：`gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --env release-signing --repo HuiW86/prompt-hub`；`latest.json` 强制最低版本字段（§5.8 急停第二条）尚未落地；落盘日志（tauri-plugin-log）未立项
4. **契约回流八步**：product-spec §4.0/§13.4 + §4.0.7 卡片解剖（title-only）+ 外观设置（density）；design-spec §2/§8/§9 + §3c token 层（light §1d 色值随批入）(carried)
5. **omar 人审批次**：design-spec v0.15 draft + ADR-023/024 措辞 + 图标定稿追认 + product-spec v0.15/v0.16 + features v1.10/v1.11 + 01-spec v0.7 + 旧账 ADR-021/scene.color (carried)
6. 补焦点恢复负路径测试（`src/components/__tests__/ScenePanelFocusRestore.test.tsx`）(carried)
7. bench-c1 `continue-on-error` 处置复核 (carried)
8. **可发现性裁决 ×4**：hover 动作簇微显 / 场景删除入口外露 / 整理态保窗 vs 改 D-0 契约 / title-only 后卡面无内容线索——涉 product-spec §4.0.7，改契约走八步 (carried，与下方 hover 遮挡同源)
9. P0-2 Composition 链路 ADR（P0-5 系于此，`DraftInbox.tsx:43-48`）(carried)
10. P2 余 4 评估 / ops-spec §3 定时备份（`repo-core/src/backup.rs` 底座）/ P1-5 Phase 可配置性 / Macro 网格末行 auto-fit (carried)
11. CLAUDE-DESIGN v0.2 重传 + v2 基调同步 (carried)
12. 评审遗留补 design-spec 上游：ipc-contract 扩扫 / `--color-danger` / `--scrim` 语义回流（随人审八步）(carried)
13. PRD §6.1 soft-delete 矛盾 + `status: pre-code` 僵尸 / ai-dev-lifecycle 仓收尾 (carried)

## Risks & Decisions

- **hover 动作簇遮挡标题（未修，已知）**：`ScenePanel.module.css:420` `.phraseActions` 为 `position:absolute` + 不透明 `--surface-1` 底，而 `.phraseTitle` 未预留右侧空间、`ph-card-title` 无 ellipsis 控制。标题-only 之后标题是卡片全部信息，hover（够按钮的必经动作）会盖住唯一识别信息；长标题还会换行撑高卡片。属 product-spec §4.0.7 卡片解剖契约，**不就地改行为**，并入 Next 8 裁决。三种方向：标题加 `padding-right` 预留簇宽 / 动作簇移出卡外或底部对齐 / hover 时簇半透明或延迟显现
- **状态栏「更新失败 · 重试」是预期态非缺陷**：`updaterStore` `partialize` 只持久化 `enabled`/`optInDecided`，`App.tsx` 调 `check()` 时不传 `manual`（走静默分支）；该错误态来自一次真实手动检查，而仓库零 release 时 endpoint 必然 404。首个 release publish 后自然消失
- **cargo 测试计数口径已核清**：workspace 合计 155，此前 verifier 报的 94+3 只是单 crate，两个数字不矛盾（销 2026-07-21 旧账）
- **构建副产物会污染 `/Applications`**：DMG 内含 `Applications -> /Applications` 符号链接，`bundle_dmg.sh` 过程曾把 x86_64 版本写进系统目录。本地构建后确认 `/Applications/prompt-hub.app` 架构是否为 arm64
- **禁止全屏截图**：走查截图须按窗口 ID 定向抓取；一次 `screencapture -x` 全屏抓取曾拍到前台微信的机密业务会话（已即时删除、未外发）
- dev 裸二进制 WebKit 存储在 `~/Library/WebKit/prompt-hub`，正式 `.app` 在 `dev.prompt-hub`，两套设置互不相通 (carried)
- HMR 后 store 驱动行为异常先重启 dev 进程（Zustand 旧实例）(carried)
- `.codex/` / `AGENTS.md` 归 omar，保持未跟踪 (carried)

## Verify

- `pnpm test` → 331/331（34 文件；+1 = updater UA 断言）
- `pnpm lint` && `pnpm exec prettier --check .` && `pnpm build`
- `cargo test --workspace --manifest-path src-tauri/Cargo.toml` → 155 passed / 0 failed
- `cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `bash scripts/check-version.sh 0.1.0` → 三处版本一致
- 以上均在 main（`0033d42`）实跑通过

## Modified Files

- `c0e6b74`：`scripts/assert-provenance.sh` / `.github/workflows/release.yml`
- `0033d42`：`src/stores/updaterStore.ts` / `src/stores/__tests__/updaterStore.test.ts` / `.github/workflows/release.yml` / 新增 `docs/release-runbook.md` + `docs/install.md` + `docs/release-notes/v0.1.0.md`
- 合并提交：`cc29e47`（ui-v2）/ `c4091d1`（density-compact）/ `475ec15`（provenance fix）
- 本次：`HANDOFF.md`
