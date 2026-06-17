---
type: ops-spec
project: prompt-hub
version: v0.2
created: 2026-05-19
status: pre-code
author: ai  # 🤖 AI 主笔 + 人审（CLAUDE §5.2）
audience: [ai, human]
description: prompt-hub 运营规格——部署/性能预算/备份/升级回滚/监控（本地单人语境）
related:
  - 06-prd
  - 02-constitution
  - 11-test-spec
---

# Ops Spec: prompt-hub

> **运营语境特殊性**：单人单机桌面应用（[[02-constitution#A2]] [[02-constitution#A3]]），传统"运营"含义（部署集群/容量规划/SRE on-call）大量 N/A。本文件保留对单人桌面工具**仍然适用**的 ops 实践。

---

## §1 部署模式

### 1.1 分发形态

> **2026-05-19 [[001-choose-desktop-runtime]] 后**：分发统一走 Tauri bundle + `tauri-plugin-updater`，跨 OS 一致。
>
> **2026-05-19 [[008-enable-macos-private-api]] 后**：启用 `macos-private-api` feature 以满足 [[01-spec#2.3]] 主形态视觉效果，**永久排除** macOS App Store 上架（违反 Mac App Store Review Guidelines 2.5.1 私有 API 禁令）；macOS 分发仅走 DMG 直链 + Developer ID 签名 + notarization。若未来需上架 App Store 需开新 ADR superseding ADR-008 并重写主形态窗口管理代码。

| 平台 | 分发方式 | 安装包格式 | 自动更新 |
|---|---|---|---|
| macOS | DMG 直链（**永久排除 App Store**，见 [[008-enable-macos-private-api#6]]）| `.dmg` / `.app` / `.app.tar.gz`（updater）| **tauri-plugin-updater** |
| Windows | MSI 直链 | `.msi` / `.exe.zip`（updater）| **tauri-plugin-updater** |
| Linux | （v2.0 后再考虑） | AppImage / .deb | tauri-plugin-updater |
| iPad（辅形态） | （v2.0+，[[06-prd#7.4]] 次要设备，Tauri 2 支持 iOS 但本项目暂缓） | TestFlight 或 sideload | — |

### 1.2 签名 / 公证

- macOS：必须 Apple Developer ID 签名 + 公证（避免 Gatekeeper 拦截）
- Windows：建议 EV 代码签名（避免 SmartScreen 拦截）
- 签名密钥管理：本地 Keychain / 加密文件，不进 git
- **Tauri 集成方式**（[[001-choose-desktop-runtime]] 后）：在 `tauri.conf.json` 配置 `bundle.macOS.signingIdentity` + `bundle.macOS.entitlements` + `bundle.macOS.providerShortName`，构建时通过 `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` 环境变量触发 notarization，无需自建 shell 脚本

### 1.3 不做的部署

- ❌ Web 部署（[[02-constitution#A1]] 桌面原生 only）
- ❌ Docker / k8s（单人桌面工具，无服务端）
- ❌ 多租户 SaaS（[[02-constitution#A3]] 单人）

---

## §2 性能预算（生产线 SLO）

> 本节是 [[02-constitution#C1]] 的运营落地。Benchmark 在 [[11-test-spec#§5]] 跑，本节定义线上违反时的处理。

| 指标 | SLO | 测量 | 违反处理 |
|---|---|---|---|
| 主形态唤起 P95 | ≤200ms | 用户本地 perf API 自采样（不上报） | 用户体感即可，开 issue |
| 冷启动 P95 | ≤1.5s | 启动到 view:home-* 可交互 | issue + 优先级 P0 |
| 内存常驻 | ≤300MB（含辅形态） | 用户 Activity Monitor / 任务管理器 | warning，>500MB 必修 |
| 包体积 | ≤80MB（解压后） | 构建产物 stat | warning，>120MB 阻塞发布 |

**自采样**：用户本地 perf 数据写入 localStorage `metrics_log`，仅本地查看，**不上报**（[[02-constitution#A2]]）。

> **2026-05-19 [[001-choose-desktop-runtime]] 后**：Tauri 2.x 实测内存常驻 50-100MB / 包体 10-20MB，远低于上述上限。本表保留为**警戒线**（regression 防线），非目标——若实际数字接近上限说明出现内存泄漏或资源未压缩，需调查。

---

## §3 数据备份策略

### 3.1 自动备份触发

| 触发点 | 备份内容 | 命名规则 | 保留期 |
|---|---|---|---|
| 启动时 schema_version 不一致 | 完整数据 JSON | `backup-{timestamp}-{old_version}.json` | 永久（用户决定何时删） |
| 用户主动「清空所有数据」 | 同上 | `backup-{timestamp}-pre-wipe.json` | 永久 |
| 用户主动导出 | 同上 | `prompt-hub-{timestamp}.json` | 用户自管 |
| 每月 1 号（启动时检测） | 同上 | `auto-monthly-{YYYY-MM}.json` | 最近 6 个月 |

### 3.2 备份位置

- 默认：`~/Library/Application Support/prompt-hub/backups/`（macOS）/ `%APPDATA%/prompt-hub/backups/`（Windows）
- 用户可在配置面板改默认目录到 iCloud / Dropbox / Git 仓库

### 3.3 恢复 flow

详见 [[04-user-flows#§3]]。关键约束：恢复前再做一次当前数据备份（防恢复失败丢失现有数据）。

---

## §4 升级回滚契约

> 详见 [[06-prd#7.7]] 升级回滚契约。本节是 ops 视角的执行细则。

### 4.1 minor 升级（自动）

- 用户感知：无
- 备份：自动
- 失败处理：静默回滚 + 错误日志写入 `~/...prompt-hub/logs/`
- 用户介入门槛：仅在连续 3 次启动迁移失败时弹窗

### 4.2 major 升级（强同意）

- 用户感知：弹窗
- 备份：强制要求导出到用户指定位置
- 失败处理：回滚 + 弹窗解释 + 建议手工恢复
- 旧版二进制：v2.0 发布后 v1.x 二进制保留 ≥12 个月，可下载

### 4.3 版本号语义

- 应用版本（user-facing）：`v{major}.{minor}.{patch}`
- schema_version（数据兼容）：`{major}.{minor}`（不含 patch）
- 两者独立 bump：应用 v1.2.3 可能仍用 schema 1.1

---

## §5 监控（本地 + 用户主动）

### 5.1 启用的监控

| 类型 | 实现 | 数据流向 |
|---|---|---|
| 性能自采样 | `metrics_log` in localStorage | 本地，用户在 view:status-panel 查看 |
| 错误日志 | 文件日志 `~/...prompt-hub/logs/error.log` | 本地，按 7 天滚动 |
| 迁移日志 | `migration_log` in localStorage | 本地，用户在配置面板查看 |
| UsageRecord | 主数据 | 本地，append-only |

### 5.2 禁用的监控（明确拒绝）

- ❌ Sentry / Bugsnag 等错误上报（[[06-prd#7.3]]）
- ❌ Google Analytics / Mixpanel（[[06-prd#7.3]]）
- ❌ 任何 telemetry / heartbeat 上报
- ❌ 崩溃日志自动上传

**用户主动报错 flow**：错误页提供「复制错误信息」按钮，用户**手动**贴到 GitHub issue（用户主动 = 明确知情）。

---

## §6 不需要的 ops 能力（明确范围）

| ops 能力 | 是否需要 | 理由 |
|---|---|---|
| 部署集群 | ❌ | 桌面应用 |
| 容量规划 | ❌ | 单人 |
| 数据库主从 | ❌ | 本地 SQLite |
| 缓存层（Redis 等） | ❌ | 本地查询 |
| CDN | 仅安装包分发可选 | Cloudflare / GitHub Releases |
| 负载均衡 | ❌ | 无服务端 |
| on-call rotation | ❌ | 单人项目 |
| 灾备多活 | ❌ | 用户自管备份 |
| 合规审计日志 | ❌ | [[06-prd#9]] 本地无审计要求 |
| Rate limiting | ❌ | 无对外接口 |

---

## §7 发布流程（建仓后细化）

> 待 ADR-001 决议（Tauri vs Electron）后补具体命令。当前框架：

```
1. version bump (semver) + CHANGELOG 更新
2. 跑全量 test-spec（[[11-test-spec]]）
3. 跑性能基准 vs main baseline
4. 构建多平台安装包
5. 签名 + 公证
6. 上传到 GitHub Releases / 自托管 update server
7. 更新 update manifest（Sparkle / Squirrel）
8. 跨设备烟雾测试（Mac + Windows + 副屏）
9. 通过后宣布
```

发布频率：建议 minor ≤每月 1 次，major 半年内不超 1 次（[[02-constitution#E1]] 类似精神）。

---

## §8 灾难场景预案

| 场景 | 预案 |
|---|---|
| 用户数据 localStorage 损坏 | 自动尝试最近一份备份恢复，失败则提示用户手动选择备份文件 |
| 升级后无法启动 | v1.x 二进制保留 ≥12 个月，用户可下载旧版回退 |
| 签名密钥泄露 | 立即吊销 + 重新签发新版本 + 通过更新通道告警旧版本不可用 |
| GitHub Releases 不可访问 | 提供备用下载点（自托管 / 镜像） |

---

## §9 出站网络与隐私披露（自动更新）

> 本节是 [[02-constitution#A2]]「本地优先 + 零出站」的**受限豁免披露**——自动更新（[[017-enable-auto-update]]）引入项目首次出站网络，此处诚实记账出站边界供用户知情。豁免论证见 ADR-017 §5.1；A2 铁律本身不变，本节是其对价之一（[[017-enable-auto-update]] 的 ratification gate）。

### 9.1 唯一出站场景

- **触发**：仅「更新检查 / 下载更新包」一条路径，目标为 GitHub Releases 公开域名，无其他出站。
- **业务字段**：当前版本号 + target/arch（经 URL 模板传递）+ 下载更新包。**绝不携带**任何话术、资产内容、用户数据。

### 9.2 协议层被动元数据（诚实记账）

出站请求在 HTTP/TLS 协议层固有、无法消除的可见信息，GitHub/CDN 侧可观测：

| 元数据 | 说明 | 缓解 |
|---|---|---|
| IP + 时间戳 | 服务端可见请求来源与时刻 | 低频检查降低序列可观测性（见 §9.3） |
| TLS SNI / JA3 | 握手暴露目标域名与客户端指纹 | 协议固有，不可消除 |
| User-Agent | reqwest 默认 UA 含库版本组合指纹 | **覆盖为固定串 `prompt-hub-updater`** |

定性：引入第三方元数据可见性，但**无任何资产载荷外泄**——A2 字面禁的是「话术/隐私指纹上传」，此处无资产外泄，豁免成立。

### 9.3 节律与开关（用户可控）

- **首启 opt-in**：默认不静默出站，首次启动一次性询问「是否启用更新检查」，用户显式同意后才后台检查。
- **总开关**：提供「更新检查」总开关，**关闭后客户端零出站**，回到 A2 字面状态。
- **低频**：启用后每日 ≤ 1 次或仅启动时一次，失败不密集重试——避免 IP + 时间戳序列形成「在线 / 使用节律」指纹。

### 9.4 与 §5.2 禁用监控的关系

更新检查**不是** telemetry / heartbeat（§5.2 仍全禁）：无业务载荷上报、低频、用户可关、目标是公开下载端点而非分析后端。二者正交，§5.2 不放宽。
