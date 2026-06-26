---
type: adr
project: prompt-hub
id: ADR-019
status: Proposed
date: 2026-06-25
description: 推翻 ADR-012 的「反 polish / flat」视觉锚点，引入 elevation（box-shadow）并重审颜色本体论强度，以贴近 Promptscape 设计稿观感；启用 ADR-012 当年明示排除的 Option E。本 ADR 由 AI 起草待 omar 人审；其中「放弃颜色本体论」分支触动 constitution B2，须由 omar 先人主笔改宪法方可推进。
related:
  - 02-constitution
  - 01-spec
  - 05-design-spec
  - CLAUDE-DESIGN
  - 012-lock-visual-quality-anchor
  - 018-absorb-promptscape-design
---

# ADR-019: 推翻 flat 视觉锚点，引入 elevation 并重审颜色本体论

> **状态说明**：本 ADR 为 **AI 起草草案（Proposed）**，等 omar 人审。Decision 节给出 AI 建议，最终拍板属 omar（ADR-012 决策者）。

## 1. 标题与日期

- **标题**：是否推翻 [[012-lock-visual-quality-anchor]] 的「反 polish / Bloomberg-flat」视觉锚点——引入 elevation（box-shadow），并决定颜色本体论（三色绑层）保留还是弱化，以贴近 [[018-absorb-promptscape-design]] 吸收的 Promptscape 设计稿观感
- **日期**：2026-06-25
- **决策者**：omar（待拍板）／AI 起草
- **影响范围**：
  - [[012-lock-visual-quality-anchor]] —— 被本 ADR `Superseded`（Accepted 后才生效）
  - [[05-design-spec#§8.2]] Hard exclusions —— 撤「box-shadow 禁项」，bump major
  - [[05-design-spec#§10.1]] 交互态 —— hover「NO shadow」改写
  - [[05-design-spec#§2.4.1]] Ontology 三色 —— 仅「弱化本体论」分支涉及
  - [[02-constitution#B2]] 色块即本体 + 反设计清单 —— 仅「弱化本体论」分支涉及（🧑 人主笔）
  - [[01-spec]] 九条哲学「认知缓冲 > polish」—— 仅「弱化本体论」分支涉及（🧑 人主笔）
  - `src/styles/tokens.css` —— 新增 `--shadow-*` token
  - 全站组件 CSS（卡片 / banner / overlay 的 hover / 抬起态）

## 2. Status

`Proposed`（2026-06-25，AI 起草，待 omar 人审）

> Accepted 后：① 本字段改 Accepted；② [[012-lock-visual-quality-anchor]] 的 Status 改 `Superseded by ADR-019`（届时才动，现在不碰 ADR-012 原文）。

## 3. Context

### 触发事件
[[018-absorb-promptscape-design]] 吸收 Promptscape 全景仪表盘设计稿后，实现与设计稿反复「不一样」。本会话逐块比对诊断，差异分三类：

- **A 类·翻译损耗**（1 处）：Scene header meta 缺 `desc · N 个 Composition`（数据模型缺字段，与本 ADR 无关）
- **B 类·铁律保护**（8 处）：任务层胶囊配色、Macro 图标盒、box-shadow 抬起、Modifier/Recent 角标语义色等，由 [[05-design-spec#§8.2]]（无阴影）+ [[05-design-spec#§2.4.1]]（颜色本体论）锁定
- **C 类·设计稿未覆盖**（4 区）：UpdaterBanner / SopProgress / DraftInbox / 各资产编辑态——Promptscape 是只读演示原型，未画这些真实功能，导致它们视觉语言各自为政、气质割裂

omar 判断要让实现贴近设计稿观感（带 elevation 的「抬起感」、可能更中性的配色），这要求推翻 ADR-012 §8.2 的反阴影底线——正是 ADR-012 §4 当年 **Option E（明示排除）** 的内容。

### 业务约束
- **ADR-012 §4 Option E + §6 + §相关链接**白纸黑字规定：「推翻反 polish 哲学」属 ADR-013+ 范畴，**须先改 [[02-constitution]]（B2 色块即本体 + 反设计清单）与 [[01-spec]]（九条哲学）**
- [[02-constitution#B2]] 协议层/任务层物理分离——颜色本体论（紫=协议 / 绿=任务）是其视觉实现，是用户「一眼区分协议资产与任务资产」的主要手段
- [[01-spec]] 哲学「认知缓冲 > polish」「信息密度 > 视觉舒服」
- 文档分工（[[CLAUDE#§5.2]]）：constitution / spec 是 🧑 人主笔，AI 不得起草

### 技术约束
- [[05-design-spec#§8.1]] 视觉优先级：**ADR-012 > CLAUDE-DESIGN > bundle preview（设计稿）**——设计稿当前优先级最低，「照搬设计稿」本身违反 §8.1，故须先动 §8.1 的来源 ADR-012
- [[CLAUDE-DESIGN]] sticky context（claude.ai/design 的 design system）以 hard exclusions「No box-shadow」为约束，本 ADR 通过后须同步 bump 重传，否则后续设计稿仍会按旧锚点产出
- `--shadow-*` token 尚不存在，引入须遵守 [[CLAUDE#§4.1]] CSS 必须用 token

### 不决策的代价
- C 类区无法用设计稿的「抬起 / elevation」语言统一，视觉割裂持续
- 每次吸收设计稿都要在「贴稿」与「守 §8.2」间往复反转（ADR-018 已反转两次），决策成本累积

## 4. Options Considered

### Option A: 全面推翻 —— elevation + 放弃颜色本体论
- **描述**：启用 box-shadow elevation，**并**放弃/弱化 §2.4.1 颜色本体论（Modifier chips 转中性、协议角标转中性/黑），全面对齐 Promptscape。
- **优点**：
  - 与设计稿观感最接近，C 类区有稿可依
  - 一次性消除大部分 B 类差异
- **缺点**：
  - **触动 constitution B2** = 须 omar 先人主笔改宪法 + 改 spec 哲学，AI 不能起草，链条最长
  - 丢失「紫=协议 / 绿=任务」一眼区分，削弱 B2 物理分离的用户可感知性
  - 违 spec「信息密度 > 视觉舒服」哲学
  - 全站组件 CSS + tokens + design-spec §2/§8/§10 + CLAUDE-DESIGN 全部重写
- **预估成本**：最高——含宪法/哲学修订（人主笔）+ 6 章 design-spec + 8-15 组件 CSS

### Option B: 只解锁 elevation，保留颜色本体论（AI 起草建议）
- **描述**：定义 `--shadow-*` token，开放 **subtle** box-shadow（限 card / banner / overlay 的 hover 与抬起态）；§2.4.1 三色本体论与 [[02-constitution#B2]] **不动**。
- **优点**：
  - 拿到设计稿「抬起感」这一**主要**视觉收益（B 类 #6 + C 类割裂的核心）
  - **不碰 constitution**——无需人主笔改宪法，ADR-019 自身（共创/人审）即可推进
  - 颜色区分（协议/任务）完整保留，B2 不受损
  - 改面显著小于 A：design-spec §8.2 + §10.1 + tokens + 组件 hover
- **缺点**：
  - 仍与设计稿的中性配色不同（Modifier 仍紫、角标仍语义色）——B 类 #4/#7/#8 保留为「有意偏离」
  - 推翻 §8.2「box-shadow」hard exclusion，「Bloomberg-flat」调性弱化（但 Linear typography / 密度仍在）
- **预估成本**：中——design-spec 部分章节 bump + tokens 加 shadow + 卡片/banner/overlay 组件 CSS

### Option C: 不推翻 —— 维持 flat + 本体论，C 类区只做 primitives 统一
- **描述**：保留 ADR-012 全部底线，C 类区割裂改用「复用 RegionHeader / CardSurface / Button / badge 等已有 primitives」消除（先前方案 1）。
- **优点**：零违宪、零文档 bump、最快、不动任何锚点
- **缺点**：实现与 Promptscape 的 elevation 观感差距保留，用户感知的「不一样」中属于 flat 的那部分不消除
- **预估成本**：最低——仅 3 组件 + 各自 CSS（复用现有 primitives）

## 5. Decision

> **一句话拍板**：_待 omar 拍板_。AI 起草建议 **Option B**——以 `--shadow-*` token 解锁 subtle elevation 拿回主要视觉收益，同时**不动** colour ontology 与 constitution B2，避免为次要的「配色贴稿」付出改宪法 + 丢协议/任务区分的最高代价。

**为什么建议 B 而非其他**：
- **不建议 A**：颜色本体论是 [[02-constitution#B2]] 物理分离的视觉载体，放弃它伤的是「一眼区分协议/任务」的产品核心能力，且须 omar 人主笔改宪法 + 改 spec 哲学——代价与「换了产品」的不可逆风险远超「配色更像设计稿」的收益。Promptscape 把 Modifier 画成中性，是它作为通用 shadcn 原型**不懂本项目本体论**的结果，不应反向同化项目。
- **不建议 C**：C 虽零成本，但用户已明确要 elevation 观感；纯 primitives 统一解决不了「flat 缺抬起感」这一主诉求。
- **B 是收益/代价拐点**：elevation 是 B 类与 C 类割裂的最大视觉公约数，且不越 constitution 红线。

**若 omar 坚持 Option A**：本 ADR **挂起（保持 Proposed）**，先由 omar 人主笔完成 ① [[02-constitution#B2]] + 反设计清单修订 ② [[01-spec]] 哲学修订，二者 ratified 后再回到本 ADR 补 colour-ontology 推翻条款。AI 不得代为起草 constitution / spec。

## 6. Consequences

### 正向后果（以 B 为基准）
- 拿回 elevation 视觉收益，C 类区（banner / 卡片 / overlay）可用统一抬起语言收口割裂
- 设计稿吸收的往复反转减少：§8.2 不再与设计稿的 shadow 直接对撞
- `--shadow-*` 进 tokens.css 单一真源，后续组件有据可依

### 反向后果
- [[012-lock-visual-quality-anchor]] 被 `Superseded`（Accepted 后）
- [[05-design-spec]] §8.2 撤 box-shadow 禁项、§10.1 hover「NO shadow」改写、§8.1 优先级措辞复核 → bump major
- [[CLAUDE-DESIGN]] sticky context 须同步移除「No box-shadow」hard exclusion 并 bump 重传 Claude Design，否则后续 design task 仍按旧锚点产出
- 新增 `--shadow-*` token 的维护与暗色模式适配（阴影在 dark canvas 上需重新调参）
- 全站卡片 / banner / overlay 的 hover / 抬起态 CSS 改写

### 未来反悔成本
- **代码改造规模**：撤回 elevation = 再次全站卡片/banner/overlay CSS 改 + design-spec 再 bump + tokens 删 shadow（约 8-15 组件 + 6 章中相关节）
- **数据迁移**：无（视觉决策不涉及数据）
- **学习成本**：AI / 团队心智锚从「Bloomberg-flat」改为「Linear typography + subtle elevation」
- **不可逆点**：
  - 用户上线后形成「有阴影」视觉印象，二次撤销 = 「换了产品」
  - （仅 Option A）颜色本体论一旦放弃、用户习惯中性配色后，协议/任务的视觉区分无法仅靠改 CSS 找回
- **前置依赖（Option A 专属）**：constitution B2 + 反设计清单（🧑 人主笔）、spec 哲学（🧑 人主笔）须先 ratified——这是 A 的硬门槛，B 无此依赖

---

## 反模式（写完自检）
- ✅ Options 3 个（A 全面推翻 / B 仅 elevation / C 不推翻），覆盖「动宪法 / 不动宪法 / 不动锚点」三档
- ✅ Decision 一句话建议 + 为什么不选其他；最终拍板显式留给 omar（决策者一致性）
- ✅ Consequences 含「未来反悔成本」与「不可逆点」，并区分 A/B 的前置依赖
- ✅ 如实标注：本 ADR 由 AI 起草，触动 constitution 的分支须人主笔（守 [[CLAUDE#§5.2]]）
- ✅ 现阶段不修改 ADR-012 原文（Superseded 待本 ADR Accepted 后才标）

## 相关链接
- **触发本决策的文档**：[[018-absorb-promptscape-design]]（Promptscape 吸收）/ 本会话三类差异诊断
- **被本决策影响的文档**：[[012-lock-visual-quality-anchor]]（superseded）/ [[05-design-spec]]（§2/§8/§10 bump）/ [[CLAUDE-DESIGN]]（hard exclusion 同步）/ `src/styles/tokens.css`（shadow token）
- **前置 / 关联 ADR**：[[012-lock-visual-quality-anchor]]（被推翻，其 Option E 即本 ADR 范畴）/ [[018-absorb-promptscape-design]]（吸收来源）
- **人主笔前置（仅 Option A）**：[[02-constitution#B2]] + 反设计清单 / [[01-spec]] 哲学
