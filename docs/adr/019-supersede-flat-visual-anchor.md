---
type: adr
project: prompt-hub
id: ADR-019
status: Proposed
date: 2026-06-25
description: 推翻 ADR-012 的「反 polish / flat」视觉锚点，引入 elevation（box-shadow）并重审颜色本体论强度，以贴近 Promptscape 设计稿观感；启用 ADR-012 当年明示排除的 Option E。本 ADR 由 AI 起草待 omar 人审。关键校正：颜色本体论与反阴影底线实际住在 design-spec §2.4.1/§8.2（🤝 AI 可起草层），constitution B2 只管结构分离不管颜色——故 Option A（含放弃颜色本体论）无须人主笔改宪法，无人主笔门槛。
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
  - [[05-design-spec#§2.4.1]] Ontology 三色 —— 仅「弱化本体论」分支涉及；颜色本体论的唯一归属，改它属 🤝 AI 可起草层
  - [[02-constitution#B2]] —— **不涉及**：B2 只管结构分离（AlignmentPhrase 不入 SOP / Macro 不展示 AlignmentPhrase），不约束颜色，放弃颜色本体论不触动 B2
  - [[01-spec]] 九条哲学 —— 仅作软性参照（「认知缓冲 > polish」「信息密度 > 视觉舒服」），无字面「反 polish / 反阴影」条款，不构成人主笔门槛
  - `src/styles/tokens.css` —— 新增 `--shadow-*` token
  - 全站组件 CSS（卡片 / banner / overlay 的 hover / 抬起态）

## 2. Status

`Accepted`（2026-06-26，omar 拍板 **Option A**——全面推翻 flat 锚点：引入 elevation + 放弃颜色本体论，全面对齐 Promptscape）

> 已生效：① 本字段 Accepted；② [[012-lock-visual-quality-anchor]] Status 改 `Superseded by ADR-019`；③ 关键校正：颜色本体论与反阴影底线住 design-spec §2.4.1/§8.2（🤝 AI 可起草层），constitution B2 只管结构分离不管颜色——本 ADR 全程无 🧑 人主笔门槛。

## 3. Context

### 触发事件
[[018-absorb-promptscape-design]] 吸收 Promptscape 全景仪表盘设计稿后，实现与设计稿反复「不一样」。本会话逐块比对诊断，差异分三类：

- **A 类·翻译损耗**（1 处）：Scene header meta 缺 `desc · N 个 Composition`（数据模型缺字段，与本 ADR 无关）
- **B 类·铁律保护**（8 处）：任务层胶囊配色、Macro 图标盒、box-shadow 抬起、Modifier/Recent 角标语义色等，由 [[05-design-spec#§8.2]]（无阴影）+ [[05-design-spec#§2.4.1]]（颜色本体论）锁定
- **C 类·设计稿未覆盖**（4 区）：UpdaterBanner / SopProgress / DraftInbox / 各资产编辑态——Promptscape 是只读演示原型，未画这些真实功能，导致它们视觉语言各自为政、气质割裂

omar 判断要让实现贴近设计稿观感（带 elevation 的「抬起感」、可能更中性的配色），这要求推翻 ADR-012 §8.2 的反阴影底线——正是 ADR-012 §4 当年 **Option E（明示排除）** 的内容。

- **ADR-012 §4 Option E + §6 相关链接**确曾写「推翻反 polish 哲学须先改 [[02-constitution]] 与 [[01-spec]]」——但**核对原文后此表述不精确**：
  - [[02-constitution#B2]]（`02-constitution.md:54`）证伪项纯结构（AlignmentPhrase 不参与拼接 / 不入 SOP / 不与 Macro 互转 / 不归属 Scene），**不约束颜色**；紫=协议/绿=任务的颜色本体论不是 B2 的内容
  - 颜色本体论的唯一规范归属是 [[05-design-spec#§2.4.1]]；反阴影底线住在 [[05-design-spec#§8.2]]——二者皆 design-spec，属 🤝 共创 / AI 可起草层（[[CLAUDE#§5.2]]）
  - [[01-spec]] 九条哲学只有「认知缓冲 > polish」「信息密度 > 视觉舒服」的软性表述，**无字面「反 polish / 反阴影」硬条款**
- **结论**：推翻 flat 锚点（含 Option A 放弃颜色本体论）只需改 design-spec + tokens + 组件 CSS，**无须人主笔改 constitution / spec，无 🧑 人主笔门槛**——ADR-012 当年把门槛挂到宪法上是过度保守的表述
- 须保留的产品语义：颜色本体论（紫=协议 / 绿=任务）虽非宪法条款，仍是用户「一眼区分协议资产与任务资产」的主要手段，放弃它是产品手感取舍（见 §4 Option A 缺点），不是合规问题

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
  - 丢失「紫=协议 / 绿=任务」一眼区分——颜色本是 [[02-constitution#B2]] 物理分离的一条视觉冗余编码，放弃后协议/任务区分只剩 ProtocolBand 位置维度（[[05-design-spec#§2.3]] 多维冗余降一维）
  - 与 spec 软性哲学「信息密度 > 视觉舒服」气质有距离（非硬条款，属手感取舍）
  - 全站组件 CSS + tokens + design-spec §2/§8/§10 + CLAUDE-DESIGN 全部重写，改面最大
- **预估成本**：最高——6 章 design-spec（§2.4.1 颜色本体论也要改）+ 8-15 组件 CSS；**但无宪法/spec 人主笔门槛**（颜色本体论住 design-spec，AI 可起草人审）

### Option B: 只解锁 elevation，保留颜色本体论（AI 起草建议）
- **描述**：定义 `--shadow-*` token，开放 **subtle** box-shadow（限 card / banner / overlay 的 hover 与抬起态）；§2.4.1 三色本体论与 [[02-constitution#B2]] **不动**。
- **优点**：
  - 拿到设计稿「抬起感」这一**主要**视觉收益（B 类 #6 + C 类割裂的核心）
  - 颜色区分（协议/任务）完整保留，多维冗余编码不降维
  - 改面显著小于 A：只动 design-spec §8.2 + §10.1 + tokens + 组件 hover，§2.4.1 颜色本体论不动
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

> **一句话拍板**：omar 拍板 **Option A**（2026-06-26）——全面对齐设计稿：引入 elevation + 放弃颜色本体论，协议/任务区分改靠 ProtocolBand 位置维度 + 形状冗余编码。AI 起草时曾建议 Option B（只解锁 elevation、保颜色本体论），保留如下供追溯——**关键校正：A 与 B 的合规成本相同，均无人主笔门槛**，二者差异纯属产品手感（要不要保颜色冗余编码），不是「改宪法 vs 不改宪法」。omar 取 A 是接受「中性配色 + 一眼区分降一维」的产品手感取舍。

**AI 起草时建议 B 的理由（保留供权衡）**：
- **A 的代价**：放弃颜色本体论伤的是「一眼区分协议/任务」的产品可感知性——颜色是 [[02-constitution#B2]] 物理分离的一条视觉冗余编码（非宪法条款本身），放弃后只剩 ProtocolBand 位置维度。Promptscape 把 Modifier 画成中性，是它作为通用 shadcn 原型**不懂本项目本体论**的结果，不必反向同化项目。**注意：此为产品手感论点，非合规门槛**——颜色本体论住 [[05-design-spec#§2.4.1]]，改它 AI 可起草人审。
- **不建议 C**：C 虽零成本，但 omar 已明确要 elevation 观感；纯 primitives 统一解决不了「flat 缺抬起感」这一主诉求。
- **B 是收益/代价拐点**：elevation 是 B 类与 C 类割裂的最大视觉公约数，拿回主要视觉收益且保留颜色区分。

**若 omar 拍 Option A**：本 ADR 直接补 colour-ontology 推翻条款 → Accepted，**无前置人主笔依赖**。AI 可起草 [[05-design-spec#§2.4.1]] 颜色本体论降级 + §8.2/§10.1 阴影解锁的修订草案，走 🤝 共创人审。constitution / spec 不需改动。

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
- **前置依赖**：无人主笔前置——A 与 B 均只需改 design-spec（🤝 AI 可起草人审）+ tokens + 组件 CSS，constitution / spec 不触动。A 比 B 多改 §2.4.1 颜色本体论一节，仅工作量差异，非合规门槛差异

---

## 反模式（写完自检）
- ✅ Options 3 个（A 全面推翻 / B 仅 elevation / C 不推翻），覆盖「弃颜色本体论 / 保本体论 / 不动锚点」三档
- ✅ Decision 一句话拍板（omar 倾向 A）+ 为什么不选其他；保留 AI 起草时的 B 建议供权衡
- ✅ Consequences 含「未来反悔成本」与「不可逆点」；已校正：A/B 均无人主笔前置依赖
- ✅ 关键校正：颜色本体论住 [[05-design-spec#§2.4.1]]、反阴影住 §8.2，皆 🤝 AI 可起草层；constitution B2 只管结构分离不管颜色——本 ADR 全程无 🧑 人主笔门槛（守 [[CLAUDE#§5.2]]）
- ✅ 现阶段不修改 ADR-012 原文（Superseded 待本 ADR Accepted 后才标）

## 相关链接
- **触发本决策的文档**：[[018-absorb-promptscape-design]]（Promptscape 吸收）/ 本会话三类差异诊断
- **被本决策影响的文档**：[[012-lock-visual-quality-anchor]]（superseded）/ [[05-design-spec]]（§2/§8/§10 bump）/ [[CLAUDE-DESIGN]]（hard exclusion 同步）/ `src/styles/tokens.css`（shadow token）
- **前置 / 关联 ADR**：[[012-lock-visual-quality-anchor]]（被推翻，其 Option E 即本 ADR 范畴；其 §4/§6 把门槛挂宪法的表述经本 ADR 校正为 design-spec 层）/ [[018-absorb-promptscape-design]]（吸收来源）
- **人主笔前置**：无——颜色本体论与反阴影底线均在 [[05-design-spec]]（🤝 共创/AI 可起草），constitution / spec 不触动
