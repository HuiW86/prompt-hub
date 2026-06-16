---
type: adr
project: prompt-hub
status: proposed
description: 选择 tauri-plugin-updater + GitHub Releases 作为自动更新机制，mac 先行后全平台；记录 A2 隐私铁律的出站网络豁免边界
---

# ADR-017: 采用 tauri-plugin-updater + GitHub Releases 实现应用自动更新

> 状态：**Proposed**，等人审批准后转 Accepted。本文为 AI 起草（🤝 共创，CLAUDE §5.2），决策点 D1/D2 由人拍板（GitHub Releases / mac 先行后全平台），D3/D4 由 AI 按行业最佳实践补齐。
>
> **评审已回填（2026-06-15，ratification 前）**：经 3 路并行评审（安全/密钥 · 隐私/A2 · 工程/Tauri；codex 第四路因 API 余额不足缺席）。三路一致判"方向正确、可落地、无致命阻断"。已折入：HIGH×2（§5.3 用户可关开关 / §5.5 供应链加固）+ §5.1 隐私被动元数据记账 + §5.6 禁降级 + §6 不可逆点改顺序轮换 + 公证/minisign 互补非兜底 + §6 实现落地清单（工程坑）。
>
> **二轮官方/社区最佳实践调研补强（2026-06-15，ratification 前）**：交叉比对 Tauri v2 官方文档 + 社区 issue + 安全公告，方案主轴被印证（直连端点正解 / 公证·minisign 互补 / 禁降级 / 顺序轮换）。补三处实现级缺口：§5.5 加**客户端侧密钥泄漏第二战线**（安全公告 GHSA-2rcp-jvr4-r259，Vite `envPrefix` 误配会把私钥打进前端 bundle）/ §6 加 **v2 capabilities 放行** + **macOS 公证·打包·签名顺序锁死** + latest.json 端点与 draft 坑细化。仓库可见性前置（public/private 影响 Option A 是否成立）见 §4 缺点补注。

---

## 1. 标题与日期

