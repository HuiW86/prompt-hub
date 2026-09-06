---
type: test-spec
project: prompt-hub
version: v0.14
created: 2026-05-19
last_modified: 2026-09-06
status: ratified # v0.14 于 2026-09-06 归档（[[HANDOFF]] 第 51 项补验涟漪，记录类直接归档）：G7 剩余三项在隔离 HOME 上用真实库 **v14** 快照 + `/Applications` 正式版二进制补验——② 紧凑档 9 格可读 ✅ / `content` 真变打戳 ✅（**但 `notes` 半边前端无入口**，记 [[HANDOFF]] 第 53 项待裁）/ 导出 1.3 → 导 1.2 旧备份 → 导回 1.3 三步往返 ✅；G7 由「7 通过 / 1 部分」改「**8 通过（1 缺陷修后通过）/ 0 部分**」，§4.6「不在覆盖内」清零、只余 `notes` 一条；顺带 §4.5 G6 未覆盖的 `pre-import` 快照路径闭合（四项 → 三项）；教训续到 19。计数一个不动（前端 532 / Rust 227 / gate 7 / IPC 62）。v0.13 于 2026-09-05 归档（[[HANDOFF]] 第 47 项装机涟漪，记录类直接归档）：**只改一处结论**——G7-7 Dock / Reopen 路径在装到 `/Applications` 的正式版上补验通过，G7 由「6 通过 / 2 部分」改「**7 通过 / 1 部分**」，§4.6「不在覆盖内」四项减为三项，教训续到 17；计数一个不动（前端 532 / Rust 227 / gate 7 / IPC 62）。v0.12 于 2026-09-05 归档（[[029-alignment-coordinates-and-drift-ledger]] 三期落地涟漪，P0 `0329520` / P1 `345e37f` / P2 `3af8308`）：本版改动**全属记录类**，按 [[CLAUDE#§5.1.2]] 不进人审队列——① §2 / §4 计数全量刷新：前端 461 → **531**（41 → **45** 文件），Rust 192 → **227**；② §3 源码级 gate 仍 **7 个**，但两处盘面数变了：`ipc-contract` 覆盖命令数 56 → **62**，`soft-delete-gate` 的豁免 marker 12 → **13** 处 / 登记清单 10 → **11** 条（新增的一条是 `list_alignment_axis_values` 的引用计数读——`ON DELETE SET NULL` 是 SQL 层动作，看不见 `deleted_at`，故删一条轴取值也会把废纸篓里那些话术的坐标一并抹掉，只报存活数会藏起一半爆炸半径）；③ §4.1 新增 **G7 行**并在**同版第二笔**填入结果——ADR-029 的第一个真机门于 2026-09-05 18:05–18:52 PDT 跑完：**6 通过 / 2 部分 / 1 缺陷已修**（`4a68fa9`），逐项记录见新增的 **§4.6**；两项「部分」是 ② 紧凑档未切换验证与 ⑦ Dock / Reopen 路径未验（裸二进制没有 Dock 图标）。④ 前端计数随缺陷修复的回归用例再 +1：531 → **532**（`AlignmentPhrases.test.tsx` 28 → 29，组件组 291 → 292，文件数仍 45），本机重跑导出。**两个计数都是本机实跑导出、不抄任何人给的数**（`pnpm exec vitest run --reporter=json` 逐文件计数分组相加 101 + 28 + 291 + 31 + 80 = 531 与表头自洽；`cargo test --workspace` 12 行 `test result:` 相加 227）。`user_version` 13 → **14**，导出 data schema 1.2 → **1.3**。**本版不新增 §4.x 走查记录**——G7 跑完之后才写。前 v0.11 于 2026-09-04 归档（[[HANDOFF]] 第 21.3 项落地涟漪）：两处改动都属**记录类**，按 [[CLAUDE#§5.1.2]] 不进人审队列——① §1 分层表 Rust 行的「覆盖范围」列补「启动自检」一词（`open_and_migrate` 迁移前跑 `PRAGMA quick_check`）。**这是描述该层覆盖到哪些模块，不是改测试分层本身**；§1 中真正属图纸的三层结构、工具与触发时机一字未动 ② §2 / §4 计数刷新：前端 457 → **461**（组件组 244 → 248，全在 `SettingsModal`）、Rust 183 → **192**（repo-core unit 49 → 58，`backup.rs` +7 / `db.rs` +2）。**两个数都是本机实跑导出、不抄任何人给的数**（`vitest --reporter=json` 逐文件相加 91 + 28 + 248 + 17 + 77 = 461 与表头自洽；`cargo test --workspace` 12 行 `test result:` 相加 192），verifier 复跑确认。gate 仍 **7** / IPC 仍 **56** / `user_version` 仍 **13** ③ 新增 §4.5 **G6 走查记录**（五项全通过、零缺陷零代码改动）+ §4.1 增 G6 行 + 教训续到 **12**。G6 属 §4.x 记录类，同法反查归档：逐句对 `/tmp/ph-walk/shots/G6-run-*.log` 与 `backup.rs` / `db.rs` 源码核过，未验的四项（`pre-import` 路径 / 1 MiB 滚动 / 后台每小时线程 / 忙碌守卫）**据实列在 §4.5 末段，不算通过**。前端 chunk `index-6Y1huvpK.js`。v0.10 于 2026-09-04 同法归档（[[CLAUDE#§5.1.2]]，§4.x 属记录类）：omar 撤销 [[07-features#§1]] `verified` 判据的 ② ③ 条，本版只随之改两处措辞——§4.1 表头注明「门过 + 留证登记 = `verified` 全部条件」，§4.2 前的 v0.8 提示补一句该行已于 2026-09-04 升 `verified`。**本版增量不含任何新的代码事实断言**（零代码改动、零新测试、计数全部不动：前端 457 / Rust 183 / gate 7 / IPC 56），故无可反查项，非「跳过反查」。v0.9 于 2026-09-03 同法归档：新增 §4.4 **G5 走查记录**（ADR-028 首个真机门，八项全通过）+ §4.1 G5 行 + §4.3 O3 转「真机已复跑」+ 教训 10 / 11。反查结果 **5 处不一致，全部按代码改正后才写入**（toast 不在 header DOM 里 / 动作簇与整理模式无关 / 说明行漏一个空格 / 确认按钮另有 `aria-label` / 清空还发一条 toast，逐条见 §4.4 反查说明）。测试计数不动（457 / 183，G5 零代码改动）。v0.8 于 2026-09-03 按 [[CLAUDE#§5.1.2]]「日志不签字」反查归档（§2 计数 / §3 gate 盘面 / §4 Rust 盘面 / §4.3 走查记录属记录类，不进人审队列；数字两轮全部由本机重跑 `pnpm test` 与 `cargo test --workspace` 重新导出，非沿用）；v0.7 同日同法归档（ts-recheck 62 条核 / 8 处修正 / 21 条真机观测无法从代码核）；v0.5 于 2026-09-01 人审批次 ③ ratified。v0.8 内容：ADR-028 **P0（`77637cd`）+ P1（`6aca7eb`）**涟漪——前端 414→457 / Rust 169→183 / 源码级 gate 6→7 / IPC 53→56 / 观察 O3 闭合
author: ai # 🤖 AI 主笔 + 人审（CLAUDE §5.2）
audience: [ai, human]
description: prompt-hub 测试规格——前端 Vitest 532 + Rust 227 + 7 源码级 gate + CI 双 job + C1 bench gate + 真机门 G1–G7；LLM Eval N/A
related:
  - 06-prd
  - 07-features
  - 10-ops-spec
  - 025-unified-anchored-editing
  - 027-configurable-global-hotkey
  - 028-reversible-delete
  - 029-alignment-coordinates-and-drift-ledger
---

# Test Spec: prompt-hub

