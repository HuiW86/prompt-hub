---
type: claude-md
project: prompt-hub
version: v1.0
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
cargo test --manifest-path src-tauri/Cargo.toml           # Rust 测试（含 tempfile SQLite fixture）
cargo fmt --manifest-path src-tauri/Cargo.toml            # Rust 格式化
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings  # Rust lint

# 性能 benchmark（[[02-constitution#C1]] 200ms 唤起自检）
pnpm bench:cold-start                                     # spawn → 首次 CGWindow entry P95（debug build baseline ~193ms；C1 不约束此项）
pnpm bench:hotkey-wake                                    # show()+set_focus() Rust 调用 P95（baseline ~0.02ms；不含 OS shortcut dispatch ~10ms）
# BENCH_ROUNDS=N pnpm bench:cold-start                    # 自定义轮数（默认 20）
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
- `docs/design/09-tech-stack.md` — 生成 import 语句时
- `docs/adr/*` — 决策追溯时

### 冷区（仅显式查询时取）
- `docs/MANIFEST.md` — 项目全文件清单（六层架构总览，AI 进项目读完 CLAUDE.md 接读拿全貌）
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
6. **不要给设计文档就地补丁**——必须走方法论 §7 八步上游回流
7. **任何 dependency major version bump 必须开 ADR**——技术栈全部锁定见 [[09-tech-stack#§3]]，bump 流程见 [[09-tech-stack#§8]]
   - ✅ **已解锁**：D1（Tauri 2.x）/ D2（React 19.2）/ D3（rusqlite 0.32）/ D4（pnpm 10.x）/ D6（Zustand 5）/ D9（macos-private-api）/ D10（CSS Modules）/ D11（测试栈）；D5（Vite 7.x）+ D7（quick-shortcut plugin）由 D1 自动锁定
   - ⏳ **仍 pending**：D8（prompt-combiner 复用，[[005-prompt-combiner-reuse]] Proposed）— 等 omar 提供仓库后调研，不阻塞第一阶段 MVP
8. **不要复用 prompt-combiner 旧代码而不等 ADR-005 Accepted**——见 [[09-tech-stack#§3-D8]]
9. **不要让 AI 起草 spec / constitution**——这是 🧑 人主笔文档（§5.2）
10. **不要写根 README.md 重复本文件**——根目录暂无 README，CLAUDE.md 是单一入口；`docs/design/README.md` 是文档索引表（破例，与本条不冲突）

---

## §7 当前状态指针

- 项目阶段：**M-X.0 涟漪闭环（ADR-015 MCP write pipeline）**（2026-06-01）——MCP write 决策已涟漪进 7 份设计文档全闭环；前置 ADR-012 Phase 1-3 已 ship（fonts/tokens commit `b932ab4` / dark+ontology `9a822d8` / 9 组件视觉重写 `acf8229`），Vitest 55/55 + cargo 12/12 + lint + build 全过，M0-3 唤起 P95=10.49ms 远低于 [[02-constitution#C1]] 200ms 死线；**仍待**：ADR-012 Phase 5 `pnpm tauri dev` 6 步 manual verify / M0-4 Developer ID 签名 spike
- 文档体系：**13 核心 + L5 协作契约 2 + MANIFEST 全部 ratified**（2026-06-01 M-X.0 涟漪：spec v0.6 / constitution v1.1 / product-spec v0.7 / design-spec v0.8 / prd pre-code v0.7 / features in-progress v0.3 / tech-stack v1.2；🤝 共创 6/6 ratified）——核心设计文档 `docs/design/01-11-*.md` + L5 派生 [[CLAUDE-DESIGN]] + [[claude-design-prompts]]；全文件清单见 [[MANIFEST]] v1.3
- ADR 进度：**13 Accepted + 1 Proposed + 2 Reserved**——001/002/003/004/006/007/008/009/010 + 012（lock-visual-quality-anchor，Linear 气质锚定）+ 013（alignment-phrases-tab-inclusion，追认独立 region + Tab cycle 6 tab-reachable）+ 015（expose-mcp-write-pipeline，2026-05-27 Accepted，14 tool + workspace 拆 4 crate + drafts staging）；005（prompt-combiner 复用）仍 Proposed；011 Reserved（search UsageSource）+ 014 Reserved（nspanel-isa-swizzle）
- tech-stack 状态：**v1.2 ratified**（[[09-tech-stack]]）—— 全栈拍板：Tauri 2.x + React 19.2 + Zustand 5 + rusqlite 0.32 + pnpm 10.x + Vite 7.x + Vitest 4 + CSS Modules + macos-private-api；v1.2 加 ADR-015 MCP server + workspace 4 crate 物理拆分
- 下一动作：**M-X.1 数据层 + workspace 重构（L 级，3-4 天）**——待 omar 验收后启动，提纲见 [[mcp-write-pipeline#§8]]（drafts 表 migration 0003 + 14 tool 双层 + Cargo workspace 拆 repo-core/repo-write）；并行待办：ADR-012 Phase 5 `pnpm tauri dev` 6 步视觉 diff（overlay frame / ⌥Space 唤起 / PhaseBar 8 段 / AlignmentPhrases chip flash / MacroGrid Flame / StatusBar ⌘K）+ bench 脚本 + M0-4 签名；Claude Design pipeline 待 omar 上传 [[CLAUDE-DESIGN]] 跑 Task β；详见 [[HANDOFF#Next-Actions]]
