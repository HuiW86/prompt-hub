# Handoff — 2026-09-01 文档对账日（全面评价建议 1 + 2）

<!-- Rewritten 2026-09-01. 长期风险与操作常识已迁 docs/learnings.md 附录 B；本文件只留本轮与指针 -->

## Objective

执行 2026-09-01 全面评价的建议 1（**文档对账日**：把文档账追平代码账，合成一个人审批次）与建议 2（**HANDOFF 瘦身**：长期 Risks 迁入 learnings，本文件只留本轮与指针）。**不含功能改动，不含新决策；需裁决处只点名。**

## Completed

- **features v1.17 → v1.18**：§4 合计 **88 → 91**（补三行：Phrase 编辑 v1.4 / 分层化 v1.9 / 固定空间布局 v1.12，其中第三行正是旧账第 2 项；S1 模块数 5→6；显式计数规则改为从 §3 逐行重数）；S1 行 `planned`→`in-progress`；ADR-017 行 4/5→5/5，§3.9 真机验收 `planned`→`done`；§3.6 唤起 P95 失效数字 10.49→13.708ms；**§7 整节重写**为当前基线并首次点名 §1 `verified` 铁律缺口
- **四份 `status: pre-code` 转出**（内容未动）：prd v0.13 / ops-spec v0.3 / user-flows v0.1 → `draft`；01-spec v0.7 → `active`（人主笔无人审环节；**此改动由 AI 执行，待 omar 确认**）
- **learnings v0.4 → v0.5**：HANDOFF 二十余条 `(carried)` 风险收编——判断类并入信条三 / 四 / 七证据段（不新增信条），操作类收成附录 B（B.1 真机走查 / B.2 发布与更新 / B.3 本地环境）
- **MANIFEST v1.15 → v1.16** 三行（features / prd / learnings）+ CLAUDE.md §7 指针（features v1.18 / MANIFEST v1.16 / ADR-017 Phase 6 销账）；CHANGELOG 新增 2026-09-01 条目
- 全面评价本身：五维评级 + 实测基线 + 七项风险，正文在会话中，未落盘为文档

## In Progress

**无。所有改动在工作区未 commit**（omar 未要求 commit）。`.codex/` / `AGENTS.md` / `dsh-plugin-ziwuliuzhu/` 仍未跟踪，归 omar，不要 stage。

## Next Actions

> 编号沿用旧账便于对照；本轮销 2 项（旧 2、旧 3 部分）、改 1 项（旧 7）、新增 3 项（19、20、21）。

1. **ADR-025 P2 键盘动作层** —— omar 2026-08-20 明示「先记录着，暂时不需要做」。3.1 去掉动作簇 `data-nav-item`（`src/components/AlignmentPhrases.tsx` / `src/components/scene/ViewPhraseCard.tsx` / `src/components/MacroGrid.tsx`）；3.2 键位表挂 `src/hooks/useRegionNav.ts`；3.3 动作簇改选中态跟随，顺带解 `ScenePanel.module.css` hover 遮挡标题。ADR §6 要求先在对齐话术一个区域跑通再铺开，验收门 G2（5 项）。已议免重复讨论：动作键不做可自定义；键盘布局差异用 `e.code`。落地时须兑现 product-spec §13.3「P2 目标」：`⌘Enter` 保存并推进到下一条（`PhraseFormEditor.tsx` 现只保存并关闭）(carried from 2026-08-20)
2. ~~补 ADR-026 的 features 回写缺口~~ → **本轮已销**（v1.18 §4 补行 + 合计重数）
3. **契约回流旧账（部分）**：仍欠 `03-product-spec.md` §4.0/§13.4 卡片解剖（title-only）+ 外观设置（density）；`05-design-spec.md` §2/§8/§9；§3c 两个 unbound token（`--t-18` / `--h-modifier-tray`，后者已无消费者属死 token）。⚠️ `docs/MANIFEST.md` **除本轮三行外**其余仍停在 2026-07-06 口径 (carried from 2026-07-21)
4. **memory 层待 omar 点头**：新增 feedback「AI 主笔对外文档必须逐句反查代码」（与 `feedback_walkthrough_coverage` / `feedback_gate_executability` 同族）。本轮又添一例：features 矩阵挂着 learnings 早已判失效的 10.49ms 三个月 (carried from 2026-08-05)
5. 发布收尾（非阻塞）：`latest.json` 最低版本字段（`release.yml` sign job `jq -n` 处）；落盘日志 tauri-plugin-log 立项；`release-signing` 环境 secret 作用域整理 (carried from 2026-08-05)
6. `a24c7c0` / `4b722c1` / `716bd4c` 三 commit 补 verifier 对抗审查 (carried from 2026-07-07)
7. **omar 人审批次（本轮重组为一个批次，建议按此顺序过）**：① **features §7 `verified` 铁律二选一**（逐批标 `verified` / 修订 §1 判据）② 01-spec status `active` 确认 ③ test-spec v0.2→v0.5（唯一从 ratified 降回 draft 的）④ prd v0.12→v0.13 + ops-spec v0.3 + user-flows v0.1（本轮转 `draft`）⑤ product-spec v0.10→v0.22 ⑥ design-spec v0.11→v0.19 ⑦ features v1.10→v1.18 ⑧ ADR-027 全文 + ADR-023/024 措辞 + 图标定稿追认 + 旧账 ADR-021/`scene.color` (carried from 2026-07-06, restructured 2026-09-01)
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
    - 21.3 **启动 `PRAGMA quick_check` + 每日 `VACUUM INTO` 备份（`backup.rs` 底座已有，接 ops-spec §3）+ 落盘日志（tauri-plugin-log，与第 5 项合并）**。不动数据契约、不需 ADR，一个会话可完成
    - 21.4 **S2 最小闭环**：只做「复制过但未归类的内容提示保存」一件，验证「沉淀」假设再定其余三项
    - 21.5 **外部使用者**：即第 19 项，21.1–21.4 完成前所有优先级判断只有作者一个样本
    - 附带待核实：MCP 在窗口隐藏期间写入的草稿，唤起时是否刷新（`refreshAll` 只见于挂载 / 手动重试 / 导入后）；SOP 占位区「第三阶段实现」在 0.2.0 生产界面常驻，是否该收起

