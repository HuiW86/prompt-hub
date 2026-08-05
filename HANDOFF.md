# Handoff — v0.1.0 发布就绪：验收通过、三分支并回 main，待 omar 处置签名闸门后打 tag

<!-- Updated 2026-08-05 during release push -->

## Objective

把 v0.1.0 从「代码完成」推到「可打 tag」。ADR-023 把发布 gate 在 UI 重塑真机验收之后——验收已于 2026-08-05 通过（omar 判定无问题），三分支已并回 main。剩余阻塞全部在 GitHub 配置与对外文案侧，不在代码侧。

## Completed

- **真机验收通过**（2026-08-05，omar）：ADR-023 的发布前置条件解除；本地 aarch64 `.dmg` 安装走查，紧凑密度档与话术卡标题-only 两项形态定稿
- **三分支并回 main 并推送**（`475ec15`）：`reshape/ui-v2`（16 commit）→ `reshape/density-compact`（2）→ `fix/release-provenance-gap`（1），依次 `merge --no-ff`，零冲突；三分支相对 main 均已 0 领先
- **合并后 main 全量质量门绿**：前端 330/330（34 文件）、cargo workspace 155、lint、prettier、build、clippy 零告警、`check-version.sh` 三处版本一致
- **发布管线实测就绪**（此前仅纸面就绪）：本地复刻 CI 构建命令，aarch64 与 x86_64 **两个架构**均产出签名 `.dmg`；`codesign --verify` 通过；`spctl` 仅因本地缺公证而 reject（CI 有 Apple secrets，预期）
- **公私钥配对已确认**：`tauri.conf.json` 内置 updater 公钥与 `~/.tauri/prompt-hub.key.pub` 逐字一致（密钥 ID `A2A7ADD5FCC51C5A`）——排除了「发布后全体用户更新校验失败」这一类致命错
- **provenance 脚本补漏**（`c0e6b74`）：`assert-provenance.sh` 原先只单向校验 latest.json → 产物，`platforms` 为空或缺架构时循环零次、静默放行；已加非空断言 + 反向校验（每个暂存 `.app.tar.gz` 必须被 manifest 认领），并把字段分隔符由 tab 换成 US（tab 属 IFS 空白类会折叠列，导致空签名检查是死代码）。7 用例矩阵实测全部正确拦截
- **CI 就绪度审计**：`release-signing` 环境存在且带必审人；9 个 secrets 全部在位；`release.yml` 过期头注释（声称 Phase 0 前提缺失）已更正

## In Progress

无代码任务在途。发布卡在下方 Next Actions 1–3，均需 omar 在 GitHub 侧或文案侧动作。

## Next Actions

1. **签名密钥作用域**（打 tag 前必做）：`TAURI_SIGNING_PRIVATE_KEY` 与其密码目前是**仓库级** secret，不是 `release-signing` **环境级**——任何新增 workflow 都能引用它而绕过审批闸门，与 ADR-017 §5.5 声称的安全模型不符。移到环境级并删除仓库级；建议直接从 `~/.tauri/prompt-hub.key` 重新上传，顺带消除「CI 里的私钥是否就是本地这把」这一无法从外部验证的疑点（secrets 只写）
2. **审批人策略裁决**：`release-signing` 必审人是 HuiW86 本人且 `prevent_self_review: false`，而 `release.yml` 注释要求「审批人不是 tag 作者」。单人项目下开启 `prevent_self_review` 会导致永久无法发布。二选一：加第二审批人，或接受偏离并在 ADR-017 如实记档（**不要让注释继续声称一个不存在的保护**）
3. **对外文案与交付余量**：发布说明（workflow 建 draft 用的是占位文案）；仓库无 README、无安装/快捷键/FAQ 文档，而 `.dmg` 是首次对外分发；落盘日志（tauri-plugin-log）未立项
4. **打 tag 发布**（1–3 完成后）：从 main 打 `v0.1.0` → 触发 build → Actions 内审批 sign job → 产出 **draft** release → 核对哈希后手动 publish。**draft 不被当作 `releases/latest`，publish 那一刻才是更新功能的首次真实激活**（ADR-017 Phase 6 验收时机）
5. **契约回流八步**：product-spec §4.0/§13.4 + §4.0.7 卡片解剖（title-only）+ 外观设置（density）；design-spec §2/§8/§9 + §3c token 层（light §1d 色值随批入）(carried)
6. **omar 人审批次**：design-spec v0.15 draft + ADR-023/024 措辞 + 图标定稿追认 + product-spec v0.15/v0.16 + features v1.10/v1.11 + 01-spec v0.7 + 旧账 ADR-021/scene.color (carried)
7. 补焦点恢复负路径测试（`src/components/__tests__/ScenePanelFocusRestore.test.tsx`）(carried)
8. bench-c1 `continue-on-error` 处置复核 (carried)
9. **可发现性裁决 ×4**：hover 动作簇微显 / 场景删除入口外露 / 整理态保窗 vs 改 D-0 契约 / title-only 后卡面无内容线索——涉 product-spec §4.0.7，改契约走八步 (carried，与下方 hover 遮挡同源)
10. P0-2 Composition 链路 ADR（P0-5 系于此，`DraftInbox.tsx:43-48`）(carried)
11. P2 余 4 评估 / ops-spec §3 定时备份（`repo-core/src/backup.rs` 底座）/ P1-5 Phase 可配置性 / Macro 网格末行 auto-fit (carried)
12. CLAUDE-DESIGN v0.2 重传 + v2 基调同步 (carried)
13. 评审遗留补 design-spec 上游：ipc-contract 扩扫 / `--color-danger` / `--scrim` 语义回流（随人审八步）(carried)
14. PRD §6.1 soft-delete 矛盾 + `status: pre-code` 僵尸 / ai-dev-lifecycle 仓收尾 (carried)

