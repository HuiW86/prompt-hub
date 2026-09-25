# Handoff — v0.2.1 发布：修复 macOS 27 启动即闪退

<!-- Updated 2026-09-25 (not via /checkpoint): only the head, the two new Next Actions, Risks top, Verify and Modified Files changed; the rest carries from 2026-08-20 -->

## Objective

用户升级 macOS 27 后，v0.2.0 启动约 2 秒即 SIGABRT：`src/macos.rs:65` 的 `TaoWindow -> KeyablePanel isa-swizzle: instance size mismatch`（`536` vs `528`），panic 发生在 `applicationDidFinishLaunching` 内无法 unwind。本轮：定位根因 → 修复 → 发补丁版 **v0.2.1** 并验收。

## Completed

- **根因**：tao 0.35 的 `TaoWindow` 在 `NSWindow` 上加了 1 字节 ivar `focusable`。旧版 macOS 上它落在 `NSWindow` 末尾对齐 padding 里，不带 ivar 的 `KeyablePanel` 与之等大**纯属巧合**；macOS 27 上 padding 没了，`TaoWindow` 长到 536。附带隐患：换类后 tao `set_focusable` 按名字查 `focusable` ivar，旧 `KeyablePanel` 上没有
- **修复**（HuiW86/prompt-hub#1，`d6659e0` + `cc2bf9c`，merge `36e0e4e`，仅 `src-tauri/src/macos.rs`）：`KeyablePanel` 改为运行时 `ClassBuilder` 构建，继承 `NSPanel` 并声明同名 `focusable: Bool` ivar，布局按构造与 `TaoWindow` 一致；换类前校验实例大小 / `NSWindow` 之下所有类新增 ivar / `focusable` 偏移；不通过则打日志 `isa-swizzle skipped` 并**降级为普通置顶窗口**，不再 panic
- **CI 抓到第一版修复的静默降级**：首个提交 CI 全绿，但 `bench-c1` 日志显示走了降级分支——运行时实际类是 KVO 动态子类 `NSKVONotifying_TaoWindow`（自身无 ivar），只查叶子类必然误判。第二个提交改为沿父类链收集到 `NSWindow`；复跑日志无 `skipped`，macOS 14.8.9 上换类真正执行且不崩
- **发布 v0.2.1**（HuiW86/prompt-hub#2 merge `6f1b63b`，tag `v0.2.1`，run `36159126062`，已 publish）：patch 版，无迁移。build 两架构签名+公证+`Assert notarized + stapled` 全过；sign job `assert-provenance` 通过；sign 日志密钥均为 `***`。发布说明 `docs/release-notes/v0.2.1.md` 提醒已打不开的用户须手动下 `.dmg` 覆盖（应用内更新对启动即崩的客户端无效）
- **omar 验收**：runbook §3 核对 + macOS 27 真机（启动 / 不抢焦点 / 可输入 / 日志无 `isa-swizzle skipped`）全过后 publish。publish 后复核：`releases/latest` → v0.2.1，`latest.json` `version: 0.2.1`，四个资产均 200

## In Progress

无。`main` 已含全部改动。⚠️ runbook §4「用 0.2.0 客户端检查更新 → 升到 0.2.1」**本轮未单独确认**，下次顺手验一次。

⚠️ `.codex/` / `AGENTS.md` / `dsh-plugin-ziwuliuzhu/` 未跟踪，归 omar，**不要 stage**。

## Next Actions

1. **ADR-025 P2 键盘动作层 —— omar 2026-08-20 明示「先记录着，暂时不需要做」**（技术上无阻塞）。3.1 去掉动作簇 `data-nav-item`（`src/components/AlignmentPhrases.tsx` `PhraseChip` 6 停靠点→1、`src/components/scene/ViewPhraseCard.tsx` 7→1、`src/components/MacroGrid.tsx` 5→1）；3.2 键位表挂 `src/hooks/useRegionNav.ts:32`；3.3 动作簇改选中态跟随——**顺带解掉 `src/components/ScenePanel.module.css:420` hover 遮挡标题**。ADR §6 要求**先在对齐话术一个区域跑通再铺开**，验收门 G2（5 项）。
   **已议免重复讨论**：动作键层不做可自定义；键盘布局差异用 `e.code`（ADR-027 录键器已验证该取向）。
   ⚠️ 落地时须兑现 product-spec §13.3 标注的「P2 目标」：`⌘Enter` 保存并推进到下一条（`src/components/primitives/PhraseFormEditor.tsx:196-206` 现只保存并关闭） (carried from 2026-08-20)