## Dropped

- 无。本轮净销 1 项（旧 2），新增 3 项（19、20、21），净计 **20 项**（含旧 2 已划线）。第 21 项是分析结论转账，omar 明示暂不动手。

## Risks & Decisions

> 长期风险、走查工具链坑、发布与本地环境陷阱已全部迁入 [[learnings]] 附录 B（B.1 真机走查 / B.2 发布与更新 / B.3 本地环境），判断类条目并入信条三 / 四 / 七。**本段今后只写本轮新产生的条目**；沿用的不再逐轮抄写。

- **对账不等于人审**（new 2026-09-01）：本轮把四份 frontmatter 从「说谎」改成「待审」，把 features 合计改成能对上 §3 的数——这些都是让文档停止陈述假事实，不是让它们变成 ratified。人审积压（第 7 项）不因本轮减少，只是合成了一个批次
- **历史 delta 累加会静默漂移**（new 2026-09-01）：features §4 合计从 2026-05 起靠每次 +N 维护，v1.9 / v1.12 各「+1」却没加表行，三个月后差 3。凡「合计」类数字，应从明细重数而不是累加，与信条四「手数会漏」同族
- **AI 改人主笔文档的 status 是灰区**（new 2026-09-01）：01-spec 由 `pre-code` 改 `active` 是本轮唯一触碰 🧑 文档的动作。内容一字未动，但 status 是治理信号；已在 frontmatter 注释与第 7 项②留痕，omar 若不认可直接改回即可

## Verify

本轮实测（2026-09-01，`main` @ `9fc9fad`，改动前跑，本轮只动 Markdown 未再跑）：

- `pnpm test` → **398/398（39 文件）** ✅
- `cargo test --workspace --manifest-path src-tauri/Cargo.toml` → **168** ✅
- `pnpm lint` / `pnpm exec tsc --noEmit` / `pnpm build` / clippy / fmt → 全绿 ✅
- `node scripts/doc-governance/index.mjs --config doc-governance.config.mjs` → 改动后复跑 **0 error / 6 warn** ✅（6 warn 为既有失效引用，未新增）

**恢复工作前**：跑 `pnpm test` + doc-governance 确认基线。动代码须补 `pnpm lint` + `pnpm build` + `cargo test --workspace`；涉及主形态启动路径还须 `pnpm bench:hotkey-wake`（⚠️ 它会拿真实数据库跑，见 learnings B.3）。

## Modified Files

本轮 **未 commit**，工作区改动：

- `docs/design/07-features.md` — v1.18（§4 重表 + §6 追加 + §7 重写 + 三处行级修正）
- `docs/design/06-prd.md` / `10-ops-spec.md` / `04-user-flows.md` / `01-spec.md` — frontmatter status + last_modified
- `docs/learnings.md` — v0.5（信条三 / 四 / 七证据段 + 附录 B）
- `docs/MANIFEST.md` — v1.16（三行）
- `docs/design/CHANGELOG.md` — 2026-09-01 条目
- `CLAUDE.md` — §3 冷区 MANIFEST 指针 + §7 文档体系 / 自动更新两行
- `HANDOFF.md` — 本文件重写
