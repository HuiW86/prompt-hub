# Handoff — M-01 全景面板已合入 `main`，待真机门（2026-11-13）

> 本文件只留「本轮做了什么 + 仍开着的账」。历史轮次的明细在 `docs/design/CHANGELOG.md` 与 git 历史；本机装机记录见 [本机安装记录](docs/website-tab/evidence/local-install-2026-09-24.md)。

## Objective

让唤起后的默认视图成为「一眼看到全局，一键贴出，每次都记数」的全景面板（[[031-panorama-default-view]]，Issue #7–#10）。

## Completed

- **PR #12 合入 `main`**（merge `97b4e75`，2026-11-13），#7–#10 全部关闭：
  - I-02 `70c7339`：migration `0016_panorama_placements`（`user_version` 15→**16**）、`list_panorama_placements` / `set_panorama_placement`（IPC 71→**73**）、导出 1.4→**1.5**（缺键保留仍对得上的本地行 / 空数组清空 / 有内容替换，悬空行丢弃，`null` 拒绝）
  - I-01 `30b6729` + `980a05e`：ADR-031 **Accepted**，宪法 B2 **v1.2 ratified**（HuiW86 2026-11-13 签字，`0016` 同时通过）
  - I-03 `b284cb9`：`src/components/panorama/PanoramaView.tsx` 设为默认工作区，Header「全景 / 管理 / 常用网站」
  - I-04 `5dfe22a`：`PlacementMenu`、整理态 `M` / `⌥1–⌥9` / `⌥0`、抢占常用位撤销
  - 签字时工作区名「整理」改为「管理」（避开交互模式「整理态」撞名，原第 66 项）
- 测试：前端 540→**603**，Rust 231→**243**；浏览器冒烟（Vite + Playwright + 假 IPC，1440×900 / 1280×720）通过

## In Progress

- 无。

## Next Actions

> 编号沿用旧账，只列仍开着的。**建议起手：第 68 项**（CI 换 runner 后看首跑结果），再第 64 项剩下的两项界面验收。

### 全景（M-01）收尾

64. **全景真机门**（2026-11-13 本机跑过一轮，**仍未全过，继续不要从 `main` 出包**）：
    - ✅ 本地编译：`cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings` 通过（macOS）
    - ✅ 唤起性能：`bench:hotkey-wake` p95 **20.143ms**，低于 200ms 门槛；但比 2026-09-05 的 14.139ms **多 6.004ms（+42%）**。这是 Rust `show()+set_focus()` 路径，不含系统快捷键派发。同时兑现原第 59 项（网站 Tab 与全景两次改动的累计）。增量原因未查，候选：唤起时全景重置筛选并聚焦输入框、全景首屏 DOM 比旧仪表盘多；若后续再涨须先定位
    - ✅ 迁移：用 SQLite 备份做真实库副本，开发版把副本 15→16 迁移正常；原库仍 15，`quick_check` 正常。副本在 `/tmp/prompt-hub-acceptance-home`
    - ⏳ 真实库 76 条一屏无纵向滚动（含紧凑档）——自动化接管不了隔离开发版窗口，须手动看
    - ⏳ `⌥1–⌥9` 指定常用位、`⌥0` 取消（macOS WebKit 下 `event.code` 是否为 `DigitN`）——同上，须手动：切到「整理」态 → 方向键选中一条 → 按 `⌥3`，该条应出现常用位徽标 3；再按 `⌥0` 徽标消失
65. **全景契约回流**：product-spec / design-spec / prd 均未写全景与「管理」工作区，按 ADR-031「显式不裁」走八步
67. （低优先）清空废纸篓不清 `panorama_placements` 悬空行：不显示、占的常用位被新抢占者静默让出、导入时清理。要立即干净就在 `purge_trash` 末尾调 `repo_write::panorama::delete_dangling_placements`
68. **CI runner 配置失效**（new 2026-11-13）：根因已查明——GitHub 于 **2026-11-02 退役 `macos-14` 镜像**，`ci.yml` 三个任务都钉在 `macos-14`，于是启动前即被取消（报「macos-14-arm64-us-default 配置不受支持」），账单 $0、没有任何红叉，CI 静默失明。已改钉 `macos-15`（待合并后看首跑）。首跑须确认：rust / frontend 两个任务真的跑完并转绿；bench-c1 在新镜像上是否仍因无显示环境失败（它本就 `continue-on-error`，见第 10 项）。`release.yml` 用的是 `macos-latest`，不受影响

