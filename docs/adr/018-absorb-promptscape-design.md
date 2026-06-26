---
type: adr
project: prompt-hub
id: ADR-018
status: Accepted
date: 2026-06-25
description: 把 Claude Design「Promptscape 全景仪表盘」设计稿按组合 A1+B1+C1+D+E 吸收进现有 Dashboard——改造现有组件而非另起平行实现，保留项目 protocol/task 语义色，不引入 Modifier 右栏，接入既有 store，保留 prompt-hub 名 + 去头像；三处放大决策：任务层 3→2 列、新增 slim Header、省略全局「新建」按钮。新增中性强调色 + 主题三态外观系统。作为本次 5 份文档涟漪的共同上游锚点
related:
  - 03-product-spec
  - 05-design-spec
  - 07-features
  - 012-lock-visual-quality-anchor
  - 013-alignment-phrases-tab-inclusion
  - 016-choose-dnd-and-resizable-layout
  - 017-enable-auto-update
  - 02-constitution
  - CLAUDE-DESIGN
  - CLAUDE
---

# ADR-018: 吸收 Promptscape 设计稿（组合 A1+B1+C1+D+E）

> **铁律自检**：吸收策略主决策列 Options ≥2；Decision 一句话；Consequences 含未来反悔成本。三处放大决策（D1 列数 / D2 Header / D3 新建按钮）作为子项各记一句拍板。

## 1. 标题与日期