- **标题**：选择 tauri-plugin-updater + GitHub Releases 作为自动更新分发通道，而非自托管静态端点或不做自动更新
- **日期**：2026-06-15
- **决策者**：Hui Wang（待批准）
- **影响范围**：`src-tauri/tauri.conf.json`（新增 `plugins.updater` + `bundle.createUpdaterArtifacts`）/ `src-tauri/Cargo.toml`（新增 `tauri-plugin-updater`）/ `package.json`（`@tauri-apps/plugin-updater`）/ `src-tauri/src/lib.rs`（后台检查逻辑）/ 新增前端更新提示 UI / 新增 `.github/workflows/release.yml` / 关联 [[02-constitution#A2]] 隐私铁律 / 下游 features + tech-stack + CLAUDE §7

## 2. Status

`Proposed`

## 3. Context

- **触发事件**：M0 四项交付全绿、Developer ID 签名公证链路（M0-4）已就绪，应用已可分发给真实用户。但当前无任何更新通道——用户拿到 `.dmg` 后无法感知/获取新版本，只能手动重新下载安装。版本号 `0.1.0` 三处（package.json / tauri.conf.json / Cargo.toml）同步，但无 bump→分发闭环。
- **业务约束**：
  - [[02-constitution#A2]]「不上传数据到外部服务」——本项目至今**零出站网络**（话术含隐私指纹）。自动更新会引入项目**首次出站请求**，必须明确豁免边界，否则与铁律冲突。
  - [[02-constitution#C1]] 200ms 唤起预算——更新检查绝不能进唤起热路径。
  - 「手动挡」哲学（[[01-spec]]）——更新应是用户可控的，不做静默强制自动安装。
- **技术约束**：
  - Tauri 2.x 官方更新方案 `tauri-plugin-updater` 需要：① 一个静态 endpoint 返回 `latest.json`（版本 + 各平台 URL + 签名）；② 更新包用 **minisign** 私钥签名（独立于 Apple Developer ID 代码签名，两套并存）；③ macOS 更新 artifact 为 `.app.tar.gz` + `.sig`。
  - 当前 webview CSP `connect-src 'self'`——但 updater 走 Rust 端 reqwest，**不受 webview CSP 约束**，故 CSP 无需改动（记录在此避免后人误改）。
  - 当前仅 macOS 完成签名公证；Windows/Linux 尚无签名链路。
- **不决策的代价**：用户无法获得 bugfix / 新功能，每次升级靠口头通知 + 手动重装，违背可持续分发；且越晚引入出站网络、用户基数越大，A2 边界争议成本越高。

## 4. Options Considered

### Option A: tauri-plugin-updater + GitHub Releases（推荐）

- **描述**：用 Tauri 官方 updater 插件，更新源指向 GitHub Releases。GitHub Actions（`tauri-action`）在打 tag 时自动出包、签名、生成 `latest.json`、上传 Release。客户端定期/手动拉取 Release 的 `latest.json` 比对版本。
- **优点**：
  - 零运维、零成本——GitHub 托管静态资源，无需自建/维护服务器。
  - 官方工具链端到端打通（`tauri-action` 自动出包 + 签名 + 生成 manifest），出包流程标准化、可审计。
  - 出站目标是 GitHub 公开域名，透明可解释，便于在隐私说明里向用户披露。
  - 与现有 Developer ID 签名公证并存无冲突。
- **缺点**：
  - 绑定 GitHub 生态（仓库必须可被客户端访问 latest.json；私有仓库需额外 token）。
  - **仓库可见性是本方案的隐含前置（二轮调研补）**：直连 `releases/latest/download` 仅在**公开仓库**下匿名可达；**私有仓库**的资产下载链不可匿名认证，updater 直连直接失效，须自建 proxy/后端转发 token——会抹掉"零运维"优势并引入额外出站面（与 A2 边界二次冲突）。**Option A 成立的前提是发布仓库为 public**；若计划私有分发，须改走 Option B 或重写本 ADR 成本估算与 A2 论证。**此项需人拍板**。
  - 更新通道依赖 GitHub 可用性。
- **预估成本**：插件接入 + conf 配置 + CI workflow ≈ 0.5–1 天；minisign keypair 一次性生成。

### Option B: 自托管静态端点（Cloudflare R2/Pages）+ tauri-plugin-updater

- **描述**：同样用 updater 插件，但 `latest.json` 和更新包托管在自己的 Cloudflare R2 / Pages。
- **优点**：
  - 完全掌控分发域名与更新策略（灰度、回滚更灵活）。
  - 不绑定 GitHub，私有分发更自然。
- **缺点**：
  - 需自建出包→上传脚本（GitHub 生态没有现成 action 直推 R2，需自己写 CI）。
  - 引入额外运维面（域名、存储桶权限、CDN 缓存失效）。
  - 出站目标是自有域名，隐私披露与信任建立成本更高。
- **预估成本**：≈ 2–3 天（含 CI 脚本 + 存储配置 + 缓存策略）。

### Option C: 不做自动更新（手动下载重装）

- **描述**：维持现状，每次发版让用户手动去某处下载新 `.dmg` 重装。
- **优点**：
  - 零出站网络，完美贴合 A2 铁律字面。
  - 零新增复杂度。
- **缺点**：
  - 升级摩擦极大，用户极可能停留在旧版本，bugfix 触达率低。
  - 无版本感知，不可持续。
- **预估成本**：0，但隐性分发成本随用户增长线性上升。

## 5. Decision

> **一句话拍板**：选择 **Option A**——`tauri-plugin-updater` + GitHub Releases + GitHub Actions（`tauri-action`）自动出包，mac 先行、架构预留全平台。理由是借力官方标准工具链以最低运维成本拿到可审计的更新闭环。

**为什么不选其他**：
- 不选 B 因为：当前无自托管运维诉求，Cloudflare 路线的灵活性（灰度/自有域名）对单机手动挡工具是过度工程，且自写 CI 推送成本不划算——可作为未来需要灰度/私有分发时的 superseding 选项。
- 不选 C 因为：放弃更新能力等于放弃可持续分发，与"增加更新能力"的诉求直接矛盾。

### 关键执行约束（随 Decision 一并锁定）

1. **A2 隐私豁免边界（已按评审修正）**：updater 出站请求的**业务字段仅** `当前版本号 + target/arch`（经 URL 模板传递）并下载更新包；**严禁**携带任何话术、用户数据、资产内容。但须**诚实记账**协议层固有的被动元数据：HTTP 请求头的 **User-Agent**（reqwest 默认 UA 含库版本，**必须覆盖为固定串如 `prompt-hub-updater`** 以免泄漏精确版本组合指纹）、TLS 握手的 **SNI/JA3**、以及 GitHub/CDN 侧可见的 **IP + 时间戳**。定性：**引入第三方元数据可见性，但不含任何资产载荷**——A2 字面禁的是"话术/隐私指纹上传"，此处无资产外泄，豁免成立但不轻描淡写。
2. **C1 唤起预算**：更新检查在后台 `tauri::async_runtime::spawn` 执行，**绝不进 ⌥Space 唤起热路径**，不影响 P95（落地后附一次 bench 复测佐证）。
3. **手动挡 + 用户可关开关（HIGH，评审新增）**：默认行为 = 启动后台静默检查 + 主形态内手动「检查更新」入口 + 非侵入提示；**下载和安装由用户显式确认触发**，不做静默强制自动安装。**且必须提供「更新检查」总开关，关闭后客户端零出站**——作为 A2 豁免的对价条件，不可省略。
4. **CSP 不动**：updater 走 Rust reqwest，不受 webview `connect-src` 约束。（注：若生产构建启用 App Sandbox，出站需对应 entitlements 放行——工程实现注意，非隐私问题。）
5. **签名密钥 + 供应链加固（D4，HIGH，评审强化）**：minisign keypair 由 `tauri signer generate` 生成（私钥带 password）；私钥进 GitHub **Environment** secret（`TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`）并挂 **required reviewer + 限 tag-push/protected-branch 触发，禁止 PR 触发签名**；第三方 GitHub Action 全部 **pin 到 commit SHA**（非 tag）；workflow `permissions:` 最小化为 `contents: write`；出包后**人工核验 `latest.json` 与资产 hash**；开 tag protection 限定可发 Release 的人。开发者本地备份用 password 保护的私钥，离线存（硬件/密码管理器），**绝不进任何同步盘/repo**；公钥写入 `tauri.conf.json` 的 `plugins.updater.pubkey`（填公钥**内容**非路径）。**客户端侧泄漏第二战线（二轮调研补，HIGH，安全公告 GHSA-2rcp-jvr4-r259）**：CI 密钥卫生之外另有一条真实泄漏路径——Vite `envPrefix` 误配会把 `TAURI_SIGNING_PRIVATE_KEY` + password **注入前端 bundle 随安装包分发给用户**（等同私钥公开）。必须显式锁 `envPrefix: ['VITE_']` 并对 TAURI_* 变量手动白名单（仅放 `TAURI_PLATFORM/ARCH/FAMILY/...` 等非敏感项），**严禁 `TAURI_SIGNING_*` 进任何会被前端打包的前缀**。预写密钥泄漏应急 runbook（轮换路径见 §6 不可逆点）。
6. **禁止降级（评审新增，固化默认安全）**：updater 默认拒装低于当前版本的包；**禁止开启 `allowDowngrades` / 禁止放宽自定义 `version_comparator`**，且服务端 `latest.json` 永不广播旧版本——防服务端驱动的降级攻击。
7. **平台范围（D2）**：第一阶段 endpoint/manifest/客户端逻辑只对 macOS 生效；**平台扩展不另开 updater ADR**，但 Windows/Linux 各自的**签名链路需独立 ADR**（同一更新决策的平台扩展，但签名是新的不可逆决策）。

## 6. Consequences

### 正向后果
- 获得可持续的版本分发能力，bugfix/新功能可触达已安装用户。
- 出包流程 CI 化、标准化、可审计（tag → 自动签名出包 → Release）。
- 为后续灰度发布、强制最低版本等策略预留接口（latest.json 可扩展字段）。

### 反向后果
- 引入项目首次出站网络，A2 铁律从"零出站"变为"受限豁免"，需在用户隐私说明中显式披露更新通道。
- 新增 minisign 私钥这一**高敏感凭据**的保管责任（泄漏 = 可伪造更新包推给全体用户）。注意 minisign 与 Apple 公证是**互补、非互为兜底**：公证/Gatekeeper 防"未签名/恶意来源首次落地"，minisign 防"更新通道里的包被替换/伪造"；`.app.tar.gz` 增量更新经 minisign 校验后由 updater 原地替换，**不一定重走完整 Gatekeeper 公证校验**，故 minisign 一旦失守公证未必兜底。
- 出包链路绑定 GitHub Actions + Releases 可用性。
- 版本发布需同步 bump 三处 version（package.json / tauri.conf.json / Cargo.toml），新增发版纪律。
- **新增持续的 release-engineering 负担**（评审提醒）：自动更新意味着每个 bugfix 都需走 tag→出包→公证→发布闭环，对 2 人项目是常态化运维成本；更新节奏与"手动挡/慢思考"定位需自洽，避免为更新而频繁发版。

### 实现落地清单（评审补 — 转 Accepted 后执行时逐项核对）

> 以下为三路评审发现的 MED 级工程坑，非决策项，记此防实现时遗漏：

- `plugins.updater.pubkey` 为**必需字段**，填公钥**内容**（`.key.pub` 文本）非路径；`endpoints` 数组指向 GitHub Releases 的 `latest.json`。
- 依赖钉版本：`tauri-plugin-updater >= 2.10`（多 installer key 格式）+ `@tauri-apps/plugin-updater` + 配套 `tauri-plugin-process`（重启）+（若用内置提示 dialog）`tauri-plugin-dialog`；**Rust toolchain ≥ 1.77.2**（updater 插件下限）；同步登记进 `09-tech-stack`。
- **v2 capabilities 显式放行（二轮调研补，v2 默认锁死全部危险命令）**：`src-tauri/capabilities/main.json` 的 `permissions` 须加 `updater:default` / `updater:allow-check` / `updater:allow-download-and-install` / `process:allow-restart`（用内置 dialog 则加 `dialog:default` / `dialog:allow-ask` / `dialog:allow-message`）——不加则前端调不通 updater。注意 **v1 内置「自动更新 dialog」在 v2 已移除**，提示 UI 须用 JS/Rust API 自建（正好承载 §5.3 手动「检查更新」入口 + 可关开关）。
- **GitHub `latest.json` 端点 401 redirect 已知坑**（302 重定向到 `objects.githubusercontent` AWS 链接）——maintainer 确认正解就是 `releases/latest/download/latest.json` 形式（Discussion #10206 / plugins-workspace Issue #2579），无需额外逻辑；若仍受重定向影响可 fallback `raw.githubusercontent.com/<owner>/<repo>/<branch>/latest.json`。tauri-action 出包用 **`includeUpdaterJson: true`** 自动生成并附加 latest.json。**注意 draft / prerelease 不会成为 `latest`**（updater 取不到下一版）——发版纪律须确保 Release 正式发布（非草稿/预发布）。
- macOS CI 需 **aarch64 + x86_64 双 target 矩阵**（否则只覆盖单架构）；公证凭据走 `APPLE_API_*`；防"`latest.json` 不生成"（tagName/releaseId 配置）。macos-private-api + 公证在 M0-4 已证伪冲突，CI 同链路可复用。
- **macOS 公证·打包·签名顺序锁死（二轮调研补，防 minisign 签名失配）**：顺序必须为 **① 公证 `.app`（ticket staple 到 bundle）→ ② 从已 staple 的 `.app` 打 `app.tar.gz` → ③ 对最终归档跑 `tauri signer sign` 出 `.sig`**。updater 的 minisign 签名独立于 Apple 公证（Discussion #7703）；若先签后再改归档字节（重打包/重公证）会导致 `.sig` 与交付文件失配，updater 校验失败。`latest.json` 须引用最终归档 URL + 对应 `.sig`。
- **版本三处无官方自动同步**：加 pre-tag 校验脚本（三处 version 一致才允许打 tag），写入发版 runbook。

### 未来反悔成本

> 若想从 GitHub Releases 切到自托管（Option B）或彻底移除更新能力：

- **代码改造规模**：切端点 ≈ 改 `plugins.updater.endpoints` 1 行 + 重写 CI workflow（~50–100 LOC）；移除能力 ≈ 删插件 + 配置 + UI（~3–5 文件）。
- **数据迁移**：无 schema 变更，不涉及 SQLite。
- **学习成本**：低，updater 协议不变，仅换 manifest 托管位置。
- **不可逆点（评审修正：原描述偏悲观，有成熟缓解）**：① minisign 公钥已内嵌进发布版本后换 keypair，**需走顺序轮换流程**——过渡版用旧私钥签、conf 内嵌新公钥，下一版再切私钥，可零断点换钥（Tauri v2 亦支持运行时 `Builder::pubkey()` 注入自定义轮换；原生多公钥 issue #7585 尚未稳定落地，不依赖）。该顺序轮换流程须写进发版纪律，同时充当密钥泄漏应急手段。② 一旦用户群形成对自动更新的依赖，回退到 Option C 会造成升级断点。

---

## 反模式（写完自检）

- ✅ Options 3 个（A/B/C），非通告
- ✅ Decision 一句话可说清
- ✅ Consequences 含反向后果 + 反悔成本（minisign keypair 连续性不可逆点）
- ✅ 未改任何上游原文，新开 ADR

## 相关链接

- 触发本决策的文档：[[01-spec]] 手动挡定位 / M0-4 签名公证收口（CLAUDE §7）
- 受本决策影响/需 bump 的下游文档：`docs/design/07-features.md`（新增"自动更新"功能项）/ `docs/design/09-tech-stack.md`（新增 `tauri-plugin-updater` 依赖）/ `CLAUDE.md` §7 状态指针 / 用户隐私说明（披露更新出站）
- 关联 ADR：[[008-enable-macos-private-api]]（signing 前置）/ 未来若转自托管或加灰度 → superseding ADR
- 关联铁律：[[02-constitution#A2]]（隐私出站豁免边界）/ [[02-constitution#C1]]（唤起预算）
- 外部最佳实践依据（2026-06-15 调研）：Tauri v2 Updater 官方文档 `v2.tauri.app/plugin/updater` / 安全公告 GHSA-2rcp-jvr4-r259（envPrefix 私钥泄漏）/ Discussion #10206（GitHub Releases 端点正解）/ plugins-workspace Issue #2579（401 redirect）/ Discussion #7703（公证 vs updater 签名互补）
