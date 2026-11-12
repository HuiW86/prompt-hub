---
type: claude-md
project: prompt-hub
version: v1.2  # 2026-11-12 §7 压回指针形态（约 2 万字符编年史移除，事实以 CHANGELOG / ADR / HANDOFF 为准）并按 main@a7f8304 反查更正盘面数字；待人审
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
- `docs/MANIFEST.md` v1.24 — 项目全文件清单（六层架构总览，AI 进项目读完 CLAUDE.md 接读拿全貌）
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

> 本节只留指针，不留编年史。每个数字只写当前值；它是怎么变成这样的，查 `docs/design/CHANGELOG.md` 日期条目、对应 ADR 与 [[HANDOFF]]。写入新状态时**替换**旧条目而不是追加（2026-11-12 对账时本节已积到约 2 万字符、占本文件六成，且多处与现状不符，故压回指针形态）。

- **项目阶段**：S1 进行中。最新公开版 **v0.2.2**（2026-10-09 发布，tag `v0.2.2` = `main@a7f8304`，含常用网站 Tab 与主界面减法 pass；发布说明 `docs/release-notes/v0.2.2.md`）
- **盘面数字**（2026-11-12 反查 `main@a7f8304` 源码）：`user_version` **15**（最新 migration `0015_websites.sql`）/ 导出 data schema **1.4** / `#[tauri::command]` **71** 个 / 源码级 gate **7** 道。测试计数最后一次实测是 2026-09-27 于 `ccb145b`：前端 **540** / Rust **231**（此后只有 `c40f2c1` 改过一条断言，未重新计数）
- **文档体系**：spec v0.8 / constitution v1.1 / product-spec **v0.30** / user-flows v0.1（draft，待重写）/ design-spec **v0.23** / prd **v0.16** / features **v1.30** / sitemap v0.2 / tech-stack **v1.4** / ops-spec **v0.5** / test-spec **v0.15**；MANIFEST v1.24（多行口径滞后，见 [[HANDOFF]] 第 3 项）；L5 [[CLAUDE-DESIGN]] v0.2（⚠️ 待 omar 重传）+ [[claude-design-prompts]] v0.1。各文档的版本以其自身 frontmatter 为准，本行只是快照
- **ADR 进度**：001–030 共 **26 Accepted** + 2 Proposed（005 prompt-combiner 复用 / **030 website-library——代码已随 v0.2.2 发布，决策仍未裁**）+ 1 Reserved（011）+ 1 Superseded（012 → 019）。各决策与补遗明细见 `docs/adr/`
- **tech-stack**：Tauri 2.x + React 19.2 + Zustand 5 + rusqlite 0.32 + pnpm 10.x + Vite 7.x + Vitest 4 + CSS Modules + macos-private-api + updater/process 插件，全栈拍板见 [[09-tech-stack#§3]]
- **本机安装版**：最后一次有记录的是 2026-09-24 自建的 0.2.1（含网站 Tab，schema 15，未公证），见 [本机安装记录](docs/website-tab/evidence/local-install-2026-09-24.md)。是否已升到公开 v0.2.2 无记录，下次装机时补
- **清单入口**：全文件清单见 [[MANIFEST]] v1.24，版本叙事见 CHANGELOG
- **下一动作**：见 [[HANDOFF#Next-Actions]]（行动项单一真相源）