### 待裁决

58. **ADR-030（网站库）仍 Proposed**：`docs/adr/030-website-library.md` 缺 `Last reviewed`，代码已在 `main`。送审只给一句话决定 + 推荐；裁后八步回流 prd / product-spec / design-spec（网站 Tab 目前只有 `docs/website-tab/design-delta.md`）
8. 可发现性裁决 ×3：场景删除入口外露 / 整理态保窗 vs 改 D-0 契约 / title-only 后卡面无内容线索
21. 主环：**21.4 S2 最小闭环「复制过但未归类的内容提示保存」**未做，需要自己的图纸（prd §5.7 / product-spec 区域 7 或 8）；附带待裁：隐藏期间 MCP 写入的草稿唤起不刷新 badge（G4 O1）、SOP 占位区是否收起
26. （G4 观察）新建空场景无「添加话术」入口；UI 新建 Macro `native=0` 而种子 `native=1`
28. `src/components/primitives/PhraseFormEditor.tsx` 的 `inline` 形态去留（已无生产调用方）
34. （P3）用「取消」/「保存」关锚定编辑器后焦点不回锚点（macOS WebKit 点 `<button>` 不聚焦）
54. **明细面回显修订说明**：`notes` 只写不显。改法：`src-tauri/crates/repo-core/src/repo.rs` `summarize_drift_ledger` 返回值带 `notes`（Rust + `src/ipc/types.ts`）→ `src/components/alignment/DriftLedgerView.tsx`「修订后」那行旁显示（空串不显示）。走 product-spec 区域 7 八步，**先出一句话方案**
11. P0-2 Composition 链路 ADR（`DraftInbox.tsx` `PROMOTE_BLOCKED_HINT`）
12. P2 余 4 评估 / P1-5 Phase 可配置性

### 审查与验证欠账

60. **`ccb145b`（网站 Tab）补审查**：`/review` + verifier。重点 `src-tauri/src/commands.rs` `open_website` 的 URL 校验；`src-tauri/crates/repo-write/src/import.rs` 网站库三态导入；**第七道源码级闸门的 `ASSET_TABLES` 不含 `websites`**（`src/ipc/soft-delete-gate.test.ts`），网站读路径的 `deleted_at` 过滤没有闸门保护——须判断是否该进清单
61. 网站 Tab 真机未验：`WebsitePanel.tsx` 的 `ipc.openWebsite` 打开后默认浏览器行为与窗口焦点（non-activating panel，打开后是否应隐藏）、真实导入 1.4
6. `a24c7c0` / `4b722c1` / `716bd4c` 三个 commit 补 verifier 对抗审查
46. Codex 代理账户余额约 $0.3，充值到 ≥ $3 后补跑 `/codex review`（ADR-029 三期、第 53 项均无第二意见）
55. 正式版上反查一次 `notes`：omar 下次真要改话术正文时填说明保存，再跑 `sqlite3 "$HOME/Library/Application Support/dev.prompt-hub/prompt-hub.db" "SELECT id, name, notes, content_revised_at FROM alignment_phrases WHERE content_revised_at IS NOT NULL ORDER BY content_revised_at DESC LIMIT 3;"`。AI 不替他挑话术改真实库
62. runbook §4 更新链路未单独确认：0.2.0 客户端「检查更新」→ 公开 v0.2.1，须在另一台机或隔离安装上做
40. （低优先）G5 两处覆盖薄处：六个删除入口只真机走了 Macro 卡；`revive_trashed_ancestors` 祖先复活路径未真机跑
45. （低优先）G6 未验：1 MiB 日志滚动是否真保留一份；每小时后台线程跨休眠的每日排期

### CI / 发布