> 实际测试盘面 + 分层规格。**LLM Eval 集 N/A**（[[02-constitution#D1]] 禁用 LLM SDK），本文件 §6 说明替代方案。
> 覆盖率目标见 [[07-features#§5]]。
>
> **标注约定**（沿用文档体系三标）：📊 实测（有命令输出背书，标注口径日期）/ 🎯 目标（规格要求，未必已落地）/ ⚠️ 红线（违反即 block）。
> 本版 📊 数字口径：前端与 Rust 均为 **2026-09-05 本机实测**（G7 缺陷修复后，`main` @ **`4a68fa9`**）——`pnpm exec vitest run --reporter=json`（逐文件计数分组相加 101 + 28 + 292 + 31 + 80 = **532 / 45 文件**）+ `cargo test --workspace`（12 行 `test result:` 相加 **227**，`4a68fa9` 是纯前端修复，Rust 侧未复跑口径不变）。未单独标注日期的条目沿用 2026-08-20 口径。
>
> **v0.3 全量刷新**：v0.2 的口径停在 2026-07-02，其间前端 154→**373**、Rust 135→**158**、源码级 gate 4→**6**、IPC 命令 48→**51**。数字标了日期不算说谎，但**差了一个半月和两倍用例量的规格文件已无参考价值**——v0.3 把全部 📊 推到当日实测。
>
> **v0.4（同日第二笔 · ADR-027 涟漪）**：前端 373→**395**、Rust 158→**168**、IPC 命令 51→**53**、新增真机门 **G3 四项**。源码级 gate 仍 6 个。
>
> **v0.5（同日第三笔 · 冲突提示）**：前端 395→**398**（`HotkeyRecorder` +3）。**G3 项 2 由「不可达」转为「通过」**——补上提示后该场景终于可观测，见 §4.2。
>
> **v0.7（2026-09-02 第二笔 · D1 修复）**：前端 398→**405**（AnchoredEditor 17→23 / ScenePanel 53→54）。jsdom shim 新增 **focus 拒绝隐藏元素** 规则——仅此一步 6 条既有用例变红，证明 D1 此前对整个套件不可见；修后 402 全绿。§4.3 D1 行记修复，W3 待发布形态复跑。**同日第三笔**：W3 按发布形态复跑通过（按 `main` 重建裸 release + 隔离 `HOME`，Swift 事件工具驱动 + 窗口定向截图 + SQL 反查；Macro / 场景属性 / 添加话术三入口），D1 闭合，新增观察 O7 / O8，见 §4.3。**同日第四笔**：W21 复跑改判 D3——对话框一直会弹（系统进程持有，窗口定向截图拍不到），真缺陷是点 OK 后退出 panic、码 101；失败分支改同步弹框 + `process::exit(1)`，复跑 `exit=1`，D3 闭合（P1→P2），§4.3 W21 / D3 行与教训 8。`/review` 后 repo-core 补两条 `open_and_migrate` 负路径测试（非 SQLite 文件 / 父路径不是目录 → Err 不 panic），Rust 168→**170**。**同日第五笔**：D2 修复——根因先修正：两监听并非「同在 window 冒泡阶段」，App 的隐藏监听挂 `document` 冒泡、弹窗 Esc 挂 `window` 冒泡，前者**先**到，原记的「补 `stopPropagation`」在原位置无效；改为弹窗在 `document` **捕获阶段**认领 Esc 并 stop（与 `primitives/Editor.tsx` 同约定，HotkeyRecorder 的 window 捕获仍先于它、录键中 Esc 语义不变），前端 405→**409**（App +2 / SettingsModal +2，其中两条来自 `/review`：录键态 + 弹窗集成、长按 Esc 自动重复不隐藏——后者顺带给 App 隐藏监听加 `e.repeat` 守卫）。顺带销 HANDOFF 第 31 项：`AppState.db_path` 收窄为 `PathBuf`，删只为 `None` 分支活着的单测，Rust 170→**169**。§4.3 D2 行记修复，W18 Esc 段发布形态复跑待做。**同日第六笔**：W18 Esc 段按 `main`（`e932955`，内嵌 chunk `I1hrJmog` 与 `dist` 一致）重建裸 release + 隔离 `HOME` 复跑，三步全过（单击 Esc 只关弹窗 / 录键态两次 Esc 先退录键再关弹窗 / 长按 Esc 约 1 s 弹窗关、仪表盘仍在屏），对照「弹窗关闭时长按 Esc 第一下即隐藏」证明事件确实到达隐藏监听；`settings.global_hotkey` 全程 `Alt+Space` 未动。**D2 闭合**，W18 转 ✅，G4 三缺陷至此全部闭合；教训 9 记合成键盘事件无 OS 自动重复。零代码改动。**次日第七笔（2026-09-03）**：观察 O7 裁决并修复——`AnchoredEditor` 接管锚点二次按下（`preventDefault` + 吞掉 click + 不调 `onDismiss`），前端 409→**414**（`AnchoredEditor` +3：吞掉锚点自身 click 不 dismiss / 焦点落 body 时回首字段 / 焦点已在面板内则不动，另改写 1 条旧用例标题；`MacroGrid` +1：再点「新增」单实例仍挂载、宿主 click 未触发；`AlignmentPhrases` +1：编辑中再点 chip，编辑器仍开且 `writeText` 与 `record_usage` 未调用）。变异验证撤回修法后 4 条变红，第 5 条「焦点已在面板内则不动」两态皆绿、是防过度修正的守卫。**jsdom 验不到的那半边**：mousedown 的默认聚焦动作 jsdom 不实现，「`preventDefault` 挡住焦点外移」只能真机证；已按 `main` + 本改动重建裸 release 复跑通过，见 §4.3 O7。
>
> **v0.7 归档说明（2026-09-03）**：本版按 [[CLAUDE#§5.1.2]]「日志不签字」直接归档——§2 计数与 §4.x 走查记录属**记录类**内容，不进人审队列，改由只读子代理逐句反查代码。首跑结果 **62 条核 / 8 处修正 / 21 条无法核**。8 处修正：§2 四行计数失真（`HotkeyRecorder` 10 条从未入册、`HotkeyBanner` 记 5 实为 7、`settingsStore` 8→11、`accelerator` 9 条漏登记、`token-gate` 39→40，合计与表头 414 对不上）+ §4.1 G4 门项口径（旧「21 / 3 / 1」合计 25 且已被后续复跑作废）+ §4.3 D3 净删行数（27→16）与 W24 导出表数（十表→8 张资产表）+ 教训 4 措辞降级。21 条无法核的全部是**真机观测**（截图 / 像素采样 / 退出码 / 剪贴板），代码里没有对应物，原样保留。v0.5 及以前经人审 ratified，本版起 §2 / §4.x 走此路。
>
> **v0.8 归档说明（2026-09-03 · ADR-028 P0+P1 涟漪）**：同法直接归档。本版所有 📊 数字**重新跑出来，不抄任何人给的数**，且因 P0 与 P1 相隔一次提交而**跑了两轮**（首轮对 `77637cd` 得 444 / 40 与 182，二轮对 `6aca7eb` 得 **457 / 41** 与 **183**，本文件记二轮）：`pnpm exec vitest run --reporter=json` 逐文件导出后按分组相加得 91 + 28 + 244 + 17 + 77 = **457**，与表头自洽；`cargo test --workspace` 的 12 行 `test result:` 相加得 **183**；IPC 数由 `commands.rs` 的 `#[tauri::command]` 与 `src/ipc/index.ts` 的 `invoke<` 各数一次，均为 **56**（P1 未加命令）。新增 §3.7 记第七道 gate（含它自己列明的四条盲区），§4.3 观察 O3 转闭合并记明**实装范围窄于 ADR 措辞**（composition 使用记录不带 `target_id`，未纳入过滤）。**首轮反查（对 P0 增量）：107 条核对一致 / 8 处不一致 / 13 条无法核**，8 处全部改正后才归档——① §3.7 原写「豁免只有两类」，实为**四类共 12 处 marker**（其中 10 处进得了清单），且原文点名的「动态拼表名那两处」恰恰**不在**清单里——它们对扫描器不可见，正是盲区 3 的实证② §4.3 原写「jsdom 侧由 `promptStore` 的 `syncRecentUsage` 用例守」——**该用例不存在**，`syncRecentUsage` 与 `useUndoableDelete` 都没有专属测试 ③ §2 promptStore +9 的构成描述错（9 条全在一个 `restoreAsset` describe 里，无一条测 `syncRecentUsage`）④ §4 soft_delete_e2e 行原写恢复「含 usage 历史」——该断言不在这个文件，在 repo-core ⑤ §4 repo-core 行原写读路径「**全部**带谓词」，与本文件 §3.7 自相矛盾（本 crate 就有 8 处登记豁免）⑥ 同行原把 `list_trash` 记作 repo-core 单测覆盖，实则该模块无 `#[cfg(test)]` ⑦ §2 MacroGrid「+2」把**同一条**用例的两个断言拆成两条，真正的第二条（删除被拒时回滚且不给撤销）反而漏了 ⑧ §2 AlignmentPhrases 记为纯 +1，实为 **+2 / −1**（删掉了「两步行内确认」那条）。13 条无法核分三类：真机走查 4 条、过程履历（谁在何时跑的）7 条、跨文档 2 条。
>
> **二轮反查（对 P1 增量，`6aca7eb`）**：数字全部重跑——`pnpm test` **457 / 41**，逐文件 JSON reporter 分组相加 91 + 28 + 244 + 17 + 77 = **457** 与表头自洽；`cargo test --workspace` 12 行 `test result:` 相加 **183**（唯一增量是 `soft_delete_e2e.rs` 6→7）；IPC 仍 **56**（P1 没加命令）。前端 +13 的构成经 `git show 6aca7eb --stat` 与逐文件对拍双向确认：`TrashSection.test.tsx` 12 + `token-gate` 40→41，而 `SettingsModal.test.tsx` 改了内容、条数不变。
>
> ⚠️ **v0.8 当时无真机证据**（原文保留）：ADR-028 P0+P1 的用户可见改动（一键删除、撤销 toast、最近区不再出墓碑、废纸篓列表与恢复与清空）全部只有 jsdom 与 Rust 覆盖，尚未跑发布形态走查，[[07-features]] 相关行**不因本版升 `verified`**。→ **v0.9 已补上**：真机门 **G5 八项全通过**，见 §4.4。→ **v0.10（2026-09-04）**：omar 撤销 [[07-features#§1]] 判据 ② ③ 后，G5 这一门即该行 `verified` 的**全部**条件，[[07-features]] §3.8 那行当日升 `verified`。
>
> **方法记一笔**：第 ⑦ ⑧ 两处不一致是同一个坏习惯——**照着「应该测了什么」写，而不是照着「测了什么」写**。⑦ 把一条用例的两个断言写成两条用例，凑够了「+2」这个数；⑧ 把净 +1 写成纯新增，掩盖了一条被删掉的旧用例。两处都不影响总数，所以**逐文件对拍抓不出来**——那把尺子只量条数，量不出哪条被换掉，后者只有读 diff 才行。这是 v0.7 归档时「逐文件对拍」经验的边界。
>
> **P1 补一条**：`token-gate` 又一次「自己长出来一条」（40→41，因为新增了 `TrashSection.module.css`）。这已是同一机制第二次现身（首次是 v0.3 的 `HotkeyRecorder.module.css`）——**凡本轮新增了 CSS module，gate 计数就会 +1，别把它算进「我写了几条测试」**。
>
> **v0.9（2026-09-03 · ADR-028 首个真机门）**：新增 §4.4 **G5 走查记录**——八项全通过，删除全链路（一键删除 → 撤销 → 废纸篓恢复 → 清空）在发布形态上跑完，**G4 观察 O3 一并在真机闭合**。**测试计数不动**（前端 457 / Rust 183 / gate 7 / IPC 56）：G5 零代码改动，只取证。§4.1 增 G5 行、§4.3 O3 行由「未经真机复跑」转为已复跑，教训续到 **11**。**一处诚实的空白**：祖先复活路径（恢复话术连带复活废纸篓里的场景与子阶段）**未在真机跑**，理由与证据见 §4.4「不在本门覆盖内的一项」。

---

## §1 测试分层（实际形态）

v0.1 规划的四层金字塔已落地为下表实际形态（Playwright E2E 层**未落地**，见 §4）：

| 层 | 工具（📊 实际在用） | 覆盖范围 | 触发时机 |
|---|---|---|---|
| 前端单元 + 集成 | Vitest 4（jsdom + `src/test/setup.ts`，含 `popover` shim） | stores / hooks / 组件渲染与交互 / App Tab cycle | 本地 `pnpm test` + CI frontend job |
| 源码级 gate | Vitest（文本级解析源码，共 **7** 个，见 §3） | token 纪律 / B2 物理分离 / IPC 三方契约 / 文档引用契约 / 密度层单调性 / 双光主题对等 / **软删除读路径过滤** | 同上（7 个全部随 `pnpm test` 跑）|
| Rust 单元 + 集成 | cargo test `--workspace`（tempfile SQLite fixture + trybuild） | repo-core / repo-write / MCP server / 迁移 / 备份 / **启动自检** | 本地 + CI rust job |
| 性能基准 | 自研 bench 脚本（`bench/*.bench.mjs`） | 唤起延迟（C1）/ 冷启动 | 主形态路径改动后手动跑；hotkey-wake 兼作自动化 gate（§5） |
| E2E（Playwright） | 🎯 未落地 | 完整用户 flow（快捷键 / 窗口切换） | —— 现由 ADR-012 Phase 5 式真机验收（screencapture + 手点）临时顶位 |

⚠️ **反金字塔禁止**：E2E > 集成 > 单元 数量倒挂时必须重构（违反则 PR 被 block）。

---

## §2 前端 Vitest 盘面

📊 **532 用例 / 45 测试文件，全绿**（2026-09-05 第十二笔实测，G7 缺陷修复后 `main` @ `4a68fa9`；同日第十一笔 531 取自 `3af8308`，v0.11 口径 461 / 41 于 2026-09-04）。

> **v0.12 +70（ADR-029 三期 · 461 → 531，文件 41 → 45）**：逐文件用 vitest JSON reporter 复算，四个新文件 + 六个既有文件长大——
>
> - **新文件 4 个 / +37**：`utils/__tests__/alignmentCopyText.test.ts` **10**（复制文本拼装 7 条 + chip 次级文字 3 条；含「三轴全空则逐字节等于原 `content`」这条把「旧话术零变化」钉死的用例）/ `components/__tests__/DriftLedgerView.test.tsx` **13**（空态 / 排序 / 逐轴行与行合计 / 修订前后切分 / 逐轴总计 / 两处缺口与合计对得上 / 读失败不退化成空态，另加一个**措辞禁令扫描**：`纠偏|漂移|出错|偏离|不好|建议|效果不佳|排名|评价` 一律不许出现在用户可见文案里）/ `stores/__tests__/sessionStore.test.ts` **10**（会话戳与本次唤起的口令计数）/ `ipc/usageSource.test.ts` **4**（口令一律记 `live_cue`，与它从哪个区被复制无关）
> - **既有文件 +33**：`AlignmentPhrases` 9 → **28**（+19：chip 坐标 4 / 编辑器三个坐标选择器 6 / 「管理…」轴取值面 9；**G7 之后再 +1 至 29**，见下条）/ `StatusBar` 1 → **6**（+5）/ `App.test` 27 → **30**（+3，全是 `⌘9`）/ `RecentList` 1 → **3** / `SearchOverlay` 17 → **18** / **`token-gate` 41 → 43 又是它自己长出来的**——P1 的 `alignment.module.css` 与 P2 的 `driftLedger.module.css` 按 CSS 文件枚举自动入册并通过，与 v0.3 的 `HotkeyRecorder.module.css`、v0.8 的 `TrashSection.module.css` 是同一机制第三次现身；`ipc-contract` 6 → **7**（新增一条「命令面大小恰好等于 62」的断言，守的不是三方漂移而是**静默增长**）
>
> **G7 之后再 +1（`4a68fa9`）**：531 → **532**，唯一一条是 `AlignmentPhrases.test.tsx` 的 `re-pulls axis values on open so the confirm reports the current refCount (G7 缺陷)`——守 **D-G7-1**（§4.6）。这条用例的来源值得记：**它不是写完代码时想到的，是真机门指出来的**，而这类「数据是对的、只是store 里那份过期了」的缺陷，jsdom 里所有既有用例都是绿的，因为它们各自只走一步。
>
> ⚠️ **jsdom 验不了这一批的四类东西**：真实形状库的 13→14 迁移（这里跑的是 tempfile 空库）/ 9 格相位带的像素 / `⌘9` 走 OS 快捷键分发 / **原生 `select` 弹窗与「点外关闭」规则的冲突**——jsdom 的 `<select>` 不弹原生菜单，而那正是三个坐标选择器最可能出事的地方。四类全部归 **G7**（§4.1）。

> **v0.11 +4（第 21.3 项 · 设置弹窗忙碌守卫）**：全部落在 `SettingsModal` 10→**14**——忙碌中 Esc 不关窗 / 忙碌中点遮罩不关窗 / 忙碌中点 × 不关窗 / 导入 settle 后可关，另有空闲态点遮罩仍可关一条作对照。**文件数不变**（41），新增用例进的是既有文件。这四条守的是 `import_data` 转 async 之后新出现的窗口：主线程不再冻结，于是「冻结」这个意外的互斥没了。
>
> ⚠️ **jsdom 只能验一半**：「导入真的在跑」在这里是个替身（`dataBusy` 由测试直接置位），真机上那半边归 G6。

> v0.3 记 373 / 37。**+22 的逐文件构成经 worktree 对拍取得，不是估算**：新增 `utils/__tests__/accelerator.test.ts` **9** + `components/__tests__/HotkeyRecorder.test.tsx` **7**；既有文件 `settingsStore` 8→11、`HotkeyBanner` 5→7；**`token-gate` 39→40 是它自己长出来的**——该 gate 按 CSS module 文件枚举用例，新增的 `HotkeyRecorder.module.css` 自动入册并通过。这一条顺带证明 [[CLAUDE#§4]] 4.1 的 token 纪律确实盖住了新组件，而不靠人记得去查。
>
> ⚠️ 手数 `it(` 会漏：多个文件用 `it.each` / 按文件枚举生成用例，源码里的 `it(` 数与运行时用例数**不等**。本轮首次改用 vitest JSON reporter 逐文件对拍，是查出 token-gate 那 +1 的唯一原因。
>
> v0.7 +7（D1 修复回归）：`AnchoredEditor` +6（shim 自检 ×2：visibility 与 display:none 自身/祖先 / 打开即聚焦 / `anchor=null` 时不聚焦、到位后才聚焦 / 滚动·resize·换锚点不重聚焦 / inline 形态挂载聚焦）+ `ScenePanel` 属性面板 +1。后三条来自 `/review` 测试专项与可维护性专项的缺口指认。另 `src/test/setup.ts` 新增 focus 拒绝规则（`visibility: hidden` 或祖先 `display: none` 时 `focus()` 不生效），不计用例但改变了全套件的判定口径——它让 6 条既有用例在修复前变红。
>
> v0.8 **净 +30（ADR-028 P0）**：逐文件用 vitest JSON reporter 复算——
>
> - `promptStore` 36→**45**（+9）：全部落在一个 `describe("promptStore — restoreAsset (ADR-028)")` 里，构成是 1 条转发断言 + 一个 7 项 `it.each`（六类资产各一 + 一条未知 kind）+ 1 条失败 rethrow
> - `toastStore` 10→**16**（+6）：让位规则——普通 toast 让位撤销 / `error` 仍上位 / 新撤销可替换旧撤销 / `clear()` 不受约束
> - `MacroGrid` 6→**8**（+2）：一条「首次点击即删、toast 的撤销把它恢复回来」+ 一条「删除被拒时卡片回滚、给 error 且**不给撤销**」
> - `AlignmentPhrases` 8→**9**：**净 +1 掩盖了 +2 / −1**——删掉旧的「删除是两步行内确认」，新增一键删 + 撤销、以及被拒时给 error 不给撤销两条
> - 新增第七道 gate `src/ipc/soft-delete-gate.test.ts` **12**（3 条扫真实源码 + 9 条用夹具自检这把尺子本身，见 §3.7）
>
> **`ScenePanel` / `ScenePropertiesEditor` / `ScenePanelFocusRestore` / `ModifierGrid` 四个文件本轮改了内容但用例数不变**（确认框断言换成撤销 toast 断言），故不出现在增量里。这一条与上面 `AlignmentPhrases` 的 +2/−1 是同一件事的两面：**净增量看不出改写**，逐文件对拍也只看得出条数、看不出哪条被换掉——后者要读 diff。
>
> v0.8 **+13（ADR-028 P1）**：新增 `components/__tests__/TrashSection.test.tsx` **12**（列表渲染与条目数 / 空态 / 读失败不退化成空列表 / 单条恢复后重读 / 清空走确认框 / 连点不重复打 `purge_trash`）+ **`token-gate` 40→41 又是它自己长出来的**——新增的 `TrashSection.module.css` 按 CSS 文件枚举自动入册并通过，与 v0.3 记的 `HotkeyRecorder.module.css` 同一机制第二次现身。**`SettingsModal.test.tsx` 本轮改了内容但用例数不变**（10→10）。
>
> v0.7 +4（D2 修复回归）：`App.test` +2（设置弹窗开着按 Esc → 弹窗关、`hide_window` 调用数不变；`repeat: true` 的 Esc 不隐藏窗口）+ `SettingsModal` +2（Esc 在 document 捕获阶段被认领，同 target 的冒泡监听收不到；录键态下第一次 Esc 只取消录键、第二次才关弹窗——事件同时带 `key` 与 `code`，因为录键器按 `code` 判、弹窗按 `key` 判，只带一个字段会静默跳过一方；变异验证：录键器监听挪到 document 即红）。前两条把 keydown 派发到持焦点的 dialog 而不是 document，走真实按键的传播路径——派发到 document 时 at-target 阶段捕获 / 冒泡两组监听的先后依赖 jsdom 对规范的实现细节，不作为判据。

| 分组 | 用例 📊 | 文件 | 覆盖对象 |
|---|---|---|---|
| stores（8 文件） | 101 | `src/stores/__tests__/{appStore 2, promptStore 45, searchStore 4, **sessionStore 10**, settingsStore 11, toastStore 16, updaterStore 12}.test.ts` + `src/stores/prompt/__tests__/helpers 1` | Zustand store actions / 复制失败可见 + toast intent 分级与**让位规则** / updater 状态机 / draft 计数联动 / 软删除恢复与废纸篓 slice / **唤起会话戳与本次唤起的口令计数** |
| hooks（4 文件） | 28 | `src/hooks/__tests__/{useAnchoredPosition 13, useRegionNav 8, useCopy 4, useSearchResults 3}` | **锚定定位与滚动祖先订阅**（ADR-025）/ 区域内漫游导航 / 复制 / 搜索结果派生 |
| 组件（22 文件） | 292 | `src/App.test.tsx` 30 + `src/components/__tests__/*`：ScenePanel 54 / **AlignmentPhrases 29** / AnchoredEditor 26 / ScenePropertiesEditor 22 / SearchOverlay 18 / DraftInbox 15 / **DriftLedgerView 13** / TrashSection 12 / SettingsModal 14 / HotkeyRecorder 10 / MacroGrid 8 / HotkeyBanner 7 / **StatusBar 6** / ScenePanelFocusRestore 5 / ModifierGrid 4 / UpdaterBanner 4 / ErrorBoundary 3 / ModeToggle 3 / PhaseBar 3 / RecentList 3 / SearchBar 3 | 组件渲染 / 交互 / Tab cycle 6 区断言（[[03-product-spec#13.4]]）/ 编辑器关闭规则表分支 / 一键删除 + 撤销 toast / 废纸篓列表 · 恢复 · 清空 / **chip 坐标与三个坐标选择器** / **轴取值管理面** / **状态栏口令计数与漂移账明细（含措辞禁令扫描）** |
| utils（4 文件） | 31 | `src/utils/__tests__/errorMessage.test.ts` 8 + `src/utils/__tests__/accelerator.test.ts` 9 + **`src/utils/__tests__/alignmentCopyText.test.ts` 10** + **`src/ipc/usageSource.test.ts` 4** | IPC 错误信息归一 / 快捷键 accelerator 解析与格式化 / **复制文本拼坐标前缀与 chip 次级文字** / **口令复制一律记 `live_cue`**（后者放在 `src/ipc/` 下但不是 gate，按职能归本组）|
| 源码级 gate（7 文件） | 80 | **token-gate 43** / soft-delete-gate 12 / theme-parity 8 / **ipc-contract 7** / b2-separation 5 / density-gate 3 / doc-refs-gate 2 | 见 §3 |

🎯 单元测试范围要求（自 v0.1 保留，按现行架构改述）：核心业务逻辑（store actions / promote 语义 / schema 校验）覆盖 ≥90%；状态机转移（draft `pending→promoted/discarded`、SOP `active/paused/completed` 等，见 [[06-prd#7]]）穷举合法转移 + 拒绝非法转移；[[02-constitution]] 边界约束（资产数量上限 / 单条话术 ≤5000 字符 / 恶意 JSON 拒绝）必测。

---

## §3 源码级 gate（7 个）

> 模式：不 mock、不跑运行时，直接以文本级解析源码断言纪律成立——把「靠人肉 review 守的规矩」下沉为测试。7 个全部为 Vitest 用例（随 `pnpm test` 跑）。
>
> ⚠️ **v0.3 补记两个漏登记的 gate**：`density-gate` 与 `theme-parity` 早已落地并在 CI 跑，但 v0.2 的「4 个」口径从未更新——**规格文件本身也会漏账**，见 §3.5 / §3.6。

### 3.1 token-gate（`src/styles/token-gate.test.ts`）

守护 [[CLAUDE#§4.1]] / design-spec §10.2.2 hard rule：组件 CSS 禁止裸 px / 裸 hex / 裸 ms 字面量，一切长度/颜色/时长必须引用 `tokens.css` token（唯一 allowlist 即 `tokens.css` 本身）。递归扫描 `src/**/*.css`，剥离注释后正则断言。来源：旧 `#1D9E75` 字面量事故（2026-05-18）。

### 3.2 b2-separation（`src/components/__tests__/b2-separation.test.ts`）

守护 [[02-constitution#B2]] 协议层/任务层物理分离：断言任务层组件（MacroGrid / ScenePanel / ModifierGrid / SopProgress）零 alignment 引用 + DraftInbox scoped 断言，5 条用例。豁免名单显式登记（SearchOverlay 跨层检索面 / ProtocolBand 等本身即协议层 / RecentList 历史徽标），每条附依据。前身 `composition-b2-separation.test.ts` 随 CompositionWorkbench 下架被删（`fedb3a8`），本 gate 为其恢复与扩面（2026-07-01 P2-2）。

### 3.3 ipc-contract（`src/ipc/ipc-contract.test.ts`）

守护 Tauri IPC 三方契约：`commands.rs` 的 `#[tauri::command]` 集合 ↔ `lib.rs` 的 `generate_handler![…]` 注册表 ↔ `src/ipc/index.ts` 的 `invoke("…")` 字面量，三向名字集合等价。动因：前端测试 mock `invoke`、Rust 测试打 command 层以下的 repo fn，命令「定义了没注册 / 名字漂移」只会在运行时炸（ADR-015 补遗-2 踩过同类坑）。📊 当前覆盖 **62 个命令**（2026-09-05 实测：`commands.rs` 62 个 `#[tauri::command]` ↔ `src/ipc/index.ts` 62 个 `invoke<>` 字面量；v0.12 增 ADR-029 六个——轴取值的 list / create / update / delete / reorder 五个 + 漂移账一个；v0.8 增 `restore_asset` / `list_trash` / `purge_trash`，v0.4 增 `get_global_hotkey` / `set_global_hotkey`。v0.2 记 48——gate 动态解析源码，无需随命令数改测试）。

> **v0.12 起本 gate 多了一条不同性质的用例**（6 → **7**）：`EXPECTED_COMMAND_COUNT = 62` 是一个写死的数，它守的**不是三方漂移**（那是另外六条集合比对的事），是**静默增长**——每加一个命令都是一块新的攻击面和一处新的同步负担，所以加命令必须顺手改这个数并说明理由。ADR-029 那六个里**没有「轴取值引用计数」这一个**：两个计数搭 list 读的便车返回，因为需要它们的那一刻正是已经需要那张列表的那一刻（[[06-prd#6.6-bis]]）。

### 3.4 doc-governance 引用契约（`scripts/doc-governance/doc-refs-gate.test.ts`，本轮新增）

守护文档体系引用完整性：Vitest gate 以 `spawnSync` 执行 vendored checker（`scripts/doc-governance/index.mjs`，上游 ai-dev-lifecycle content-os，零网络/零 LLM），按 `doc-governance.config.mjs` 契约扫描治理域 markdown（CLAUDE.md / HANDOFF.md / `docs/**`），校验 `[[双链]]` / 相对 md 链接 / 反引号 code-path 引用目标真实存在——把方法论 §7 涟漪更新的「引用不悬空」约束从人工检查下沉为可执行 gate。三层分级：authoritative（编号设计文档 01–11 / CLAUDE.md / MANIFEST，违规 = error 挡门）/ working（plans / HANDOFF / CHANGELOG 等，warn 不挡门）/ frozen（Superseded ADR / mockups / research，跳过）。附反空转护卫（扫描文件数 >20，防 include 漂移致 gate 空跑）。随 `pnpm test` 执行（本地 + CI frontend job）。

### 3.5 density-gate（`src/styles/density-gate.test.ts`，v0.3 补登记）

守护 `tokens.css` §3c compact 层契约：compact **只允许收紧结构**。两条不变量以文本级解析断言——(1) `:root.compact` 里每个 token 必须**重声明**某个 base `:root` 已定义的 token（禁止孤儿 override，那种写了等于没写）；(2) 每个 override 必须是**严格小于** base 的 px 值（compact 变大或持平即回归）。字号 token `--t-*` 一律禁止出现在 compact 层——**密度不得以可读性为代价**。

> ⚠️ 关联未决项：[[05-design-spec]] §3c compact 层的**立论**待重写（正文的「640px-tall baseline window」不可复现，窗口恒等于显示器高度）。本 gate 守的是「若有 compact 层则必须单调收紧」，**不回答「该不该有 compact 层」**——见 [[HANDOFF#Next-Actions]]。

### 3.6 theme-parity（`src/styles/theme-parity.test.ts`，v0.3 补登记）

守护浅色调色板的**双份手工镜像**不分叉：`tokens.css` 按设计承载浅色两次——`:root.light`（显式选浅色）与 `@media (prefers-color-scheme: light)` guard 内的跟随系统分支。两份手写镜像，**往其一加 token 而忘了另一份，会让「浅色」与「跟随系统」两种外观静默分叉**。gate 解析两组规则并按 selector 后缀（base / `.accent-*`）逐声明断言相等。

### 3.7 soft-delete-gate（`src/ipc/soft-delete-gate.test.ts`，v0.8 新增）

守护 [[028-reversible-delete]] 子决策 2：**凡读七张资产表的 SQL，必须带 `deleted_at IS NULL`**。软删除只有在**每一处读**都过滤时才成立，而那是散在四个 crate、几十条语句上的承诺，漏一处的失败形态是**静默的**——某一个界面上，已删的资产悄悄复活。ADR-028 选原地软删除的**明示前提**就是把这类错误从「不推荐」变成「做不到」，否则 A 方案退化成外部调研反复警告的那个坑。

扫描 `src-tauri/src` 与 `src-tauri/crates` 的 Rust 源码，按资产表逐个计谓词；无法遵守的语句必须在紧邻上方写 `// soft-delete-gate: exempt — <理由>` 并在测试内的 `EXPECTED_EXEMPTIONS` 清单登记——清单与实扫结果必须**完全相等**（多一条少一条都红），**加豁免因此是一个需要过审的显式动作**。

📊 源码里带 marker 的共 **13 处，归五类**（v0.12 由 12 处 / 四类增至此）：**导出** 7 处（全保真备份，[[06-prd#6.9]] / 子决策 6）/ **废纸篓视图本身** 1 处（它要选的正是别人都藏起来的行）/ **恢复读取** 2 处 / **删除路径的存在性探针** 2 处（要看得见废纸篓行，才能把「已经删过了」这个空操作与「根本没这个 id」这个错误分开）/ **轴取值的引用计数读** 1 处（v0.12 新增）。

> **v0.12 那条新豁免为什么必须开**：`list_alignment_axis_values` 这条读要产出的两个数里，有一个正是**指向该取值的废纸篓话术条数**。三列坐标的外键声明是 `ON DELETE SET NULL`，而 `ON DELETE` 是 SQL 层动作、**看不见 `deleted_at`**——删掉一条轴取值，会把废纸篓里那些话术的坐标也一并抹掉。只报存活数，等于藏起用户自己没法核对的那一半爆炸半径（[[06-prd#6.6-bis]]）。同一条语句里的**存活计数照旧带谓词**，marker 覆盖的是整条语句。这一条同样落在「软删除自己的机件」那一类，**不是面向用户的列表读**，所以下面那条「没有任何一条豁免能把废纸篓里的行漏进用户看得见的列表」仍然成立。

> ⚠️ **别把「豁免有十几处」读成闸门被稀释了**：这四类**全是软删除自己的机件，没有一条是面向用户的列表读**——因此**没有任何一条豁免能把一条废纸篓里的行漏进用户看得见的列表**，而那正是这道闸门要防的唯一一件事。
>
> ⚠️ **13 处 marker 只有 11 条进得了清单，差的两条不是漏登记**：软删与恢复各有一条**按表名动态拼**的 SQL（`repo-write/src/soft_delete.rs` 与 `repo-write/src/trash.rs`），它们对扫描器**根本不可见**（下方盲区 3），写 marker 只是给读代码的人看的，扫不到自然也就登记不上。**这正是盲区 3 的实证**：真要有人新写一条动态表名的读语句，这道闸门不会拦他。

📊 **12 条用例**：3 条扫真实源码（找得到源码与资产读 / 每条非豁免读都带谓词 / 豁免集合与清单完全相等），9 条**用夹具自检这把尺子本身**（漏谓词要报 / 补上要过 / 多表 JOIN 要逐表计 / 豁免注释要认 / 远处的豁免注释不得覆盖到下一条语句 / 写语句要跳过 / 无该列的表要跳过 / 注释里的 SQL 不算 / 扫到 `#[cfg(test)]` 即停）。

> ⚠️ **这把尺子的已知盲区（gate 自己的注释里列明，不是遗漏）**：它是文本扫描不是 SQL 解析器——只看首关键字为 SELECT / WITH 的语句（写语句整体跳过，因为 `MAX(order_index) + 1` 这类追加子查询**必须**跨越废纸篓行，否则恢复会撞上后来发出的排序位）；只计谓词个数不做绑定；动态表名不可见（现存两处已豁免）；Rust 测试模块不扫。**能挡住的是真正会发生的那一类**：有人加一条列表读、或给既有读加一列，忘了带谓词。

---

## §4 Rust workspace 测试盘面

📊 **227 用例，全绿**（2026-09-05 第十一笔实测 `cargo test --workspace --manifest-path src-tauri/Cargo.toml`；2026-09-04 口径 192，**ADR-029 P0 `0329520` +35**。P1 `345e37f` 与 P2 `3af8308` 是纯前端改动，Rust 侧一条没动）：

| crate / suite | 用例数 📊 | 覆盖对象 |
|---|---|---|
| repo-write（unit） | **117** | 全部写路径 CRUD / promote 4 arm / reorder / `move_phrase` + MoveReceipt / 七处原地软删 + `restore_asset` + `purge_trash`（tempfile SQLite fixture）。**v0.12 +18（ADR-029 P0）**：新文件 `alignment_axis_values.rs` **7**（16 条 seed 分轴有序 / 追加只在本轴内 / 无提示也能建 / 改名改提示与未知 id / 重排拒收外轴 id / **删除把存活与废纸篓里的坐标一并置 NULL** / 硬删且报未知 id）+ `alignment_phrases.rs` **7**（存坐标与 `kind` / 跨轴 id 被拒且一个字节都不写 / **`coordinates` 载荷缺席则坐标与 `kind` 原封不动** / 显式全 null 才清空 / 更新时跨轴被拒不动行 / 只改名或只改坐标**不刷** `content_revised_at` / 正文真变了才打戳并写 `notes`）+ `import.rs` **4**（1.2 备份缺 `alignment_axis_values` 键时本表不动 / 显式空数组才清空 / 往返保住坐标与 `kind` 与修订戳 / 坐标指向不存在的轴取值则整笔回滚）|
| repo-core（unit） | **74** | 读路径（除 §3.7 登记豁免的 8 处外均带 `deleted_at IS NULL`——7 处导出 + 1 处废纸篓视图就在本 crate）/ 迁移（含 `open_and_migrate` 两条负路径）/ `count_pending_drafts` 等 free fn。**v0.11 +9（第 21.3 项）**：`backup.rs` **+7**——分前缀配额（一类快照的风暴挤不掉另一类）/ 哈希去重（库没变就复用旧快照、变了才落新盘）/ **`Unchanged` 仍刷 mtime**（verifier 抓出的 D1：不刷则每日排期永远结不清，每小时白跑一次 `VACUUM INTO`）/ **扫掉中断留下的 `.tmp`**（D3）/ `daily` 配额 7 / due 判定（无快照或最近一份满 24h）/ 同秒写入按写序排列；`db.rs` **+2**——健康库通过 `quick_check`、逐页写坏的库被拒绝且不 panic。**v0.12 +16（ADR-029 P0）**：`db.rs` **+5** 全是 `0014`——`usage_records` 整表重建后**逐行比对无一丢失** / seed 出第 9 相位与它的六条口令与 16 条轴取值 / 第 9 相位的「一相位一默认」部分唯一索引仍成立 / 有数据的磁盘库走 runner 升到 14 / 三列坐标外键真的是 `SET NULL`；`repo.rs` **+11**——`drift_ledger_*` **8** 条（归到前面那条开场话术 / 无会话戳的行跳过且绝不跨会话配对 / 任何锚点之前的口令记未归因 / **「停」进合计但不进任一轴** / 锚点在废纸篓则记未归因 / 口令自身在废纸篓只进合计 / 按 `content_revised_at` 切前后两段 / 用 `source` 而非 `target_type` 分开锚点与口令）+ `record_usage` 往返会话戳与 `live_cue` + 轴取值引用计数把存活与废纸篓分开数 + 轴取值按轴再按位序。**v0.8 +3**：`db.rs` 两条 `0013` 迁移测试（在有数据的库上加列后原行仍存活 / 重建后的默认索引让废纸篓里的默认话术腾出名额）+ `repo.rs` 一条最近使用区（软删后该行消失、恢复后带着历史回来）|
| prompt-hub-mcp（unit） | 8 | MCP server 工具层 |
| prompt-hub-mcp `tests/e2e.rs` | **7** | MCP 14 tool 端到端。**v0.12 +1**：`list_alignment_phrases_exposes_the_adr_029_fields_read_only`——外部 AI 读得到坐标与 `kind`，但**写不进**（B 类边界不因加了字段而松动）|
| prompt-hub-mcp `tests/trybuild_negative.rs` | 1 | 编译期负例（禁 import repo-write 写面，B 类边界的类型层强制） |
| repo-write `tests/backup_e2e.rs` | 3 | 备份端到端 |
| repo-write `tests/soft_delete_e2e.rs`（v0.8 新增） | 7 | 软删除端到端，**逐条**：① 六类资产恢复后 `id` / `created_at` / `order_index` 三者不变 ② 软删的行离开列表读但仍在表里 ③ 恢复一条已被顶替的默认对齐话术**降级而非报错** ④ `list_trash` 按删除时间倒序列出各类、默认为空 ⑤ 清空只销毁废纸篓里的行、留下一致的 schema 并清掉孤儿 usage ⑥ 可见列表重排**跳过废纸篓里的邻居**，回填隐藏 id 被拒。⑦（P1 新增）**恢复一条话术会连同它挂靠的场景 / 子阶段一起复活**，不留下够不着的资产。**「恢复后 usage 历史重连」不在本文件**，由 `repo-core` 的 `list_recent_usage` 用例守（见上一行）|
| prompt_hub_lib（bin crate unit） | 10 | app 壳层（第五笔删 `import_without_db_path_skips_backup_and_still_imports`：`db_path` 收窄后该分支不存在） |

⚠️ **`--workspace` 必须**：裸 `cargo test` 只测 bin pkg（≈0 用例），真实用例在 repo-core / repo-write / prompt-hub-mcp 三个子 crate（[[CLAUDE#§2]]）。

🎯 数据迁移要求（自 v0.1 保留）：每个 `migrate_X_to_Y` 必须有正向成功 / 注入伪故障回滚 / 备份完整性 / `user_version` 更新 / FK 完整性五类用例，覆盖 100%。

🎯 E2E 用户 flow（v0.1 §4 的 E1–E5 / X1–X4 清单）仍为目标规格，Playwright 未落地；现阶段由真机验收 runbook（screencapture 自动化 + 人工点验，参照 ADR-012 Phase 5 的 11 项模式）临时承接，正式 E2E 层落地时回收该清单。

### 4.1 真机验收门（v0.3 新增 · 涟漪 [[025-unified-anchored-editing]]）

E2E 层缺位期间，**布局 / 层叠 / 定位类改动一律由带编号的真机验收门承接**，门项写进对应 ADR §6 并逐项留证。当前状态：

> **门的分量（2026-09-04 起）**：一道门全项通过 + 留证登记进 [[07-features#§7]]，就是该功能升 `verified` 的**全部**条件。原判据还要求「进过一次已 publish 的 release」与「自用 ≥1 周无回归」，omar 于 2026-09-04 撤销这两条（[[07-features#§6]] 同日行）——它们仍然要紧，但由他自己执行与判断，不再是本层门禁的一部分。**对本文件的实际影响只有一句：门过了，状态就该动，不必再等日历。**

| 门 | 来源 | 状态 📊 |
|---|---|---|
| G1（六项）| ADR-025 P1-a 容器单点验证 | **全通过**。项 1/3/4 为 omar 目视；项 6 为 `bench:hotkey-wake` 实测；项 2 拆两半分别取证；项 5 因「P1-a 阶段该对象尚不存在」deferred 至 P1-b 门后通过 |
| P1-b 门（两项）| ADR-025 P1-b 容器迁移 | **全通过**，且**首次取得 AI 侧逐像素证据**：hover-lift 卡上浮层 diff bbox `None` / 最大通道差 `0`（同帧卡片区 `231`）；纵向滚动位移锚点 `-168px` vs 浮层 `-166px`，差值恒为 1 逻辑点、不累积（已 A/B 排除高度上限成因，记为已知量）|
| G2（五项）| ADR-025 P2 键盘动作层 | **未跑**（P2 未落地）|
| **G3（四项）**| ADR-027 全局唤起键可配置 | **四项全通过**（2026-08-20，见 §4.2）。项 2 一度判为「不可达」，补上冲突提示后**转为可观测并通过**。**omar 当日另行真机走查，未发现问题**（人工目视，不可回归；覆盖到哪几项未逐条记录）|
| **G4（二十四项）**| features §7 留证缺口清单（v1.19） | **21 通过（W1–W12 / W14–W19 / W21 / W23 / W24）/ 2 不可达（W13、W20）/ 1 部分（W22）**（2026-09-02 走查，W18 / W21 于同日复跑转通过，见 §4.3）。首次按**发布形态**走查（裸 release 二进制内嵌 dist，非 dev + vite）；发现三个此前所有门都没抓到的缺陷 D1–D3 |
| **G5（八项）**| ADR-028 删除可撤销（P0 + P1） | **八项全通过**（2026-09-03，见 §4.4）。删除全链路一次走完：迁移 → 一键删除 → 撤销 toast → 撤销恢复 → 废纸篓列表 → 单条恢复 → 最近区无墓碑（**G4 观察 O3 在真机闭合**）→ 清空确认与硬删。**零缺陷、零代码改动**。**一项明确不在覆盖内**：祖先复活路径未真机跑，理由见 §4.4 |
| **G6（五项）**| [[HANDOFF]] 第 21.3 项可靠性底座 | **五项全通过**（2026-09-04，见 §4.5）。空库首启落日志与两份快照 → 同日再启不重拍 → 拨老 25h 且改过数据则重拍 → 拨老 25h 未改数据则复用并刷 mtime → 打坏 `macros` 根页后启动弹阻断框、退出码 1、`backups/` 未被触碰。**零缺陷、零代码改动**。**三项明确不在覆盖内**：1 MiB 日志滚动 / 后台每小时线程跨长会话 / 设置弹窗忙碌守卫，理由见 §4.5 末段（`pre-import` 路径已于 2026-09-06 第 51 项补验闭合）|
| **G7（八项）**| [[029-alignment-coordinates-and-drift-ledger]] 三期（P0 + P1 + P2） | **8 通过（含 1 缺陷修后通过）/ 0 部分**（2026-09-05 18:05–18:52 PDT 首跑 6 / 2 / 1；⑦ 同日 19:59 第 47 项装机后补验；② 与「不在覆盖内」两项于 2026-09-06 00:34–00:44 PDT 第 51 项补验，见 §4.6）。通过：① 真实库 v13 快照升 14 且 38 行 `usage_records` 全保留 / ③ `⌘9` 复制「停」并记 `live_cue` 带会话戳 / ④ 复制文本逐字节等于前缀 + 换行 + 正文 / ⑤ 原生 `select` 弹窗不触发外点关闭、footer 可达 / ⑥ 确认框报活的 `refCount`（**修后**）/ ⑧ 状态栏计数与明细逐行对得上 `usage_records` / ⑦ 快捷键与 Dock / Reopen 两条路径都写会话戳（Dock 路径**补验**于正式版，S2 ≠ S1）。② 紧凑 / 舒适两档各截一张，9 格等宽、字号不变、「9 中途 ⌘9」可读（补验）。**缺陷 D-G7-1 已修** `4a68fa9`（`refCount` 读的是启动时的缓存，确认框把在用的取值报成「0 条」），回归用例 +1、Vitest 531 → **532**。**原列「不在覆盖内」四项已全部补验**；唯一残留：修订时写 `notes` 这半边**前端没有入口**（IPC 收、编辑器不发、product-spec 未画），真机上改正文后 `notes` 仍 NULL——不是本门能验的，是待裁（[[HANDOFF]] 第 53 项）|

#### 4.2 G3 门项（v0.4 新增 · 涟漪 [[027-configurable-global-hotkey]]）

前三项**物理不可自动化**：`register()` 要向 macOS 真正申请组合键，`RunEvent::Reopen` 要真实的 Dock 点击，重启持久化要真实的进程生命周期——jsdom 没有 OS，CI 没有窗口服务器。

| # | 门项 | 期望 | 为什么自动化测不了 |
|---|---|---|---|
| 1 | 在设置 › 快捷键把绑定改成 `⌃⇧P`，按新键唤起 | 窗口唤起；旧的 `⌥Space` **不再**唤起 | 需要真实 `RegisterEventHotKey` 与系统级按键分发 |
| 2 | 录键态下按一个已被别的进程占用的组合键 | 出现「没收到完整的组合键…可能已被其他应用占用」提示，**保持录键态**；绑定不变、旧组合键仍能唤起 | 占用方必须是另一个真实进程，且要真实的系统级按键分发 |
| 3 | 退出应用 → 重新打开 `.app` / 点 Dock 图标 | 窗口唤起（reopen 逃生口）；顺带确认「点 Dock 无反应」的旧缺陷已修 | `applicationShouldHandleReopen` 只由真实 AppKit 事件触发 |
| 4 | 改绑后完全退出并重启应用 | 新绑定仍生效（读自 SQLite，非 localStorage） | 需要真实进程重启 + 真实 app data 目录 |

> **走查前置**：须先退出 `/Applications/prompt-hub.app`，否则两个实例争抢同一组合键（同 [[HANDOFF]] 既有告警）。
>
> ⚠️ **`HOME` 覆盖只隔离数据库，隔离不了界面偏好**：SQLite 会落到临时目录，但 WebKit 的 localStorage 不认 `HOME` 覆盖，照旧读写真实的 `~/Library/WebKit/prompt-hub/...`。后果有二——**「空白配置」这一半根本不空白**（2026-08-20 据此误报过一次「首装是浅色」，实为走查者自己的旧偏好），且**走查会写到真实的界面偏好里**（分栏宽度、主题）。要真隔离得连 WebKit 存储目录一起换。

##### 走查结果（2026-08-20 实测，隔离 `HOME` 跑 dev 二进制 + vite）

| # | 结果 | 证据 |
|---|---|---|
| 1 | ✅ **通过** | 点「更改」→ 合成 `⌃⇧P` → DB `Alt+Space` → `Control+Shift+KeyP`，keycap 随之变 `⌃ ⇧ P`、「恢复默认」由禁用转可用；随后 `⌥Space` **连按两次窗口均不出现**，`⌃⇧P` 正常 toggle |
| 2 | ✅ **通过（补提示后复测）** | 首测判为不可达（录键器收不到被占组合键）。补上冲突提示后复测：第二个实例占住 `⌥Space`，在第一个实例录键态按 `⌥Space` → **提示按预期出现**、录键态保持、绑定仍为 `Control+Shift+KeyP`、`⌃⇧P` 事后正常 |
| 3 | ✅ **通过（两次复现）** | 窗口隐藏 → 点 Dock 图标 → 窗口上屏。**同时证实「点 Dock 图标无反应」的旧缺陷已修** |
| 4 | ✅ **通过** | `kill` 后重启，启动无 stderr 告警（注册成功），`⌥Space` 无反应 / `⌃⇧P` 唤起——绑定确实读自 SQLite |

> ⚠️ **项 2 首测判为「不可达」，是门项写错了**（该轮最重要的产出，**问题已于当日修复，门项已按修复后的形态重写**）。原门项设想「按下一个已被占用的组合键 → 报『已被其他应用占用』」。真机上这个场景**按不出来**：被占用的组合键由持有方在 OS 层注册并**消费**，前台应用的 webview 根本收不到该按键。实测用第二个实例占住 `⌥Space`，在第一个实例的录键态按 `⌥Space` —— 结果是**第二个实例的窗口弹了出来**，第一个实例的录键器全程没有任何输入。
>
> 因此 `HotkeyUnavailable` 错误路径**仍然必要且正确**（竞态、系统保留但未被 Carbon 持有的组合键仍会走到它），但它**不是冲突的主要形态**。主要形态是：**用户按下去，本窗口毫无反应，而另一个应用跳了出来**——界面不给任何解释。这是一处真实的 UX 缺口，[[HANDOFF]] 已挂账待裁（属新问题，不在 ADR-027 已批范围内）。
>
> **门项自检的教训又中一次**：§4.1 教训 1 说「门项必须在本阶段跑得起来」，本轮四项确实都「跑得起来」，但项 2 的**前提假设本身**（这个按键能到达应用）没有被检验。**下次起草门项要多问一句：这个操作真的做得出来吗，不只是这个对象存在吗。**
>
> ⚠️ **复测时又踩了一次同类坑，值得单记**：第一次复测「提示没出现」，差点结论成「修复无效」。实为**走查工具不忠实**——`key.swift` 只在主键上打修饰键标志位，**从不发送修饰键自身的按下/抬起事件**，而提示的判据正好依赖那对事件。人手按 ⌥Space 会发，合成的不会。改用 `chord.swift`（先发修饰键 keydown、再发主键、最后反序抬起）后一次复现成功。**「没复现」要先怀疑复现手段，再怀疑被测对象**——这是 §4.1 教训 2 的同一条，换了个面孔。

**三条方法教训**（写进规格以免重犯）：

1. ⚠️ **门项必须在本阶段跑得起来**——G1 项 5 要求「在 hover-lift 的 Macro / Scene 卡上开浮层」，而 P1-a 只接对齐话术一处，那些面当时还没有浮层可开。**门引用了一个迁移后才存在的对象**。起草验收门时逐项自检「这一项现在能跑吗 / 验不过我会看见什么现象」
2. **「拍不到」可能是取证方法的结论，不是被测对象的性质**——P1-a 三轮共 135 帧屏幕捕获从未拍到浮层，结论一度写成「不含 AI 观测证据」；改为按窗口 ID 定向 + 按需截图（不用定时 burst）后一次拍中
3. **真机走查未必要动数据**——本轮全程只点铅笔不点卡片本体（卡片本体是复制热区，会触发 hide-on-copy 并计入 usage），事后核对状态栏「今日复制 0 次」，零写入零回滚。上一轮曾造 14 条临时话术 + 整库备份 + 逐字段 diff

**走查工具链**（可复用）：`screencapture -x -o -l<窗口ID>` 定向截图（⚠️ **禁止全屏截图**；例外：其他进程持有的系统对话框，见 §4.3 教训 8）+ CGEvent 合成鼠标移动/点击/滚轮 + PIL 模板匹配测位移；坐标换算 @2x 下物理像素 ÷ 2 = 逻辑点。

---

### 4.3 G4 走查记录（v0.6 新增 · 2026-09-02 · 覆盖 [[07-features#§7]] 留证缺口清单）

**为什么这次不同**：此前所有真机门都跑在「dev 二进制 + vite」上。本轮先在 dev 上撞见「编辑器打开后键入进不去」，一度归咎 StrictMode 双跑 effect，改跑 release 后**同样复现**——于是全程改用 `pnpm tauri build --no-bundle` 产出的裸 release 二进制（内嵌 `dist`，`tauri://localhost` 源，localStorage 与 dev 不同源、与正式 `.app` 也不同目录），隔离 `HOME` 落库。**`verified` 对着的是发布形态，证据也该来自发布形态。**

**环境**：macOS，1470×956 逻辑 / @2x；正式版 `/Applications/prompt-hub.app` 先退出（组合键独占）；MCP 二进制走 stdio JSON-RPC 造 3 条草稿；每步以 `sqlite3` 反查隔离库为主证据，截图为辅；像素证据用自研 `px`（列扫描测高、区域均值测色）。

| # | 门项 | 结果 | 证据 |
|---|---|---|---|
| W1 | ⌘K 聚焦 / 分组结果 / Enter 复制 | ✅ | 隐藏 + `usage_records` +1 + 剪贴板全文 |
| W2 | 最近使用去重 / 空态 | ✅ | 同资产复制 2 次 → 1 条；导入清空后「复制过的话术会这里出现」 |
| W3 | Macro 新建 / 改名 / 删除 | ✅ | `macros` 逐步反查；删除走 `ConfirmInline`。**D1 修后复跑通过（2026-09-02 第三笔）**：`/review` 对抗审查指出首轮用的 05:08 二进制内嵌 chunk `BA-6NYDY` 与 `main` 产物不同（第二轮审查改过 `heldFocusRef` 运行时逻辑），遂按 `main`（`d2260f6`，代码同 `0f01261`）重建裸 release（chunk `BXzTJiZI`）重跑。**三个入口各一次全新打开**，点开后不做第二次点击直接键入，名称框均自带焦点环、首字符即落字：Macro「新增」（`rerun macro b` 经 Tab → 内容 → ⌘Enter 落库 1 行，`native=0` 与 O5 一致）/ 场景属性面板铅笔（`方案设计` 追加成 `方案设计z`）/ 子阶段「添加话术」（`y` 落字）。对齐话术 / 草稿两面与 Macro 同走 `PhraseFormEditor`，推定通过、未单独真机开。附带发现 O7 / O8（见下）。走查工具注意：macOS 首字母大写建议气泡会吃掉紧随键入之后的第一次 Esc；⌘Enter 在内容为空时由 `handleSave` 静默早退（`canSave` 为 false），不会保存也不提示 |
| W4 | 对齐话术新建 / 设为默认 / 改内容 | ✅ | `alignment_phrases.is_default` + `phases.default_alignment_phrase_id` 同步 |
| W5 | 话术新建 / 上移 / 改名 / 删除 | ✅ | `phrases.order_index` 0→1；删除后 3 条 `usage_records` 成孤儿（见观察 O3） |
| W6 | Scene 属性：改名 / 颜色 / 角色预设 / 前移 / 删非空 | ✅ | `scenes.color=#2f9e6e`、`role_presets` +1、`order_index` 1→0；删非空 → 琥珀 toast「该场景仍有子阶段或话术」 |
| W7 | 子阶段新建 / 改名 / 删除解绑 | ✅ | `sub_stages` 增删；删除后话术 `sub_stage_id` 置空；编辑器下拉第二路径改分组同样落库（ADR-022 双路径） |
| W8 | 待审 badge 仅 N>0 / 草稿 tab 最左 | ✅ | 首启「3 条待审」；归档后 3→2 |
| W9 | 草稿编辑水合 / 归档落地 / 丢弃撤销 | ✅ | `payload_json.name` 更新；归档 → `alignment_phrases` +1、草稿 `discarded`；丢弃 → 撤销 → `pending` |
| W10 | composition 草稿归档 / 编辑禁用、丢弃可用 | ✅ | 截图 R08a |
| W11 | 跨 Scene 移动 → 撤销 | ✅ | `scene_id/sub_stage_id/order_index`：调研/∅/2 → 方案/生成/3 → 撤销回 调研/∅/2；usage 不变 |
| W12 | 整理态整卡点击 = 展开 / 驻留 / 不计 usage；连续整理；显式复制计 usage 不隐藏 | ✅ | usage 5→5→6，窗口始终在屏 |
| W13 | 窄 Header 下 ModeToggle | ⛔ 不可达 | 主形态窗口恒等于显示器宽（`fit_to_active_monitor`），无法缩窄 |
| W14 | 长话术展开不溢出 | ✅ | 275 字正文在列内换行五行，未出卡 / 列（R12b） |
| W15 | 撤销 toast 存活 6 s | ✅ | 逐秒截图：+5.4 s 在、+6.4 s 消失；`toastStore` `action: 6000` |
| W16 | 主题三态 + 重启保留 + 跟随系统 | ✅ | 首启深色 canvas `14,14,16`；浅色 `242,242,240`；跟随系统 + OS 翻转 → `6,6,7`；重启后浅色仍在；localStorage `themeMode` |
| W17 | 强调色接管 brand，语义层不变 | ✅ | logo / Macro 芯片：绿 `50,97,77` / 蓝 `62,90,140` / 中性 `89,82,140`；Scene 图标恒 `19,48,36` |
| W18 | `⌘,` / × / Esc / 密度 | ✅ **通过（第六笔复跑）**；首轮 ⚠️ 部分 | `⌘,` 与 × 通过；密度紧凑 Macro 磁贴 111→87 px（56→44 逻辑）通过；首轮 **Esc 连仪表盘一起隐藏 → 缺陷 D2**。**D2 修后 Esc 段复跑通过（第六笔，按 `main` `e932955` 重建裸 release，chunk `I1hrJmog`，隔离 `HOME`）**：单击 Esc → 弹窗关、窗口 onscreen=true；「更改」进录键态 → Esc 只退出录键（弹窗仍开，显示 ⌥ Space / 更改）→ 再 Esc 关弹窗；长按 Esc 1 s（每 33 ms 一次带 autorepeat 标志的 keydown）→ 弹窗关、仪表盘仍在屏；对照：弹窗关闭时同样长按，第一下即隐藏窗口。`settings.global_hotkey` 保持 `Alt+Space` |
| W19 | slim Header / 暗 band / 2 列 | ✅（omar 目视） | R00 首启截图 |
| W20 | 复制失败可见 | ⛔ 不可达 | 剪贴板写失败无法在本机构造 |
| W21 | 启动 DB 失败阻断对话框 | ✅ **通过（第四笔复跑）**；首轮 ❌ 为取证误判 | 4 KB 随机字节当库。首轮记「无任何对话框」，实为对话框由系统进程 `UserNotificationCenter` 持有（rfd 无 parent 时走 `CFUserNotificationDisplayAlert`），窗口定向截图拍不到；按 owner 查 CGWindowList + 全屏截图证实含路径对话框在屏。真缺陷在退出路径（D3 改判）。修后按 `main` 重建裸 release 复跑：对话框在屏 → 点 OK → 进程退出 `exit=1` 无 panic；健康库对照正常建库、⌘Q `exit=0`、WAL 折回 0 字节 |
| W22 | 更新检查 manual 分级 | ⚠️ 部分 | 总开关关时点击零反应（零触网）；开后「已是最新版本」+ StatusBar 入口；失败路径需断网未构造 |
| W23 | 空态 / 未分组列头 / light 明度 / primitives 观感 | ✅（omar 目视） | R07b / R16c / R24i；新建空场景只有「新增子阶段」入口（观察 O4） |
| W24 | 导出 / 导入（原生对话框） | ✅ | `⌘⇧G` 驱动面板；导出 **8 张资产表**（`modifiers` / `macros` / `scenes` / `sub_stages` / `phrases` / `phases` / `alignment_phrases` / `compositions`，见 `repo-core/src/export.rs:30`）+ `schema_version` / `exported_at` 两个顶层字段，无 `usage_records`；SQL 篡改后导入回滚、`settings` 保留、`refreshAll` |

**缺陷（三条，全部首次发现）**：

| # | 现象 | 根因（已读代码） | 级别 |
|---|---|---|---|
| D1 | 四个锚定编辑面（Macro / 对齐话术 / 话术 / 草稿）打开后名称框**没有焦点**，键入落空；必须再点一次 | `AnchoredEditor` 在 `useAnchoredPosition` 给出坐标前把面板设为 `visibility: hidden`，而 `PhraseFormEditor` 的挂载 effect在此之前调 `focus()`，对不可见元素静默失败。jsdom `popover` shim 不模拟可见性，故 373 条测试全绿。dev / release 均复现，与 StrictMode 无关。**已修（2026-09-02 第二笔）**：`AnchoredEditor` 新增 `initialFocus` prop，首焦点改在 `position` 首次非空的 layout effect 里触发；shim 补 focus 拒绝规则后 6 条既有用例先红后绿，+7 回归用例；**W3 复跑通过（同日第三笔，按 `main` 重建的裸 release）：Macro 新增 / 场景属性 / 添加话术三入口真机各验一次，对齐话术 / 草稿同走 `PhraseFormEditor` 推定；本缺陷闭合**。Codex 提出的「WebKit 同 commit 样式刷新时序」疑虑随之证伪，不加 rAF 重试。派生观察 O7 | P1 |
| D2 | 设置弹窗开着按 Esc，弹窗与仪表盘**一起**隐藏 | 首轮记「同在 window 冒泡阶段、未 `stopPropagation`」，**修时纠正**：App 的隐藏监听挂 `document` 冒泡，弹窗 Esc 挂 `window` 冒泡——事件先到 document 再到 window，App 先隐藏，弹窗那边再 stop 也来不及。与 ADR-025 编辑器「Esc 不冒泡」契约不一致（product-spec 区域 9 写「关闭：Esc」指关弹窗）。**已修（第五笔）**：弹窗 Esc 改挂 `document` 捕获阶段并 `stopPropagation`，与 `primitives/Editor.tsx` 同约定；HotkeyRecorder 录键时的 window 捕获仍先于它，录键中 Esc 只取消录键。jsdom 回归 +4（App / SettingsModal 各二，keydown 派发到持焦点的 dialog；`/review` 后补录键态集成测试与长按 Esc `e.repeat` 回归，后者顺带给 App 隐藏监听加守卫——第一下关弹窗后 OS 自动重复的 keydown 此前会漏到隐藏监听）。**W18 Esc 段发布形态复跑通过（第六笔，三步 + 对照），本缺陷闭合** | P2 |
| D3 | ~~数据库损坏时没有阻断式错误对话框~~ → **改判（第四笔）**：对话框一直会弹，点 OK 后进程 panic、退出码 **101** 而非契约的 1 | 首轮根因「非主线程 NSAlert 不呈现」不成立——tauri-plugin-dialog 本就 `run_on_main_thread`，无 parent 的消息框由 rfd 交给系统进程渲染。真根因是结构性的：失败在 `setup()` 里、事件循环已在跑时被发现，旧实现靠「返回 `Ok(())` 保活 + 内存库顶替 `AppState` + 工作线程 `blocking_show` + `handle.exit(1)`」与半建成的应用共存，而 `RunEvent::Exit` 处理器假定 setup 已完成，`global_shortcut().unregister_all()` 撞上未注册的插件 panic。**已修（第四笔）**：失败分支直接调 `rfd::MessageDialog` 同步弹框（macOS 出进程渲染，阻塞主线程不死锁）后 `std::process::exit(1)`，永不回事件循环；保活的 `return Ok(())` / 内存库 / `window.show()` / 工作线程四件机器全删（`lib.rs` 净删 **16** 行：+39 / −55，`788b372`），`rfd` 升直接依赖（lock 已有同版本同 feature）。W21 复跑通过，**本缺陷闭合**。用户可感知影响为零，级别按事实降 P2 | ~~P1~~ P2 |

**观察（不构成缺陷，供裁决）**：O1 窗口隐藏期间 MCP 写入的草稿，唤起**不刷新** badge，只有导入后 `refreshAll` 才刷新（HANDOFF 第 21 项附带疑问的答案）；O2 焦点不在编辑器内时按 Esc 会隐藏整个仪表盘而编辑器状态保留在 React 里，下次唤起编辑器仍开着——D1 让这种情况更常见；**O3 → 已闭合（2026-09-03，[[028-reversible-delete]] P0）** 原现象：硬删话术后 `usage_records` 成孤儿，最近使用区仍显示「（未知话术）」墓碑条目（与 prd §6.1 soft-delete 悬案同源，归 HANDOFF 21.2）。**修法**：`list_recent_usage` 的四个 LEFT JOIN 各补 `deleted_at IS NULL`，并在 `WHERE` 里滤掉**带 `target_id` 却解析不到**的行；`usage_records` 本身一行不动，资产恢复后历史自动重连（id 从未变过）。**过滤位置在 SQL 的 `LIMIT` 之上**——放到渲染层会让墓碑先占满名额、再被前端抹掉，用户拿到一份莫名其妙变短的列表。**范围窄于子决策 5 的措辞**：composition 的使用记录**根本不带 `target_id`**，永远解析不出名字，但不在过滤范围内——滤掉它们是产品行为变更而非 O3 修复，这条既有缺口 ADR-028 记为「同批可修」而**本次未修**。**守它的是哪条**：Rust 侧是 `repo-core` 的 `list_recent_usage_drops_a_trashed_asset_and_brings_it_back_on_restore`（软删后该行消失、恢复后带着历史回来）；jsdom 侧只有 `MacroGrid` 的删除用例断言删除后确实重拉了一次最近使用区（`syncRecentUsage` 本身与 `useUndoableDelete` 都**没有专属测试**，这是已知的覆盖薄处）；**真机已复跑（2026-09-03，G5 项 7，§4.4）**——复制一条 Macro 让最近区出现 1 条，删掉它后最近区归 0 且**不出「（未知话术）」**，同时 `usage_records` 那一行仍在表里，恢复得回来。⚠️ 措辞要准：**墓碑字面量并未删除**（`RecentList.tsx:83` 还在），只是「有 `target_id` 却解析不到」的行不再可达；`target_id IS NULL` 的 composition 用量仍会命中它，即上文那处未修的既有缺口；O4 新建的空场景只有「新增子阶段」入口，没有「添加话术」；O5 UI 新建的 Macro `native=0`，种子 Macro `native=1`，`native` 语义待 prd 明确；O6 面板宽度随角色 chip 增加而变化、设置弹窗随页面高度重新居中——对人无害，对自动化点击是坑；**O7（第三笔新增，确定性）→ 已裁决并修复（2026-09-03）** 现象：Macro 编辑器开着时再点「新增」，编辑器不关、焦点却已在面板外——之后键入全部丢失，按 Esc 走 O2 藏掉整个仪表盘（截图 S3 / S3b / R1a）。这正是 D1 留下的肌肉记忆（以为没打开再点一次）会触发的路径；首轮 05:08 构建上同操作后焦点留在名称框（截图 05），两构建差异原因未查。**根因（修时纠正）**：`AnchoredEditor` 的 pointerdown 处理把锚点直接放行，旧注释称「锚点即 toggle」——**四个宿主没有一个实现 toggle**：Macro「新增」重复设同一个编辑目标（同 React key，面板不重挂）、草稿卡「编辑」重开，对齐话术 chip 与 Scene 话术卡的锚点点击是**复制**（调用态还会隐藏窗口）。放行后实际生效的只有 mousedown 的默认动作——把焦点带到 `tabIndex={-1}` 的按钮上。**修法（结构修法，omar 2026-09-03 确认；否决「二次按下 = 关闭」）**：容器接管锚点二次按下——`preventDefault()` 压掉兼容 mousedown（焦点不离开面板）+ 武装既有 `swallowClickRef`（宿主 click 不再跑，不重开也不复制）+ 仅在面板已失焦时回到 `initialFocus`；**不调 `onDismiss`**，Esc / teardown 焦点归还 / 点外三条分支未动。`src/components/primitives/Editor.tsx` 单文件改动，四个宿主零改动；契约回流 [[03-product-spec]] v0.24 §13.3 规则表第六行 + [[05-design-spec]] §10.2.2 接口契约第 6 条。**jsdom 回归 +5**（409→414，见 §2），撤回修法后 4 条变红。**覆盖边界**：jsdom 不实现 mousedown 的默认聚焦动作，「`preventDefault` 挡住焦点外移」这半边只能真机证。**发布形态复跑通过（2026-09-03，按 `main` + 本改动 `pnpm tauri build --no-bundle` 重建裸 release，内嵌 chunk `BTngK09y` 与 `dist/assets/` 一致，隔离 `HOME=/tmp/ph-o7-home`）**：点「新增」→ 名称框有焦点 → **再点「新增」→ 编辑器仍开、焦点仍在名称框** → 键入 `o7z` 落进名称框（同时弹 O8 的首字母大写气泡）→ 第一次 Esc 只关气泡（O8 既知）→ 第二次 Esc 关编辑器、窗口仍在屏（`onscreen=true`）；`macros` 仍 4 条、`usage_records` 0。chip / 话术卡 / 草稿三宿主同走该 primitive，推定通过、未单独真机开（与 W3 推定同口径）。截图 `/tmp/ph-walk/shots/O7r-*`；**O8（第三笔新增，OS 行为）** 名称框键入后 macOS 弹首字母大写建议气泡，此时第一次 Esc 只关气泡不关编辑器（截图 S1 → S2）；真人也会碰到，非缺陷但走查与用户认知都要算上。另（O7 修复未覆盖，`o7-probe` 2026-09-03 探查已答）：用「取消」关编辑器后焦点落到 body，随后的可打印键被路由进搜索框并切到搜索结果视图（截图 S5）。① 焦点落 body 是**既有缺陷**（HANDOFF 第 34 项）：macOS WebKit 点 `<button>` 不聚焦按钮而是沿祖先链找可鼠标聚焦节点，popover 不改祖先链，焦点落到宿主 `<section tabIndex={0}>` 或 body，`heldFocusRef` 被 `focusin` 记成 false，卸载时的归还门禁跳过；jsdom 无 mousedown 聚焦、现有归还测试只走 Esc 路径，故看不见。② **不存在 type-to-search**：`setQuery` 只有输入框 `onChange` 一个调用点，搜索框只在 ⌘K 与「唤起时 `activeElement` 是 body」两条路径拿焦点（product-spec §13.4「唤起即已默认聚焦」）——截图 S5 是「取消留下 body 焦点 → 隐藏再唤起 → 搜索框按契约接管」，非缺陷。

**取证方法教训（续 §4.2 三条）**：

4. **发布形态才是 `verified` 的对象**：裸 `cargo build --release` 不跑 `beforeBuildCommand`，内嵌的是陈旧或缺失的 `dist`（表现为空窗口）——必须经 `pnpm tauri build --no-bundle`（「走 devUrl」的说法未经证实，勿据此推理）；`tauri://localhost` 源的 localStorage 与 dev 不同源，天然给出「首装」观感（本轮据此验到默认深色）
5. **调用态整卡点击 = 复制 + 隐藏**：唤起后悬停簇尚未出现就点卡片，会误复制并写 usage（本轮误写 3 条）。稳妥序列：唤起 → 空白处点一下取焦 → 悬停 → 截图确认簇位置 → 再点
6. **像素工具先对已知区域自检方向**：自研 `px` 的 y 轴一度上下颠倒，靠「已知 toast 区域读出 canvas 色」发现；列扫描测高（56→44）比目视可靠
7. **状态栏「今日复制」按本机时区计日**：本机为 UTC−7，昨夜 23:59 的复制在「今日」不计，不是 bug
8. **窗口定向截图看不见其他进程持有的窗口**：D3「无任何对话框」的误判源自 §4.2 铁律「禁止全屏截图、只按窗口 ID 定向」——系统级对话框（rfd 无 parent → `CFUserNotificationDisplayAlert`）属于 `UserNotificationCenter`，不在本应用的窗口列表里。走查系统对话框时改按 owner 查 CGWindowList（`kCGWindowOwnerName`），并允许破例全屏截图；「没出现」先问探针能不能看见这类对象（§4.1 教训 2 的第三次现身，应升格为走查前固定自检项）
9. **合成键盘事件没有 OS 自动重复**（第六笔）：`CGEventPost` 的 keyDown 按住 1 s 只落一个字符——自动重复由物理键盘的 HID 层生成，合成事件拿不到。验长按路径要自己按 OS 口径补事件：每 33 ms 发一次 `kCGKeyboardEventAutorepeat=1` 的 keyDown 再 keyUp，WebKit 侧即为 `e.repeat=true`；先在搜索框长按可打印键自检（落一个字符 = 无重复，落一串 = 有效）。另：终端 `nohup` 起的裸 release 被快捷键唤起后未必是前台应用，键盘事件会落到终端（本轮两次 `⌘,` 打到了 iTerm2），发键前用 System Events 把进程置前

---

### 4.4 G5 走查记录（v0.9 新增 · 2026-09-03 · [[028-reversible-delete]] 首个真机门）

**这一门验的是什么**：ADR-028 把删除从「不可逆 + 六处确认框」改成「一键 + 撤销 + 废纸篓」，P0（`77637cd`）与 P1（`6aca7eb`）落地时**只有 jsdom 与 Rust 覆盖**（前端 457 / Rust 183 / 第七道 gate 12 条 / `soft_delete_e2e.rs` 7 条），用户可见的那一半从未在发布形态上跑过。G5 一次走完**删除全链路**：迁移 → 一键删除 → 撤销 toast → 撤销恢复 → 废纸篓列表 → 单条恢复 → 最近区无墓碑 → 清空确认与硬删。**零缺陷、零代码改动**。

**环境**（照 §4.2 / §4.3 教训 4 的既有口径，不另立新法）：`pnpm tauri build --no-bundle` 在 `ec2867b`、工作树干净时重建裸 release；`strings` 核内嵌 chunk `index-B2I7FDCC.js` 与 `dist/assets/` 一致；隔离 `HOME=/tmp/ph-g5-home`；已装的 `/Applications/prompt-hub.app` 走查前退出、走查后重开（组合键独占）；**真实资产库全程未被触碰**。截图 `/tmp/ph-walk/shots/G5-*`，每步以 `sqlite3` 反查隔离库为主证据。

| # | 门项 | 结果 | 证据 |
|---|---|---|---|
| G5-1 | 全新库首启跑 `0013` 迁移 | ✅ | 隔离 `HOME` 首启后 `pragma user_version` = **13**；`PRAGMA table_info(macros)` 含 `deleted_at` |
| G5-2 | 一键删除，无确认框 | ✅ | 整理态悬停 Macro 卡出**三图标簇** → 点垃圾桶 → **没有 `ConfirmInline` 这一步**，当场删除；`macros` 该行**仍在表里**、`deleted_at` 打上时间戳（不是行消失）；卡片计数 `4 张` → `3 张`；窗口留在屏上 |
| G5-3 | 撤销 toast | ✅ | 文案「已删除「借力最优解」」+「撤销」按钮，出现在**右上**而非底部 |
| G5-4 | 撤销真的恢复 | ✅ | 再删一次 → 点「撤销」→ `deleted_at` 翻回 **NULL**，卡片回到列表 |
| G5-5 | 废纸篓视图 | ✅ | `⌘,` → 数据页：「废纸篓」「1 项」+ 说明行 + 一行「Macro · 借力最优解 · 1分钟前 · 恢复」+「清空废纸篓」按钮 |
| G5-6 | 从废纸篓单条恢复 | ✅ | 点「恢复」→ 计数 `1 项` → `0 项`，转空态「废纸篓是空的」；SQL 反查 `deleted_at` 为 NULL |
| G5-7 | **G4 观察 O3 在真机闭合** | ✅ | `⌘K` + Enter 复制一条 Macro → 写入一条 `usage_records`、最近区出现「Macro 先出方案我拍板 刚刚」、计数 1 → 删掉该 Macro → 最近区计数归 **0** 且**不出「（未知话术）」墓碑**，而 `usage_records` 那一行**仍在表里**（恢复得回来，历史不丢） |
| G5-8 | 清空要确认，确认后才真删 | ✅ | 点「清空废纸篓」→ 行内确认「彻底删除废纸篓中的 1 项，删除后无法恢复」+ ✓ / ✕；**armed 期间 `macros` 仍是 4 行**（确认框是纯本地 state，不碰库）；确认后 `macros` → **3**（真硬删）、`usage_records` → **0**（孤儿清掉）、`pragma foreign_key_check` **返回空**，面板回执「已彻底删除 1 项资产与 1 条使用记录」 |

**不在本门覆盖内的一项（据实记，不算通过）**：**祖先复活路径**——恢复一条话术时连带复活它挂靠的、也在废纸篓里的场景与子阶段（[[028-reversible-delete]] 的第 5 处实装分歧，也是 P1 自己堵上的那个洞）——**未在真机跑**。判断依据：该路径是 `repo-write/src/trash.rs` 单个事务里的纯 SQL（`unchecked_transaction()` → `revive_trashed_ancestors` 全 `UPDATE` → `commit()`），**不经过 WebKit**，而真机门存在的理由正是抓 jsdom 看不见的那类失效（可见性、层叠、焦点、OS 事件）。它由 `repo-write/tests/soft_delete_e2e.rs` 的 `restoring_a_phrase_revives_the_scene_and_sub_stage_it_hangs_from` 覆盖，且该用例经变异验证。**代价说清楚**：自动化能证「行回到了可见集合」，证不了「用户确实又在仪表盘上看见它了」——这半边仍是空白，补法是下一次走查加一步，不是改测试。

**归档反查（[[CLAUDE#§5.1.2]]）：5 处不一致，全部按代码改正后才写入本节**——① 撤销 toast 原记「渲染在 header 里」，**DOM 上不成立**：`<Toast />` 是 `Dashboard.tsx` 根节点末尾与 `StatusBar` / `SettingsModal` 平级的兄弟，`position: fixed` + `top: 24px / right: 32px`（`Toast.module.css`），视觉上**盖在** header 带上而不属于它——「右上、非底部」为真，「在 header 里」为假 ② 三图标簇原记为「整理模式下才有」，实为 `MacroGrid.tsx` 的 `ActionCluster` **无条件渲染**，`interactionMode` 在该组件只决定排序（调用态按 `usageCount`、整理态按 `order_index`）；本轮选整理态是**走查纪律**（教训 10），不是界面条件 ③ 废纸篓说明行漏了一个空格：JSX 跨行文本节点会把换行折叠成一个 U+0020，实际渲染是「…也不会出现在仪表盘或搜索中。<空格>恢复后它回到原来的位置，使用历史一并回来。」 ④ 清空确认的 ✓ / ✕ 只记了字形，实际两枚按钮另有 `aria-label`「确认清空」/「取消」，容器为 `role="alertdialog"` ⑤ 清空成功**除**面板状态行外**还发一条 toast**「已清空废纸篓」，原记漏了。另有两条不改结论但影响措辞的提醒已就地写入：O3 行注明**墓碑字面量并未删除**、只是不再可达；G5-7 那条使用记录的 `source` 落的是 `macro_area` 而非 `search`（`SearchOverlay.tsx` 的 `TODO(ADR-011)` 未落地，与本门无关）。**无法核**的是全部真机观测——`sqlite3` 输出、截图、计数、剪贴板、构建产物身份，代码里没有对应物。

**取证方法教训（续 §4.3，编号接 9）**：

10. ⚠️ **合成点击对「悬停才出现的控件」太快**：一次自带 `mouseMoved` 紧接 `mouseDown` 的合成点击，React 还没渲染出动作簇，点击就落到了**下面那张裸卡片**上——在调用态这等于一次复制 + 一次隐藏窗口，不是本来要点的删除。可靠序列是**移动 → 等约 1 秒 → 截图确认簇已出现 → 再单独发一次点击**。另外，**卡级交互一律在整理态做**：那里误点卡片本体既不复制也不隐藏窗口，而调用态会（§4.3 教训 5 是同一根源的另一面——那条讲「别误触发复制」，这条讲「悬停控件要等它出现」）
11. **本机坐标换算：物理像素 ÷ 2 = 逻辑点**（@2x），本轮以点中「整理」切换按钮实测确认，不靠推算。另一条省事的定位经验：**撤销 toast（那块压在 header 带上的浮层）里「撤销」按钮距屏幕右边缘的偏移是固定的**，与资产名长短无关——toast 右对齐（`right: var(--s-8)`），名字变长只会把左边缘推出去，按钮不动

### 4.5 G6 走查记录（v0.11 新增 · 2026-09-04 · [[HANDOFF]] 第 21.3 项可靠性底座）

**这一门验的是什么**：启动自检、自动备份、落盘日志三件事的失败形态**在界面上一模一样**——快照没落盘、日志没写、自检没跑，用户看到的窗口没有任何区别。Rust 单测证得了「函数被调用且返回对了」，证不了「那份文件真的躺在那儿」。所以本门的主证据不是截图，是**隔离 `HOME` 下的 `~/Library/Logs/dev.prompt-hub/prompt-hub.log` 与 `backups/` 目录列表**。

**环境**（照 §4.3 教训 4 的既有口径）：`pnpm tauri build --no-bundle` 在当前工作树重建裸 release，内嵌 chunk `index-6Y1huvpK.js` 与 `dist/assets/` 一致；隔离 `HOME=/tmp/ph-g6-home`；真实资产库全程未触碰。

> ⚠️ **本门与前几门有一处不同：不需要退出正式版**。`/Applications/prompt-hub.app`（0.2.0，PID 51541）全程在跑并持有 ⌥Space——G6 五项没有一项需要唤起窗口，全部靠进程启停与文件系统取证。前几门那条「须先退出正式版」的前置在这里不适用。

**证据**：`/tmp/ph-walk/shots/G6-run-1.log` / `G6-run-2.log` / `G6-run-3.log`（脚本全程输出）+ `G6-5-dialog.png`。

| # | 门项 | 结果 | 证据 |
|---|---|---|---|
| G6-1 | 空库首启：日志落盘 + 迁移前后两类快照 | ✅ | 日志文件 **1618 B**，含 13 条 `migration N (name) applied`、一条 `prompt-hub 0.2.0 started: db=… user_version=13 quick_check=ok`、一条 `backup written: …/daily-1788589364.db`；`backups/` 两份——`pre-migrate-1788589364.db`（**4096 B**，迁移前拍的空库）与 `daily-1788589364.db`（**208896 B**，迁移后的完整库）。两者体积差本身就是「快照拍在迁移之前」的证据 |
| G6-2 | 同日再启不重复拍 | ✅ | 日志只多一条 `started`，**无 `backup` 行**；`backups/` 文件数与内容均不变 |
| G6-3 | 拨老 25h + 改过数据 → 重拍 | ✅ | 把 daily 快照 mtime 拨老 25h 并改一条 `macros.name` 后启动：日志 `backup written: …/daily-1788589667.db`，`backups/` 出现第二份 daily |
| G6-4 | 拨老 25h + 未改数据 → 复用并刷 mtime | ✅ | 日志 `backup unchanged, kept …/daily-1788589364.db (daily)`，文件数不变；**被保留文件的 mtime 刷成当次时刻**——verifier 抓出的 D1 修复在真机可见（不刷则每日排期永远结不清，每小时白跑一次 `VACUUM INTO`）|
| G6-5 | 库损坏 → 阻断弹框 + 退出码 1 + 不动备份 | ✅ | `PRAGMA wal_checkpoint(TRUNCATE)` 后向 `macros` 根页（**page 19**）写 800 字节随机数据；`sqlite3` 自身 `quick_check` 报 **4 条 cell offset 越界**。启动 → 原生弹框「prompt-hub failed to start」，正文含**库路径 + 四行 quick_check 错误 + `backups/` 路径 + 四步恢复指引**（另存坏库 / 换最近快照 / 删 `-wal` 与 `-shm` / 重启）；按 Return 后进程退出码 **1**；日志两条 ERROR（`quick_check failed: …` 与 `startup aborted: …`，含同样全文）；**`backups/` 未被触碰** |

**不在本门覆盖内的四项（据实记，不算通过）**：

1. ~~**`pre-import` 快照路径本门未走**~~ → **2026-09-06 第 51 项补验时闭合**：两次真导入各先落一份 `pre-import-*.db`（245760 B），见 §4.6 补验第 3 条
2. **1 MiB 日志滚动是否真保留一份旧文件未跑**——本门日志最大才 1618 B，离滚动阈值三个数量级
3. **后台每小时线程跨长会话未观测**——本门靠拨 mtime 模拟时间流逝，进程都是启了就退；「一个开着不动的应用会不会在第 61 分钟自己拍一份」没验
4. **设置弹窗忙碌守卫只有 jsdom**——它是 §3.16 第四行，本门未覆盖；jsdom 里「导入真的在跑」只是个替身（`dataBusy` 由测试直接置位）

**取证方法教训（续 §4.4，编号接 12）**：

12. ⚠️ **首轮 G6-5 两次没检出，不是自检没生效，是损坏没造成**。两个原因叠在一起：① **进程被 SIGTERM 结束不跑退出 checkpoint**，WAL 里留着那些页的干净副本，而读页时 WAL 优先——主文件里刚写进去的垃圾被整个盖住，`quick_check` 照样报 `ok` ② **page 2 是无关页**，写坏了也不参与 b-tree 校验。造损坏的正确做法是**先 `PRAGMA wal_checkpoint(TRUNCATE)` 把 WAL 清空，再打某张表的根页**。这条与 §4.3 教训「走查记录里的根因，修之前再读一遍代码」是同一类错误：**看到「没报错」就写成「功能没生效」，而真相是输入根本没送到**。判一项「验不过」之前先证明**被测条件确实成立**

### 4.6 G7 走查记录（v0.12 第二笔 · 2026-09-05 · [[029-alignment-coordinates-and-drift-ledger]] 三期）

**这一门验的是什么**：这一批的四类风险 jsdom 一类都碰不到——**真实形状的库**（工作树上跑的全是 tempfile 空库，真实库里 `usage_records` 有历史行要保全）、**9 格相位带的像素**、**`⌘9` 走 OS 快捷键分发**、**三个原生 `select` 弹窗与「点外关闭」规则的冲突**（jsdom 的 `<select>` 根本不弹原生菜单，而那正是最可能出事的地方）。本门的主证据是**每步用 `sqlite3` 反查隔离库**，截图只作辅证。

**环境**：`pnpm tauri build --no-bundle` 重建裸 release，`strings` 核内嵌 chunk `index-Da-E5vjQ.js` 与 `dist/assets/` 一致（修复后重建为 `index-B2tPyOB8.js`）；隔离 `HOME=/tmp/ph-g7-home`；库是**真实库 v13 的快照副本**（取自 `backups/manual-pre-install-1788595906.db`：38 条 `usage_records` / 3 种 `source` / 13 条话术 / 8 相位）。正式版 `/Applications/prompt-hub.app` 走查前退出、走查后重开；**真实库全程未触碰**（走查后复核：仍 `user_version` 13、40 行、默认未变）。截图 `/tmp/ph-walk/shots/G7-*`。

> ⚠️ **这是本门第一条教训，也是它差点白跑的原因**：先用裸 `cargo build --release` 出的二进制在真机上 **webview 全白、⌘ 键无反应**，换空 `HOME` 同样全白——那条路径不会把 `dist` 正确嵌进去。G5 / G6 的口径本来就是 `pnpm tauri build --no-bundle`，偏离它的代价是**看起来像功能坏了，其实是壳没装对**。

| # | 门项 | 结果 | 证据 |
|---|---|---|---|
| G7-1 | 真实形状库 13→14 迁移 + `pre-migrate` 快照 + `usage_records` 全行保留 | ✅ | 日志 `migration 14 (0014_alignment_coordinates) applied` + `user_version=14 quick_check=ok`；`backups/` 落 `pre-migrate-1788656707.db`（**225280 B**）与 `daily-1788656707.db`。整表重建后 `usage_records` **38 行一行不少**、3 种 `source` 原样、新列 `session_started_at` 全 NULL（历史行本就没有会话）；三个索引重建；`foreign_key_check` 为空。seed 落位：`phases` 9 行（`phase-live｜中途｜8｜ap-live-stop`）/ `alignment_phrases` 25 条（cue 6 + opening 19）/ `alignment_axis_values` 16 条 |
| G7-2 | 相位带 9 格紧凑档可读、字号字重不变 | ✅ **（补验）** | 首跑只在默认密度档验（截图 `G7-2-phasebar`）。**2026-09-06 补验**：设置 · 外观里当前档为「紧凑」，直接截相位带（`G7-2-compact-bar`），再切「舒适」截一张对照（`G7-2-comfort-bar`），切回紧凑再截（`G7-2-compact-again-bar`）——两档 9 格等宽、字号字重相同、「9 中途 ⌘9」在紧凑档可读，紧凑档只收行高不改字号，与设置页文案「字号不变」一致 |
| G7-3 | `⌘9` = 切中途 + 剪贴板「停」+ 记 `live_cue` 带会话戳 | ✅ | 剪贴板得「停」；`usage_records` 新行 `live_cue｜ap-live-stop｜phase-live`，`session_started_at` 与同一次唤起里 `⌘1` 那行**同值** `2026-09-06T01:14:36`——会话边界在真机上成立。相位带切到中途、chip 行出六条口令、「停」高亮为默认。**窗口驻留是整理态的契约行为**，不是漏隐藏 |
| G7-4 | 带坐标话术复制 = 前缀 + 换行 + 正文 | ✅ | 经 UI 给「默认 · 发散」选层=路径 / 域=技术 / 模式=收敛并保存，点 chip 复制，剪贴板**逐字节**为 `'本轮在路径层，只谈技术闭环，收敛模式。\n我们做发散,铺开可能性,先不下结论。'`；chip 上以灰色次级文字同行显示「路径 · 技术 · 收敛」，无坐标的 chip 外观不变。**`content_revised_at` 保存后仍 NULL**——只改坐标不打戳，与契约一致。⚠️ `⌘1-9` / 搜索 / 最近区三条复制路径**未单独真机走**（四入口同一个 helper，由 jsdom 覆盖）|
| G7-5 | 三个选择器与原生 select 弹窗不触发外点关闭、面板变高后 footer 可达 | ✅ | 三个选择器默认「不限」；原生 `select` 弹窗在 popover top layer 内打开、选中后**编辑面仍开着**、外点关闭规则未被触发（二轮复跑确认）；「管理…」展开后面板变高变宽，footer 的取消 / 保存仍可达 |
| G7-6 | 轴取值删除 `ConfirmInline` 报 `refCount`（含 0）与废纸篓追加句 | ✅ **（修后）** | 首轮**不通过**——见下方 **D-G7-1**。`4a68fa9` 修复并重建后复验：同一会话内把「默认 · 发散」的模式改为「发散」保存，再开模式的「管理…」，「发散」行确认框报「**1 条**话术的『模式』坐标将被清空，删除后无法恢复」；「路径」行报 1 条。**全程只按 ✕ 取消，未真删** |
| G7-7 | wake 事件在快捷键与 Dock 重开两条路径都写会话戳 | ✅ **（补验）** | 快捷键（⌥Space）路径**通过**，证据同 G7-3。**Dock / Reopen 路径于同日 19:59–20:01 PDT 在 `/Applications` 正式版（第 47 项装机，`a2763aa` 出包，真实库 13→14）上补验通过**：⌥Space 唤起后 `⌘1` 记 `phase_bar｜phase-diverge`，`session_started_at` = `03:01:32.63Z`（S1）；调用态复制后窗口自动隐藏（`wid` `onscreen=false`）；`osascript 'tell application "prompt-hub" to reopen'` 触发 `RunEvent::Reopen`，窗口回到屏上且应用成为前台（`System Events` 报 frontmost = prompt-hub，无需外力激活）；再 `⌘1` 记 `session_started_at` = `03:01:39.54Z`（S2）。**S2 ≠ S1、两者均非空**，安装前的历史行仍为 NULL。截图 `G7-7-dock-a-hotkey-wake` / `G7-7-dock-b-after-reopen` |
| G7-8 | 状态栏「中途口令 N 次」N=0 不渲染、明细内容 | ✅ | N=0 时状态栏**无该格**；两次「停」后显示「中途口令 2 次」；点开「中途口令明细」——按开场话术表为空、按轴合计全 0、「未归入任何一轴：2 次」「未归到任何开场话术：0 次」「中途口令合计：2 次」。再做 `⌘1`（锚点）→ `⌘9` → 点「换层：路径层」chip 后，明细显示「默认 · 发散」行 层=1 / 合计 1，按轴合计 层 1，「未归入任何一轴 3」，合计 4，与 `usage_records` **逐行对得上**。⚠️ **空态文案未真机触发**——隔离库在有口令记录之前，那一格按契约根本不渲染，也就点不开。这不是漏验，是**契约把这条路堵死了** |

**缺陷 D-G7-1（已修 `4a68fa9`）· 确认框把在用的轴取值报成「0 条」**

首轮「管理…」→ 删「路径」，确认框报「**0 条**话术的『层』坐标将被清空」——而那个值**刚刚**被「默认 · 发散」引用过（G7-4 那一步保存的）。根因不在 SQL：`refCount` / `trashedRefCount` 是**每次查询现算**的，而 store 里那份轴取值列表是**启动时拉的**，此后保存的坐标它一无所知。修法两处——`AxisValueManager` 挂载时 `refreshAlignmentAxisValues()`，以及话术 create / update **带 coordinates 成功后**也重拉一次。回归用例 +1（Vitest 531 → **532**）。

> **这个缺陷的形状值得记**：数据层是对的（后端现算的数就是 1），UI 也是对的（它忠实显示了手上那份数），错的是**两者之间那份副本的年龄**。所有既有 jsdom 用例都绿——因为它们各自只走一步，没有任何一条把「保存坐标」和「打开管理面」串成一次会话。**真机门抓到它，靠的正是它必须连着做完一串动作。**而它报错的方向是最坏的那个：**把有代价的删除说成没代价的**。

**一处未复现的孤例（原因未明，据实记）**：首轮点选「路径」那一刻，选择器没变，且状态栏的会话计数被清零——**像是发生了一次 wake**。二轮同步骤复跑正常，三个选择器与两次「管理…」全部正常，未再出现。**未定位，不算缺陷也不算通过**，记在这里等它下次出现。

**首跑「不在本门覆盖内」的四项已全部补验**（⑦ 于 2026-09-05 第 47 项装机后；其余三项于 2026-09-06 00:34–00:44 PDT 第 51 项，环境：隔离 `HOME=/tmp/ph-51-home`、库 = 真实库 **v14** 的 `VACUUM INTO` 快照、二进制 = `/Applications/prompt-hub.app` 正式版（`a2763aa`）直接以 `HOME` 覆盖启动，正式版走查前退出、走查后重开，**真实库全程未触碰**——复核仍 43 行 `usage_records`、「默认 · 发散」无戳、16 轴取值；截图 `/tmp/ph-walk/shots/G7-51-*` 与 `G7-2-*-bar`）：

1. **紧凑档相位带**（G7-2）→ ✅，见上表
2. **`content` 真变时打 `content_revised_at` 戳** → ✅（打戳半边）。整理态 hover「默认 · 发散」→ 铅笔 → 正文框全选后改为「我们做发散，铺开可能性，先不下结论。（第51项真机改正文）」→ 保存：`content_revised_at` = `2026-09-06T07:36:07.849419+00:00`，`kind` / 坐标未动；再只改名保存，戳**不动**（反面复核）。**但 `notes` 仍 NULL**——编辑器没有「修订说明」输入框，`updateAlignmentPhrase` 的 `notes` 参数没人传。ADR-029 子决策 5 写「修订 = 编辑 `content` + 写 `notes`」，prd §6.6 写「v0.15 起有写入方」，写入方是 Rust 函数而非任何 UI；product-spec 从未画过这个框。**这不是本门能验的东西，是图纸缺一笔**，记 [[HANDOFF]] 第 53 项待裁
3. **导出 1.3 真机往返** → ✅ 三步：① 设置 · 数据 → 「导出备份…」→ 原生保存面板存 `export-1.3.json`（37198 B）：`schema_version` **1.3**、顶层 `alignment_axis_values` **16** 条、`alignment_phrases` 25 条且「默认 · 发散」行带 `contentRevisedAt`（驼峰键）/ `kind` / 三坐标；② 用该文件造一份 **1.2 旧备份**（删 `alignment_axis_values` 键、`schema_version` 改 `"1.2"`、改一个话术名作导入标记）→ 「导入备份…」→ 原生确认框 OK → `pre-import-1788680519.db` 先落盘 → 话术名变成标记值（整库替换确实发生）、`usage_records` 43 → 0（prd §6.9 D2 写明的设计）、**`alignment_axis_values` 16 行逐行 md5 与导入前快照相同**（键缺失不清空，[[06-prd]] §6.9 规则 ②）；③ 再导回 `export-1.3.json` → `pre-import-1788680634.db` 落盘、话术名与修订戳复原、轴取值 16 行 md5 与 bundle 相同、`foreign_key_check` 空

**取证方法教训（续 §4.5，编号接 13）**：

13. ⚠️ **裸 release 必须用 `pnpm tauri build --no-bundle`，`cargo build --release` 的产物在真机上白屏**。后者不会把 `dist` 正确嵌进去，表现是 webview 全白、⌘ 键无反应，换空 `HOME` 也一样。这与 §4.5 教训 12 同源：**看起来像功能坏了，先证明被测对象是对的那个**
14. ⚠️ **窗口隐藏之后 `screencapture -l` 仍能截到陈旧画面，而 `-R` 抓到的是屏幕上层的别的应用**。所以每次发合成按键之前，先按 `wid` 核 `onscreen=true`——否则那串按键会**打进用户的前台应用**，而截图还会给你一张看起来合理的旧图
15. ⚠️ **原生 `select` 弹窗的纵向位置随当前选中项对齐而移动**，点某个选项必须按 `wid` 报出的弹窗几何现算，固定坐标一定点错
16. ⚠️ **`tell application "prompt-hub"` 唤起的是 `/Applications` 里的正式版，不是你手上那个裸二进制**。G7-7 就是这么废掉的——脚本「成功」了，但它操作的是另一个进程、另一个库
17. ⚠️ **`onscreen=true` 不等于键盘能打进 webview**。第 47 项补验 G7-7 时，正式版由后台 shell `open -a` 拉起后首次 ⌥Space 唤起，窗口在屏上但前台应用仍是 Chrome，`⌘1` / Esc 全打进了 Chrome（⌘1 = 切标签页，无后果）；用 `System Events` 把 prompt-hub 提到前台后按键仍无效，**先在窗口空白处点一下夺焦点**才生效。每次发按键前除核 `onscreen` 外还要核 `frontmost`，并在唤起后先点一下窗口。真人用手点不会遇到这条，它只是取证路径的坑
18. ⚠️ **原生保存 / 打开面板不认 `HOME` 覆盖，默认指向真实用户的桌面**。隔离 HOME 只骗得过应用自己的库与日志，`NSSavePanel` 的起始目录仍是真桌面——不带全路径直接按 Save 就会把走查产物写进用户的真实目录。做法：先在文件名框全选输入文件名，再 ⌘⇧G 输入隔离目录回车，截图核面板路径栏后再点 Save
19. **导入后 `usage_records` 归零不是缺陷**：导出不含使用记录（prd §6.9 D2），整库替换即还原到备份时的资产状态。反查计数前先读这一条，别把 43 → 0 报成丢数据

---

---

## §5 性能基准（regression test）

| 指标 | 约束 | 测试方法 | 现状 📊（2026-06 口径） | 失败处理 |
|---|---|---|---|---|
| 主形态唤起 P95 | ⚠️ ≤200ms（[[02-constitution#C1]] 死线） | `pnpm bench:hotkey-wake`：`--features bench` Rust auto-cycle 测 `show()+set_focus()`，默认 20 轮（`BENCH_ROUNDS=N` 可调） | P95 ≈ 13–15ms（2026-06-05 主线程修复后口径；2026-06-12 签名后复测 12.9–13.5ms 无回归；不含 OS shortcut dispatch ~10ms） | **P95 > 200ms 时退出码 1**（2026-07-01 P0-6）——可直接作 CI/本地自动化 C1 gate |
| 冷启动 | 🎯 ≤1.5s（非 C1 约束项） | `pnpm bench:cold-start`：subprocess spawn → 首次 CGWindow entry（Swift probe） | debug build P95 ≈ 258ms / p50 ≈ 175ms（2026-06-12） | warning（非 block） |
| 任意点击响应 P95 | 🎯 ≤100ms | 待 E2E 层落地后接 timing | 未测 | 🎯 block PR |
| 数据写入延迟 | 🎯 ≤50ms | UsageRecord 单条写入 | 未单测 | warning |
| 搜索延迟（300 条 Phrase） | 🎯 ≤100ms | tinybench | 未单测 | warning |

**触发**：任何主形态启动路径改动必须附 benchmark 结果（[[CLAUDE#§4.4]]）。📊 **最近一次复测 2026-08-20：p95 `14.226ms`**（ADR-025 P1-b 合入后在 `main` 上跑），与 2026-06-12 签名后基线 12.9–13.5ms 同档，无回归——锚定浮层不在唤起路径上，符合预期。

> ⚠️ **v0.12 起这个数字过期了，且过期得有理由**：[[029-alignment-coordinates-and-drift-ledger]] P0（`0329520`）在唤起路径上加了一次 `emit_wake`——`lib.rs` 的 `wake_on_main_thread` 在 `show()` 之后向 webview 发一个带 RFC 3339 时间戳的 `wake` 事件。这是自 2026-06-12 签名基线以来**第一次真的动了 C1 约束的那条路径**（此前每一轮「未复跑」的理由都是「没碰唤起路径」，这一轮不成立）。bench 脚本已随同一支 commit 改为走 `wake_on_main_thread` 本身而不是它自己的一份拷贝，**emit 因此计入秒表内**（旧脚本会把它整个漏在计时之外）。**已于同日复跑：p95 `14.139ms`**（2026-09-05，verifier 在隔离 `HOME` 下实测，emit 已计入秒表内）——与 2026-08-20 的 `14.226ms` 同档，**加了一次 `emit_wake` 没有把唤起推离 C1 预算**，离 200ms 死线仍有一个数量级。这一项就此结清，不再是待办。

---

## §6 LLM Eval 集（N/A 说明）

> **本节明确声明 N/A 并说明理由**：方法论 §5.10 要求 test-spec 含 LLM Eval 集，但本项目 [[02-constitution#D1]] 禁用 LLM SDK，工具内部无 LLM 调用——无 LLM 行为可 eval。
>
> **替代方案**：
> - prompt-hub 的"输出"是用户复制到外部 AI 的话术。话术本身的有效性 eval 不在本工具范围（属于用户工作流，应在 Obsidian / 用户笔记内做）
> - 如果未来违反 D1 引入 LLM SDK（须先开 ADR），本节立即升级为完整 LLM Eval 集规范
>
> **方法论盲区**：§5.10 应增加「LLM-free 项目 N/A 子句」，详见 [[~/Vault/.../产品文档体系方法论-实战盲区]]

---

## §7 测试基础设施

### 7.1 CI 流水线（📊 已落地：`.github/workflows/ci.yml`，2026-07-01 P2-1）

双 job，触发 `push` main + 全部 PR，`macos-14` runner（项目仅 macOS，依赖 macos-private-api），第三方 action 全 pin commit SHA，`permissions: contents: read`，concurrency 同 ref 互斥：

- **frontend job**：`pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm exec prettier --check .` → `pnpm test` → `pnpm build`
- **rust job**：`cargo fmt --check` → `cargo clippy --workspace --all-targets -- -D warnings` → `cargo test --workspace`（Swatinem/rust-cache + stub `dist/index.html` 供 tauri codegen）

🎯 尚未接入 CI 的项：coverage 上报（阈值见 features §5）、bench 对比 main baseline（`bench:hotkey-wake` 已具备退出码语义，接入即用，见 §5）。v0.1 规划的 e2e job 随 Playwright 层一并 pending；doc-governance gate（§3.4）已随 `pnpm test` 进入 CI frontend job。

### 7.2 本地 pre-commit / pre-push

🎯 未落地 hooks；现行约定为提交前手动跑 `pnpm test` + `pnpm lint` + `pnpm build`（[[CLAUDE#§2]] 构建预检），CI 兜底。

### 7.3 测试数据策略

- 前端：`src/test/setup.ts` 统一 setup，jsdom 环境；IPC 一律 mock `invoke`（其真实性由 §3.3 契约 gate 补位）
- **jsdom `popover` shim**（v0.3 新增 · [[025-unified-anchored-editing]]）：jsdom 29.1.1 不支持原生 `popover`，`setup.ts` 约 20 行 shim 暴露 `showPopover` / `hidePopover` / `togglePopover` 与 `:popover-open`。⚠️ **shim 验不了真实 top layer**——它换来的是渲染 / 提交 / 焦点 / 回调这些**与 top layer 无关**的断言可跑；层叠、`overflow` 逃逸、`transform` 包含块、定位跟随四类**只能靠 §4.1 真机门**。当初的取舍依据是「用测试环境的 shim 去换掉一项平台能力，方向反了」
- Rust 集成：每个测试独立 tempfile SQLite，跑全量 migration 后注入 fixture
- 🎯 E2E 固定 seed 数据集（`tests/fixtures/seed.json`）随 Playwright 层落地

---

## §8 不测的项（明确范围）

- ❌ 第三方依赖本身（Tauri / React / dnd-kit 等不在 prompt-hub 测试范围）
- ❌ 视觉回归截图 diff（视觉一致性由 token-gate（§3.1）卡在源码层 + 真机 screencapture 人验承接）
- ❌ A11y 自动化（暂手工检查：focus 顺序 / role=alert 等已在组件测试内点状断言，系统性 a11y 扫描未启用）
- ❌ **布局与视觉权重**（jsdom 无布局引擎：`offsetParent` 恒 null、无实际盒模型）——由 §4.1 真机门 + token-gate 源码层双向承接。⚠️ **但「jsdom 验不了」常被过度援引**：订阅逻辑、规则表分支、焦点契约都能验且**应当**验。判某项不可验时，先拆开问「**哪一半**不可验」——ADR-025 项 2 曾整项判为「物理不可验」，拆开后订阅逻辑那一半立刻补出 5 条测试，且逐条反向验证（把 hook 分别改坏三种方式，各自只被对应一条测出）
- ❌ 多端同步一致性（[[02-constitution#A3]] 单人单机，无多端实时同步）
