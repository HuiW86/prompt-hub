---
type: claude-md
project: prompt-hub
version: v1.0
created: 2026-05-19
audience: [ai, human]
description: prompt-hub 项目级 AI 上下文——项目特有约束/三温区映射/忌讳清单。AI 进场始终注入
related:
  - constitution
  - spec
  - tech-stack
---

# CLAUDE.md — prompt-hub 项目级 AI 上下文

> 本文件为 prompt-hub **项目级**约束。全局规则见 `~/.claude/CLAUDE.md`（中文沟通 / Conventional Commits / [P0] 设计原则等），本文件**只承载项目特有的**约束。
>
> 双向链接：[[constitution]] 是项目铁律，本文件是 AI 在 prompt-hub 工作的行为规范。

---

## §1 一句话定位

prompt-hub 是 **AI 编程手动挡阶段的桌面仪表盘**——主形态快捷键唤起全屏窗口，辅形态副屏常驻视图，承载提示词资产的展示/调用/沉淀，以及人机协议对齐。

完整定位见 [[spec#1.1]]。

---

## §2 关键命令

> ⚠️ **TBD — 待第一阶段建仓后补**
>
> 当前项目处于 pre-code 阶段（仅有设计文档），尚未建仓。Tauri vs Electron 选型未定（见 [[tech-stack#§3]]）。建仓后回填以下命令：
>
> ```bash
> <dev>     # 开发服务器
> <build>   # 生产构建（含 desktop bundle）
> <test>    # 单元 + 集成测试
> <lint>    # 代码风格检查
> <format>  # 自动格式化
> ```
>
> 本节是"未来 AI 接手第一阶段"的接力棒。

---

## §3 项目三温区映射

通用三温区模型见全局 CLAUDE.md。本节是 prompt-hub 的具体映射：

### 热区（始终注入）
- `CLAUDE.md`（本文件） — AI 进场基线
- `constitution.md` — 8 条铁律
- `spec.md` — 项目定位与九条哲学
- `HANDOFF.md` — 跨会话断点

### 温区（按需取用，按 description 召回）
- `prd.md` — 写后端 / 数据层时
- `product-spec.md` — 写 UI 时
- `design-spec.md` — 写 CSS / 视觉时
- `plan.md` — 实施任务清单
- `tech-stack.md` — 生成 import 语句时
- `adr/*` — 决策追溯时

### 冷区（仅显式查询时取）
- `~/Vault/知识库/方案模板/产品文档体系方法论.md` — 文档体系治理时
- git history — 变更追溯
- 未来：`features.md` / `sitemap.md` / `test-spec.md` / `ops-spec.md`（待 W2-W4 补齐）

---

## §4 代码规范（项目特有）

> 通用规范（命名 / 注释英文 / Conventional Commits）见全局。本节只列 **prompt-hub 特有**的。

### 4.1 CSS 必须用 token
**任何组件 CSS / 内联样式禁止裸 px / 裸 hex / 裸 ms 值**——必须引用 `--fs-*` / `--space-*` / `--color-*` / `--duration-*` token。见 [[plan#§0-T1]]。

**失败案例**：旧 `#1D9E75` 字面量混入代码导致颜色不一致，2026-05-18 全量替换为 `var(--color-task-border)`。

### 4.2 数据模型严守三层
任何新增资产类型前，先确认能否归入 Modifier / Composition / Macro。**不允许引入第 4 层资产**（违反 [[constitution#B1]]）。

### 4.3 协议层与任务层分离
新增功能涉及 AlignmentPhrase / Phase / SOP / Macro 时，必须自检 [[constitution#B2]] 物理分离约束：
- AlignmentPhrase 不出现在 Composition 工作台
- SOP 不引用 AlignmentPhrase
- Macro 区不展示 AlignmentPhrase

### 4.4 性能预算
任何主形态相关代码必须保持唤起 ≤ 200ms P95（[[constitution#C1]]）。涉及主形态启动路径的改动需附 benchmark。

---

## §5 文档工作流（项目特有）

### 5.1 变更必须走方法论 §7 八步
任何 spec / prd / product-spec / design-spec 改动走 [[~/Vault/知识库/方案模板/产品文档体系方法论#§7]] 流程：锁定 diff → 影响半径 → 上游一致性 → bump → 涟漪更新 → features 回写 → ADR → AI 层同步。

### 5.2 文档主笔人分工
- 🧑 人主笔：`spec.md` / `constitution.md`
- 🤝 共创：`CLAUDE.md` / `adr/*` / `user-flows.md` / `product-spec.md` / `design-spec.md` / `plan.md`
- 🤖 AI 主笔（人审）：`prd.md` / `test-spec.md` / `ops-spec.md` / `features.md` / `sitemap.md` / `tech-stack.md`

AI 不得擅自起草人主笔文档（spec / constitution），可起草共创 / AI 主笔文档但必须等人审。

### 5.3 决策走 ADR
- 任何"二选一/多选一"的不可逆决策 → 开 ADR（模板：`adr/000-template.md`）
- constitution 变更 → 必须先开 ADR（[[constitution#E1]]）
- 技术栈 bump major version → 必须开 ADR（[[tech-stack#§5]]）

---

## §6 忌讳清单（不要做的事）

每条都来自真实约束或方法论铁律，**违反请立即停手**：

1. **不要内嵌 LLM SDK 用于话术生成**——违反 [[constitution#D1]]，工具会退化为"AI 话术陈列馆"
2. **不要写自动发送话术给 AI 的逻辑**——违反 spec §8.3，破坏"思考的缓冲"
3. **不要在 Macro 里展示 AlignmentPhrase**——违反 [[constitution#B2]]，破坏协议/任务分离
4. **不要引入 Scene/Macro/Phase 的嵌套子层级**——违反 spec §8.4
5. **不要把数据上传到任何外部服务**——违反 [[constitution#A2]]，话术含隐私指纹
6. **不要给设计文档就地补丁**——必须走方法论 §7 八步上游回流
7. **不要在 pre-code 阶段擅自选型**——技术栈未拍板时见 [[tech-stack#§3]]，开 ADR 决议
8. **不要复用 prompt-combiner 旧代码而不开 ADR**——见 [[tech-stack#D8]]
9. **不要让 AI 起草 spec / constitution**——这是 🧑 人主笔文档（§5.2）
10. **不要写 README.md 重复本文件**——本项目暂无 README，CLAUDE.md 是单一入口

---

## §7 当前状态指针

- 项目阶段：**pre-code**（仅设计文档，0 LOC）
- 文档体系：13/13 已规划，当前 6/13 已落盘（spec / product-spec / design-spec / prd / plan / constitution / CLAUDE / tech-stack / adr/template），W2-W4 待补 4 份（features / sitemap / user-flows / test-spec / ops-spec）
- 下一动作：见 [[HANDOFF#Next-Actions]] 或 [[plan#§0]]
