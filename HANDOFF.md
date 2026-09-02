# Handoff — 2026-09-01/02 文档对账日 + 人审批次 + G4 真机走查

<!-- Rewritten 2026-09-01. 长期风险与操作常识已迁 docs/learnings.md 附录 B；本文件只留本轮与指针 -->

## Objective

执行 2026-09-01 全面评价的建议 1（**文档对账日**：把文档账追平代码账，合成一个人审批次）与建议 2（**HANDOFF 瘦身**：长期 Risks 迁入 learnings，本文件只留本轮与指针）。**不含功能改动，不含新决策；需裁决处只点名。**

## Completed

- **features v1.17 → v1.18**：§4 合计 **88 → 91**（补三行：Phrase 编辑 v1.4 / 分层化 v1.9 / 固定空间布局 v1.12，其中第三行正是旧账第 2 项；S1 模块数 5→6；显式计数规则改为从 §3 逐行重数）；S1 行 `planned`→`in-progress`；ADR-017 行 4/5→5/5，§3.9 真机验收 `planned`→`done`；§3.6 唤起 P95 失效数字 10.49→13.708ms；**§7 整节重写**为当前基线并首次点名 §1 `verified` 铁律缺口
- **四份 `status: pre-code` 转出**（内容未动）：prd v0.13 / ops-spec v0.3 / user-flows v0.1 → `draft`；01-spec v0.7 → `active`（人主笔无人审环节；AI 执行，omar 同日人审批次 ② 确认）
- **learnings v0.4 → v0.5**：HANDOFF 二十余条 `(carried)` 风险收编——判断类并入信条三 / 四 / 七证据段（不新增信条），操作类收成附录 B（B.1 真机走查 / B.2 发布与更新 / B.3 本地环境）
- **MANIFEST v1.15 → v1.16** 三行（features / prd / learnings）+ CLAUDE.md §7 指针（features v1.18 / MANIFEST v1.16 / ADR-017 Phase 6 销账）；CHANGELOG 新增 2026-09-01 条目
- 全面评价本身：五维评级 + 实测基线 + 七项风险，正文在会话中，未落盘为文档
- **G4 真机走查（2026-09-02，omar 确认方案后执行）**：发布形态（`pnpm tauri build --no-bundle` 裸 release + 隔离 `HOME` + MCP 造草稿）覆盖 features §7 缺口清单，24 门项 21 通过 / 3 不可达 / 1 未通过；features v1.20 32 行升 `verified`（69 / 7 / 1 / 14），test-spec v0.6 §4.3 走查记录（draft 待人审）；**三个真实缺陷 D1–D3 转第 23–25 项**；第 21 项附带疑问已答。环境已复原（正式版重新拉起、WebKit 偏好复原、OS 外观复原）。**本段改动未 commit**
- **人审批次 ① 已裁（2026-09-01 第二段，omar 拍板「改规则，然后逐个标」）**：features v1.19——§1 `verified` 判据改为「真机门 / 持续自动化 gate 留证 + 进过 publish release + 自用 ≥1 周」，失效引用 [[01-spec#10.5]] 改指 test-spec §4.1；37 行升 `verified`、39 行缺留证保持 `done`，§7 新增留证索引 + 缺口清单。涟漪 MANIFEST v1.17 / CLAUDE.md §7 / CHANGELOG 第二段。对账 commit `c417c36` 已提交。**批次 ②–⑧ 同日续完**：test-spec v0.5 / prd v0.13 ratified；ops-spec / user-flows 保持 draft 并挂重写条件（21.3 / 22）；product-spec v0.23 / design-spec v0.20 补 ADR-024 与 reshape 旧账回流后 ratified，`--t-18` / `--h-modifier-tray` 自 tokens.css 删除（398 / lint / prettier / build 全绿）；features v1.19 矩阵认可；ADR-027 全文 + ADR-023/024 措辞 + 图标 + ADR-021 scene.color 四件追认。MANIFEST v1.17 纠正 ops-spec / user-flows 两处 ratified 误标。**批次 ②–⑧ 改动未 commit**

## In Progress

**无。所有改动在工作区未 commit**（omar 未要求 commit）。`.codex/` / `AGENTS.md` / `dsh-plugin-ziwuliuzhu/` 仍未跟踪，归 omar，不要 stage。

## Next Actions

> 编号沿用旧账便于对照；本轮销 2 项（旧 2、旧 3 部分）、改 1 项（旧 7）、新增 3 项（19、20、21）。

1. **ADR-025 P2 键盘动作层** —— omar 2026-08-20 明示「先记录着，暂时不需要做」。3.1 去掉动作簇 `data-nav-item`（`src/components/AlignmentPhrases.tsx` / `src/components/scene/ViewPhraseCard.tsx` / `src/components/MacroGrid.tsx`）；3.2 键位表挂 `src/hooks/useRegionNav.ts`；3.3 动作簇改选中态跟随，顺带解 `ScenePanel.module.css` hover 遮挡标题。ADR §6 要求先在对齐话术一个区域跑通再铺开，验收门 G2（5 项）。已议免重复讨论：动作键不做可自定义；键盘布局差异用 `e.code`。落地时须兑现 product-spec §13.3「P2 目标」：`⌘Enter` 保存并推进到下一条（`PhraseFormEditor.tsx` 现只保存并关闭）(carried from 2026-08-20)
2. ~~补 ADR-026 的 features 回写缺口~~ → **本轮已销**（v1.18 §4 补行 + 合计重数）
3. ~~契约回流旧账~~ → **2026-09-01 人审批次 ⑤⑥ 已销**：product-spec v0.23 补话术卡 title-only + 密度档 + ADR-024 默认深色；design-spec v0.20 补 ADR-024 全套（§2.4.6 / §2.5 / §2.1 / §8.1 / §9 + v0.15 补账）；`--t-18` / `--h-modifier-tray` 已自 `tokens.css` 删除。**仍余**：⚠️ `docs/MANIFEST.md` 除人审批次触及的行外其余仍停在 2026-07-06 口径 (carried from 2026-07-21)
4. **memory 层待 omar 点头**：新增 feedback「AI 主笔对外文档必须逐句反查代码」（与 `feedback_walkthrough_coverage` / `feedback_gate_executability` 同族）。本轮又添一例：features 矩阵挂着 learnings 早已判失效的 10.49ms 三个月 (carried from 2026-08-05)
5. 发布收尾（非阻塞）：`latest.json` 最低版本字段（`release.yml` sign job `jq -n` 处）；落盘日志 tauri-plugin-log 立项；`release-signing` 环境 secret 作用域整理 (carried from 2026-08-05)
6. `a24c7c0` / `4b722c1` / `716bd4c` 三 commit 补 verifier 对抗审查 (carried from 2026-07-07)
7. **omar 人审批次（本轮重组为一个批次，建议按此顺序过）**：~~① features §7 `verified` 铁律二选一~~ → **已裁（修订判据 + 逐行标，见 Completed）**；~~② 01-spec status `active` 确认~~ → **已确认**；~~③ test-spec v0.2→v0.5~~ → **已定稿 ratified**；~~④ prd / ops-spec / user-flows~~ → **prd ratified；ops-spec 保持 draft 归 21.3；user-flows 保持 draft 归第 22 项**；~~⑤ product-spec~~ → **v0.23 ratified**；~~⑥ design-spec~~ → **v0.20 ratified**；~~⑦ features~~ → **v1.19 矩阵认可**；~~⑧ ADR-027 全文 + ADR-023/024 措辞 + 图标定稿追认 + ADR-021/`scene.color`~~ → **四件全部追认 / 复核通过**。**第 7 项八步全部销账（2026-09-01）** (carried from 2026-07-06, closed 2026-09-01)
8. 可发现性裁决 ×3：场景删除入口外露 / 整理态保窗 vs 改 D-0 契约 / title-only 后卡面无内容线索 (carried from 2026-07-06)
9. 补 `src/components/__tests__/ScenePanelFocusRestore.test.tsx` 焦点恢复负路径测试（正路径已改走 `AnchoredEditor` teardown）(carried from 2026-07-21)
10. `.github/workflows/ci.yml` bench-c1 `continue-on-error` 处置复核——全面评价再次点名：C1 铁律目前在 CI 上不设防 (carried from 2026-07-12)
11. P0-2 Composition 链路 ADR（P0-5 系于此，`src/components/DraftInbox.tsx` `PROMOTE_BLOCKED_HINT`）(carried from 2026-07-06)
12. ops-spec §3 定时备份（`repo-core/src/backup.rs` 底座）/ P2 余 4 评估 / P1-5 Phase 可配置性 / `MacroGrid.module.css` 网格末行 auto-fit (carried from 2026-07-06)
13. **prd §6.1 soft-delete 矛盾**（承诺 soft-delete，实现硬删除；ADR-025 P2 可撤销删除系于此）。本轮只把 prd status 改 `draft`，矛盾本身未动 (carried from 2026-07-02)
14. `docs/design/CLAUDE-DESIGN.md` v0.2 重传 + v2 基调同步 (carried from 2026-07-02)
15. 评审遗留补 design-spec 上游：ipc-contract 扩扫 / `--color-danger` / `--scrim` 语义回流；`HotkeyRecorder.module.css` 报错色沿用「琥珀代替 danger」约定 (carried from 2026-07-02)
16. gstack 待升级 0.16.3 → 1.61.0 + 两项一次性配置提示 (carried from 2026-08-11)
17. 两份 ADR 超期未复核：`005-prompt-combiner-reuse.md`（Proposed）/ `011-search-usagesource.md`（Reserved），均 `Last reviewed: 2026-07-02`，今已 61 天 (carried from 2026-08-19)
18. （低优先）1 逻辑点浮层偏移：`useAnchoredPosition.ts` 翻转态首次放置与重算差 1pt，记为已知量 (carried from 2026-08-20)
19. **（新）找 2–3 个外部使用者装 v0.2.0 用一周**——全面评价「产品验证 C」的唯一解法；在此之前功能矩阵的 `done` 只代表「作者验过」，也直接决定第 7 项①怎么选
20. **（新）Developer ID 证书 2027-02-01 到期 + 第 17 项两份 ADR 复核**：加日历提醒，不再靠 health pulse 复报
21. **（新，2026-09-01 第一性原理分析，omar 认可、明示先不动手）主环五件事**，按此顺序，后一项的优先级判断依赖前一项：
    - 21.1 **主环度量**：给 `usage_records` 补唤起时间戳（migration `user_version` 12→13），算「唤起→复制」分布与空手关闭率。先出方案再改
    - 21.2 **全面 soft-delete + 撤销**：8 处 `DELETE FROM` 只有草稿软删。**先开 ADR 裁 prd §6.1 矛盾**（与第 13 项合并），也是第 1 项 ADR-025 P2 可撤销删除的前置
    - 21.3 **启动 `PRAGMA quick_check` + 每日 `VACUUM INTO` 备份（`backup.rs` 底座已有，接 ops-spec §3）+ 落盘日志（tauri-plugin-log，与第 5 项合并）**。不动数据契约、不需 ADR，一个会话可完成。**同批重写 ops-spec §3（备份触发改成实装事实）+ §7（发布流程改成 release.yml + 签名 runbook + ADR-017 口径，删 ADR-001 前措辞）后送审转 ratified**（2026-09-01 人审批次 ④ omar 裁决）
    - 21.4 **S2 最小闭环**：只做「复制过但未归类的内容提示保存」一件，验证「沉淀」假设再定其余三项
    - 21.5 **外部使用者**：即第 19 项，21.1–21.4 完成前所有优先级判断只有作者一个样本
22. **（新，2026-09-01 人审批次 ④）user-flows v0.1 重写**（共创文档，与 omar 同会话做）。反查 v0.2.0 实装，六处不符：§2 升级迁移写 major 弹窗 + 强制导出，实装只有 ADR-017 minor 自动更新；§3 导入写「成功导入 N 条」，实装为整库替换 + 确认弹窗（prd 决策 D1）；§4 删除写取消 / 弃用 / 永久删除三选项，实装为二次确认硬删（与 prd §6.1 同源，等 21.2 ADR 后一并改）；§5 快捷键冲突写弹窗三备选，实装为 `HotkeyBanner` + 设置改绑（ADR-027）；§6 首次使用写三屏引导页，实装无 onboarding、`0002_seed` 直接灌示范数据；§7/§8 iPad 只读 / localStorage 配额 / ADR-003 待议均已过时。**建议顺序：等 21.2 裁完再重写**，否则 §4 要改两次
    - 附带（G4 已核实）：MCP 在窗口隐藏期间写入的草稿，唤起时**不刷新** badge，导入后 `refreshAll` 才刷新——是否在 `show()` 后补一次 `count_pending` 待裁；SOP 占位区「第三阶段实现」在 0.2.0 生产界面常驻，是否该收起
23. **（新，G4 缺陷 D1 · P1）锚定编辑器打开后 autofocus 不生效**：`src/components/primitives/Editor.tsx` 在 `position` 未解出前 `visibility: hidden`，`PhraseFormEditor` 挂载 effect 的 `focus()` 静默失败，四个编辑面都要再点一次。修法方向：把首焦点挪到 `position` 首次解出之后（effect 依赖 `position !== null`），或先定位再显示；**测试要能抓到**——jsdom `popover` shim 不模拟可见性，须在 shim 层让 `visibility:hidden` 元素拒绝 `focus()`，否则修了也守不住。修复后重跑 G4 W3 一项即可闭合
24. **（新，G4 缺陷 D3 · P1）数据库损坏时阻断对话框从不出现**：`src-tauri/src/lib.rs` `fail_startup` 在 `std::thread::spawn` 里 `blocking_show()`，macOS 不呈现非主线程 NSAlert；裸二进制与发布 `.app` 均复现，进程静默存活、窗口隐藏。修法：`run_on_main_thread` 或在 `RunEvent::Ready` 后主线程弹；prd §7.7 承诺的「含路径 + exit(1)」两条都要复验（复验法：4 KB 随机字节当库，见 test-spec §4.3 W21）
25. **（新，G4 缺陷 D2 · P2）设置弹窗内 Esc 连仪表盘一起隐藏**：`SettingsModal` 的 Esc 监听补 `stopPropagation`（或与 AnchoredEditor 同走 document 捕获阶段）；product-spec 区域 9「关闭：Esc」语义是关弹窗不关仪表盘。同族观察：焦点不在编辑器内按 Esc 会隐藏仪表盘而编辑器状态留在 React 里，下次唤起仍开着
26. **（新，G4 观察）**：硬删话术后 `usage_records` 成孤儿、最近使用区留墓碑（并入 21.2 soft-delete ADR）；新建空场景无「添加话术」入口只能先建子阶段（product-spec 区域 4 待裁）；UI 新建 Macro `native=0` 而种子 `native=1`，`native` 语义待 prd §6.3 明确；features §7 余下 7 行 `done` 的补法已写在表下

## Dropped

- 无。本轮净销 3 项（旧 2 / 旧 3 / 旧 7 整项八步），新增第 22–26 项（22 为文档重写，23–25 为 G4 缺陷，26 为观察），新增 3 项（19、20、21），净计 **20 项**（含旧 2 已划线）。第 21 项是分析结论转账，omar 明示暂不动手。

## Risks & Decisions

> 长期风险、走查工具链坑、发布与本地环境陷阱已全部迁入 [[learnings]] 附录 B（B.1 真机走查 / B.2 发布与更新 / B.3 本地环境），判断类条目并入信条三 / 四 / 七。**本段今后只写本轮新产生的条目**；沿用的不再逐轮抄写。

- **对账不等于人审**（new 2026-09-01）：本轮把四份 frontmatter 从「说谎」改成「待审」，把 features 合计改成能对上 §3 的数——这些都是让文档停止陈述假事实，不是让它们变成 ratified。人审积压（第 7 项）不因本轮减少，只是合成了一个批次
- **历史 delta 累加会静默漂移**（new 2026-09-01）：features §4 合计从 2026-05 起靠每次 +N 维护，v1.9 / v1.12 各「+1」却没加表行，三个月后差 3。凡「合计」类数字，应从明细重数而不是累加，与信条四「手数会漏」同族
- **真机门验容器不验第一件事**（new 2026-09-02）：ADR-025 G1 六项 + P1-b 两项全过、还有逐像素证据，但没有一项问「打开后能直接打字吗」，autofocus 缺陷 D1 就这样带进了 v0.2.0。起草门项时加一问：**用户打开它之后的第一个动作，门里有吗**
- **dev 形态不是 `verified` 的对象**（new 2026-09-02）：此前 G1–G3 全跑在 dev 二进制 + vite 上；G4 改跑 `pnpm tauri build --no-bundle` 裸 release，立刻多验到默认深色首装观感、`tauri://localhost` 独立 localStorage 等 dev 上看不到的事实。操作细节已入 [[learnings]] B.1
- **AI 改人主笔文档的 status 是灰区**（new 2026-09-01）：01-spec 由 `pre-code` 改 `active` 是本轮唯一触碰 🧑 文档的动作。内容一字未动，但 status 是治理信号；已在 frontmatter 注释与第 7 项②留痕，omar 若不认可直接改回即可

## Verify

本轮实测（2026-09-01，`main` @ `9fc9fad`，改动前跑，本轮只动 Markdown 未再跑）：

- `pnpm test` → **398/398（39 文件）** ✅
- `cargo test --workspace --manifest-path src-tauri/Cargo.toml` → **168** ✅
- `pnpm lint` / `pnpm exec tsc --noEmit` / `pnpm build` / clippy / fmt → 全绿 ✅
- `node scripts/doc-governance/index.mjs --config doc-governance.config.mjs` → 改动后复跑 **0 error / 6 warn** ✅（6 warn 为既有失效引用，未新增）
- **G4 走查（2026-09-02）**：`pnpm tauri build --no-bundle` 成功；隔离库终态 macros 4 / phrases 6 / alignment 10 / drafts 4 / usage 0（导入清空）；截图 137 张在 `/tmp/ph-walk/shots`（易失）；工具 `/tmp/ph-walk/{wid,mouse,kb,px}`（易失，重建法见 learnings B.1）

**恢复工作前**：跑 `pnpm test` + doc-governance 确认基线。动代码须补 `pnpm lint` + `pnpm build` + `cargo test --workspace`；涉及主形态启动路径还须 `pnpm bench:hotkey-wake`（⚠️ 它会拿真实数据库跑，见 learnings B.3）。

## Modified Files

本轮 **未 commit**，工作区改动：

- `docs/design/07-features.md` — v1.18（§4 重表 + §6 追加 + §7 重写 + 三处行级修正）
- `docs/design/06-prd.md` / `10-ops-spec.md` / `04-user-flows.md` / `01-spec.md` — frontmatter status + last_modified
- `docs/learnings.md` — v0.5（信条三 / 四 / 七证据段 + 附录 B）
- `docs/MANIFEST.md` — v1.16（三行）
- `docs/design/CHANGELOG.md` — 2026-09-01 条目
- `CLAUDE.md` — §3 冷区 MANIFEST 指针 + §7 文档体系 / 自动更新两行
- `docs/design/11-test-spec.md` — v0.6（§4.1 G4 行 + §4.3 走查记录，draft 待人审）
- `HANDOFF.md` — 本文件重写