- **标题**：以「改造现有组件」方式吸收 Claude Design「Promptscape 全景仪表盘」设计稿约 90% 视觉收益，组合锁定 **A1+B1+C1+D+E**
- **日期**：2026-06-25
- **决策者**：omar
- **影响范围**：[[03-product-spec]] §13 区域结构（+Header region / +Settings 弹窗 / 任务层 2 列）/ [[05-design-spec]] §2.4-2.5 颜色与主题 token（+accent 族 / +scrim / theme 三态）/ [[07-features]] §3.4 配置个性化 / [[016-choose-dnd-and-resizable-layout]]（resizable group 由 3 列降为 2 列，id 改 `panorama-2col`）/ [[02-constitution#B2]] 物理分离复检（强调色只染中性面）

## 2. Status

`Accepted`（2026-06-25，omar 人审通过组合方案后授权实施）

> 实施已落地并全绿：`pnpm build` ✓ / `pnpm test` 97/97 ✓ / `lint` ✓ / `prettier --check` ✓（后端 Rust 未动）。本 ADR 与代码改动 + 5 份文档涟漪同批。

## 3. Context

### 触发事件
Claude Design（claude.ai/design）产出「Promptscape 全景仪表盘」设计稿，视觉气质（slim Header、协议层暗色 band、紧凑任务层全景、设置弹窗、主题/强调色个性化）显著优于现状。需决定**如何吸收**：是照搬另起一套实现，还是改造现有组件择优吸收。设计稿与项目语义存在张力——稿中带账号头像、Modifier 右栏、改名 Promptscape，均与项目约束冲突，不能整稿吞下。

### 业务约束
- [[02-constitution#B2]] 物理分离：协议层（AlignmentPhrase/Phase）与任务层（Macro/Scene）语义色不得交叉污染；任何新增「强调色」开关只能染**中性强调面**（品牌标记 / 主操作 / 焦点环），绝不可重染 protocol/task 层
- [[02-constitution#B1]] 三层资产封顶：不得借设计稿引入第 4 层资产或把 Modifier 提升为常驻右栏
- [[012-lock-visual-quality-anchor]] Linear 气质：吸收须克制，不引入花哨动画（≤200ms）
- spec §8.2 单用户无账号：设计稿的头像区无依托，须去除
- 项目定位保留 `prompt-hub` 名，不改名 Promptscape

### 技术约束
- [[016-choose-dnd-and-resizable-layout]] 既有 react-resizable-panels 三列布局已持久化在 localStorage；改列数须迁移（bump group id 丢弃旧布局）
- [[017-enable-auto-update]] updaterStore 已是 opt-in 出站总开关；设置弹窗「更新」页只能复用既有状态机，不得新造 channel 概念
- [[009-choose-styling]] CSS Modules + token gate：所有新视觉值须落 tokens.css（accent/scrim/宽度），组件 CSS 零裸值

### 不决策的代价
- 设计稿停在 Figma，视觉收益无法兑现；或 AI 随手照搬导致语义色污染 / 改名 / 多出 Modifier 栏，破坏 B1/B2 铁律返工

## 4. Options Considered（≥2 个）

### Option 甲：整稿照搬，另起 Promptscape 平行实现 ← 不选
- **描述**：按设计稿 1:1 新建一套组件树（含头像、Modifier 右栏、改名）
- **优点**：视觉最贴稿；不受现有组件包袱牵制
- **缺点**：违反 B1（Modifier 右栏）/ B2（语义色）/ spec（账号、改名）；与现有 store/测试断层，维护两套；返工风险高
- **预估成本**：高

### Option 乙：组合 A1+B1+C1+D+E，改造现有组件择优吸收 ← 选
- **描述**：保留项目语义（A1 紫/绿语义色不动），不引入 Modifier 右栏（B1），改造现有组件而非平行新建（C1），接入既有 store（D），保留 prompt-hub 名 + 去头像（E）。在此约束下吸收 slim Header、协议层 band、任务层全景、设置弹窗、主题/强调色
- **优点**：守住全部铁律；复用现有 store/测试，零数据迁移（仅 localStorage 布局 key 迁移）；约 90% 视觉收益
- **缺点**：与稿有可见偏离（无头像 / 无 Modifier 右栏 / 无全局新建按钮）；需逐组件改造而非一次性生成
- **预估成本**：中（本次已落地）

### Option 丙：只取配色/间距 token，不动结构
- **描述**：仅吸收视觉 token，布局结构保持现状
- **优点**：改动最小、最安全
- **缺点**：放弃设计稿主要价值（Header/band/全景/设置弹窗），收益<30%
- **预估成本**：低但收益低

## 5. Decision

> **一句话拍板**：选 **Option 乙（组合 A1+B1+C1+D+E）**，理由是它在不破任何 constitution 铁律的前提下，用「改造现有组件 + 接既有 store」拿到约 90% 视觉收益且零数据迁移。

三处放大决策（实施期子项，omar 当场拍板）：
- **D1 任务层列数**：3 列 → **2 列**（task | aside）。理由：设计稿任务层是双栏全景；resizable group id 改 `panorama-2col` 以丢弃旧三列布局缓存。触及 [[016-choose-dnd-and-resizable-layout]]，以本 ADR 补遗记录，不另开 ADR。
- **D2 Header**：**新增** slim Header（logo + 标题 + 内嵌搜索 + gear），去设计稿头像，保留 prompt-hub 名。
- **D3 全局「新建」按钮**：**省略**。理由：各资产区已有就地新建入口，全局按钮会成死按钮。

**为什么不选其他**：
- 不选甲：整稿照搬必然引入 Modifier 右栏 / 头像 / 改名，直接撞 B1/B2/spec，且维护两套
- 不选丙：放弃设计稿主体价值，收益不足以兑现这次吸收

## 6. Consequences

### 正向后果
- 兑现 Promptscape 视觉气质：slim Header / 协议层暗色 band / 任务层双栏全景 / 设置弹窗 / 主题三态 + 5 色中性强调色
- 新增外观个性化能力（settingsStore：themeMode `light|dark|system` + accent `neutral|blue|green|violet|amber`，persist localStorage，A2 不出站）
- 复用 updaterStore，把「检查更新」从 StatusBar 临时入口升级为设置弹窗常驻页
- 全部新视觉值落 tokens.css（`--accent-swatch-*` / `--accent` / `--scrim` / `--w-settings-*` / `--h-macro-strip` / `--col-min-*`），token gate 通过

### 反向后果
- 与设计稿三处可见偏离（无头像 / 无 Modifier 右栏 / 无全局新建按钮）——已在本 ADR 显式记录，非缺陷
- 强调色系统新增一类「中性强调面」概念，后续任何上色须复检 B2，防止强调色泄漏到 protocol/task 层
- 任务层降为 2 列后，原三列各自承载的内容需重新分配（Macro 收为顶部紧凑横条 / aside 承载 Recent + SOP）

### 未来反悔成本
- **代码改造规模**：Header/ProtocolBand/SettingsModal 3 个新组件 + 约 7 个既有组件 CSS/TSX 调整；回退即删 3 组件 + 还原列数
- **数据迁移**：无 schema 变更；仅 localStorage 布局 key（`panorama-2col`）与外观偏好 key（`prompt-hub-settings`）丢失时回落默认，无损
- **学习成本**：无新技术栈
- **不可逆点**：无——纯前端工程，可干净还原

---

## 反模式（写完自检）

- ✅ 吸收策略主决策 Options 3 个（甲/乙/丙）
- ✅ Decision 一句话拍板 + 三处放大决策各一句 + 为什么不选其他
- ✅ Consequences 含未来反悔成本 + 三处偏离显式记录
- ✅ 触及 ADR-016 不就地改其原文，以本 ADR 补遗 + ADR-016 加指回备注

## 补遗-1（2026-06-25，omar 指示 · 三项提高保真度，待人审）

> **状态**：代码已落地全绿（`pnpm test` 98/98 ✓ / `build` ✓ / `lint` ✓ / `prettier` ✓，后端 Rust 未动）。本补遗为 AI 起草，**反转本 ADR §5/§6 的两项原决策**，须 omar 人审追认后方可视为 ratified。

omar 复审设计稿后指示「Scene 区和右栏 aside、配色都调整一致」，三项落地：

- **R1 默认配色 暗 → 浅**：`settingsStore.themeMode` 默认 `system` → `light`，以浅色为参考外观（暗色仍为用户可选模式）。**反转**原「暗色 token 为基础」基调（§6 正向后果第 1 项 + design-spec v0.11 §2.5）。现有 light token 偏暖灰，与设计稿纯中性灰存在细微色相差，**未**重绘 token（保留既有 light 调色板），如需精确对齐 shadcn 中性灰另议。
- **R2 补回 Modifier 右栏（aside 原子库）**：新增 `ModifierGrid`（紧凑 chip 卡，按 4 象限 groupKind 分组，click-to-copy），插入 aside 顶部。**反转**本 ADR Option 乙的 E「不引入 Modifier 右栏」+ §6 反向后果第 1 项。
  - **B2 复检通过**：Modifier 按 tokens.css 本就属 `--protocol` 色系，chip 用 `layer="protocol"`；不染 task 面，不与 AlignmentPhrase/SOP 混置（仅展示 Modifier 自身），不违反物理分离。
  - **B1 复检通过**：未引入第 4 层资产，Modifier 仍是三层资产之一，仅新增其展示位。
  - **取舍**：该块为「展示型」区块，**不进 §13.4 Tab 工作区循环**（无 `data-region` / 无 region `tabIndex`），故不改 product-spec §13.4 区域序列、不破 App.test.tsx 8 区断言；chip 本身是 button 仍可逐个 Tab 到。
  - **数据模型约束**：`UsageSource` 无 `modifier` 值，Modifier 复制走 clipboard 直拷、**不记 usage**（不进 Recent / 不累加 usageCount）。加 `modifier` source 属后端改动，未授权不做——属忠实适配（同 Scene 无 desc 字段）。
- **R3 Scene 子阶段补 idx 编号**：Scene 只读视图每列子阶段头补 `01/02…` 序号（mono），贴近设计稿。Scene 区本就是多列 grid（auto-fill），**未**改为固定 4 列（窄列下 auto-fill 更稳健）。属纯布局，不触铁律。

**待人审决策点**：R1（默认翻浅）+ R2（补 Modifier 右栏）实质反转本 ADR 原决策，omar 追认后应回流 design-spec（§2.5 默认模式 + §10.8 新增 ModifierGrid 行）/ product-spec（§13.3 aside 区域补 Modifier 块）/ features，并校正本 ADR §6 正反向后果。

## 相关链接

- **触发本决策的文档**：[[CLAUDE-DESIGN]]（Promptscape 设计稿来源）/ [[CLAUDE#§6]] 忌讳清单（B1/B2 自检）
- **被本决策影响的文档**：[[03-product-spec]] §13（bump v0.10）/ [[05-design-spec]] §2.4-2.5/§10.3/§13.1（bump v0.11）/ [[07-features]] §3.4 / [[016-choose-dnd-and-resizable-layout]]（3→2 列补遗备注）
- **相关 ADR**：[[012-lock-visual-quality-anchor]]（Linear 气质上游）/ [[013-alignment-phrases-tab-inclusion]]（协议层 region 谱系）/ [[016-choose-dnd-and-resizable-layout]]（列数前置）/ [[017-enable-auto-update]]（设置弹窗更新页复用 updaterStore）
