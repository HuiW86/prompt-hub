---
type: claude-md
project: prompt-hub
version: v1.1  # 2026-07-01 §7 状态指针除锈+补账（ADR-019/020 + P0/P2/P3 改进轮 + 真实版本号/测试数），§2 bench 补 CI gate 说明
created: 2026-05-19
status: ratified
author: co  # 🤝 人机共创（CLAUDE §5.2 本文档自身）
audience: [ai, human]
description: prompt-hub 项目级 AI 上下文——项目特有约束/三温区映射/忌讳清单。AI 进场始终注入
related:
  - 02-constitution
  - 01-spec
  - 09-tech-stack
---

# CLAUDE.md — prompt-hub 项目级 AI 上下文

> 本文件为 prompt-hub **项目级**约束。全局规则见 `~/.claude/CLAUDE.md`（中文沟通 / Conventional Commits / [P0] 设计原则等），本文件**只承载项目特有的**约束。
>
> 双向链接：[[02-constitution]] 是项目铁律，本文件是 AI 在 prompt-hub 工作的行为规范。

---

## §1 一句话定位

prompt-hub 是 **AI 编程手动挡阶段的桌面仪表盘**——主形态快捷键唤起全屏窗口，辅形态副屏常驻视图，承载提示词资产的展示/调用/沉淀，以及人机协议对齐。