10. `.github/workflows/ci.yml` 的 bench-c1 仍是 `continue-on-error: true`——C1 铁律在 CI 上不设防
56. 给 swizzle 降级加 CI 闸门：`bench/hotkey-wake.bench.mjs` 只转发 stderr，不判 `isa-swizzle skipped`；建议出现即退出码 1
57. 升 tao 须复核 `macos.rs` 的 ivar 镜像：`layout_mismatch` 硬编码 tao 0.35 `TaoWindow` 只有 `focusable` 一个 ivar，增删 ivar 会**静默降级为抢焦点的普通窗口**；第 56 项落地前升 tao 后人工看一次启动日志
5. 发布收尾（非阻塞）：`latest.json` 最低版本字段；`release-signing` 环境 secret 作用域整理
20. **Developer ID 证书 2027-02-01 到期**（距今不到三个月），加日历提醒

### 文档

3. `docs/MANIFEST.md` 停在 v1.24，大部分行仍是 2026-07-06 口径，**ADR-029 之后的 030 / 031 都未登记**
17. `docs/adr/005-prompt-combiner-reuse.md`（Proposed）/ `docs/adr/011-search-usagesource.md`（Reserved）的 `Last reviewed` 仍是 2026-07-02，超期未复核
22. user-flows v0.1 重写（共创，与 omar 同会话做）
14. `docs/design/CLAUDE-DESIGN.md` v0.2 重传 + v2 基调同步
15. design-spec 上游回流：ipc-contract 扩扫 / `--color-danger` / `--scrim` 语义

### 代码小账（低优先）

49. `src/components/scene/PhraseEditor.tsx` 只改子阶段后点外关闭会静默丢弃——`PhraseFormEditor` 已有 `extraDirty`，PhraseEditor 没传，一个 prop 就能修
50. prd §6.6「相位带按 `kind='opening'`、口令区按 `kind='cue'` 过滤」UI 未实现；chip 的 `aria-label` 盖住坐标文本；状态栏口令格 `tabIndex=-1` 只能鼠标点开
9. 补 `ScenePanelFocusRestore.test.tsx` 焦点恢复负路径测试
18. `src/hooks/useAnchoredPosition.ts` 翻转态首次放置与重算差 1 逻辑点
29. 测试套件不在 StrictMode 下跑，而 `pnpm tauri dev` 是
38. 清空废纸篓后 `src/components/StatusBar.tsx`「今日复制」计数陈旧
39. 恢复的成功 toast 可能被存活中的撤销 toast 顶掉——**别为这条放宽让位规则**
44. 导入期间弹窗锁死但无进度反馈
52. `DriftLedgerView.tsx`「按开场话术」表在只有「停」时为空表头（若想看到「默认 · 发散 0 0 0 0」再改）

### 暂缓

1. ADR-025 P2 键盘动作层——omar 2026-08-20 明示暂不做（落地时须兑现 product-spec §13.3「`⌘Enter` 保存并推进到下一条」，验收门 G2 五项）
16. gstack 升级 0.16.3 → 1.61.0
19. 找 2–3 个外部使用者装一版用一周

## Dropped

- 第 63 项（PR #12 合并）：2026-11-13 已合并
- 第 66 项（「整理」撞名）：工作区改名「管理」，模式名不动（CHANGELOG 2026-11-13）
- 第 59 项（网站 Tab 补 C1 bench）：并入第 64 项，同一次 `bench:hotkey-wake` 一并覆盖

## Risks & Decisions

> 长期风险在 [[learnings]] 附录 B；此处只留仍会影响下一次改动的。

**发版与数据**

- **`0016` 落地后不可降版本**：`user_version` 16 的库不能交给 v15 的二进制。`main` 现为 **0.2.2**（未发版），高于公开 v0.2.1；下次发版须从当前 `main` 出包，版本号不得回落
- **两个 0.2.1 同号不同内容**：公开 v0.2.1 = 闪退修复、schema 14；本机 `/Applications` 的 0.2.1 = 网站 Tab、schema 15（2026-09-24 自建，未公证）。同号让本机更新器不提示升级，这是好事；问题只在下次发版必须 ≥ 0.2.2
- **ADR-030 代码先于决策**：`0015` 已在真实库跑过，若裁决改动数据形态，只能新开迁移，不能降版本
- **`notes` 留空 = 清空，不是保留**：正文真变时 `AlignmentPhraseEditor.handleSubmit` 总是发 `notes`（可为空串），读方按空串 = 无说明（prd §6.6）。别把谓词改回「非空才发」
- `live_cue` 语义已冻住（append-only）；`refCount` 是查询期现算；`update_alignment_phrase` 缺省 `coordinates` = 不动，显式 `null` 才清空
- 第七道闸门只强制 `deleted_at`；轴取值表硬删；error toast 顶撤销 toast 是刻意的；改 `SceneNotEmpty` 或单条恢复前先读 `revive_trashed_ancestors`

