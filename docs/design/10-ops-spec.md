---
type: ops-spec
project: prompt-hub
version: v0.5
created: 2026-05-19
last_modified: 2026-09-05
status: ratified  # v0.5 于 2026-09-05 人审批次 ⑩ 经 omar 签字（与 [[03-product-spec]] v0.27 同批），自 v0.3 起挂的 draft 至此转正——理由是本版每条都有代码对应且过了真机门 G6。v0.5（2026-09-04）兑现 [[HANDOFF]] 第 21.3 项：§3.1 / §3.2 / §3.3 / §5.1 / §7 / §8 按实装重写——自动备份改为 `VACUUM INTO` `.db` 快照三种触发（迁移前 / 导入前 / 每日）并按前缀独立配额 + 哈希去重（顺带销掉 [[HANDOFF]] 第 32 项那个「迁移每次失败就把旧快照全挤掉」的坑）、备份目录按真实路径且用户不可改、新增启动 `PRAGMA quick_check` 与手工恢复步骤、落盘日志改 `tauri-plugin-log` 真实路径与滚动策略、§7 按 `.github/workflows/release.yml` 实际流水线重写（删 Sparkle / Squirrel / Windows / 「待 ADR-001」措辞）、§8 首行改 `quick_check` 失败预案。**本版之前的三笔欠账至此清零**。前 v0.4（2026-09-03 · [[028-reversible-delete]] 回流）新增 §3.0 废纸篓与备份的分工；v0.3 于 2026-09-01 人审批次 ④ omar 裁决保持 draft
author: ai  # 🤖 AI 主笔 + 人审（CLAUDE §5.2）
audience: [ai, human]
description: prompt-hub 运营规格——部署/性能预算/备份/升级回滚/监控（本地单人语境）
related:
  - 06-prd
  - 02-constitution
  - 11-test-spec
  - 03-product-spec
  - 028-reversible-delete
  - 017-enable-auto-update
  - m0-4-macos-signing
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

### 3.0 废纸篓与备份的分工（v0.4 新增 · [[028-reversible-delete]] 子决策 4）

> **先读本节。** 应用里有两套「东西没了还能拿回来」的机制，它们**不能互相替代**——[[028-reversible-delete]] §4 Option C 正是因为混淆二者而被否决。