完整定位见 [[01-spec#1.1]]。

---

## §2 关键命令

> 全栈技术决议完毕（[[09-tech-stack#§3]]）：Tauri 2.x + React 19.2 + pnpm 10.x + Vite 7.x + Vitest 4 + cargo test。M0 已建仓，所有命令可直接跑；`bench:*` 脚本已落地（2026-05-25，cold-start 走 subprocess + Swift CGWindow probe / hotkey-wake 走 `--features bench` Rust auto-cycle）。

```bash
# 包管理
pnpm install                                              # 安装依赖（lockfile 提交）
pnpm install --frozen-lockfile                            # CI 环境

# 开发与构建
pnpm tauri dev                                            # Dev server + Tauri shell（Vite HMR）
pnpm tauri build                                          # 生产构建（输出 .dmg / .msi / .app.tar.gz）

# 质量
pnpm test                                                 # Vitest 全量（前端单元 + 集成 + jsdom，单次）
pnpm test:watch                                           # Vitest watch mode
pnpm lint                                                 # ESLint 10 flat config
pnpm format                                               # Prettier 3.x
pnpm exec prettier --check .                              # Prettier 检查（不写盘）
cargo test --workspace --manifest-path src-tauri/Cargo.toml           # Rust 测试（含 tempfile SQLite fixture）—— --workspace 必须，否则只测 bin pkg（0 测试），真实用例在 repo-core/repo-write/prompt-hub-mcp
cargo fmt --manifest-path src-tauri/Cargo.toml                        # Rust 格式化（fmt 默认覆盖整个 workspace）
cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings  # Rust lint（--all-targets 覆盖 trybuild 等 test target）

# 性能 benchmark（[[02-constitution#C1]] 200ms 唤起自检）
pnpm bench:cold-start                                     # spawn → 首次 CGWindow entry P95（debug build baseline ~258ms / p50 ~175ms，2026-06-12 M0-4 签名后回归；C1 不约束此项）
pnpm bench:hotkey-wake                                    # show()+set_focus() Rust 调用 P95（baseline ~13-15ms，2026-06-05 auto-cycle 主线程修复后口径，2026-06-12 签名后复测 12.9-13.5ms 无回归；旧 ~0.02ms 为跑不通的失效数字；不含 OS shortcut dispatch ~10ms）。P95 超 200ms 时退出码 1（2026-07-01 P0-6），可作自动化 C1 gate
# BENCH_ROUNDS=N pnpm bench:cold-start                    # 自定义轮数（默认 20）
# ⚠️ 两个 bench 自 2026-09-04 起在一次性 HOME（mkdtemp）里跑空库，不再触碰真实资产库（此前 bench 会把真实库迁到工作树 schema，2026-09-04 就发生过一次）；cold-start 旧 baseline 取自真实库、之后取自空库，跨此日期的数字不可直接比较
```

**lockfile 政策**（[[004-choose-package-manager#6]]）：禁用 `npm install` / `yarn install` / `bun install` —— 它们会产生 lockfile 冲突。

---

## §3 项目三温区映射

通用三温区模型见全局 CLAUDE.md。本节是 prompt-hub 的具体映射：

### 热区（始终注入）
- `CLAUDE.md`（本文件） — AI 进场基线
- `docs/design/02-constitution.md` — 8 条铁律
- `docs/design/01-spec.md` — 项目定位与九条哲学
- `HANDOFF.md` — 跨会话断点

### 温区（按需取用，按 description 召回）
- `docs/design/06-prd.md` — 写后端 / 数据层时
- `docs/design/03-product-spec.md` — 写 UI 时
- `docs/design/05-design-spec.md` — 写 CSS / 视觉时
- `docs/design/CLAUDE-DESIGN.md` — 用 Claude Design (claude.ai/design) 设计 UI 时（L5 sticky context）
- `docs/workflows/claude-design-prompts.md` — 在 Claude Design 跑 task 时（L5 prompt 模板 + 迭代 checklist）
- `docs/plans/prompt-hub-mvp.md` — 实施任务清单
- `docs/design/09-tech-stack.md` v1.4 — 生成 import 语句时
- `docs/adr/*` — 决策追溯时

### 冷区（仅显式查询时取）
- `docs/MANIFEST.md` v1.23 — 项目全文件清单（六层架构总览，AI 进项目读完 CLAUDE.md 接读拿全貌）
- `~/Vault/知识库/方案模板/产品文档体系方法论.md` v1.3 — 文档体系治理时
- git history — 变更追溯

---

## §4 代码规范（项目特有）

> 通用规范（命名 / 注释英文 / Conventional Commits）见全局。本节只列 **prompt-hub 特有**的。

### 4.1 CSS 必须用 token
**任何组件 CSS / 内联样式禁止裸 px / 裸 hex / 裸 ms 值**——必须引用 `--fs-*` / `--space-*` / `--color-*` / `--duration-*` token。见 [[prompt-hub-mvp#§0-T1]]。

**失败案例**：旧 `#1D9E75` 字面量混入代码导致颜色不一致，2026-05-18 全量替换为 `var(--color-task-border)`。

### 4.2 数据模型严守三层
任何新增资产类型前，先确认能否归入 Modifier / Composition / Macro。**不允许引入第 4 层资产**（违反 [[02-constitution#B1]]）。

### 4.3 协议层与任务层分离
新增功能涉及 AlignmentPhrase / Phase / SOP / Macro 时，必须自检 [[02-constitution#B2]] 物理分离约束：
- AlignmentPhrase 不出现在 Composition 工作台
- SOP 不引用 AlignmentPhrase
- Macro 区不展示 AlignmentPhrase

### 4.4 性能预算
任何主形态相关代码必须保持唤起 ≤ 200ms P95（[[02-constitution#C1]]）。涉及主形态启动路径的改动需附 benchmark。

---

## §5 文档工作流（项目特有）

### 5.1 变更必须走方法论 §7 八步
任何 spec / prd / product-spec / design-spec 改动走 [[~/Vault/知识库/方案模板/产品文档体系方法论#§7]] 流程：锁定 diff → 影响半径 → 上游一致性 → bump → 涟漪更新 → features 回写 → ADR → AI 层同步。

#### 5.1.1 减法快车道（2026-08-18 omar 拍板）

**纯删除类 UI 改动不走八步**，只在 `docs/design/CHANGELOG.md` 记一行即可提交。

适用范围（**四类，封闭清单**）：

| 类别 | 例 |
|---|---|
| 删解释性文案 | 层标记 pill、区域副标题、无决策价值的计数 |
| 删装饰 | 重复图标、冗余色块、纯修饰性描边 |
| 删未实现占位 | 尚无实装的区域 stub |
| 删动效 | 触发 layout 的 transition、无信息量的位移动画 |

**边界（越界即回落八步）**：

- ❌ 删的东西**承载语义或状态**（区分层级 / 表达选中 / 传递计数含义）→ 不是减法，是契约变更
- ❌ 删 `tokens.css` 条目 → 属 [[05-design-spec]] §3c token 契约，走八步
- ❌ 删区域、删功能、删数据字段 → 走 ADR
- ❌ 一次删三处以上 → 已构成设计 pass，走八步

**为什么开这条**：八步对"新增"与"删除"施加同等仪式成本，使得修一个 UI 缺陷比新增一个 UI 区域更贵，理性选择就是继续新增——这正是前端"什么都有道理但主角不明"的成本结构成因（2026-08-17 前端评价复盘）。快车道只降**减法**的成本，不降加法的。

**留痕要求**：CHANGELOG 那一行必须写明删了什么 + 依据哪一类，否则半年后无法与"手滑删掉"区分。

#### 5.1.2 日志不签字（2026-09-03 omar 拍板）

**人审只签「图纸类」改动**——[[01-spec]] / [[02-constitution]] / [[03-product-spec]] / [[05-design-spec]] / [[06-prd]] 里回答「应该长什么样」的契约条款。

**「记录类」内容不进人审队列**——[[11-test-spec]] §2 计数与 §4.x 走查记录、[[07-features]] §7 留证、`docs/design/CHANGELOG.md`、[[HANDOFF]]。这类内容由 AI 逐句反查代码后**直接归档**（`status` 可直接写 `ratified`），omar 想抽查随时翻。

**一份文档两类并存时按章节分**：test-spec §1 / §3 / §5 是图纸（改测试分层、改 gate 契约、改性能预算走人审），§2 / §4.x 是日志。

**反查怎么做**：起**只读**子代理，对增量逐句出三列——一致 / 不一致（附 `file:line`）/ 无法核（真机观测、截图、退出码这类代码里没有对应物的）。不一致的**先改再归档**；无法核的条目保留原文并在归档说明里标明条数。

**送审图纸时只给「一句话的决定 + 推荐选项」**，不把 diff 落点逐条列成裁点——裁点数量应该等于决策数量，不等于改动数量。

**为什么开这条**：八步对「改图纸」和「记日志」收一样的签字费，于是每段工作都攒出一批待人审，人审成了瓶颈而不是防线。而记录类内容的真实风险根本不是「omar 没看」，是**AI 凭印象写错**——G4 的 D1 / D2 / D3 三个根因走查当天全写错，纠错靠的是回头读代码不是人签；本规则首跑就在 [[11-test-spec]] 的增量里抓出 8 处不一致。**签字签不出正确性，反查才行。**比喻：房主签图纸，不签施工日志。

### 5.2 文档主笔人分工
- 🧑 人主笔：`docs/design/01-spec.md` / `docs/design/02-constitution.md`
- 🤝 共创：`CLAUDE.md` / `docs/adr/*` / `docs/design/04-user-flows.md` / `docs/design/03-product-spec.md` / `docs/design/05-design-spec.md` / `docs/plans/prompt-hub-mvp.md`
- 🤖 AI 主笔（人审）：`docs/design/06-prd.md` / `docs/design/11-test-spec.md` / `docs/design/10-ops-spec.md` / `docs/design/07-features.md` / `docs/design/08-sitemap.md` / `docs/design/09-tech-stack.md`

AI 不得擅自起草人主笔文档（spec / constitution），可起草共创 / AI 主笔文档但必须等人审。

### 5.3 决策走 ADR
- 任何"二选一/多选一"的不可逆决策 → 开 ADR（模板：`docs/adr/000-template.md`）
- constitution 变更 → 必须先开 ADR（[[02-constitution#E1]]）
- 技术栈 bump major version → 必须开 ADR（[[09-tech-stack#§5]]）

### 5.4 Anchor 命名约定

项目采用**复合 anchor** 指代表格行 / 子任务项 / 列表项。标准 Markdown 解析器（GitHub / Obsidian 部分场景）不一定能跳转，但人/AI 阅读时可定位：

- `[[prompt-hub-mvp#§0-T1]]` — prompt-hub-mvp.md §0 章节下的 T1 子任务（实际标题 `### T1 ...`，单独 anchor 也能解析为 `[[prompt-hub-mvp#T1]]`）
- `[[09-tech-stack#§3-D1]]` — 09-tech-stack.md §3 决策表的 D1 行（**不可解析**：D1 是表格行不是标题，纯人/AI 视觉定位）
- `[[CLAUDE#§6]] 第 N 项` — 列表项用"§N + 文字补语"，不写 `#§6-#N` 复合形式

**新增引用时**：优先用真实标题 anchor；表格行 / 列表项的复合形式仅在"指向粒度小于子标题"时使用，且默认接受其不可机器跳转。

---

## §6 忌讳清单（不要做的事）

每条都来自真实约束或方法论铁律，**违反请立即停手**：

1. **不要内嵌 LLM SDK 用于话术生成**——违反 [[02-constitution#D1]]，工具会退化为"AI 话术陈列馆"
2. **不要写自动发送话术给 AI 的逻辑**——违反 spec §8.3，破坏"思考的缓冲"
3. **不要在 Macro 里展示 AlignmentPhrase**——违反 [[02-constitution#B2]]，破坏协议/任务分离
4. **不要引入 Scene/Macro/Phase 的嵌套子层级**——违反 spec §8.4
5. **不要把数据上传到任何外部服务**——违反 [[02-constitution#A2]]，话术含隐私指纹
6. **不要给设计文档就地补丁**——必须走方法论 §7 八步上游回流（例外两条：§5.1.1 减法快车道，四类纯删除改动只记 CHANGELOG；§5.1.2 记录类内容反查归档，不进人审队列）
7. **任何 dependency major version bump 必须开 ADR**——技术栈全部锁定见 [[09-tech-stack#§3]]，bump 流程见 [[09-tech-stack#§8]]
   - ✅ **已解锁**：D1（Tauri 2.x）/ D2（React 19.2）/ D3（rusqlite 0.32）/ D4（pnpm 10.x）/ D6（Zustand 5）/ D9（macos-private-api）/ D10（CSS Modules）/ D11（测试栈）；D5（Vite 7.x）+ D7（quick-shortcut plugin）由 D1 自动锁定
   - ⏳ **仍 pending**：D8（prompt-combiner 复用，[[005-prompt-combiner-reuse]] Proposed）— 等 omar 提供仓库后调研，不阻塞第一阶段 MVP
8. **不要复用 prompt-combiner 旧代码而不等 ADR-005 Accepted**——见 [[09-tech-stack#§3-D8]]
9. **不要让 AI 起草 spec / constitution**——这是 🧑 人主笔文档（§5.2）
10. **不要写根 README.md 重复本文件**——根目录暂无 README，CLAUDE.md 是单一入口；`docs/design/README.md` 是文档索引表（破例，与本条不冲突）

---

## §7 当前状态指针

> 本节只留指针，不留编年史。事实明细以 `docs/design/CHANGELOG.md` 日期条目、对应 ADR 与 [[HANDOFF]] 为准。

- **项目阶段**：S1 进行中，**M0 四项交付全绿**（含 M0-4 Developer ID 签名公证，runbook [[m0-4-macos-signing]]）；MCP 写管线 M-X.1–X.4 + 草稿收件箱 UI 已收口（ADR-015，明细见 [[07-features#§4]] 节奏表 2026-06-03 起各行）；资产编辑 AE P1–P4 收口，后随「UI 减负」Modifier/Composition 编辑 UI `withdrawn`、Tab cycle 回落 6 区（[[07-features#3.8]] + [[03-product-spec#13.4]]）；Promptscape 设计吸收落地（ADR-018 + 补遗-1，CHANGELOG 2026-06-25）；flat 视觉锚点被推翻转 subtle elevation（ADR-019，CHANGELOG 2026-06-26）
- **文档体系**：13 核心 + L5 协作契约 2 + MANIFEST v1.23——product-spec **v0.27 ratified** / design-spec **v0.22 ratified** / features **v1.27** / test-spec **v0.12** / prd **v0.15 ratified** / ops-spec **v0.5 ratified** / spec v0.8 / constitution v1.1 / tech-stack v1.4（2026-09-05 人审批次 ⑩：product-spec v0.27 + ops-spec v0.5 同批签字，两个裁点均按推荐通过，见 CHANGELOG 2026-09-05；2026-09-04 判据撤销：omar 撤销 features §1 `verified` 的判据 ② ③（进过一次已 publish 的 release / 自用 ≥1 周无回归），判据自此**只剩留证一条**——② ③ 可核但**不可作为**，留证已完备的行只能等日历，`verified` 因此从「验过没有」滑成「够不够老」；「用了一周没出问题」的信号回到 omar 自己的判断，外部使用者位置不动（[[HANDOFF]] 第 19 项）。**唯一动状态的一行**是「删除可撤销」`done`→`verified`，矩阵 **71 verified / 6 done / 1 in-progress / 14 planned = 92**（合计不变），§7 缺口表 7→6 且自此只登记「缺留证」一种缺口，涟漪 test-spec v0.10；2026-09-03 人审批次 ⑧：ADR-028 回流的三份图纸**同批签字**——prd v0.14 / product-spec v0.25 / design-spec v0.22，**批次内无新决策**，两个裁点都是照签已 Accepted 的子决策 3（六处确认框改一键 + 撤销）与 6（导出含废纸篓），其余全是这两条的必然涟漪；本批的实在收获是**销掉 prd §6.1 挂了三个版本的自相矛盾**——旧文承诺 `deprecated = true`、实装是硬删，现两边都已改正。同日按 §5.1.2 反查归档四份记录类文档：test-spec 连跳两版至 **v0.9**（ADR-028 P0+P1 涟漪 + G5 门记录，两轮反查各抓出 8 处 / 5 处不一致）、features 连跳两版至 **v1.23**（矩阵 91→92，G5 八项全过但受当时判据 ② ③ 所限一行都升不了 `verified`，次日判据撤销后补升）；同日人审批次 ⑦：omar 只签一条契约「编辑器已打开时再按一次锚点 = 无事发生」，product-spec v0.24 / design-spec v0.21 随之 ratified，并首次按 §5.1.2 反查归档 test-spec v0.7（ts-recheck 62 核 / 8 修正 / 21 无法核）；2026-09-02 G4 真机走查：features v1.20 32 行升 verified、test-spec v0.6 §4.3 走查记录 + 三缺陷；2026-09-01 人审批次 ①–⑥：features v1.19 `verified` 判据修订 + 37 行升 verified，test-spec v0.5 / prd v0.13 ratified，product-spec v0.23 / design-spec v0.20 补 ADR-024 与 reshape 旧账回流后 ratified；同日对账日：features v1.18 合计 88→91 + §7 重写，prd/ops-spec/user-flows/spec 四份 `pre-code` 转出；2026-08-20 两轮回流：ADR-027 → v0.20/v1.15/v0.4/v0.13，ADR-025 → v0.19/v0.18/v1.14/v0.3；此前 2026-08-19 两轮：ADR-026 回流 → v0.17/v0.16/v1.12，走查缺陷裁决 → v0.18/v0.17/v1.13）；L5 派生 [[CLAUDE-DESIGN]] v0.2（⚠️ 待 omar 重传）+ [[claude-design-prompts]] v0.1；全文件清单见 [[MANIFEST]] v1.23，版本叙事见 CHANGELOG
- **ADR 进度**：001–029 共 **26 Accepted** + 1 Superseded + 1 Proposed + 1 Reserved——最新 **029（alignment-coordinates-and-drift-ledger，2026-09-04 Accepted，2026-09-05 P0/P1/P2 三期全部落地 + 当日真机门 G7 6 过 / 2 部分 / 1 缺陷已修 `4a68fa9`，当晚第 47 项装机后 ⑦ Dock 路径补验通过 → 7 过 / 1 部分）**：触发是 omar 拿出的单文件原型 `docs/mockups/开场对齐台.html`，戳中的是「对齐不只发生在开场，漂移发生在中途」。裁法选 Option A——四轴坐标接进现有模型，**`phases` 表结构一行不改**，六段形态话术落成六条普通 AlignmentPhrase 分入现有相位；六条中途口令挂新增的第 9 相位「中途」（`kind='cue'`，默认「停」，`⌘9`），**每一次复制本身就是一笔漂移账**，零新按钮。落地：migration `0014`（`user_version` 13→**14**，新表 `alignment_axis_values` 16 条 seed + `alignment_phrases` 六个新列 + `usage_records` 整表重建加 `live_cue` 与 `session_started_at`）、IPC 56→**62**、导出 data schema 1.2→**1.3**、Rust 192→**227** / 前端 461→**532**、源码级 gate 仍 7（第七道豁免清单 10→**11**）、`ConfirmInline` 消费者 1→**2**。**G7 在真实库 v13 快照上跑（38 行 `usage_records` 整表重建后一行不少），8 行升 `verified` / 2 行仍 `done`**（矩阵 **82 verified / 9 done / 1 in-progress / 14 planned = 106**）；**缺陷 D-G7-1**——删轴取值的确认框把刚被引用的取值报成「0 条」，根因是 `refCount` 每次查询现算而 store 那份列表停在启动时刻，**把有代价的删除说成没代价的**，修法 `4a68fa9` 回归用例 +1；两项「部分」据实记（相位带紧凑档未切 / Dock 与 Reopen 路径未验，后者当晚装机后补验通过），另有一处未复现的孤例；`bench:hotkey-wake` 同日复跑 p95 **14.139ms** 无回归（P0 在唤起路径上加了 `emit_wake`，这是自 2026-08-20 以来第一次真的动了 C1 那条路径）。实施期两个 P0 阻断由 verifier 抓出（省略坐标载荷把 `kind` 一起抹掉 / 只有 P0 时口令复制被记成入口而非 `live_cue`）+ 五处偏离 + 一处契约层待裁（状态栏那一格在**调用态**实际读不到：wake 清零 + 复制后约 200ms 隐藏窗口），明细见 CHANGELOG 2026-09-05 第二段。次新 **028（reversible-delete，2026-09-03 Accepted 并当日 P0/P1/P2 三期全部落地 + 真机门 G5 八项全过 + 回流八步完成）**：触发是 omar 当日的第一性原理复盘——G4 走查剩余观察项是「门把手」，真正的洞是**删除不可逆**（原话「删掉一条话术，它就永远消失了」）。裁法选 Option A **原地软删除**而非把行搬进废纸篓表：七张资产表各加 `deleted_at TEXT NULL`，删除是 `UPDATE`，行不动，id / `created_at` / `order_index` / `usage_records` 全部原封不动——这四样正是 [[022-cross-scene-phrase-move]] `:57` 与 [[025-unified-anchored-editing]] `:41` 两次否决「搬走再放回」形态时点名会丢的东西；而 `deprecated` 隐藏管线（五表有列 + 读路径已全过滤 + 有测试）**早已建成却无人写入**，A 的读路径改造只是在既有谓词旁边加一个。**第七道源码级闸门是选 A 的前提**：读源码断言凡查资产表必带 `deleted_at IS NULL`（ADR 正文写的是 `deprecated = 0 AND deleted_at IS NULL`，实装的闸门只强制后半——`deprecated` 至今无人写入），豁免须写行内 marker 并在清单里登记、清单与实扫必须完全相等，把「将来有人漏写过滤」从可能发生变成做不到——没有它，A 就退化成外部调研反复警告的那个坑。六处行内「永久删除？」确认框拆除改一键 + 撤销 toast，依据是 [[025-unified-anchored-editing]] `:125` 已 ratified 的「**撤销优于确认，但仅限真正可逆的动作**」——此前删除不可逆所以确认框是对的，本 ADR 让它可逆所以确认框该退场，确认只留「清空废纸篓」一处。废纸篓**不自动过期**，不设保留天数、不设定时清理，只由用户在设置 · 数据页手动清空（代价是主表单调增长，不粉饰）。**两个坑在动主体之前先修掉**：`idx_alignment_phrase_one_default_per_phase` 的部分唯一索引谓词不认识隐藏行，软删一条默认对齐话术后用户将永远设不了新默认，migration `0013` 重建为 `WHERE is_default = 1 AND deleted_at IS NULL`；`toastStore` 的 arm 助手会让后一条 toast 静默顶掉未过期的撤销 toast，改为带 action 的 toast 在存活期内不被无 action 的顶掉（**error 仍上位是刻意的**：藏掉一次失败比丢一个撤销按钮更糟）。**三期当日全部落地**——P0 `77637cd`（七表加 `deleted_at` + 七处 `DELETE` 改 `UPDATE` + 读路径补谓词与第七道闸门 + 六处确认框拆成一键 + 撤销）/ P1 `6aca7eb`（设置 · 数据页废纸篓：条目数 / 单条恢复 / 清空走全应用唯一的确认框）/ P2 `ec2867b`（契约回流六份）；`user_version` 12→**13**、IPC 53→**56**、源码级 gate 6→**7**、前端 414→**457** / Rust 169→**183**、导出 data schema 1.1→1.2。**五条实施期口径修订里最要紧的一条 ADR 通篇没设想过**：单条恢复曾能造出一条**既不在废纸篓、又不在仪表盘上**的资产——`SceneNotEmpty` 只数存活子内容，故「先删话术、再删它那个已空的场景」是允许的；此后单独恢复那条话术，`deleted_at` 变回 NULL 于是废纸篓不再列它，而场景仍隐藏于是仪表盘也渲染不出。**这正是本 ADR 要消灭的那种损失，却由它自己的恢复路径制造出来**，修法是 `restore_asset` 向上复活被恢复行挂靠的场景与子阶段。**真机门 G5 八项全通过**（`bb344a7`，零缺陷零代码改动，顺带在真机上销掉 G4 观察 O3）。对应功能行当日仍 `done`——彼时三条判据 G5 只补上第 ① 条；**2026-09-04 omar 撤销判据 ② ③ 后该行升 `verified`**（矩阵 71 / 6），G5 这一门即它 `verified` 的全部条件。**两处覆盖薄处照旧留着**：六个删除入口只真机走了 Macro 卡一处，祖先复活路径不经 WebKit 未真机跑（[[HANDOFF]] 第 40 项）。决策明细见 [[028-reversible-delete]] §5、实施期修订见其 §2。更前 **027（configurable-global-hotkey，2026-08-20 Accepted 并当日落地 + 回流八步完成）**：兑现 product-spec §13.4 自 v0.5 起写下却硬编码了三个月的「可配置」。三条子决策——绑定存 SQLite `settings` 表（`user_version` 11→12；理由唯一且硬：Rust 在 `setup()` 注册快捷键时 webview 尚不存在，localStorage 方案必然每次启动先错误注册一次）/ 冲突只有 `register()` 失败一种形态、改绑「校验→注销旧→注册新→落库」任一步失败回滚、强制至少一个修饰键 / 新增 macOS `RunEvent::Reopen` 逃生口（**顺带修掉「点 Dock 图标无反应」**）。IPC 51→53，前端 395 / Rust 168 全绿，`bench:hotkey-wake` p95 13.708ms 无回归；**G3 真机门四项全通过**（项 3 顺带证实「点 Dock 图标无反应」已修）。项 2 一度判为不可达——被占用的组合键被持有方在 OS 层消费，录键器根本收不到；**omar 当日拍板补冲突提示**（判据：修饰键按下又抬起而无主键，不用计时器），补后该场景才可观测并通过，涟漪 product-spec v0.21 / features v1.16 / test-spec v0.5。此前 **026（fixed-spatial-layout，2026-08-18 Accepted 并当日落地，2026-08-19 真机走查通过 + 已合入 `main` + 契约回流八步完成）**：`interactionMode` 停止驱动区域重排，两态共用一套空间，纵向分配改用户可拖拽；起因是实现层 dual-layout 越过 product-spec §4.0.7 作用范围 / §13.3 区域 6 位置 / §13.4 Tab 顺序三处已批准契约且从未开 ADR。走查另发现三项缺陷**已当日裁决**——Scene 下限 `196px`→`288px`（非取舍，是未满足子决策 2 自写的验收条件）/ Separator 约 9px 视觉死区记为已知可接受 / `--brand-dim` 对比度 `1.145:1` 不调色改为把 `.phase.active::after` 标注承重件防减法快车道误删；025（unified-anchored-editing，2026-08-17 Accepted，**六条子决策全数通过**：编辑器改原生 `popover` top layer 锚定 + organize 升级为选择驱动的键盘处理模式 + 子决策 6 局部修订 ADR-024 的 PhaseBar 主角化；**P0 + P1-a + P1-b 已落地并合入 `main`（2026-08-20，merge `97858f7`），真机验收门 G1 六项 + P1-b 门两项全通过，契约回流八步完成 → product-spec v0.19 / design-spec v0.18 / features v1.14 / test-spec v0.3；P2 键盘动作层 + P3 合流待排，验收门 G2 五项未跑**）；021 子决策 scene.color 用户内容色 2026-09-01 omar 复核通过；012 Superseded by 019；005（prompt-combiner 复用）仍 Proposed 等 omar；011 Reserved（search UsageSource，与 025 的 Modifier `macro_area` 借用同族）；各决策与补遗明细见 `docs/adr/`
- **tech-stack**：**v1.4 ratified**——Tauri 2.x + React 19.2 + Zustand 5 + rusqlite 0.32 + pnpm 10.x + Vite 7.x + Vitest 4 + CSS Modules + macos-private-api + updater/process 插件，全栈拍板见 [[09-tech-stack#§3]]
- **自动更新（ADR-017）**：Phase 1-6 全部销账——客户端 + CI 出包 landed（CHANGELOG 2026-06-19），Phase 6 真机验收随 0.2.0 发布实测通过（0.1.1 → 0.2.0 更新链路 + 更新后签名链复验，CHANGELOG 2026-08-20）
- **最近一轮改动（2026-07-12 UX 任务流批次 A+B + 模式契约回流）**：批次 A——D-0 显式整理模式落地（`interactionMode` 持久化 + Header ModeToggle + 整理态整卡=预览/复制显式化 + suppressHide 门控，usage 照计）+ promote 落地定位 / discard 可撤销 / 保存 toast / ⌘Enter 统一 / footer wrap，契约回流 product-spec v0.15 §4.0.7；批次 B——ADR-022 跨 Scene 话术移动（`move_phrase` + MoveReceipt 撤销 + 分层选择器，双路径语义等价），契约回流 product-spec v0.16 §13.3；两批均 verifier 对抗审查 PASS（前端 222→309 / cargo 147→155），NEEDS HUMAN 真机走查待验、确认前不入对外发布说明；明细见 CHANGELOG 2026-07-12 两条目 + [[2026-07-12-ux-taskflow-audit]] + [[HANDOFF]]
- **最近一轮改动（2026-08-17/18 前端结构收口）**：外部独立前端评价触发的两轮裁决——ADR-025 六条全通过 + P0 落地（PhaseBar 去掉 `flex-grow`/`font-size` 的布局漂移）；ADR-026 通过并当日落地（模式不再重排布局，两态共用一套空间，Macro/Scene 改用户可拖拽 + 像素下限）。附带 CLAUDE §5.1.1 新增**减法快车道**（四类纯删除 UI 改动不走八步）。335 测试 / lint / build 全绿，但**布局与视觉权重两项 jsdom 验不了，真机走查前不入对外发布说明**；ADR-026 的契约回流八步是新账优先项，见 [[HANDOFF]]
- **最近一轮改动（2026-09-04 第 21.3 项：启动自检 + 备份去重 + 落盘日志）**：`open_and_migrate` 在 `configure` 之前跑 `PRAGMA quick_check`，非 `ok` 走既有 `fail_startup` 弹框（含库路径 + `backups/` 路径 + 四步手工恢复），不自动回滚；`backup.rs` 快照配额改**按前缀独立**（pre-migrate 5 / pre-import 5 / daily 7）+ `VACUUM INTO` 临时文件后 sha256 去重（`Unchanged` 刷被保留文件 mtime、按年龄清 `.tmp` 残留），HANDOFF 第 32 项「迁移反复失败把旧备份全挤掉」整类坑消掉；每日备份 = 启动检查一次 + 每小时后台线程；接 `tauri-plugin-log`（仅 Rust 侧，`~/Library/Logs/dev.prompt-hub/prompt-hub.log`，1 MiB × KeepOne，不记话术内容）；`import_data` / `export_data` 转 async，随之设置弹窗数据页忙碌中 Esc / 遮罩 / × **不可关**（第 33 项由待裁升必修：async 后这是防「导入中改资产被整库替换抹掉」的唯一互斥）。IPC 仍 56 / `user_version` 仍 13 / Rust 183→**192** / 前端 457→**461**；verifier 两轮（首轮 FAIL 抓 D1 白跑 VACUUM / D2 弹窗可关 / D3 `.tmp` 残留，修后 PASS）；**真机门 G6 五项全过**（[[11-test-spec#4.5]]）。涟漪：ops-spec **v0.5**（2026-09-05 批次 ⑩ ratified）/ product-spec **v0.27**（唯一裁点忙碌中禁止关窗，同批通过）/ tech-stack **v1.4** / features **v1.26**（矩阵 106，74 verified / 7 done）/ test-spec v0.11。Codex 第二意见因代理余额不足中断，无结论
- **最近一轮改动（2026-09-05 ADR-029 三期：对齐坐标 + 中途口令 + 漂移账）**：P0 数据层 `0329520` / P1 UI `345e37f` / P2 归因展示 `3af8308` 当日全部落地。migration `0014` 把 `user_version` 推到 **14**——新表 `alignment_axis_values`（16 条 seed）、`alignment_phrases` 加六列（`kind` / 三列坐标 / `cue_axis` / `content_revised_at`）、`usage_records` **整表重建**（`source` 的 CHECK 由 6 值增至 7，新增 `live_cue`；加 `session_started_at`）；seed 出第 9 相位「中途」与六条口令（默认「停」）以及六条形态话术。前端**零新按钮**：坐标显示在既有 chip 的名称之后，轴取值管理寄生在坐标选择器的最后一个 `<option>`，口令计数占状态栏左侧第四格（N=0 不渲染），漂移账明细由点这一格按需打开。IPC 56→**62** / `user_version` 13→**14** / 导出 data schema 1.2→**1.3** / Rust 192→**227** / 前端 461→**532**（45 文件）/ 源码级 gate 仍 **7**（第七道豁免清单 10→**11**）。**当日真机门 G7 在真实库 v13 快照上跑完**（6 过 / 2 部分 / 1 缺陷 `4a68fa9` 修后通过）——`usage_records` 整表重建后 38 行一行不少、`foreign_key_check` 空，这一条空库永远证不到。涟漪：features **v1.27**（§3.15 十行 `planned`→`done` 后 **8 行升 `verified`**，矩阵 106 不变，`planned` 24→14 / `done` 7→**9** / `verified` 74→**82**）/ test-spec **v0.12**（计数刷新 + §4.1 G7 行 + 新增 **§4.6 走查记录**，教训续到 16）/ prd 与 product-spec 只改落地状态标注、**契约文字一字未动**。**G7 首跑「不在覆盖内」四项已于次日全部补验**（2026-09-05 晚第 47 项装机补 Dock 路径，**正式版自此 `a2763aa` / schema 14，真实库同步 14**；2026-09-06 第 55 项再装 `d93723b`（代码同 `4c6299c`，补上修订说明框，schema 不变无迁移）；2026-09-06 第 51 项在隔离 HOME 上用真实库 v14 快照补紧凑档 / 改正文打戳 / 导出 1.3 三步往返，G7 **8 项全过**）。「导出 1.2 → 1.3」升 `verified`（矩阵 83 / 8 / 1 / 14，features v1.29 / test-spec v0.14）；「修订切分点」当日先发现**图纸缺口**（编辑器没有「修订说明」框，`notes` 列有 Rust 写入方却无 UI 调用方），omar 裁 a 后当日落地（编辑面「这次为什么改」输入，product-spec **v0.29** / prd **v0.16** 人审批次 ⑫；正文真变时总是写入、留空即清掉上一条）并真机回查通过，升 `verified`——**§3.15 十行全部 `verified`**，矩阵 **84 / 7 / 1 / 14 = 106**，前端 532 → **536**（features v1.30 / test-spec v0.15）。说明目前只写不显，明细面回显待 [[HANDOFF]] 第 54 项。
- **下一动作**：见 [[HANDOFF#Next-Actions]]（行动项单一真相源）
