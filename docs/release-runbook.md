---
type: runbook
project: prompt-hub
description: v* 发版操作手册——打 tag 前后的逐步动作、单人发版的强制本地核对、坏包急停与密钥轮换
---

# 发版 Runbook

> 本文是 [[017-enable-auto-update]] §5.5 要求的操作层落地。**§3 的本地核对不是可选步骤**——它是单人发版场景下替代「第二人审批」的补偿控制，跳过它等于整条签名闸门失效。

---

## §1 前置检查（打 tag 之前）

在 `main` 上依次跑通，任一项不过就不要打 tag：

```bash
pnpm test                                                   # 前端全量
pnpm lint && pnpm exec prettier --check . && pnpm build
cargo test --workspace --manifest-path src-tauri/Cargo.toml
cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings
bash scripts/check-version.sh <版本号>                       # 三处 version 必须一致
```

版本号要同时改三处（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`），没有官方自动同步机制；`check-version.sh` 是唯一防线，CI 里也会再跑一次。

确认仓库仍是 **public**。ADR-017 Option A 的隐含前置是公开仓库——私有仓库的 Release 资产不可匿名下载，updater 直连会直接失效。

---

## §2 打 tag 触发流水线

```bash
git tag v<版本号>
git push origin v<版本号>
```

只有 `v*.*.*` 形式的 tag push 会触发。`workflow_dispatch` / `repository_dispatch` / `schedule` 均**故意未注册**，不存在旁路触发。

流水线两段：

1. **build**（矩阵 aarch64 + x86_64）：构建 → Apple 签名 → 公证。此 job **看不到 minisign 私钥**，被投毒的构建期依赖偷不到它。
2. **sign**（环境 `release-signing`，需人工审批）：打包 `.app.tar.gz` → minisign 签名 → 组装 `latest.json` → 跑 provenance 断言 → 建 **draft** release。

在 Actions 页面审批 sign job 之后才会注入密钥。

---

## §3 强制本地核对（补偿控制，不可跳过）

ADR-017 §5.5 要求审批人不是 tag 作者。本仓库只有一个协作者，审批必然是自批，第二双眼睛不存在。**因此以下核对是硬性替代**，在 publish draft 之前完成：

1. **下载 draft release 的全部资产**，与本地构建产物逐项比对。本地复刻 CI 构建命令：

   ```bash
   pnpm tauri build --target aarch64-apple-darwin --bundles app,dmg \
     --config '{"bundle":{"createUpdaterArtifacts":false}}'
   ```

2. **核对 `latest.json`**：`version` 与 tag 一致；`platforms` 含 `darwin-aarch64` 与 `darwin-x86_64` 两项；每个 `url` 指向本次 release 的资产且文件名带版本号。CI 的 `scripts/assert-provenance.sh` 已自动断言这些，本步是人工复核而非主防线。

3. **核对签名与公证**——分开验，两者会独立失败：

   ```bash
   codesign --verify --deep --strict --verbose=2 <路径>/prompt-hub.app   # 签名
   xcrun stapler validate <路径>/prompt-hub.app                          # 公证票据
   xcrun stapler validate <路径>/prompt-hub_<版本>_<target>.dmg
   spctl -a -vvv -t exec <路径>/prompt-hub.app                           # Gatekeeper 实判
   ```

   **任何一条 reject 都必须当真，不要归因于本地环境。** 签名与公证是两件事：签名只需要证书，公证需要把包提交 Apple 并把票据 staple 回来，`codesign` 全绿而 `stapler` 说 `does not have a ticket stapled` 是完全可能的组合——v0.1.0 第一次打 tag 时正是如此（Tauri 凭据变量名不匹配，公证被静默跳过，CI 照样绿）。本文旧版在此处写着「本地未公证构建会 reject」，把唯一的真信号预先解释成了噪音；**一个失败模式被提前开脱的检查，不是检查**。CI 的 `Assert notarized + stapled` 现已把同样的断言前移到构建期，本步是人工复核。

4. **核对内嵌公钥**：`src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey` 必须与签名所用私钥配对。公钥内容即 `~/.tauri/prompt-hub.key.pub` 的原文（该 `.pub` 文件本身已是 base64，不要再解一层码）。**不配对 = 发布后全体用户的更新校验失败**。

5. **核对 Actions log 无密钥回显**：仓库是 public，Actions log 公开可见。确认 `::add-mask::` 生效、无 `set -x`。

---

## §4 Publish

核对全过。在 Release 页面把 draft 转为正式发布。

**这一步是不可逆的语义分界**：draft **不会**被 GitHub 当作 `releases/latest`，所以在 publish 之前 updater 端点始终 404，客户端拉不到任何更新；publish 那一刻更新通道才真正激活。首次发布时，这也是 ADR-017 Phase 6 真机验收的时机。

publish 后验一次真实更新链路：用上一版客户端触发「检查更新」，确认能发现新版本、下载、校验、重启。

---

## §5 坏包急停

禁降级（§5.6）意味着用户无法自行退回，所以坏包必须有急停通道。两条，按顺序：

1. **立即把坏 Release 转回 draft 或 un-publish**。`releases/latest` 会回落到上一个好版本，尚未升级的用户不再拉到坏包。这是「draft 非 latest」这一特性的反向利用。
2. **已经升上去的用户**只能靠下一版拉回——尽快发修复版。`latest.json` 预留强制最低版本字段用于此场景（当前 manifest 仅含 `version` / `pub_date` / `platforms`，该字段尚未落地）。

---

## §6 密钥轮换

私钥泄漏或需换钥时**不要直接换**，走顺序轮换，否则存量客户端内嵌的旧公钥会导致更新链断裂：

1. 过渡版：仍用**旧私钥**签名，但 `tauri.conf.json` 内嵌**新公钥**发布；
2. 下一版：切到新私钥签名。存量用户在第 1 步已经拿到新公钥，可无缝校验。

泄漏场景下还须配合强制最低版本字段强推一版，尽快把仍内嵌旧公钥的客户端拉离——否则持旧私钥者仍能对未升级客户端伪造更新包。

本地私钥备份（`~/.tauri/prompt-hub.key`）带密码保护，须离线存放，**绝不进任何同步盘或仓库**。

---

## §7 已知坑

- **构建会污染 `/Applications`**：DMG 内含 `Applications -> /Applications` 符号链接，`bundle_dmg.sh` 过程可能把刚构建的 `.app`（含非本机架构的版本）写进系统目录。本地构建后确认 `/Applications/prompt-hub.app` 的架构：`lipo -info /Applications/prompt-hub.app/Contents/MacOS/prompt-hub`。
- **走查截图只按窗口抓**，不要用 `screencapture -x` 全屏——会把当时前台的其他窗口内容一并拍进去。
- **签名顺序不能改**：公证 `.app`（staple）→ 从已 staple 的 `.app` 打 `app.tar.gz` → 对最终归档跑 `tauri signer sign`。先签后改归档字节会导致 `.sig` 与交付文件失配，updater 校验失败。