2. **补 ADR-026 的 features 回写缺口**：`docs/design/07-features.md` §4 节奏表缺「固定空间布局」行、§6 变更日志缺 v1.12/v1.13 条目。**已在 §4 表下留警示**。补账时须同步复核合计数（现记 **88**） (carried from 2026-08-20)
3. **契约回流八步（旧账，本轮已销两笔）**：仍欠 `03-product-spec.md` §4.0/§13.4 卡片解剖（title-only）+ 外观设置（density）；`05-design-spec.md` §2/§8/§9。**§3c 剩两个 unbound token 待处置**（`--t-18` / `--h-modifier-tray`——⚠️ 后者随 ADR-026 底部 tray 退役后已无消费者，属死 token）。⚠️ `docs/MANIFEST.md` 其余行仍停在 2026-07-06 口径。**已销**：§13.4 SOP instrument card 描述（v0.22 补告示块）、§3c token 层立论（design-spec v0.19 §2.7） (carried from 2026-07-21)
4. **memory 层剩一条待 omar 点头**：新增 feedback「AI 主笔对外文档必须逐句反查代码」（与 `feedback_walkthrough_coverage` / `feedback_gate_executability` 同族，应互链）。**本轮又添两例佐证**：ADR §2 混进估数 388/170；G3 项 2 门项前提未检验。原计划的「授权扩到失败恢复时的路径选择」仍未写入 `feedback_decision_autonomy` (carried from 2026-08-05)
5. **发布收尾（非阻塞，本轮更正一处）**：`latest.json` 最低版本字段落在 `.github/workflows/release.yml` sign job 的 `jq -n` 处；落盘日志 tauri-plugin-log 立项。~~`gh secret set ... --env release-signing`~~ → **经核实非阻塞**（仓库级已有），降为作用域整理 (carried from 2026-08-05)
6. **`a24c7c0` / `4b722c1` / `716bd4c` 三 commit 补 verifier 对抗审查**——`a24c7c0`「float phrase actions」正是 `src/components/ScenePanel.module.css:420` hover 遮挡标题的来源 (carried from 2026-07-07)
7. **omar 人审批次（本轮又增）**：product-spec v0.15→**v0.22** + design-spec v0.15→**v0.19** + features v1.10→**v1.17** + **test-spec v0.2→v0.5（唯一从 `ratified` 降回 `draft` 的，建议优先过）** + prd **v0.13** + **ADR-027 全文** + ADR-023/024 措辞 + 图标定稿追认 + 01-spec v0.7 + 旧账 ADR-021/`scene.color` (carried from 2026-07-06)
8. **可发现性裁决 ×3**：场景删除入口外露 / 整理态保窗 vs 改 D-0 契约 / title-only 后卡面无内容线索 (carried from 2026-07-06)
9. 补 `src/components/__tests__/ScenePanelFocusRestore.test.tsx` 焦点恢复负路径测试。⚠️ 正路径已改走 `AnchoredEditor` teardown，写负路径时须对齐新机制 (carried from 2026-07-21)
10. `.github/workflows/ci.yml` bench-c1 `continue-on-error` 处置复核 (carried from 2026-07-12)
11. P0-2 Composition 链路 ADR（P0-5 系于此，`src/components/DraftInbox.tsx:43-48` 的 `PROMOTE_BLOCKED_HINT`） (carried from 2026-07-06)
12. **ops-spec §3 定时备份**（`src-tauri/crates/repo-core/src/backup.rs` 底座）/ P2 余 4 评估 / P1-5 Phase 可配置性 / `src/components/MacroGrid.module.css` 网格末行 auto-fit (carried from 2026-07-06)
13. **`docs/design/06-prd.md` §6.1 soft-delete 矛盾** + `status: pre-code` 僵尸 / ai-dev-lifecycle 仓收尾。**与 ADR-025 子决策 5 直接相关**——真正可撤销的删除需要后端 `deleted_at` + `restore_*`，prd 已承诺 soft-delete 而实现是硬删除。⚠️ v0.13 bump 时**刻意没动 `status: pre-code`**（改 status 是治理信号，归本项） (carried from 2026-07-02)
14. `docs/design/CLAUDE-DESIGN.md` v0.2 重传 + v2 基调同步 (carried from 2026-07-02)
15. 评审遗留补 design-spec 上游：ipc-contract 扩扫 / `--color-danger` / `--scrim` 语义回流（随人审八步）。⚠️ `src/components/HotkeyRecorder.module.css` 报错色沿用「琥珀代替 danger」的既有约定（palette 至今无 danger token），随本项一并处置 (carried from 2026-07-02)
16. **gstack 待升级 0.16.3 → 1.61.0**（跨大版本），另有两项一次性配置提示（proactive / skill routing） (carried from 2026-08-11)
17. **两份 ADR 超期未复核**（health pulse 第五次复报，均 `Last reviewed: 2026-07-02`，**49 天** > 45 天阈值）：`docs/adr/005-prompt-combiner-reuse.md`（Proposed，等 omar 提供仓库）/ `docs/adr/011-search-usagesource.md`（Reserved） (carried from 2026-08-19)
18. **（低优先，可不做）1 逻辑点浮层偏移归因**：翻转态 `src/hooks/useAnchoredPosition.ts` 的 `top = a.top − OFFSET − p.height`，首次 `useLayoutEffect` 放置与后续重算之间差 1pt。亚感知、恒定、不累积，**记为已知量** (carried from 2026-08-20)
19. **给 swizzle 降级加 CI 闸门**（new 2026-09-25）：`bench-c1` 只看退出码和 p95，降级分支照样绿——本轮第一版修复就是这样混过去的，靠人读日志才发现。建议在 `bench/hotkey-wake.bench.mjs` 里捕获 stderr，出现 `isa-swizzle skipped` 即退出码 1
20. **tao 升级须复核 `macos.rs` 的 ivar 镜像**（new 2026-09-25）：`layout_mismatch` 硬编码 tao 0.35 `TaoWindow` 只有 `focusable` 一个 ivar。tao 若增删 ivar，不会崩但会**静默降级为抢焦点的普通窗口**。第 19 项落地前，升 tao 后须人工看一次启动日志