**工具与环境**

- **钉死的 runner 版本会被 GitHub 退役，且退役后任务是「取消」不是「失败」**（第 68 项）：不会出红叉，CI 看上去只是没结果。看 PR 时「cancelled」要当成没跑，不能当成没问题；云端 Linux 编不过主 crate 里 macOS 专有的 `RunEvent::Reopen`，测试时需临时替换该行、测完还原
- **Rust workspace 已整体 `cargo fmt` 一次**（2026-11-13，PR #14）：此前 `repo-core` / `repo-write` 积了约 59 处格式差异，CI 在 macos-14 退役前后都没真正检查到；macos-15 首跑即在 `cargo fmt --check` 上失败。现在全量干净，之后 CI 会照常拦
- **本机 shell 跑在 Rosetta 下**：前端命令一律包 `arch -arm64 /bin/zsh -lc '…'`，别为 `@rollup/rollup-darwin-x64` 报错重装 `node_modules`
- **云端会话推不了 tag**（代理 403），发版打 tag 须在本地做
- **本地 `AGENTS.md` 是 7 月 v1.1 旧规则**（已 gitignore），用 Codex 前先同步或改指向 `CLAUDE.md`
- **降级路径会让 CI 失明**：凡有 fallback，要有 CI 看得到的信号区分主路径与 fallback（第 56 项）；isa-swizzle 的「布局相等」要比 ivar 集合与偏移，且看运行时实际类（KVO 会插入 `NSKVONotifying_*`）

**真机取证与装机**

- 唤起后先点一下窗口并核 `frontmost`（`onscreen=true` 不等于键盘能打进 webview）；原生保存 / 打开面板不认 `HOME` 覆盖，须 ⌘⇧G 输全路径；导入后 `usage_records` 归零是 prd §6.9 D2 的设计
- 裸 release 用 `pnpm tauri build --no-bundle`（`cargo build --release` 的产物 webview 全白）；`tell application "prompt-hub"` 唤起的是 `/Applications` 正式版
- 装机口径：`--bundles app` + 关 updater 产物；chunk 名与 `dist/assets/` 一致即算核过；`spctl` 报 `Unnotarized Developer ID` 属正常

**流程**

- 记录类内容不进人审队列（[[CLAUDE#§5.1.2]]）；§2 计数只信 vitest JSON reporter

## Verify

> 2026-11-12 在云端 Linux 上实测（`5dfe22a` 之后）；macOS 上未跑（见第 68 项）。

- `pnpm test` → **603** / 49 文件
- `cargo test --workspace --manifest-path src-tauri/Cargo.toml` → **243**（Linux 上需临时替换 `RunEvent::Reopen`）
- `cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings` / `cargo fmt --manifest-path src-tauri/Cargo.toml --check` → 全绿
- `pnpm lint && pnpm build && pnpm exec prettier --check src` → 全绿
- `node scripts/doc-governance/index.mjs --config doc-governance.config.mjs` → 0 error

## Modified Files

> 本轮见 PR #12（merge `97b4e75`），34 个文件；主要新增：

- `src-tauri/crates/repo-core/migrations/0016_panorama_placements.sql`、`src-tauri/crates/repo-core/src/panorama.rs`、`src-tauri/crates/repo-write/src/panorama.rs`
- `src/utils/panorama.ts`、`src/stores/panoramaStore.ts`、`src/components/panorama/`（`PanoramaView` / `PlacementMenu`）
- `docs/adr/031-panorama-default-view.md`、`docs/design/02-constitution.md`（v1.2）