## Risks & Decisions

- **hover 动作簇遮挡标题（未修，已知）**：`ScenePanel.module.css:420` `.phraseActions` 为 `position:absolute` + 不透明 `--surface-1` 底，而 `.phraseTitle` 未预留右侧空间、`ph-card-title` 无 ellipsis 控制。标题-only 之后标题是卡片全部信息，hover（够按钮的必经动作）会盖住唯一识别信息；长标题还会换行撑高卡片。属 product-spec §4.0.7 卡片解剖契约，**不就地改行为**，并入 Next 9 裁决。三种方向：标题加 `padding-right` 预留簇宽 / 动作簇移出卡外或底部对齐 / hover 时簇半透明或延迟显现
- **状态栏「更新失败 · 重试」是预期态非缺陷**：`updaterStore` `partialize` 只持久化 `enabled`/`optInDecided`，`App.tsx` 启动检查为无参调用（走静默分支）；该错误态来自一次真实手动检查，而仓库零 release 时 endpoint 必然 404。首个 release publish 后自然消失
- **cargo 测试计数口径已核清**：workspace 合计 155，此前 verifier 报的 94+3 只是单 crate，两个数字不矛盾（销 2026-07-21 旧账）
- **构建副产物会污染 `/Applications`**：DMG 内含 `Applications -> /Applications` 符号链接，`bundle_dmg.sh` 过程曾把 x86_64 版本写进系统目录。本地构建后确认 `/Applications/prompt-hub.app` 架构是否为 arm64
- **禁止全屏截图**：走查截图须按窗口 ID 定向抓取；一次 `screencapture -x` 全屏抓取曾拍到前台微信的机密业务会话（已即时删除、未外发）
- dev 裸二进制 WebKit 存储在 `~/Library/WebKit/prompt-hub`，正式 `.app` 在 `dev.prompt-hub`，两套设置互不相通 (carried)
- HMR 后 store 驱动行为异常先重启 dev 进程（Zustand 旧实例）(carried)
- `.codex/` / `AGENTS.md` 归 omar，保持未跟踪 (carried)

## Verify

- `pnpm test` → 330/330（34 文件）
- `pnpm lint` && `pnpm exec prettier --check .` && `pnpm build`
- `cargo test --workspace --manifest-path src-tauri/Cargo.toml` → 155 passed / 0 failed
- `cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings`
- `bash scripts/check-version.sh 0.1.0` → 三处版本一致
- 以上均在合并后的 main（`475ec15`）实跑通过

## Modified Files

- `c0e6b74`：`scripts/assert-provenance.sh` / `.github/workflows/release.yml`
- 合并提交：`cc29e47`（ui-v2）/ `c4091d1`（density-compact）/ `475ec15`（provenance fix）
- 本次：`HANDOFF.md`