## Dropped

- 本轮（2026-09-25）无销账、无放弃；新增第 19、20 项，净计 **20 项**。以下为 2026-08-20 原记录：
- 无。旧 18 项：**第 3、5 项各部分销账**（其余部分已在原项内标注，未静默消失），其余全部承接；**本轮新增 0 项**——冲突 UX 缺口当轮拍板落地、浅色首屏经查为误报、发布相关三项（放行 sign job / publish / Phase 6 验收）当轮做完。净计 **18 项**。
- **ADR-025 P2 键盘动作层：omar 明示「先记录着，暂时不做」**——保留在 Next Actions 第 1 项，不是放弃，是排期外。

## Risks & Decisions

- **降级路径会让 CI 失明**（new 2026-09-25）：为「不闪退」设计的降级分支，恰好让「修复没生效」在 CI 里表现为全绿。**凡是有 fallback 的地方，要有一个信号能区分「走了主路径」和「走了 fallback」**，并让 CI 看得到它（见 Next Actions 第 19 项）
- **isa-swizzle 的前提是布局相等，而「相等」可能只是对齐 padding 的巧合**（new 2026-09-25）：只比 `instance_size` 不够，还要比 ivar 集合与偏移；且要看**运行时实际类**（KVO 会插入 `NSKVONotifying_*` 子类），不是自己以为的类。⚠️ 从 KVO 子类换走 isa 会让该对象的 KVO 通知失效——这是改前就存在的行为，本轮未改变，也未观察到问题
- **云端会话推不了 tag**（new 2026-09-25）：`git push origin v*` 被代理 403，GitHub MCP 也无建 tag 的工具。发版的打 tag 一步须在本地做
- **必然失败或做不出来的检查 = 没有检查**（new 2026-08-20，本轮三次同形态命中）：G3 项 2 的门项前提（被占的键根本到不了本应用）/ runbook §3 第 1 项「与本地构建逐字节比对」（本地与 CI 不可能相同）/ 第 4 项要 `brew install minisign` 才能验签（为验一次装个工具 = 这步被跳过）。**起草检查项时要问「这一步真的做得出来吗」，不只是「这个对象存在吗」**
- **估数会混进「落地进度」而看起来像实测**（new 2026-08-20）：ADR §2 我写过「前端 373→388 / Rust 158→170」，那是动手前的估计，实测 **395 / 168**。**更隐蔽，因为它长得就像刚跑完的结果**
- **手数 `it(` 会漏**（new 2026-08-20）：多个测试文件用 `it.each` / 按文件枚举生成用例。改用 **worktree 对拍 + vitest JSON reporter** 才发现 `token-gate` 39→40 是它自己长出来的（按 CSS module 枚举，新增的 `HotkeyRecorder.module.css` 自动入册并通过）
- **走查工具链五个坑**（new 2026-08-20，`/tmp/ph-g3/` 会被清理，需要时按此重建）：
  1. **debug 裸二进制走 `devUrl`，不跑 vite 就是空窗口**——截图全黑 + 键鼠全失效，极易误判成「渲染不出来」或「权限没给」。**抓别的 app 的窗口做控制组**是分辨关键
  2. **`mouse.swift` 的 click 不设 `kCGMouseEventClickState`**，WebKit 不认作点击；hover 却是好的，所以现象是「能悬停不能点」
  3. **CGEvent modifier flag 会泄漏到后续鼠标事件**：发完 `⌃⇧P` 再点击 = ctrl+click = 右键菜单，**原生菜单吞掉全部输入**。修法：鼠标事件显式 `e.flags = []`
  4. **`key.swift` 只打修饰键标志位，不发修饰键自身的按下/抬起事件**——**害得一次修复复测差点被判无效**。忠实版 `chord.swift`：先发修饰键 keydown → 主键 → 反序抬起
  5. **`screencapture -l` 会返回隐藏窗口的陈旧 backing store**——看着是实时截图，实际是上次可见时的画面。**每次截图前后都要用窗口列表确认在屏**
