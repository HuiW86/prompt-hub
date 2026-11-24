# Handoff — AI 上下文重组（#38）

> 本文件只放**当下**：一个目标、≤ 5 条下一步、仍会影响下一次改动的风险。做完的写 `docs/design/CHANGELOG.md`，积压进 GitHub Issues，长期陷阱进 [[learnings]] 附录 B。`scripts/doc-governance/context-budget.test.ts` 强制体积与条数。

## Objective

让 AI 每次进项目读到的东西准确、够短、按层分开（#38）：CLAUDE.md 只留协议层，HANDOFF 只留任务层，流程改为按需加载的 skill，并用第 8 道闸门防止它们再长回去。

## Completed

- 开 #38；旧 Next Actions 42 条按原分类迁入 #39–#46，保留原编号（对照表见下）；frontmatter 编年史另开 #47
- `.claude/agents/verifier.md`：不再复述宪法条款，改为每次读现行宪法；原 B2 检查仍按 v1.1 的「Macro 区」判卷，会把合法的全景改动判成 FAIL
- `CLAUDE.md` v2.0：36 KB → 约 11.3 KB；§7 编年史移出（原文 `git show 91e87a4:CLAUDE.md`）；§1–§7 及被引用的 4.x / 5.x 子标题全部保留（旧 §3 热 / 温 / 冷三个子标题改为一张表，无引用指向它们）；新增闸门对照表；§3 改为如实说明「只有本文件自动注入」
- 新增 skill：`.claude/skills/doc-change`（原 §5 全文）/ `release` / `c1-bench`
- [[learnings]] v0.7：收编本文件旧 Risks 段的长期陷阱（新增 B.4 代码不变量），订正 B.3 bench 条目（原文与现行脚本相反）
- 第 8 道闸门 `context-budget`：CLAUDE.md ≤ 12 000 字节、无日期、无测试计数、引用标题不丢；HANDOFF ≤ 8 000 字节且 Next Actions ≤ 5
- 涟漪：[[11-test-spec]] v0.22（§3 登记第 8 道闸门，属图纸，待签）/ [[MANIFEST]] v1.25 / CHANGELOG

## In Progress

- PR 待 HuiW86 审，一句话的决定：**采纳 #38 的分层方案**（CLAUDE.md v2.0 + 第 8 道闸门 `context-budget`），推荐通过。v2.0 新写进三条约束，请一并过目：§4「改闸门或豁免清单需有依据」、§4.2「新增独立库表前先开 ADR」、§6 第 11 条「不往 CLAUDE.md 追加状态叙事」
- 审查已过两道：verifier 首轮 FAIL（7 处事实错误与闸门漏报）已全部修正；记录类按 [[CLAUDE#§5.1.2]] 只读反查，8 处不一致先改后归档，10 条无法核（运行结果、真机与本机观测、宿主注入行为），原文保留

## Next Actions

1. **签 #38 的 PR**：CLAUDE.md v2.0 与 test-spec v0.22 转 ratified，合并
2. **技能 Tab 真机走查**（#40 第 73 项）：`main` 上的技能 Tab（migration `0018`）和新图标还没发版，下一次发版前必须过这一门
3. **Developer ID 证书 2027-02-01 到期**（#43 第 20 项）：约 10 周后到期，先续证书，再发下一版
4. **CI 上 C1 不设防**（#43 第 10 / 56 项）：`bench-c1` 仍为 `continue-on-error`，swizzle 降级也不判失败
5. **设计文档 frontmatter 编年史**（#47）：同类问题，test-spec 的 `status` 一行就有 8 KB

## 发布状态

- **最新公开版 v0.2.5**（2026-11-15 发布，tag 指向 `8e7fcbd`，schema 17，含字号可调、悬停全文预览、设置分组行）。此前 CLAUDE.md 一直写「最新公开版 v0.2.4、PR #26 未发版」，本轮核对 GitHub Releases 后改正
- **`main` 上未发版**：技能 Tab（PR #35，schema 18）、新桌面图标（PR #37）
- 使用者本机已装哪一版：未核

## 积压去向（旧「HANDOFF 第 N 项」编号 → issue）

| issue | 分类 | 旧编号 |
|---|---|---|
| #39 | 全景（M-01）收尾 | 67 · 69 |
| #40 | 技能 Tab 收尾 | 73 · 74 · 75 |
| #41 | 待裁决 | 8 · 11 · 12 · 21 · 26 · 28 · 34 · 54 |
| #42 | 审查与验证欠账 | 6 · 40 · 45 · 46 · 55 · 61 · 71 |
| #43 | CI / 发布 | 5 · 10 · 20 · 56 · 57 |
| #44 | 文档 | 3 · 14 · 15 · 17 · 22 |
| #45 | 代码小账 | 9 · 18 · 29 · 38 · 39 · 44 · 49 · 50 · 52 |
| #46 | 暂缓 | 1 · 16 · 19 |

表里没有的编号都已结项：多数可在 `docs/design/CHANGELOG.md` 搜到「第 N 项」，第 2 / 13 / 72 项只在本文件历史里（`git log -p -- HANDOFF.md`）。今后新开的积压直接开 issue，不再编号。

## Risks & Decisions

- **旧编号引用只在本表可解**：文档里一百多处「[[HANDOFF]] 第 N 项」（带与不带 `[[ ]]` 合计约 150），靠上表找到去向。删这张表之前，先确认这些引用已经不再需要
- **提高闸门预算是允许的，但要有理由**：改 `context-budget.test.ts` 里的常量，并在提交说明里写清为什么现在的分层装不下；不要只是把数字调大
- **CLAUDE.md §7 版本表仍要手改**：bump 01 / 02 / 03 / 05 / 06 / 07 / 09 或 MANIFEST 的 `version`，同步改那一行（doc-governance 只核对这 8 份；04 / 08 / 10 / 11 不受核对）
- **01-spec §8.6 与宪法 v1.2 冲突（范围外，人主笔，AI 不改）**：§8.6 仍写「Macro 区不展示 AlignmentPhrase」，ADR-031 已在宪法里删掉这条证伪；CLAUDE §4.3 引 §8.6 时略去了这一条。需要 HuiW86 决定是否回流 spec
- 长期陷阱（真机取证、发版、本地环境、代码不变量）见 [[learnings]] 附录 B

## Verify

> 2026-11-23 云端 Linux 实测。

- `pnpm test`：53 个文件 / 666 条用例，全绿（本轮新增 `context-budget` 7 条；改前 52 / 659）。另有一次与 cargo 编译并发的运行挂了 1 条，未定位是哪条；之后单独重跑全绿。若再遇到，先查对时间敏感的用例
- `context-budget` 变异自检：中文 / 斜杠 / 月份日期、frontmatter 注释里的日期、测试计数、把 `5.1.2` 标题藏进代码块、Next Actions 第 6 条用 `6)` / `+` / ` *` 写，九种写法逐一注入均报红，还原后转绿（其中多数是 verifier 对初版闸门实测绕过的写法）
- `cargo test -p repo-core -p repo-write -p prompt-hub-mcp`：244 条全过。主 crate `prompt_hub_lib` 另有 10 条，Linux 上编不过所以没跑；workspace 合计 254。本轮没改 Rust
- `node scripts/doc-governance/index.mjs --config doc-governance.config.mjs`：0 error（24 条 warning 都是改前就有的）
- `pnpm lint`、`pnpm exec prettier --check .`：全绿
- 没改唤起路径，没跑 bench