| | 废纸篓（撤销） | 备份（快照） |
|---|---|---|
| 修的是什么 | **我点错了**——删了一条不该删的资产 | **库坏了 / 整个库出事了**：迁移失败、文件损坏、误导入整库替换 |
| 粒度 | 单条资产，原地恢复 | 整库，回到过去某一时刻 |
| 恢复代价 | 一次 UPDATE，**此后的其他改动一律不受影响** | **丢掉快照之后的全部改动** |
| 保留 | **永不自动过期**，只由用户手动清空 | 见 §3.1：**按前缀各自独立配额 + 哈希去重**，一类快照的循环挤不掉另一类 |
| 用户入口 | 设置 · 数据页（[[03-product-spec#13.3]] 区域 9） | 导出备份 / 文件系统 |

**为什么必须写在这里**：删错一条话术若要靠备份来救，代价是把整个库退回到某个过去的时刻，此后所有别的工作一起丢——**那是备份，不是撤销**。反过来，废纸篓也救不了一个损坏的数据库文件：它就在那个文件里面。

**两条必须记明的后果**：

1. **废纸篓不是备份**，不因为它存在就可以少做备份。它只保存**用户主动删除**的资产，对文件损坏、迁移失败、误导入一概无能为力
2. **废纸篓会单调增长**，因为不自动过期。这是 [[028-reversible-delete]] 子决策 4 自觉接受的代价——「你的数据过期了」是比列表变长更糟的惊吓，而全库皆文本、[[06-prd]] 的规模天花板是数百行量级，占用可忽略。**什么时候清空是用户的决定**，不设保留天数也不设定时清理任务；界面显示条目数，让这笔账看得见

**与导出的交叉**：导出**包含**废纸篓内容（[[028-reversible-delete]] 子决策 6），否则「导出再导入」会变成一次静默的永久删除。因此一份备份文件里可能有用户以为已经删掉的东西，见 [[03-product-spec#13.3]] 区域 9 对用户的告知。

### 3.1 自动备份触发（v0.5 按实装重写）

**备份的形态只有一种**：SQLite `VACUUM INTO` 出的整库 `.db` 快照。不是 JSON——WAL 模式下光拷 `.db` 主文件会漏掉还在 `-wal` 里的已提交页，而 `VACUUM INTO` 让 SQLite 自己写一份一致且已 checkpoint 的副本，对活连接安全。

| 触发点 | 内容 | 命名 | 配额 | 去重 |
|---|---|---|---|---|
| **迁移前**：启动时发现有待跑迁移，在跑之前 | 整库快照 | `pre-migrate-<unix>.db` | 5 | 与**同前缀**最近一份 sha256 相同则不落盘 |
| **导入前**：整库替换导入执行之前 | 同上 | `pre-import-<unix>.db` | 5 | 同上 |
| **每日**：启动时检查一次 + 后台线程每小时检查，最近一份早于 24h 即拍 | 同上 | `daily-<unix>.db` | 7 | 同上 |

**配额按前缀各自独立**——`pre-migrate` 的循环挤不掉 `daily`，反之亦然。这一条是本版**唯一的行为修正**，销掉 [[HANDOFF]] 第 32 项：旧实现全目录共用五槽，于是「迁移每次启动都失败」时每次都拍一份新的 `pre-migrate`，五次之内就把所有旧快照挤光——**兜底自己把自己吃掉了**。哈希去重是同一个坑的第二道闸：库没变就不留新快照，重复启动不再消耗配额。

⚠️ **快照文件的 mtime 不等于内容捕获时刻**。命中去重时被保留的那份快照会被**刷成当次检查的时刻**——「我们看过了，库没变」与「写了一份一模一样的副本」对每日排期是同一件事，不刷则该库永远逾期、每小时白跑一次 `VACUUM INTO`。代价是 mtime 从此只回答「最后一次确认它仍代表当前库是什么时候」。**挑快照恢复时以文件名里的 unix 秒为准**，那个数才是内容被捕获的时刻。

**用户主动导出与上表并列，不进这张表**——它不是自动触发的，也不占配额、不参与去重：用户在保存对话框自选落点，导出的是八张资产表的 JSON（`data schema 1.2`，不含 `usage_records` 与 `settings`）。**二者不互相替代**：快照是应用自己拍的、整库的、有配额会轮转的；导出是用户自己拍的、自管的、放在用户选的地方。前者救「库出事了」，后者救「这台机器出事了」。导出**包含**废纸篓内容（§3.0 末段）。

### 3.2 备份位置

```
~/Library/Application Support/dev.prompt-hub/backups/
```

由 Tauri `path::app_data_dir()` 解析后拼 `backups` 子目录，与 `prompt-hub.db` 同级。

**用户不可改这个目录**。v0.4 及以前写的「用户可在配置面板改默认目录到 iCloud / Dropbox / Git 仓库」**从未实装**，本版删去——想把备份放进网盘的用户走导出（§3.1 表下那段），那条路径本来就由用户指定落点。

### 3.3 启动完整性自检与手工恢复（v0.5 新增）

**自检**：`open_and_migrate` 在跑任何迁移之前先跑一次 `PRAGMA quick_check`。

- 结果为 `ok` → 照常继续
- 非 `ok` → 原生弹框（**框内同时给出库文件路径与 backups 目录路径**）+ 退出码 1

**不自动回滚，也不自动挑一份快照替换。** 理由是自动恢复必须替用户选一份快照，而选错的代价是**静默丢掉那份快照之后的全部改动**（§3.0 第三行）；库已经坏了这一刻，用户至少还知道自己昨天做了什么，程序不知道。所以这里只做两件事：把坏消息说清楚，把两个路径递到手上。

**手工恢复步骤**（弹框文案含第 2 / 3 / 4 步要点）：

1. 退出 prompt-hub
2. **先把当前那个坏库另存一份**（`prompt-hub.db` 改名或复制走）——恢复失败时它是唯一的现场
3. 从 `backups/` 里挑一份快照（**按文件名里的 unix 秒挑，不按文件修改时间**，原因见 §3.1 末段），复制并改名为 `prompt-hub.db` 覆盖过去
4. **删掉同目录的 `prompt-hub.db-wal` 与 `prompt-hub.db-shm`**——它们属于旧库，留着会让 SQLite 拿新文件配旧日志
5. 启动，确认数据回到快照那一刻

> 第 2 步是硬约束，自 v0.1 起未变：**恢复前先备份当前**。第 4 步是本版新写明的——WAL 与共享内存文件不删是 `VACUUM INTO` 快照恢复最容易踩的一脚。

---

## §4 升级回滚契约

> 详见 [[06-prd#7.7]] 升级回滚契约。本节是 ops 视角的执行细则。

### 4.1 minor 升级（自动）

- 用户感知：无
- 备份：自动
- 失败处理：静默回滚 + 错误写入落盘日志（路径与滚动策略见 §5.1）
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
| **落盘日志**（v0.5 按实装重写）| `tauri-plugin-log` → `~/Library/Logs/dev.prompt-hub/prompt-hub.log` | 本地文件，**不出站**（[[02-constitution#A2]]）|
| **迁移日志**（v0.5 改口径）| 迁移步骤直接进上面那份落盘日志，不再单开 `migration_log` | 同上 |
| UsageRecord | 主数据 | 本地，append-only |

**落盘日志的三条口径**：

- **滚动按大小不按天**：单文件上限 1 MiB，滚动后保留一份旧文件。日志的用途是「刚才出了什么事」，按天保留会让一次密集失败把有用的那几行冲掉，按大小则总能留住最近的两个 MiB。v0.4 写的「按 7 天滚动」从未实装，本版删去
- **级别**：release 构建 Info，dev 构建 Debug
- **只有 Rust 侧**：不注册 JS 插件绑定，渲染进程既写不进也读不出这份文件

**记什么**：启动信息（版本 / 库路径 / `user_version` / `quick_check` 结果）、迁移逐步、快照结果（written / unchanged / pruned）、快捷键注册失败、退出 checkpoint。

**不记什么**：**任何话术内容**。日志里出现的是 id、表名、计数与路径，不是用户写的字。这条不是习惯是红线——本文件 §5.2 禁的是上报，而日志连上报都没有就已经不该抄用户的内容。

### 5.2 禁用的监控（明确拒绝）

- ❌ Sentry / Bugsnag 等错误上报（[[06-prd#7.3]]）
- ❌ Google Analytics / Mixpanel（[[06-prd#7.3]]）
- ❌ 任何 telemetry / heartbeat 上报
- ❌ 崩溃日志自动上传

> **注**：自动更新检查（[[017-enable-auto-update]]）出站**不属于** telemetry / heartbeat——无业务载荷上报、低频、用户可关、目标是公开下载端点而非分析后端。本节禁令不放宽，详见 §9.4。

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

## §7 发布流程（v0.5 按 `release.yml` 实际流水线重写）

> 本节此前停在 ADR-001 之前的框架（Sparkle / Squirrel / Windows / 「待 ADR-001」），与已经跑过三次的真实流水线脱节。本版按 `.github/workflows/release.yml` 与 [[017-enable-auto-update]] 重写。逐步操作手册见 `docs/release-runbook.md`，签名与公证的一次性前置见 [[m0-4-macos-signing]]。

**触发只有一个：push 一个 `v*.*.*` tag。** `workflow_dispatch` / `repository_dispatch` / `schedule` 都**故意不列**——它们能绕过 tag 这道闸，列上去等于给发布开后门（ADR-017 §5.5）。

### 7.1 五段链路

| 段 | 在哪跑 | 做什么 | 关键闸门 |
|---|---|---|---|
| ① 打 tag | 本地 | version bump 三处（`package.json` / `tauri.conf.json` / `Cargo.toml`）+ 写 `docs/release-notes/<tag>.md` | tag 一推就不可撤，先跑全量 [[11-test-spec]] |
| ② **build job** | `macos-latest`，`aarch64` + `x86_64` 双 target 矩阵 | `check-version.sh` 校验三处版本与 tag 一致 → `tauri build`（`--bundles app,dmg`）→ 公证 `.app` → **另行公证并 staple `.dmg`** → 打包 `.app` 上传 | **「断言已公证已 staple」**：`stapler validate` × 2 + `spctl -a` + `codesign --verify --deep --strict` |
| ③ **sign job** | 同上，挂 `release-signing` 保护环境 | 断言构建产物在场 → 打 `.app.tar.gz` → `tauri signer sign` 出 minisign `.sig` → `jq` 拼 `latest.json` → 建 **draft** release | `assert-provenance.sh`：tag ↔ `latest.json` ↔ 每份产物三者版本与文件名必须一致 |
| ④ **人工 publish** | GitHub 网页 | 本地强制核对产物（`docs/release-runbook.md` §3）后把 draft 转正式 | draft **不会**被当作 `releases/latest`，publish 那一刻更新通道才激活 |
| ⑤ 客户端取更 | 用户机器 | `tauri-plugin-updater` 拉 `releases/latest/download/latest.json`，minisign 验签后原地替换 | 首启 opt-in + 总开关（§9.3）|

### 7.2 三条结构性约束

- **build 与 sign 必须是两个 job**：build job 里没有 minisign 私钥，所以一个被投毒的构建期依赖偷不走它；sign job 挂 required-reviewer 环境，私钥只在人批准之后才注入。**单人项目里这道人审必然是自批**，所以它换来的不是第二双眼睛——补偿控制是 publish 前的本地强制核对，见 `docs/release-runbook.md` §3
- **公证 → 打包 → minisign，顺序锁死**：先签名再改归档字节会让 `.sig` 与交付文件失配，updater 校验必挂（ADR-017 §6）
- **`.dmg` 不进 `latest.json`**：它是新用户的直装包，只走 Apple 签名 + 公证；updater 消费的是 `.app.tar.gz`，那份才 minisign

### 7.3 已经踩过的两脚（都已加断言）

- **公证 fail-open**（2026-08-05，v0.1.0）：凭据变量名传错，Tauri 拼不出凭据集**静默跳过公证**且构建照样绿。修法是 ② 段那条断言——断言产物本身，而不是相信步骤名。复盘见 `docs/postmortems/2026-08-05-notarization-fail-open.md`
- **产物过期 fail-open**（2026-08-10）：审批等了三天，`retention-days: 1` 先到期，`download-artifact` 下载到零个文件仍退出 0。修法是 ③ 段开头那条「断言构建产物在场」+ 保留期改 7 天

发布频率：建议 minor ≤每月 1 次，major 半年内不超 1 次（[[02-constitution#E1]] 类似精神）。

---

## §8 灾难场景预案

| 场景 | 预案 |
|---|---|
| **启动 `quick_check` 失败**（库损坏）| 原生弹框给出库路径 + `backups/` 路径，退出码 1。**不自动回滚、不自动挑快照**——恢复要选哪一份快照只有用户知道，选错等于静默丢掉那份之后的全部改动。手工步骤见 §3.3 |
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