- **唤起后第一次点击被吞掉用于取焦点**（new 2026-08-20）：非激活面板模型下，自动化点击序列**开头要补一次无害的空点**（Header 空白处，不是卡片本体）
- **`prettier --check .` 在本地必挂，不是本仓的问题**（new 2026-08-20）：报错的 6 个文件全在未跟踪的 `dsh-plugin-ziwuliuzhu/`。CI 检出的树不含它们。**照 runbook 跑这条时不要「顺手格式化」**——那些文件归 omar
- **`HOME` 覆盖只隔离数据库，隔离不了界面偏好**（new 2026-08-20）：SQLite 落到临时目录，但 **WebKit localStorage 不认 `HOME` 覆盖**，照旧读写真实的 `~/Library/WebKit/prompt-hub/...`。后果：「空白配置」不空白（据此误报过一次），且走查会写到真实界面偏好里。⚠️ 我此前说「全程隔离」是**说过头了**
- **`pnpm bench:*` 会拿真实数据库跑**（new 2026-08-20）：bench 直接 spawn dev 二进制，用真实 `app_data_dir`。**本轮 bench 已把线上库迁到 `user_version` 12**（自动留了 `pre-migrate-*.db`）
- **`user_version` 11→12 是 ADR-027 唯一不可逆项**：MCP 进程共享同库，**发版须同批**。反悔的正确做法是留空表 + 新开 migration 13 标废弃，而非降版本。⚠️ v0.2.0 的 release **不含 MCP 二进制**——目前 MCP 未注册使用，不构成实际影响，但下次若分发 MCP 须同批
- **更新会重写 `/Applications` 里的包，签名链要在更新后再验一次**（new 2026-08-20）：若解包替换弄坏签名或丢了公证票据，**Gatekeeper 要到下一次冷启动才发作**，届时很难回溯到更新那一刻
- **人工目视的证据不可回归**：G1 项 1/3/4 与 omar 的整体走查为目视；项 5/项 2-B 与 v0.2.0 更新后截图有像素证据可复算 (carried)
- **「拍不到」可能是取证方法的结论，不是被测对象的性质**——本轮第三次以不同面孔命中 (carried)
- **走查会发现「通过」之外的东西**：本轮 G3 四项里最大产出来自那一项「不可达」 (carried)
- **修好的缺陷会在别的面上原样复现**：修根因时要问「这个根因还能从哪个方向再进来一次」 (carried)
- **承重件必须显式标注**：`.phase.active::after` 对比度仅 `1.145:1` 已注释 LOAD-BEARING；**本轮同族新例**——三枚层 pill 外观像一组，其中一枚承重 (carried/extended)
- **实现扩张比实现错误更难发现**：审查实现时要问「这是谁批准的」 (carried)
- **测试可以保护偏差**：待审注释不是决策，挂账不等于合规 (carried)
- **主形态是 non-activating panel**：`macos::wake` 用 `orderFrontRegardless` + `makeKeyWindow`，不 activate 整个 app (carried)
- **app 会 hide-on-blur / hide-on-copy**：走查时**只能点铅笔，不能点卡片/chip 本体** (carried)
- **禁止全屏截图**：走查截图须按窗口 ID 定向抓取（曾拍到前台机密会话） (carried)
- **同时只能有一个实例持有同一组合键**：走查前须先退出 `/Applications/prompt-hub.app`；**反过来也可利用**——本轮靠第二个实例占键构造冲突场景 (carried/extended)
- **`interactionMode` 由 persist 中间件固化**：改默认值对已有安装无效 (carried)
- **jsdom 验不了布局，但订阅逻辑、规则表分支、焦点契约都能验且应当验** (carried)
- **hover 动作簇遮挡标题（未修）**：`src/components/ScenePanel.module.css:420`，随 P2 子决策 3.3 落地时顺带解决 (carried)
- **ADR-025 两笔债**（已写进其 §6）：裸字母动作键须持续避让 IME / type-ahead / 系统快捷键；动作簇改选中态跟随后未选中条目无 affordance (carried)
- **`pkill` tauri 父进程会留下 vite 子进程占住 1420**：清理须补 `lsof -ti :1420 | xargs kill` (carried)
- **挤压阈值窗口高 `684px`**，两条常驻横幅同时出现时约 `750px`，与常见最小 768px 仅差 18px (carried)
- **`release.yml` 的 secret→变量映射是故意交叉的**：`APPLE_API_KEY: ${{ secrets.APPLE_API_KEY_ID }}`，不要「顺手改正」 (carried)
- **Developer ID 证书有效期仅 8 个月**（2026-06-04 → 2027-02-01） (carried)
- dev 裸二进制 WebKit 存储在 `~/Library/WebKit/prompt-hub`，正式 `.app` 在 `dev.prompt-hub`，两套设置互不相通 (carried)
- `.codex/` / `AGENTS.md` / `dsh-plugin-ziwuliuzhu/` 归 omar，保持未跟踪 (carried)

