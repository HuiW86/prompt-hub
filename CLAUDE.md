---
type: claude-md
project: prompt-hub
version: v2.0  # 重组为纯协议层：状态叙事移出、流程改 skill、加 context-budget 闸门（#38）
created: 2026-05-19
status: draft  # v2.0 待 HuiW86 在 #38 的 PR 签字后转 ratified
author: co  # 🤝 人机共创（CLAUDE §5.2 本文档自身）
audience: [ai, human]
description: prompt-hub 项目级 AI 上下文——定位/命令/规则与守卫闸门/忌讳/去哪查现状。AI 进场始终注入
related:
  - 02-constitution
  - 01-spec
  - 09-tech-stack
---

# CLAUDE.md — prompt-hub 项目级 AI 上下文

> 本文件只放**协议层**：很少变、每次都要遵守的东西。全局规则见 `~/.claude/CLAUDE.md`（中文沟通 / Conventional Commits 等）。
>
> **写入规则**：不写日期、不写测试计数、不写「最近做了什么」。前两条与字节上限由 `scripts/doc-governance/context-budget.test.ts` 强制；「不写近况」闸门查不出，靠自觉。本轮做了什么 → `docs/design/CHANGELOG.md`；下一步做什么 → [[HANDOFF]]；为什么这么定 → ADR / [[learnings]]。

---

## §1 一句话定位

prompt-hub 是 **AI 编程手动挡阶段的桌面仪表盘**——主形态快捷键唤起全屏窗口，辅形态副屏常驻视图，承载提示词资产的展示 / 调用 / 沉淀，以及人机协议对齐。

**核心目的**（[[031-panorama-default-view]]）：一眼看到全局，一键贴出，每次都记数。唤起后默认进入「全景」工作区；原仪表盘为「管理」工作区，另有「常用网站」「技能」两个独立库工作区。

判断一个功能该不该做：先问它对应 [[01-spec]] §2 九条哲学里的哪一条，九条都不沾就不做。完整定位见 [[01-spec]] §1，不做什么见其 §8。

---

## §2 关键命令

```bash
pnpm install --frozen-lockfile                                         # 只用 pnpm；npm / yarn / bun 会造成 lockfile 冲突
pnpm tauri dev                                                         # Dev server + Tauri shell（Vite HMR）
pnpm tauri build                                                       # 生产构建
pnpm test                                                              # Vitest 全量，含 §4 全部源码级闸门（watch：pnpm test:watch）
pnpm format                                                            # Prettier 写盘
pnpm lint && pnpm build && pnpm exec prettier --check .                # ESLint / tsc + vite / 格式
cargo test --workspace --manifest-path src-tauri/Cargo.toml            # --workspace 必须：不加只测根包，三个库 crate 的用例全被跳过
cargo clippy --workspace --all-targets --manifest-path src-tauri/Cargo.toml -- -D warnings
cargo fmt --manifest-path src-tauri/Cargo.toml
node scripts/doc-governance/index.mjs --config doc-governance.config.mjs   # 文档闸门单独跑
pnpm bench:hotkey-wake                                                 # C1 判据，P95 > 200ms 退出码 1；怎么判见 skill `c1-bench`
```

云端 Linux 会话的限制：`cargo` 编不过主 crate 里 macOS 专有的 `RunEvent::Reopen`（测试时临时替换、测完还原）；bench 与真机走查跑不了；推不了 tag。

---

## §3 上下文怎么取

只有本文件会被自动注入，其余都要自己去读：

| 时机 | 读什么 |
|---|---|
| 每次进场 | [[HANDOFF]]（当前目标 + 下一步）· [[02-constitution]]（铁律，5 KB，读全文） |
| 写后端 / 数据层 | [[06-prd]] |
| 写 UI | [[03-product-spec]] |
| 写 CSS / 视觉 | [[05-design-spec]]，token 在 `src/styles/tokens.css` |
| 用 Claude Design 设计 UI | [[CLAUDE-DESIGN]]（sticky context）+ [[claude-design-prompts]]（task 模板） |
| 排实施任务 | `docs/plans/prompt-hub-mvp.md` |
| 生成 import / 加依赖 | [[09-tech-stack]] |
| 追溯决策 | `docs/adr/`（frontmatter `status` 为准） |
| 理解规矩背后的判断、真机与发版陷阱 | [[learnings]]（附录 B） |
| 全文件清单 | [[MANIFEST]] |

