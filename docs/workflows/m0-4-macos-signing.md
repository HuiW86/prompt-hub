---
type: workflow
project: prompt-hub
created: 2026-06-03
status: active
audience: [human, ai]
related:
  - 10-ops-spec
  - prompt-hub-mvp
  - 008-enable-macos-private-api
description: M0-4 spike runbook — Developer ID 签名 + notarization 空壳验证。证书到位后照此跑通，验证 macos-private-api + hardened runtime 的 entitlements 能否过公证。
---

# M0-4 — macOS Developer ID 签名 + 公证 Runbook

> 本 spike 的**真实目标**不是「证书能不能签」，而是验证
> **`macos-private-api`（ADR-008）+ hardened runtime 的 entitlements 组合能否通过 notarization 并被 Gatekeeper 放行**。
> 这是 [[prompt-hub-mvp#M0]] 风险前移项，验收口径见 plan「空壳 .dmg 通过 notarization，本机 Gatekeeper 放行」。

## 前置（一次性，交互操作）

### 1. 签发 Developer ID Application 证书（无需完整 Xcode）

1. 钥匙串访问 → 证书助理 → 从证书颁发机构请求证书 → 邮箱填 Apple ID、CA 留空、**存储到磁盘** → `CertificateSigningRequest.certSigningRequest`
2. https://developer.apple.com/account/resources/certificates → `+` → 类型 **Developer ID Application**（不是 Apple Distribution）→ 上传 CSR → Download `.cer`
3. 双击 `.cer` 安装进 login keychain（私钥已在第 1 步就位）
4. 校验：

```bash
security find-identity -v -p codesigning | grep "Developer ID Application"
# 期望: Developer ID Application: Hui Wang (NY89JGE95Q)
```

> 若证书显示的名字与 `tauri.conf.json` 里 `bundle.macOS.signingIdentity` 不一致，以 keychain 实际名字为准，回改 config。

### 2. 准备 notarization 凭证（二选一）

- **App-specific password**：appleid.apple.com → 登录与安全 → App 专用密码 → 生成
- 或 **App Store Connect API Key**（CI 更稳，单人本机非必需）

## 构建 + 签名 + 公证

环境变量（**不进 git**，临时 export 或放 keychain）：

```bash
export APPLE_ID="你的 Apple ID 邮箱"
export APPLE_PASSWORD="上一步生成的 App 专用密码"
export APPLE_TEAM_ID="NY89JGE95Q"
```

tauri 构建（会自动用 `tauri.conf.json` 的 signingIdentity + entitlements 签名，并触发 notarization）：

```bash
pnpm tauri build
```

产物：`src-tauri/target/release/bundle/dmg/prompt-hub_0.1.0_*.dmg`
       `src-tauri/target/release/bundle/macos/prompt-hub.app`

## 验收（逐项确认）

```bash
APP="src-tauri/target/release/bundle/macos/prompt-hub.app"
DMG="$(ls src-tauri/target/release/bundle/dmg/*.dmg | head -1)"

# 1. 签名有效 + 含 Developer ID + hardened runtime
codesign -dv --verbose=4 "$APP" 2>&1 | grep -E "Authority|flags|runtime"
codesign --verify --deep --strict --verbose=2 "$APP"

# 2. entitlements 确实带上了（应看到 allow-jit / disable-library-validation）
codesign -d --entitlements :- "$APP"

# 3. 公证状态（build 时已 staple；若手动公证用 notarytool submit --wait）
xcrun stapler validate "$APP"
xcrun stapler validate "$DMG"

# 4. Gatekeeper 放行（关键验收）—— accepted 即过
spctl -a -vvv -t install "$DMG"
spctl -a -vvv "$APP"
```

**通过判据**：`spctl` 输出 `accepted` + `source=Notarized Developer ID`，且 `stapler validate` 返回 `The validation action worked!`。
**真问题验证**：双击 `.app` 能正常起窗（透明 always-on-top 不黑屏）——证明私有 API + JIT entitlement 组合在公证后仍可运行。

## 失败排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 公证 `Invalid` + log 提到 hardened runtime | 缺 hardened runtime flag | tauri 默认带；确认 `codesign -dv` 的 `flags=...(runtime)` |
| 起窗黑屏 | 缺 JIT entitlement | 检查 entitlements.plist 三项是否齐全 |
| `spctl` rejected | 未 staple / 公证未完成 | `xcrun notarytool log <id>` 看详情 |
| 公证拒绝私有 API | macos-private-api 与公证冲突（**最坏情况**） | 触发 plan 风险出口：记入 [[10-ops-spec#§7]]，评估 ADR-008 影响，不阻塞第一阶段功能开发 |

## 风险出口（plan §M0）

签名/公证链路卡住属 ops 问题，**不阻塞第一阶段功能开发**，但阻塞任何对外发布。卡住时记入 [[10-ops-spec]] 并在此 runbook 追加结论。