## Verify

本轮实测（2026-09-25）：

- `pnpm test` → **398/398** ✅；`pnpm lint` / `prettier --check .`（云端检出树，无未跟踪目录）/ `pnpm build` → 全绿 ✅
- `cargo test` repo-core / repo-write / prompt-hub-mcp → 全绿 ✅（云端 Linux 缺 GTK，全 workspace 由 CI 覆盖）
- CI（macOS 14.8.9 runner）`frontend` / `rust` / `bench-c1` 全绿；`bench-c1` p95 **1.917ms**，日志**无** `isa-swizzle skipped` ✅
- ⚠️ 此 p95 与 2026-08-20 本地 **13.708ms** 口径不同（CI runner vs 本机），不可直接比较
- release run `36159126062` 全绿；publish 后 `latest.json` → `0.2.1` ✅
- macOS 27 真机：omar 验收通过 ✅

**恢复工作前**：跑 `pnpm test` + doc-governance + prettier 确认基线。动代码须补 `pnpm lint` + `pnpm build` + `cargo test --workspace`；涉及主形态启动路径还须 `pnpm bench:hotkey-wake`，**并确认启动日志无 `isa-swizzle skipped`**。

## Modified Files

- `d6659e0` `fix(macos)` — `src-tauri/src/macos.rs`：运行时构建 `KeyablePanel` + ivar 镜像 + 布局校验 + 降级
- `cc2bf9c` `fix(macos)` — 同文件：沿父类链收集 ivar（KVO 子类）
- `36e0e4e` — merge HuiW86/prompt-hub#1
- `aa4a829` `chore(release)` — 0.2.0 → 0.2.1（三处版本号 + `Cargo.lock`）+ `docs/release-notes/v0.2.1.md`
- `6f1b63b` — merge HuiW86/prompt-hub#2（tag `v0.2.1`）
- 本次追加：`HANDOFF.md` / `docs/design/CHANGELOG.md`