**按需加载的流程**（`.claude/skills/`）：`doc-change`（改文档 / 开 ADR 前）· `c1-bench`（碰唤起路径时）· `release`（发版时）。改完代码用 `.claude/agents/verifier.md` 做对抗审查。

**不进上下文的记录层**：`docs/design/CHANGELOG.md`、[[07-features]] 矩阵、[[11-test-spec]] §2 / §4.x、git 历史。只在要查某件事时去 grep。

---

## §4 代码规范（项目特有）

### 4.1 CSS 必须用 token
组件 CSS / 内联样式禁止裸 px / 裸 hex / 裸 ms，一律引用 `tokens.css` 的 token。曾有一个颜色字面量混入代码导致全局颜色不一致，此后改由闸门强制。

### 4.2 数据模型严守三层
新增资产类型前先确认能否归入 Modifier / Composition / Macro；**不允许第 4 层资产**（[[02-constitution#B1]]）。常用网站、技能索引是独立库表、不属资产（ADR-030 / ADR-033），新增同类前先开 ADR。

### 4.3 协议层与任务层分离
涉及 AlignmentPhrase / Phase / SOP / Macro 时自检 [[02-constitution#B2]] 与 [[01-spec]] §8.6：AlignmentPhrase 不出现在 Composition 工作台、不被拼进 Composition、不进 SOP（SOP 不引用 AlignmentPhrase）、不与 Macro 互转、不归属 Scene。全景工作区并列展示各类条目不构成违反；「管理」工作区的 `MacroGrid` / `ScenePanel` / `ModifierGrid` / `SopProgress` 仍零引用对齐话术。

### 4.4 性能预算
主形态唤起 ≤ 200ms P95（[[02-constitution#C1]]）。碰启动路径的改动必须附 benchmark，加载 skill `c1-bench`。

### 守卫闸门（全部随 `pnpm test` 跑）

规则能用测试守住，就不只写成文字。改闸门本身或它的豁免清单属契约变更，需要依据（ADR 或本文件条款）。

| 闸门 | 守什么 |
|---|---|
| `src/styles/token-gate.test.ts` | §4.1 裸值禁令 |
| `src/styles/density-gate.test.ts` | 紧凑密度层只收结构、不动字号 |
| `src/styles/theme-parity.test.ts` | 浅色两份手工镜像不分叉 |
| `src/components/__tests__/b2-separation.test.ts` | §4.3 任务层组件零对齐话术引用 |
| `src/ipc/ipc-contract.test.ts` | IPC 命令三方一致，命令总数写死防静默增长 |
| `src/ipc/soft-delete-gate.test.ts` | 读资产表必带 `deleted_at IS NULL`（ADR-028） |
| `scripts/doc-governance/doc-refs-gate.test.ts` | 文档引用不悬空、MANIFEST 覆盖、§7 版本表与文档一致 |
| `scripts/doc-governance/context-budget.test.ts` | 本文件与 HANDOFF 的体积和写入规则 |

各闸门的完整契约见 [[11-test-spec]] §3。

---

## §5 文档工作流（项目特有）

改任何文档或开 ADR 前，**加载 skill `doc-change`**——判定表、边界与理由都在那里。这里只留每条规则的一句话（全仓 `[[CLAUDE#§5.x]]` 引用指向这些标题）。

### 5.1 变更必须走方法论 §7 八步
改 spec / prd / product-spec / design-spec 的契约条款走八步：锁定 diff → 影响半径 → 上游一致性 → bump → 涟漪更新 → features 回写 → ADR → AI 层同步。

#### 5.1.1 减法快车道
纯删除类 UI 改动（删解释性文案 / 装饰 / 未实现占位 / 动效，封闭四类）不走八步，只在 CHANGELOG 记一行「删了什么 + 依据哪一类」。删的东西承载语义或状态、删 token、删区域功能字段、一次删三处以上，都越界，回落八步或 ADR。

#### 5.1.2 日志不签字
人审只签「图纸类」（01 / 02 / 03 / 05 / 06 里回答「应该长什么样」的条款）。「记录类」（test-spec §2 与 §4.x、features §7、CHANGELOG、HANDOFF）由 AI 起**只读**子代理逐句反查代码后直接归档：一致 / 不一致（附 `file:line`，先改再归档）/ 无法核（标明条数）。送审图纸只给「一句话的决定 + 推荐选项」。

### 5.2 文档主笔人分工
- 🧑 人主笔，**AI 不得起草**：[[01-spec]]、[[02-constitution]]
- 🤝 共创，AI 可起草、须人审：`CLAUDE.md`、`docs/adr/*`、[[04-user-flows]]、[[03-product-spec]]、[[05-design-spec]]、`docs/plans/prompt-hub-mvp.md`
- 🤖 AI 主笔、须人审：[[06-prd]]、[[11-test-spec]]、[[10-ops-spec]]、[[07-features]]、[[08-sitemap]]、[[09-tech-stack]]

### 5.3 决策走 ADR
二选一 / 多选一的不可逆决策、宪法任何变更（[[02-constitution#E1]]）、依赖 major version bump（[[09-tech-stack]] §8），都先开 ADR（模板 `docs/adr/000-template.md`）。

### 5.4 Anchor 命名约定
优先用真实标题 anchor；表格行 / 子任务项用复合形式（如 `[[09-tech-stack#§3-D1]]`），默认接受其不可机器跳转。

---

## §6 忌讳清单（不要做的事）

每条都来自真实约束或方法论铁律，**违反请立即停手**：

1. **不要内嵌 LLM SDK 用于话术生成**——违反 [[02-constitution#D1]]，工具会退化为「AI 话术陈列馆」
2. **不要写自动发送话术给 AI 的逻辑**——违反 spec §8.3，破坏「思考的缓冲」
3. **不要让 AlignmentPhrase 与 Macro 互转、被拼进 Composition 或进入 SOP**——违反 [[02-constitution#B2]]（全景并列展示不算，见 §4.3）
4. **不要引入 Scene / Macro / Phase 的嵌套子层级**——违反 spec §8.4
5. **不要把数据上传到任何外部服务**——违反 [[02-constitution#A2]]，话术含隐私指纹
6. **不要给设计文档就地补丁**——走 §5.1 八步（例外：§5.1.1 快车道、§5.1.2 记录类反查归档）
7. **任何 dependency major version bump 必须开 ADR**——技术栈锁定见 [[09-tech-stack]] §3；唯一仍 pending 的是 D8（prompt-combiner 复用，[[005-prompt-combiner-reuse]] Proposed）
8. **不要复用 prompt-combiner 旧代码而不等 ADR-005 Accepted**
9. **不要让 AI 起草 spec / constitution**——人主笔文档（§5.2）
10. **不要写根 README.md 重复本文件**——CLAUDE.md 是单一入口；`docs/design/README.md` 是文档索引表，不冲突
11. **不要往本文件追加状态叙事**——它曾长到 36 KB，六成是过期的编年史（#38）。现状写 HANDOFF，历史写 CHANGELOG

---

## §7 当前状态指针

本节只给**去哪查**，不给会过期的值。

| 问题 | 去哪查 |
|---|---|
| 现在在做什么、下一步是什么 | [[HANDOFF]] 的 Objective 与 Next Actions |
| 积压（含旧「HANDOFF 第 N 项」编号） | GitHub Issues；旧编号 → issue 对照表在 [[HANDOFF]] |
| 最新公开版 | GitHub Releases（云端会话用 GitHub MCP `list_releases`）；`main` 上未发版的内容看 [[HANDOFF]] |
| 数据库 schema 版本 | `src-tauri/crates/repo-core/migrations/` 最大编号 = `user_version` |
| ADR 状态 | `docs/adr/*.md` 各自 frontmatter `status` |
| 每份文档改过什么 | 各文档文末修订记录 + `docs/design/CHANGELOG.md` |

**设计文档当前版本**（doc-governance 的 `versionPointers` 只核对下表这 8 份；bump 其中任一份必须同改这一行，04 / 08 / 10 / 11 不在核对范围）：

| 文档 | 版本 |
|---|---|
| [[01-spec]] | v0.9 |
| [[02-constitution]] | v1.2 |
| [[03-product-spec]] | v0.35 |
| [[05-design-spec]] | v0.29 |
| [[06-prd]] | v0.19 |
| [[07-features]] | v1.37 |
| [[09-tech-stack]] | v1.4 |
| [[MANIFEST]] | v1.25 |
