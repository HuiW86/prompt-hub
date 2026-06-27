---
type: design-spec
project: prompt-hub
version: v0.12
created: 2026-05-18
last_modified: 2026-06-26
status: ratified  # 🤝 共创，v0.10 UI 一致性治理 omar 人审通过（2026-06-21）；v0.11 ADR-018 涟漪待人审；v0.12 ADR-019 推翻 flat 锚点（omar 拍板 Option A）待人审
author: co  # 🤝 人机共创（CLAUDE §5.2）
related: [[01-spec]], [[02-constitution]], [[03-product-spec]], [[012-lock-visual-quality-anchor]], [[019-supersede-flat-visual-anchor]], [[CLAUDE-DESIGN]], [[015-expose-mcp-write-pipeline]], [[016-choose-dnd-and-resizable-layout]], [[018-absorb-promptscape-design]], [[asset-editing-and-adaptive-layout]]
description: 手动 AI 编程仪表盘的视觉规范——token 命名与 tokens.css 单一真源对齐（--t-/--s-/ontology + neutral scale），WCAG light 实测 + dark v1.0 实装；v0.7 加 §8-§13 bundle 派生 6 章；v0.8 涟漪 ADR-015 加 §10.4 MCP write pipeline 组件视觉；v0.9 涟漪 ADR-016 加 §10.5 全景区可拖列布局 + PanoramaSeparator；v0.10 UI 一致性治理：§2.2 圆角归一 + §10.2 primitive 清单 + §10.6 Card vs List 矩阵 + §10.7 Button 矩阵 + §11 flash keyframes；v0.11 涟漪 ADR-018 Promptscape 吸收：§2.4.4 中性强调色 + scrim token / §2.5 主题三态 / §10.3+§10.8 Header·ProtocolBand·SettingsModal / §13.1 中性强调非第四语义层；**v0.12 ⚠️ 重大涟漪 ADR-019 推翻 flat 锚点**：§8.1 锚点改 Linear typography + subtle elevation / §8.2 撤 box-shadow 禁项 + 加 elevation 允许范围 / §10.1 hover 允许 subtle shadow / §2.4.1 颜色本体论降「视觉选择级」转中性 / §5 反设计撤反阴影 + 颜色冗余编码改靠位置+形状 / §13.1 解除「跨层=违宪」措辞（颜色非 B2 强制）
---

# Design Spec: prompt-hub（视觉规范）

> 本文件是 `prompt-hub-prd.md` 拆分版的 **design-spec.md**——承载视觉规范。
> 项目定位见 [[01-spec]]、UI 契约见 [[03-product-spec]]、视觉锚点见 [[012-lock-visual-quality-anchor]]、Claude Design sticky context 见 [[CLAUDE-DESIGN]]。
>
> 本文件来源：原 PRD §4.3「视觉设计原则」的视觉 Token 部分 + §13 UI 草案的颜色编码。
> 原 §4.3 中的「交互频率与路径」表（属行为契约）已迁至 [[03-product-spec#4.3-交互频率与路径-行为契约]]。

---

## 1. 设计原则总述

**真实仪表盘对应物**：汽车仪表盘的字体和图标都比普通显示器大，颜色对比度更高——因为驾驶员是扫视，不是阅读。

**核心决策**：UI 参数比常规网页放大一档，针对"扫视为主、阅读为辅"场景优化。

不论主形态还是辅形态，使用者都需要在 **1 秒内识别屏幕上的关键资产**——这是哲学二（看见全局 > 操作最快）的视觉落地。常规网页 UI（字号 14px、对比度 4.5:1、点击热区 32px）在这种场景下都会让使用者吃力。

---

## 2. 视觉 Token

### 2.1 字号 Token

> 设计原则：bundle 派生（ADR-012）— 字号 token 以 px 数值命名（`--t-{N}`），与 `src/styles/tokens.css` 单一真源对齐。扫视优先场景需要少量但精确的字号层级，5 档主 grid + 2 档 sub-grid 覆盖全部 UI 用途。
>
> 命名约定：`--t-{px数值}`。所有 UI 字号必须引用 token，禁止使用裸 px 值。

| Token | 值 | rem | 用途映射 |
|------|-----|-----|---------|
| `--t-10` | 10px | 0.625rem | num badge（sub-grid，仅在 bundle 显式调用时用）|
| `--t-11` | 11px | 0.6875rem | meta key / count badge / kbd-sm（sub-grid）|
| `--t-12` | 12px | 0.75rem | 元数据（使用次数 / 时间）/ kbd / empty hint |
| `--t-13` | 13px | 0.8125rem | body 默认 / Phrase 卡片 / Phase 名 / Tab 标签 |
| `--t-14` | 14px | 0.875rem | region header / card title（500-600 加粗）|
| `--t-16` | 16px | 1rem | strong title / 大字号 body |
| `--t-20` | 20px | 1.25rem | 卡片标题强调（PhaseBar / hero）|

**字重约定**：`--w-400`（默认）/ `--w-500`（card title）/ `--w-600`（region header / strong）。

**行高**：`--lh-tight: 1.2`（标题）/ `--lh-body: 1.45`（body）。

**字间距**（tracking）：`--tr-tight: -0.01em`（region header）/ `--tr-normal: 0em`（body）/ `--tr-meta: 0.08em`（uppercase meta labels — region count / key labels）。

**字体族**：`--font-sans` Geist Variable / `--font-mono` Geist Mono Variable（self-hosted webfonts，见 `src/assets/fonts/`，ADR-012 Phase 1 引入）。

### 2.2 间距与热区 Token

> 设计原则：4px 基准网格（bundle 收敛自原 4px grid）。主 grid (`--s-N`) 表示 4×N 倍数；sub-grid (`--s-N_M`) 表示 4×N.M 倍数（off-grid 子层），仅在 bundle 视觉调用时使用。
>
> 命名约定：`--s-{N}` 主 grid（N 为 4px 倍数）；`--s-{N_M}` sub-grid（N.M 为 4px 倍数，下划线代替小数点）。

**主 grid token**：

| Token | 值 | 用途映射 |
|------|-----|---------|
| `--s-1` | 4px | 进度条高度 / 极紧凑分隔 |
| `--s-2` | 8px | chip 内边距垂直 / 紧凑组件 |
| `--s-3` | 12px | 卡片间距（默认）/ overlay frame inset |
| `--s-4` | 16px | 卡片内边距 / 模块内分隔 |
| `--s-5` | 20px | 中等模块间隔 |
| `--s-6` | 24px | 模块间隔 |
| `--s-8` | 32px | 大模块间隔 |
| `--s-10` | 40px | overlay 大区段 |
| `--s-12` | 48px | 卡片最小高度 |
| `--s-20` | 80px | 旧相位带高度（v0.7 起非默认，见 §6）|

**sub-grid token（bundle precision tier）**：

| Token | 值 | 用途映射 |
|------|-----|---------|
| `--s-0_5` | 2px | kbd badge vertical inset |
| `--s-1_25` | 5px | kbd badge horizontal inset |
| `--s-1_5` | 6px | chip gap / small dot diameter |
| `--s-2_25` | 9px | chip horizontal padding |
| `--s-2_5` | 10px | region-header inner gap |
| `--s-3_5` | 14px | region horizontal padding |

**何时用 main vs sub-tier 决策**：
- 默认用 main grid（4×n）
- sub-tier 仅在 bundle / Claude Design preview 显式调用且 main grid 解决不了视觉密度时使用
- 不要为了"凑接近值"用 sub-tier — 例如 11px 没有，请用 12px（main）而非新增 sub-tier
- 新增 sub-tier token 视为对 bundle 视觉锚点的扩展，需走方法论 §7 八步流程

**圆角 token**：`--r-1` 2px tags / `--r-2` 3px chips / `--r-3` 4px 默认 / `--r-4` 6px 外层卡片 / `--r-frame` 8px overlay frame only。functional surfaces 圆角 ≤ 6px（hard rule，见 §8.2）。

**surface → radius 归一表（v0.10 hard rule）**：圆角不靠"手感"，按 surface 类型查表。同类 surface 必须用同一档，杜绝 `--r-3`/`--r-4` 混用漂移。

| surface 类型 | radius | 代表组件 |
|------------|--------|---------|
| overlay frame（全屏唤起外框）| `--r-frame` 8px | 主形态 overlay 唯一例外（> 6px）|
| 外层卡片（card surface — 独立资产卡）| `--r-4` 6px | `MacroGrid` 卡 / `ModifierGrid` 卡 / `DraftCard` |
| 内嵌面板 / editor panel | `--r-3` 4px | `EditorPanel`（行内编辑壳）|
| 列表行 surface（list row）| `--r-3` 4px | `ScenePanel` row / `CompositionWorkbench` row / `DraftInbox` row（行整体可选圆角，hover/selected 时显）|
| chip | `--r-2` 3px | `AlignmentPhrases` chip |
| tag / tiny pill / kbd | `--r-1` 2px | `Kbd` badge / num tag |

> **v0.10 裁定**：卡片类 surface（Macro / Modifier / DraftCard）统一 `--r-4` 6px——此前 `MacroGrid`/`ModifierGrid` 用 `--r-3` 4px 与 §2.2「外层卡片 = `--r-4`」规则及 `DraftCard`（§10.4.3 已用 `--r-4`）不一致，本次归一。列表行 / editor panel 保持 `--r-3` 4px（非外层卡片，视觉层级低一档）。

**Border token**：`--hairline: 1px`（默认边框）/ `--border-thick: 2px`（focus outline only）。

#### 2.2.1 组件 anchor 高度

| Token | 值 | 用途 |
|------|-----|------|
| `--h-chip` | 24px | AlignmentPhrase chip / kbd badge tall |
| `--h-phasebar` | 44px | PhaseBar 整体高度 |
| `--h-phrases` | 44px | AlignmentPhrases 区域高度 |
| `--h-statusbar` | 28px | StatusBar 高度 |
| `--h-quickfind` | 36px | SearchBar 高度 |
| `--h-scene-row` | 32px | ScenePanel 行高 |
| `--h-region-header` | 40px | 共享 RegionHeader primitive 高度 |

#### 2.2.2 Opacity token

| Token | 值 | 用途 |
|------|-----|------|
| `--op-icon` | 0.7 | 默认 icon 透明度（lucide-react，§12）|
| `--op-dim` | 0.5 | dim 状态（次要 meta / disabled hint）|

#### 2.2.3 热区最小尺寸

任何可点击元素高度 ≥ 24px（`--h-chip`），符合扫视优先场景对热区敏感度要求。bundle 视觉语言下，密集 chip 行的 24px 高度 + 充分 padding + hover/focus 视觉反馈已足够；WCAG 2.5.5 AAA 48px 不再作硬约束，但**禁止 < 20px 的可点击区域**。

### 2.3 对比度（WCAG 实测）

**总原则**：
- **主文字 vs 背景**：目标 ≥ 7:1（WCAG AAA）
- **非文字元素**（边框 / 图标 / 控件）：≥ 3:1（WCAG 2.1 Non-text Contrast）
- **禁止依赖颜色单一维度传递信息** — 必须颜色 + 形状 + 位置多维度冗余编码（见 §2.4.3）

#### 2.3.1 Light mode 实测（2026-05-18，sRGB gamma 离线计算）

| # | 配色组合 | 前景 | 背景 | 实测 | WCAG 评级 | 状态 |
|---|---------|-----|------|------|----------|------|
| **主文字（`--fg-1` light = `#18181B`）** | | | | | | |
| 1 | 白底 + 主文字 | `#18181B` | `#FAFAF9` | **17.40:1**（约）| AAA ✓ | ✅ 达标 |
| 2 | 紫卡 + 主文字 | `#18181B` | rgba(83,74,183,0.08) on canvas | **~15:1** | AAA ✓ | ✅ 达标 |
| 3 | 绿卡 + 主文字 | `#18181B` | rgba(23,133,97,0.08) on canvas | **~15:1** | AAA ✓ | ✅ 达标 |
| 4 | 灰底 + 主文字 | `#18181B` | `#F2F2F0` | **~15:1** | AAA ✓ | ✅ 达标 |
| **彩色边框 / 强调** | | | | | | |
| 5 | 紫边框 vs canvas | `#534AB7` | `#FAFAF9` | **6.93:1** | AA Normal ✓ / AAA ✗ | ⚠️ 不达 AAA |
| 6 | ~~原绿边框 vs canvas~~ | ~~`#1D9E75`~~ | `#FAFAF9` | ~~3.39:1~~ | ~~AA Large~~ | ❌ 已弃用 |
| 7 | **新绿边框 vs canvas** | **`#178561`** | `#FAFAF9` | **4.60:1** | AA Normal ✓ | ✅ **采纳** |
| 8 | 灰边框 vs canvas | `#888780` | `#FAFAF9` | **3.61:1** | AA Large ✓ | ⚠️ 仅作边框，不可作文字 |

**结论**：
1. ✅ **任何文字必须用 neutral scale `--fg-1` ~ `--fg-4`**（light: `#18181B` ~ `#A5A5A8`；dark: `#ECECEE` ~ `#55555B`），不论卡片底色
2. ⚠️ **三色 ontology token（`--protocol` / `--task` / `--aux`）仅用于边框 / chip fill / icon semantic state，不可作正文文字**（filled 态下用配套 `-fg` token）
3. ✅ **绿值已修订** `#1D9E75` → `#178561`（2026-05-18 决策，达 Non-text 3:1）

#### 2.3.2 Dark mode 实测（待补 v0.7.1）

ADR-012 Phase 2 已实装 dark default + light @media override。Dark mode 实测对比度数据待 v0.7.1 补全，关键组合：

- `--fg-1` `#ECECEE` vs `--canvas` `#0E0E10`
- `--fg-2` `#B4B4B8` vs `--surface-1` `#141417`
- `--protocol` `#534AB7` vs `--canvas` `#0E0E10`
- `--task` `#178561` vs `--canvas` `#0E0E10`
- `--aux` `#888780` vs `--surface-2` `#1A1A1E`

**临时承诺**：dark mode 主文字对比度目标 ≥ 12:1；三色 ontology 边框对比度目标 ≥ 4.5:1（vs canvas）。如实测不达需调色。

#### 2.3.3 绿边框色修订决策（2026-05-18 已采纳候选 A）

| 候选 | 色值 | vs light bg ~`#FAFAF9` | 状态 |
|------|------|----------------------|------|
| 原值 | `#1D9E75` | 3.39:1 ⚠️ | ❌ 弃用 |
| **候选 A** | **`#178561`** | **4.60:1** ✓ AA Normal | ✅ **已采纳** |
| 候选 B | `#0E6F4F` | 6.17:1 ✓ AA | 未采纳（更深，色相偏离更大）|
| 候选 C | `#0B5A40` | 8.23:1 ✓ AAA | 未采纳（接近墨绿，失去任务层"鲜活"调性）|

> 实测修正说明（2026-05-18）：候选 A 4.60:1 满足 Non-text 3:1 + AA Normal 4.5:1（边框场景）；作绿底文字不达 AA Normal——已由 §2.4.1 显式约束「仅作边框」消除风险。

### 2.4 颜色 Token（CSS Variables）

> 设计原则：分两组 — **Ontology 三色**（carry meaning，每色绑定特定语义层，never decoratively）+ **Neutral scale**（chrome / borders / text，无语义负担）。
>
> 来源：`src/styles/tokens.css` 单一真源（ADR-012 Phase 2 落盘）。所有颜色必须引用 token，禁止使用裸 hex 值。

#### 2.4.1 Ontology 三色（视觉选择级 — 自 v0.12 降级，ADR-019 Option A）

> **⚠️ v0.12 重大变更（[[019-supersede-flat-visual-anchor]] Option A）**：颜色本体论从「hard rule / 违宪级」**降为视觉选择级**。omar 拍板放弃「紫=协议 / 绿=任务」的强制绑层语义，全面对齐 Promptscape 中性配色。
> - **关键澄清**：颜色本体论从来不是 [[02-constitution#B2]] 的内容——B2（`02-constitution.md:54`）只管**结构分离**（AlignmentPhrase 不参与拼接 / 不入 SOP / 不与 Macro 互转 / 不归属 Scene），证伪项纯结构、零颜色。「跨层用色 = 违宪」是 v0.7-v0.11 design-spec 自行拔高的措辞，v0.12 撤回。
> - **新基线**：资产区分**靠位置（ProtocolBand band / 区域归属）+ 形状（chip vs 卡片 vs 横条）冗余编码**，不再依赖颜色维度（见 §5 / §2.3）。
> - **色板去留**：下表三色 token **保留在 tokens.css**，但**不再强制绑层**——降为可选视觉强调，新组件**默认中性**（走 §2.4.4 `--accent` 中性强调体系）。Modifier chips / 协议角标转中性；既有 PhaseBar / Macro 选中态可保留或逐步转中性（组件层决定，见 §6 / §10.1）。

| Token | 值 | 角色 | 备注（v0.12 后）|
|-------|----|------|---------|
| `--protocol` | `#534AB7` | 协议层强调（紫，可选）| 不再强制绑协议层；保留供既有组件，新组件优先中性 |
| `--protocol-fg` | `#FFFFFF` | 紫底 fg | filled 态 |
| `--protocol-8` | `rgba(83, 74, 183, 0.08)` | active press fill | 可保留，亦可转中性 fill |
| `--protocol-16` | `rgba(83, 74, 183, 0.16)` | selected fill | 同上 |
| `--task` | `#178561` | 任务层强调（绿，可选）| 不再强制绑任务层；同上 |
| `--task-fg` | `#FFFFFF` | 绿底 fg | filled 态 |
| `--task-8` | `rgba(23, 133, 97, 0.08)` | active press fill | 同上 |
| `--task-16` | `rgba(23, 133, 97, 0.16)` | selected fill | 同上 |
| `--aux` | `#888780` | 辅助米灰 | meta text / count / timestamp（中性，不受本次变更影响）|

**v0.12 用色规则**（替代旧「三铁律」）：
1. 颜色**不再绑层**——不存在「跨层污染 = 违宪」。三色是可选强调，非强制语义载体
2. 颜色**仍不作装饰**（never bg-gradient / never accent-of-month / never decorative outline）——这条与反阴影/反渐变同源，是密度工具底线，不随本次降级松动
3. 颜色**不作正文文字**（filled 态用配套 `-fg`）— 用 `--fg-1` ~ `--fg-4` 替代
4. 新组件**默认中性强调**（§2.4.4 `--accent`）；协议/任务区分交给位置 + 形状（§5 多维冗余）

#### 2.4.2 Neutral scale（chrome / borders / text）

> 来源：tokens.css §1（dark default）+ §1a（light @media + `.light` class override）

**Dark mode（default）**：

| Token | 值 | 用途 |
|-------|----|------|
| `--canvas` | `#0E0E10` | 最底层 canvas（fullscreen overlay 背景）|
| `--surface-1` | `#141417` | 区域底（region card）|
| `--surface-2` | `#1A1A1E` | 卡片底（macro card / scene row）|
| `--surface-3` | `#232328` | 浮层底（dropdown / tooltip）|
| `--border-1` | `#232328` | 区域分隔 hairline |
| `--border-2` | `#2E2E34` | 卡片 hairline |
| `--border-3` | `#3A3A42` | hover/focus 边框 |
| `--fg-1` | `#ECECEE` | 主文字 |
| `--fg-2` | `#B4B4B8` | 次文字 |
| `--fg-3` | `#7E7E84` | 三级（meta）|
| `--fg-4` | `#55555B` | 占位 / disabled |
| `--skeleton` | `#1F1F23` | loading skeleton bar 底 |
| `--skeleton-hi` | `#26262B` | loading skeleton bar 高亮 |

**Light mode**（`prefers-color-scheme: light` 或 `.light` class）：

| Token | 值 |
|-------|----|
| `--canvas` | `#FAFAF9` |
| `--surface-1` | `#F2F2F0` |
| `--surface-2` | `#EAEAE7` |
| `--surface-3` | `#DDDDD9` |
| `--border-1` | `#E2E2DE` |
| `--border-2` | `#CFCFCA` |
| `--border-3` | `#B6B6B0` |
| `--fg-1` | `#18181B` |
| `--fg-2` | `#44444A` |
| `--fg-3` | `#6F6F75` |
| `--fg-4` | `#A5A5A8` |
| `--skeleton` | `#E8E8E5` |
| `--skeleton-hi` | `#DEDEDB` |

**色温观察**：light mode 是 warm beige tinted neutral（非纯灰），与 ontology 三色（含 `--aux` 米灰）色温一致；dark mode 是 cool neutral with subtle blue lift（非纯黑 / 纯灰）。

#### 2.4.3 Multi-dimensional redundancy 原则

颜色必须配合形状 + 位置 + 字重传递信息：激活态除了用 `--protocol` 边框，还要加粗 `--border-thick` 2px + 位置高亮（`--protocol-8` 背景块）+ 字重 `--w-600`，三重冗余防色盲失明。

#### 2.4.4 中性强调色 + scrim（v0.11 — 涟漪 [[018-absorb-promptscape-design]]）

> **B2 硬边界**：强调色是 **NEUTRAL 强调**，物理独立于 ontology 三色。只染**中性强调面**——品牌标记、主操作按钮、焦点环；**绝不染** protocol（选中相位）/ task（激活场景 tab）语义面。token 物理隔离，换色不可能重染语义层（[[02-constitution#B2]]）。来源 tokens.css §1b。

| Token | 值 | 角色 |
|-------|----|------|
| `--accent-swatch-neutral` | `var(--fg-1)` | 默认：高对比中性（反相 fg），settings 取色器可预览全色板 |
| `--accent-swatch-blue` | `#4C8DFF` | 蓝色板 |
| `--accent-swatch-green` | `#2F9E6E` | 绿色板（注意：与 ontology `--task` 不同值，非语义色）|
| `--accent-swatch-violet` | `#8B7BFF` | 紫色板（注意：与 ontology `--protocol` 不同值，非语义色）|
| `--accent-swatch-amber` | `#E0962F` | 琥珀色板 |
| `--accent` | 默认 `var(--accent-swatch-neutral)` | 当前强调色；swatch override 由 `:root.accent-*` class 切换（settingsStore.setAccent）|
| `--accent-fg` | 默认 `var(--canvas)` | 强调面上的前景 |
| `--scrim` | `rgba(0, 0, 0, 0.45)` | 模态遮罩（仅 overlay 弹窗）|

**强调色三铁律**：
1. 强调色 swatch（含 blue/green/violet/amber）即便色相接近 ontology，也**绝非语义色**——取值刻意不同，且永不出现在 protocol/task 面
2. 切换走 `:root.accent-*` root class，物理独立于 ontology 三色 token，换色无法泄漏到语义层
3. 默认 `neutral` = 反相 fg 高对比中性，等于「不上色」，保证 zero-config 下零彩色噪声

### 2.5 暗色模式 + 主题三态（v0.11 已实装外观面板）

**状态**：暗色 token 已实装（ADR-012 Phase 2 / commit `9a822d8`）；**主题三态切换 UI 已实装**（v0.11 / 涟漪 [[018-absorb-promptscape-design]]，设置弹窗「外观」页）。

**实装方式**：
1. **Dark 为 default** — `:root` 直接定义 dark neutral scale
2. **Light @media override** — `prefers-color-scheme: light` 自动切换（`:root:not(.dark)` selector）
3. **`.light` / `.dark` class override** — 手动 class 切换（绕开系统偏好）。`.dark` 显式钉死暗色（屏蔽 light @media guard），`.light` 钉死亮色，二者皆无 = `system`（跟随系统）

**主题三态**（settingsStore.themeMode，persist localStorage，A2 不出站）：
- `light` → root 加 `.light` class
- `dark` → root 加 `.dark` class
- `system` → 不加 class，由 `prefers-color-scheme` @media guard 决定
- 水合时 `onRehydrateStorage` 调 `applyAppearance` 落 class；启动即生效，无闪烁

**为何 Dark 是 default**：
- 扫视优先场景下 dark UI 降低眼睛疲劳（驾驶舱仪表盘类比 — 夜航主导）
- 协议/任务/辅助三色（紫/绿/米灰）在 dark canvas 上对比度更高（待 §2.3.2 dark mode 实测确认）
- bundle 视觉锚点（Linear-class polish，[[012-lock-visual-quality-anchor]]）默认 dark surface

**切换 API**（v0.11：UI 已落地，settingsStore 封装 class 写入）：

```js
// settingsStore.setThemeMode 内部经 applyAppearance 落 class（示意，非实现）
root.classList.remove('light', 'dark')
if (mode === 'light') root.classList.add('light')
else if (mode === 'dark') root.classList.add('dark') // system 不加 class
```

**未来扩展锚点**（v1.x backlog）：
- HDR / 高对比度模式（Accessibility）
- 切换动画（CSS transition `--canvas` / `--fg-1`）— **不在当前路径**

---

## 3. 动画 Token

### 3.1 时长 Token

> 设计原则：bundle 收敛到 ≤ 200ms 上限，与 [[02-constitution#C1]]（200ms 唤起）双重锁定。

| Token | 值 | 用途 |
|-------|----|------|
| `--d-fast` | 120ms | 即时反馈 / 卡片闪烁 / hover 高亮 |
| `--d-base` | 160ms | 默认过渡（颜色 / 边框 / fill）|
| `--d-slow` | 200ms | 进场动画 / 切相位 / 隐藏过渡（上限）|

**hard rule**：禁止 > 200ms 的动画。如出现 ≥ 200ms 需求，先反思"扫视优先场景为什么需要这么长动画"。

### 3.2 Easing Token

| Token | cubic-bezier | 用途 |
|-------|-------------|------|
| `--ease` | `cubic-bezier(0.2, 0, 0, 1)` | bundle 收敛 — 起步快末端缓的统一 ease；适用于所有进场 / 切换 / 渐变 |

**为何收敛到单一 ease**：原 v0.6 4 个 ease（out / in-out / spring / linear）在 ≤ 200ms 时长下视觉差异不可感知；统一 ease 减少决策成本 + 视觉一致。spring/弹性回弹场景已被 bundle 排除（hard exclusion §8.2）。

### 3.3 场景映射表

| 场景 | 主形态（快捷键全屏） | 辅形态（副屏常驻） |
|------|------|------|
| 状态反馈动画 | `--d-fast` + `--ease`（"用完即走"）| `--d-slow` + `--ease`（"持续在场"细微差）|
| 复制即隐藏窗口 | `--d-slow` + `--ease` 淡出 | 不隐藏 |
| 切相位高亮 | `--d-base` + `--ease` 颜色渐变 | 同左 |
| 复制成功反馈（chip flash）| `--d-fast` + `--ease`（chip filled 一瞬间 + 角落 toast `--d-slow` 淡出）| 同左 |
| Macro 保存反馈 | `--d-base` + `--ease`（顶部插入 + 短暂高亮，**无弹性回弹**）| 同左 |

**统一原则**：动画必须显式声明 `transition: <property> var(--d-X) var(--ease)`，禁止裸时长（如 `transition: 200ms`）。

---

## 4. 双形态视觉适配

| 视觉要素 | 主形态（快捷键全屏） | 辅形态（副屏常驻） |
|---------|-----------------|----------------|
| 背景 | `--canvas` + overlay frame `--r-frame` 8px 边角 | `--canvas` 不透明独立窗口 |
| 距离 | 30-40cm（直视主屏正前方） | 50-70cm（侧目扫视） |
| 字号基准 | `--t-13`（body 默认） | `--t-13`（v1.0 同主形态；v1.1 起 ladder 上移一档至 `--t-14`，backlog） |
| 输入焦点 | 唤起即聚焦 SearchBar | 不自动聚焦（用户主动点击） |
| 动画时长 | `--d-fast` 主导（用完即走） | `--d-slow` 主导（持续在场） |

---

## 5. 反设计清单

> hard exclusions 见 §8.2；本节是 v0.5/v0.6 确立的反设计原则，与 §8.2 互补不重复。
> **v0.12（[[019-supersede-flat-visual-anchor]]）**：`box-shadow` 已从 §8.2 hard exclusions 撤出——subtle elevation 已解锁。反渐变 / 反玻璃感 / 反拟物 / radius ≤ 6px / animation ≤ 200ms 仍是底线。

| 反设计 | 理由 |
|--------|------|
| ❌ 小型 X 关闭按钮 | 扫视优先场景需要大热区 |
| ❌ 多层嵌套的菜单 | 违背一屏全景哲学（哲学二）|
| ❌ 需要悬停才显示的内容 | 主形态唤起后用户不会把鼠标停在界面上等待 tooltip |
| ❌ 依赖颜色单一维度传递信息 | **v0.12 强化**：放弃颜色本体论后（§2.4.1），协议/任务区分靠**位置（ProtocolBand band / 区域归属）+ 形状（chip / 卡片 / 横条）**冗余编码，颜色不再是区分维度 |
| ❌ 需要长按才能触发的操作 | 手动挡阶段不接受"藏起来"的功能 |
| ❌ 用花哨的图表 | 手动挡阶段追求信息密度，不是炫技 |
| ❌ 把配置项藏在设置页 | 常用配置应该在首屏就能调 |
| ❌ 用复杂的设置系统 | 每个配置项应该是"点一下就切换"的简单开关 |

---

## 6. 相位带视觉权重的特殊说明

相位带承载哲学七（协议对齐），是协议层视觉权重最高的模块。**v0.7 起视觉权重通过 typography + 位置而非 raw 高度体现**（Linear-class polish 用排版表达层级，非用尺寸蛮力）。

> **v0.12（[[019-supersede-flat-visual-anchor]]）**：颜色本体论降为可选（§2.4.1）。下列激活态的 `--protocol` 紫 fill/border **不再是强制 ontology**——既有 PhaseBar 可保留紫强调，亦可按 Option A 转中性强调（`--accent`）；视觉权重的主载体已是 ProtocolBand 位置 + typography，非颜色。组件层决定保留或转中性。

- 高度：`--h-phasebar` 44px（v0.6 的 80px 在 bundle 视觉密度下显冗余，已收敛到 44px）
- **当前激活态**：`--protocol-8` 背景填充 + `--protocol` 2px 下边框（`--border-thick`）+ 字重 `--w-600`
- **其他态**：透明背景 + `--border-1` hairline 下分隔 + 字重 `--w-400`
- 每个 Phase 显示：Phase 名（`--t-13` / `--w-600` 激活 / `--w-400` 非激活）+ 快捷键标签（`--t-11` ⌘1-⌘8，`--font-mono`）
- 与之相对：SearchBar 视觉权重压低（`--surface-2` 背景 + `--fg-3` 占位 + 居中宽度 ~60%）— SearchBar 是兜底不是主入口

---

## 7. 视觉草案未解决的问题

以下设计细节将在实施过程中根据真实使用反馈逐步明确：

1. **Composition 工作台子窗口** UI 配色与字号 — ⌘N 唤起后的具体样式
2. **配置面板** UI 配色与字号 — ⌘, 唤起后的具体样式
3. **AlignmentPhrase 多条候选展开浮层** — 长按 Phase 后展开列表的具体样式
4. **搜索结果分组的视觉细节** — 每组的间距、分隔线、图标
5. **辅形态（副屏常驻）** 的完整视觉规范 — 第五阶段实施前细化
6. **Dark mode 对比度实测** — 关键组合实测数据待 v0.7.1 补全（§2.3.2）
7. **辅形态字号 ladder** — v1.1 起辅形态字号是否上移一档至 `--t-14` 起步（§4）

---

## 8. 视觉锚点（ADR-019 / Promptscape 派生）

### 8.1 anchor 来源

> **v0.12 锚点重定向（[[019-supersede-flat-visual-anchor]] 推翻 [[012-lock-visual-quality-anchor]]）**：
> Linear-class polish — 锐利的 typography / 紧凑的 rhythm / 自信的 hierarchy — **+ subtle elevation**（Promptscape 抬起感），WITHOUT gradient / glassmorphism。
>
> 旧锚点「a Bloomberg terminal that read Linear's typography manual」（反 shadow 的 flat 调性）已被 ADR-019 推翻。新目标：**Linear typography + 密度 + subtle elevation**——拿回设计稿「抬起感」，同时保留高密度 / 锐排版 / 反渐变玻璃感。

视觉锚点来源：
- [[019-supersede-flat-visual-anchor]] ADR-019 视觉决策（推翻 flat，引入 elevation + 放弃颜色本体论，全面对齐 Promptscape）
- [[018-absorb-promptscape-design]] Promptscape 设计稿吸收（中性强调 + 主题三态）
- [[CLAUDE-DESIGN]] sticky context（须同步移除「No box-shadow」hard exclusion 并 bump 重传，见 §8.3）
- [[012-lock-visual-quality-anchor]] ADR-012（**Superseded by ADR-019**；其 Linear typography / 密度遗产仍沿用，仅反阴影底线被推翻）

任何视觉决策与上述源冲突时，**优先级**：ADR-019 > Promptscape 设计稿 > CLAUDE-DESIGN > bundle preview。

### 8.2 Hard exclusions（never generate）

> **v0.12（[[019-supersede-flat-visual-anchor]]）**：`box-shadow` 已从本表撤出——subtle elevation 已解锁，规范见下方「§8.2.1 elevation 允许范围」。其余禁项不变。

| 禁项 | 理由 |
|------|------|
| ❌ `linear-gradient` / `radial-gradient` / `conic-gradient` | 营销表面属性，扫视场景视觉噪音 |
| ❌ `backdrop-filter` / `blur` / glassmorphism | Apple iOS 调性而非 Linear；GPU 成本 |
| ❌ 拟物化（3D button / bevel / inner-glow）| Material 之前的视觉债，与 Linear-class polish 对立——**注意：subtle drop-shadow elevation 不属拟物，见 §8.2.1** |
| ❌ 装饰性插画 / mascot / emoji as UI | 信息密度工具不需要装饰 |
| ❌ functional surface `border-radius > 6px` | Linear 圆角克制；overlay frame 例外（`--r-frame` 8px）|
| ❌ animation > 200ms | 与 [[02-constitution#C1]] 双重锁定 |

**违反 hard exclusion = 视觉锚点崩塌**，需走方法论 §7 八步流程开 ADR 推翻 [[019-supersede-flat-visual-anchor]]。

#### 8.2.1 Elevation 允许范围（v0.12 新增）

> ADR-019 解锁的是 **subtle elevation**，非任意 shadow。约束如下，越界仍属视觉锚点崩塌：

- **token 来源**：必须引用 `--shadow-*` token（tokens.css 单一真源，[[CLAUDE#§4.1]] 禁裸值）；dark canvas 与 light 分别调参
- **适用面**：仅 **card / banner / overlay / popover 的抬起态与 hover 抬起**——即需要表达「浮于 canvas 之上」层级的真实浮层。区域分隔 / hairline border 场景不加 shadow
- **强度**：subtle（低 alpha + 小 blur + 近距 y-offset），表达层级而非戏剧光影；禁止 glow / 彩色 shadow / 多层叠 shadow / inset shadow（inset 属拟物，仍禁）
- **与 border 关系**：elevation 是 border-only baseline 的**补充**不是替代——浮层仍可保 hairline border，shadow 只加抬起感

### 8.3 anchor 同步策略

bundle / Claude Design 视觉锚点变更时（如 Linear 大版本视觉重做 / Claude Design system bundle 更新）：

1. 上游 bundle / CLAUDE-DESIGN 先 bump
2. 本文件 §8-§13 同步 bump，必要时开新 ADR
3. tokens.css 跟随 §2 章节落盘
4. 组件 CSS 跟随 §10/§11/§12 落盘

---

## 9. Typography presets

> 每个 preset 是「字号 + 字重 + 行高 + tracking + 颜色」的固化组合，组件 CSS 直接引用 preset 名而非散值组合。
>
> 命名约定：`.ph-{role}`（prompt-hub 前缀，避免与 utility class 冲突）。

| Preset | 用途 | font-size | font-weight | line-height | tracking | color |
|--------|------|-----------|-------------|-------------|----------|-------|
| `.ph-region-header` | 区域标题（PhaseBar/Macro/Scene 头）| `--t-14` | `--w-600` | `--lh-tight` | `--tr-tight` | `--fg-1` |
| `.ph-card-title` | Macro 卡片标题 / Scene row 标题 | `--t-14` | `--w-500` | `--lh-tight` | `--tr-normal` | `--fg-1` |
| `.ph-card-body` | Macro 卡片摘要 / Phrase preview | `--t-13` | `--w-400` | `--lh-body` | `--tr-normal` | `--fg-2` |
| `.ph-meta` | 使用次数 / 时间戳 / count badge | `--t-11` | `--w-400` | `--lh-tight` | `--tr-meta` | `--fg-3` |
| `.ph-hotkey` | ⌘K / ⌥Space 等快捷键 badge | `--t-11` | `--w-500` | `--lh-tight` | `--tr-normal` | `--fg-2`（`--font-mono`）|
| `.ph-empty` | EmptyState 中央提示文字 | `--t-13` | `--w-400` | `--lh-body` | `--tr-normal` | `--fg-3`（center）|
| `.ph-code` | 代码片段 / Modifier raw text | `--t-12` | `--w-400` | `--lh-body` | `--tr-normal` | `--fg-2`（`--font-mono`）|

**hard rule**：组件 CSS 写 typography 时优先引 preset，不重复散写字段组合。preset 不够用时**新增 preset**而非裸写——新 preset 视为 design-spec 扩展，需 bump。

---

## 10. 组件 pattern

### 10.1 通用交互 pattern（border-only baseline）

> 哲学：filled component 是少数（filled = ontology meaning carrier），多数是 border-only baseline + 状态叠层。

| 态 | border | bg | text | 备注 |
|----|--------|-----|------|------|
| default | `--hairline` `--border-1` | transparent | preset 默认 | 静态基线 |
| hover | `--hairline` `--border-2`（darken）| transparent | preset 默认 | 浮层类（card/banner/overlay）可加 subtle `--shadow-*` 抬起态（§8.2.1）；hairline/分隔类不加 |
| active (pressed) | `--hairline` `--border-3` | `--surface-2`（v0.12 中性，原 `-8` 按层）| preset 默认 | 中性 press fill |
| selected（持续）| `--hairline` `--accent` | `--surface-3`（v0.12 中性，原 `-16` 按层）| preset / `-fg` filled 态 | 中性 fill + `--accent` 边框 |
| focused（keyboard）| `--border-thick` `--accent` outline（v0.12 从 `--protocol` 改中性）| inherit prev | inherit prev | 2px outline-offset 1px |
| disabled | `--hairline` `--border-1` | transparent | `--fg-4` + `--op-dim` | NO semantic color |
| loading | skeleton bar | `--skeleton` / `--skeleton-hi` 动画 | hidden | neutral gray only，不染色 |
| empty | n/a | n/a | `.ph-empty` 中央 | 见 §10.3 EmptyState |

### 10.2 共享 primitive 清单

> **v0.10 背景**：截至 v0.9，`primitives.module.css` 仅封装 `RegionHeader`/`EmptyState`/`Kbd` 三件套。Card / Button / IconButton / Input / Chip / EditorPanel 各组件自行复制 CSS 并漂移（editor 五件套复制 4 份、action/confirm 图标按钮复制 4 份、`.addBtn` 分叉成 text-pill vs icon-square）。本节升级为**完整 primitive 清单**，作为 A 阶段（自建 primitives 重构）的视觉契约真源。

#### 10.2.1 chrome 三件套（v0.7，沿用）

bundle 派生的 3 个跨组件 chrome primitive：

| Primitive | 用途 | 视觉契约 |
|-----------|------|---------|
| `RegionHeader` | 每个区域顶部 header（图标 + 标题 + 右侧 meta count / action）| `--h-region-header` 40px / 内边距 `--s-3_5` 14px / typography `.ph-region-header` / 右侧 meta `.ph-meta` |
| `EmptyState` | 区域无数据时的中央提示 | 中央对齐 / typography `.ph-empty` / 与 region edge 距离 `--s-6` 24px |
| `Kbd` | 快捷键 badge（⌘K / ⌥Space / ⌘1-8）| 矩形 / `--r-1` 2px 圆角 / 内边距 `--s-0_5` 2px × `--s-1_25` 5px / typography `.ph-hotkey` |

#### 10.2.2 surface / control / editor primitive（v0.10 新增）

> **变体设计原则**（采纳 codex review）：primitive **不是逐字抽取**——它带 ontology 层变体（`task` / `protocol` / `neutral`）+ 形态变体。域内布局（拖手柄位置 / 象限尺寸 / 协议层 manage 控件）仍留各组件本地，primitive 只收敛**视觉壳**（边框 / 底色 / 圆角 / padding / 状态叠层 / typography）。`CompositionWorkbench`、`AlignmentPhrases` 的局部差异通过变体或本地补充表达，不强行抹平。

| Primitive | 用途 | 视觉契约 | 变体 |
|-----------|------|---------|------|
| `CardSurface` | 独立资产卡外壳 | `--surface-1` 底 / `--border-2` hairline / **`--r-4` 6px**（§2.2 归一）/ 内边距 `--s-4` 16px / 最小高 `--s-12` 48px；状态叠层走 §10.1 | `layer`: task / protocol / neutral（决定 active/selected 时的 `-8`/`-16` fill + selected 边框色）|
| `ListRowSurface` | 列表行外壳 | 透明底 / `--border-1` 下分隔 hairline / **`--r-3` 4px**（hover/selected 时整行显圆角）/ 行高按组件 anchor（如 `--h-scene-row` 32px）/ padding-x `--s-3_5` 14px | `layer`: task / protocol / neutral |
| `Button` | 文字按钮（含「新增」入口）| border-only baseline（§10.1）/ 高 `--h-chip` 24px / 圆角 `--r-4` 6px（圆角矩形，**非全高 stadium**——见下方 ⚠️ 待裁定）/ padding-x `--s-2_25` 9px / typography `.ph-card-title` 或 `.ph-meta`（按密度）| 形状 `pill`\|`square`；层 task\|protocol\|neutral；意图 primary\|ghost\|subtle（见 §10.7 矩阵）|
| `IconButton` | 纯图标方块按钮（无文字标签的工具位：行内编辑 confirm/cancel、卡片悬浮动作）| 正方 `--s-5` 20px 或 `--h-chip` 24px / `--r-2` 3px / lucide 14px `--op-icon` 0.7 / border-only baseline | 层 neutral（默认）；危险动作（discard）hover 时 icon `--fg-2`，**不染红/不染 ontology**（§13.2）|
| `Input` / `EditorInput` | 单行 / 多行文本输入 | `--surface-2` 底 / `--border-2` hairline / `--r-3` 4px / padding `--s-2` 8px / typography `.ph-card-body`；focus 走 §10.1 focused（`--border-thick` 2px `--accent` outline，offset 用 `var(--hairline)` 而非裸 `outline-offset: 1px`，见下 ⚠️ 缺口 2）| — |
| `EditorPanel` | 行内编辑壳（name input + body input + 动作行）| `--surface-1` 底 / `--border-2` hairline / **`--r-3` 4px**（内嵌面板，非外层卡）/ 内边距 `--s-3` 12px / 内部用 `EditorInput` × N + `EditorActions` | 层 task\|protocol（决定 save 按钮归属层 + focus 强调）|
| `EditorActions` | 编辑壳底部动作行（cancel + save）| 右对齐 / gap `--s-2` 8px / save = `Button`(primary, 当层) / cancel = `Button`(subtle, neutral) | 继承父 `EditorPanel` 层 |
| `Chip` | 单标签（AlignmentPhrase chip / tag）| 高 `--h-chip` 24px / `--r-2` 3px / padding-x `--s-2_25` 9px / typography `.ph-card-body` / border-only baseline + clicked flash（§11） | 层 protocol（chip 当前唯一使用者）|
| `ActionCluster` | 卡片悬浮动作组（多个 `IconButton` 横排）| gap `--s-1_5` 6px / 默认 hover/focus 时显（主形态不依赖 hover，键盘 focus 必显，§5）| — |
| `ConfirmInline` | 行内删除二次确认（`role="alertdialog"`）| 复用 `IconButton` 对（确认 `Check` / 取消 `X`）/ 不弹模态 / 就地替换 ActionCluster | — |

**hard rule**：
1. 不允许组件自行实现 header / empty / kbd / card / list-row / button / icon-button / input / editor / chip 视觉，必须用 primitive（含变体）。实现见 `src/components/primitives/primitives.module.css`。
2. primitive 变体只通过 `layer` / 形状 / 意图 参数表达，**不允许组件 override primitive 的边框/圆角/padding 散值**——需要新视觉时**扩展 primitive 变体**（走方法论 §7 bump），不就地补丁。
3. 层变体守 §13.2（v0.12 后）：颜色不再绑层，`layer` 参数默认渲染中性强调；若某变体保留 ontology 强调色，应整组一致、不在同层内紫绿混用（视觉一致性，非违宪）。

> **⚠️ v0.10 两个 token 缺口（待人审裁定，A 阶段实施前需定）**：
> 1. **Button 圆角**：本节暂定 `Button` 用 `--r-4` 6px 圆角矩形。若设计意图是「真 pill / stadium 全高圆角」，现有 token 表（`--r-1`~`--r-frame`，最大 8px）无对应档，需新增 `--r-pill`（如 `999px` 或 `--h-chip` 半值）——属 tokens.css 扩展，走方法论 §7 bump。**默认建议**：用 `--r-4` 6px 圆角矩形即可，与卡片同档，避免引新 token。
> 2. **focus outline-offset**：§10.1 / `Input` 契约要求 focus outline offset「1px」，但 tokens.css 无 offset 专用 token（最接近 `--hairline` 1px）。`SearchBar` 现用裸 `outline-offset: 1px` 违反 §4.1 token 铁律。**默认建议**：复用 `--hairline`（值即 1px）作 `outline-offset: var(--hairline)`，不引新 token。

### 10.3 组件清单（v1.0）

| 组件 | 主层 | 高度 / 尺寸 | 典型 pattern |
|------|------|------|------|
| `SearchBar` | aux | `--h-quickfind` 36px | border-only + focused outline `--accent` |
| `PhaseBar` | protocol | `--h-phasebar` 44px | border-only segmented + active 段 `--surface-2` + 2px `--accent` 下边框（v0.12 中性，原 `--protocol`）|
| `AlignmentPhrases` | protocol | `--h-phrases` 44px | chip 行（`--h-chip` 24px），每 chip border-only + clicked → flash 中性（`.flash` 解析 `--surface-3`）；dot 标记 `--accent` |
| `MacroGrid` | task | 任务列顶部紧凑横条：auto-fill grid（最小列 `--col-min-macro` 200px）封顶 `--h-macro-strip` 184px 后滚动（v0.11 涟漪 [[018-absorb-promptscape-design]]，原 3-col）| 卡 border-only + hover darken + subtle `--shadow-1` + active `--surface-2`；hot Flame chip 填 `--accent`（v0.12 中性，原 `--task`）|
| `ScenePanel` | task | 视图态：子阶段多列全景 auto-fill grid（最小列 `--col-min-substage` 184px），每子阶段一列、phrase 堆为 border 卡；编辑态保留纵向行（v0.11 涟漪 [[018-absorb-promptscape-design]]）| 卡/行 border-only + active `--surface-2`（v0.12 中性，原 `--task`）|
| `RecentList` | aux | 行列表 | row border-only + meta time 右侧 |
| `SopProgress` | task | 进度条 | `--skeleton` 底 + `--accent` 填充（v0.12 中性，原 `--task`）|
| `StatusBar` | aux | `--h-statusbar` 28px | dot + meta text + 右侧 Kbd 群 |
| `PendingBadge`（v0.8）| aux | inline，高度 `--h-chip` 24px | lucide `Inbox` + count text，仅 N>0 渲染，详见 §10.4 |
| `DraftInbox`（v0.8）| aux | Scene tab 行最左入口 + 列表面板 | tab 入口 lucide `Inbox` + 分隔，列表挂 `DraftCard`，详见 §10.4 |
| `DraftCard`（v0.8）| aux（中性，promote 前不染 ontology）| 卡片 | border-only neutral + target_type 文字角标 + provenance + promote/discard，详见 §10.4 |
| `PanoramaSeparator`（v0.9）| chrome（aux 中性）| 全景区列间分隔条（hairline 宽）| `--border-1` hairline baseline + hover 加深 `--border-3` + focus outline `--accent`；分隔条属 hairline 类**不加 elevation**（§8.2.1：shadow 仅浮层类）；仍**无渐变/玻璃感**，详见 §10.5 |
| `Header`（v0.11）| chrome（中性强调）| 顶部 slim 行，gear `--h-quickfind` 36px | logo 方块染 `--accent`/`--accent-fg`（B2 中性强调面）+ 标题/副标 + 内嵌 `SearchBar`(flex-1) + gear `IconButton`；去设计稿头像（spec §8.2 无账号），详见 §10.8 / 涟漪 [[018-absorb-promptscape-design]] |
| `ProtocolBand`（v0.11）| protocol | 协议层容器 band（inset，`--r-frame`）| `--surface-1` 底 + hairline 框 + `Route` icon「协议层」pill（`--surface-2`/`--fg-2` 中性，v0.12 去层色——layer 靠 band 位置表达）；纯布局壳，PhaseBar+AlignmentPhrases 内容/数据不变，详见 §10.8 |
| `SettingsModal`（v0.11）| chrome（中性强调）| 居中 overlay 弹窗（`--scrim` 遮罩，宽 `--w-settings-modal`）| 左导航(外观/更新) + 右内容；外观=主题三态分段控件 + 5 色强调 swatch；更新=opt-in 开关 + 状态行 + 检查/安装（复用 updaterStore）；焦点环/激活态用 `--accent`（中性强调，B2 安全），详见 §10.8 |

---

### 10.4 MCP write pipeline 组件视觉契约（v0.8 — 涟漪 [[015-expose-mcp-write-pipeline]]）

> 承接 [[06-prd#10]] 接口契约 + [[03-product-spec#区域-8待审-badge]] / [[03-product-spec]] §13.3 区域 4 草稿 tab 信息架构，落地三个新组件的视觉。
>
> **drafts 中性规则**：drafts 是 promote 前的**暂态收件箱条目**——三组件一律 **aux 中性层**（neutral scale + `--fg-*`），不用 ontology 强调色。v0.12 后这与「新组件默认中性」（§2.4.1）一致，依据是视觉一致性而非「防跨层污染」。资产 promote 后落各自 home region，是否取 ontology 强调由该 region 组件决定（颜色已是可选，§2.4.1）。

#### 10.4.1 PendingBadge（顶部待审 badge）

| 字段 | 视觉契约 |
|------|---------|
| 层 | aux（中性 chrome，非 ontology）|
| 位置 | SearchBar 同行右端（[[03-product-spec]] §13.3 区域 8）|
| 显示条件 | 仅 `count_pending_drafts` > 0 渲染；N=0 完全不挂载（无空态、不占位）|
| 图标 | lucide `Inbox` 14px / `--op-icon` 0.7 / `currentColor`——**非 emoji 📥**（§8.2 禁 emoji as UI / §12 chrome 用 lucide）|
| 文案 | `Inbox` icon + count text「{N} 条待审」，typography `.ph-meta`（`--t-11` / `--fg-3` / `--tr-meta`）|
| 禁止 | ❌ 红点 / ❌ 角标 dot / ❌ 动画脉冲 / ❌ 染 ontology 色——手动挡阶段 promote 是从容动作，badge 克制不制造焦虑 |
| states | default / hover（`--fg-2` 提亮）/ active（点击跳草稿 tab）——**纯状态指示器，不进 Tab cycle、无 focused 态**（与 StatusBar 同性质；键盘入口走 Scene region，见 [[03-product-spec]] §13.4）|

#### 10.4.2 DraftInbox（Scene 行草稿入口 + 列表）

**tab 入口**（Scene Tab 行最左）：

- lucide `Inbox` 14px + 一道 `--border-2` 竖 hairline 与右侧 Scene tab 隔开
- 仅 pending>0 出现（与 PendingBadge 同生同灭）
- 非激活态：`--fg-3` icon；激活态：**`--surface-2` 背景 + `--border-3` 边框**（aux 中性层，**不借协议紫**——草稿 tab 不属任何 ontology 层，守层归属铁律）

**列表面板**（草稿 tab 激活时）：

- 复用 `RegionHeader` primitive（§10.2）：lucide `Inbox` + 标题「草稿收件箱」+ 右侧 `.ph-meta` count
- 列表：`DraftCard` 纵向堆叠，间距 `--s-3` 12px
- 空态：理论上不出现（pending=0 时整个 tab 不挂载）；防御性 fallback 用 `EmptyState` primitive

#### 10.4.3 DraftCard（草稿卡片）

| 区域 | 内容 | typography / token |
|------|------|-------------------|
| 左上角标 | target_type 文字标（`MODIFIER` / `COMPOSITION` / `MACRO` / `ALIGNMENT`）| `.ph-meta`（`--t-11` / `--fg-3` / `--tr-meta` uppercase）——**中性文字，非 ontology fill** |
| 标题 | draft name | `.ph-card-title`（`--t-14` / `--w-500` / `--fg-1`）|
| 正文 | preview（≤ 100 字截断）| `.ph-card-body`（`--t-13` / `--w-400` / `--fg-2`）|
| 底部 meta | provenance「claude-code · {model_hint}」（[[06-prd#10.1.3]]，model 缺省仅显来源 app）| `.ph-meta`（`--t-11` / `--fg-3`）|
| 右下双动作 | **promote** / **discard** | 见下 |

**卡片容器**：border-only baseline（§10.1）——`--border-2` hairline / `--surface-1` 底 / `--r-4` 6px 圆角；hover → `--border-3`；**无 ontology 色**（promote 前中性）。

**双动作按钮**（border-only，§10.1 baseline）：

| 动作 | IPC | 视觉 | 备注 |
|------|-----|------|------|
| promote | [[06-prd#10.3]] `promote_draft` | border-only + lucide `Check` 14px + 「采纳」label；hover `--border-3`；**无 task 绿 fill**（按钮是动作非层成员）| 须 omar 显式点击，无自动路径（守 [[06-prd#8.2]] N3）|
| discard | `discard_draft` | border-only + lucide `Trash2` 14px + 「丢弃」label；hover `--border-3` + icon `--fg-2` | 软删（status='discarded'）|

**为何 promote 不上 task 绿**：promote 按钮是「把草稿送进任务层」的动作，但按钮自身不是任务层成员；若染绿会让人误读「这张草稿卡是绿层」，违背层归属铁律。强调靠 `--w-500` 字重 + `Check` 图标位置，不靠色。

---

### 10.5 全景区可拖列布局（v0.9 — 涟漪 [[asset-editing-and-adaptive-layout]] P4 / [[016-choose-dnd-and-resizable-layout]]）

> Dashboard 全景区从固定 grid（`1.4fr / 1fr / 0.9fr`）改为 `react-resizable-panels` v4 `Group` / `Panel` / `PanoramaSeparator`：列宽用户可拖 + localStorage 持久化（默认 `42 / 30 / 28`%，min `22 / 18 / 18`%，全百分比免 px↔% 换算）。`Separator` 视觉契约见 §10.3。

**ADR-012 合规评估**（[[012-lock-visual-quality-anchor]] 约束下，本次涟漪结论：**不违反**）：

- **反设计清单**（§8）：分隔条仅 hairline border + hover 加深，属 hairline 类不加 elevation（§8.2.1）；**无渐变 / 玻璃感 / skeuomorphism** —— 守底线（v0.12：box-shadow 已解锁但分隔条不适用）。
- **一屏全景**（[[03-product-spec#§4.1]]）：三列始终全部可见，拖动只改比例**不隐藏任何区域** —— 守哲学二。
- **色块即本体**（[[02-constitution#B2]]）：列宽调整不动三色族，分隔条属 chrome 中性色、不染 ontology。
- **结论**：列宽可调属「区域尺寸可调」，**非**「面板自由布局」（后者违反 B2，plan §1 非目标已排除）；布局偏好存 localStorage，不入 SQLite、不上传（守 [[02-constitution#A2]]）。故无需修订 §8 锚点，仅补本节 + §10.3 `PanoramaSeparator` 行。

---

### 10.6 Card vs List 范式决策矩阵（v0.10 新增）

> **背景**：截至 v0.9，同属任务层的资产用了三种视觉语言——`MacroGrid` 大卡片、`ModifierGrid` 小卡片、`CompositionWorkbench` 列表行——一眼看不像一个体系。本节把"何时卡片、何时列表行"从手感固化为 hard rule，消除范式漂移。范式由**资产性质**决定，**不由所在层**决定（task / protocol 层都可能用任一范式）。

**判定矩阵**（按资产性质查表，命中即定范式）：

| 判定维度 | → Card（`CardSurface`，`--r-4` 6px）| → List Row（`ListRowSurface`，`--r-3` 4px）|
|---------|------------------------------------|--------------------------------------------|
| 单条信息量 | 多字段（标题 + 多行正文 + meta + 图标）| 单/少字段（标题 + 一个 meta）|
| 视觉粒度 | 资产本身是"作品"，值得独立呈现 | 资产是"条目"，靠序列呈现 |
| 操作密度 | 卡内多动作（copy + edit + delete + 悬浮 ActionCluster）| 行内轻动作（点选为主，编辑次要）|
| 排列方式 | 网格（grid，2D 扫视）| 纵向列表（1D 扫视 + 可拖排序）|

**v0.10 范式归属（hard rule）**：

| 组件 | 范式 | 理由 |
|------|------|------|
| `MacroGrid` | **Card** | Macro 是多字段作品（Flame + 标题 + 2 行正文 + meta），网格扫视 |
| `ModifierGrid` | **Card** | Modifier 是带正文的资产卡，四象限网格；卡片同 Macro 一档（`--r-4` 6px，不再是"小卡片"）|
| `ScenePanel` | **List Row** | Scene 是导航条目，按 SubStage 分组的轻列表 |
| `CompositionWorkbench` | **List Row** | Composition 的 modifier 序列是可拖排序列表，单条信息量低 |
| `DraftInbox` | **List Row** | 草稿是收件箱条目，纵向堆叠（注：单张 `DraftCard` 内部仍是 card 壳，§10.4.3；这里指 inbox 的列表组织方式）|
| `AlignmentPhrases` | **Chip 行**（第三范式）| chip 是协议层短语标签，既非 card 也非 list row，用 `Chip` primitive（§10.2.2）|

> **变体而非抹平**：同范式下原允许 layer 变体差异——`MacroGrid` 与 `ModifierGrid` 都是 Card。**v0.12（ADR-019）后 layer 不再驱动颜色**：active/selected fill 统一中性（`--surface-2/3` 抬升 + `--accent` 强调），不再取「各自层色」。范式统一的是**形态壳**，颜色已中性化——layer 身份改靠位置 + 形状（§2.4.1 / §13）。

---

### 10.7 Button 形态矩阵（v0.10 新增）

> **背景**：截至 v0.9，「新增」入口分叉——`MacroGrid`/`CompositionWorkbench` 用文字 pill，`ModifierGrid` 用纯 `+` 图标方块（截图右列四象限那个孤立加号）。同一动作两种长相。本节固化按钮三维矩阵 + 入口形态裁定。

**三维**：形状 × 层 × 意图。

| 维度 | 取值 | 含义 |
|------|------|------|
| **形状** | `pill`（文字按钮，全高圆角）| 有文字标签的动作（新增 / 采纳 / 丢弃 / 保存 / 取消）|
| | `square`（`IconButton`，`--r-2` 3px 方形）| **仅**无文字标签的工具位（行内 confirm/cancel 图标、卡片悬浮 ActionCluster）|
| **层** | `task` / `protocol` / `neutral`（**v0.12 起仅标区域归属，不驱动颜色**）| layer 决定按钮所在区域的位置归属（§13）；自 ADR-019 颜色不再随层变，强调统一中性 `--accent`。`.task`/`.protocol` 仍作 legacy class 但解析为中性 |
| **意图** | `primary` | 主动作（save / 采纳）：中性 `--surface-3` fill 或 `--accent` 实心 + `--w-500`（不再用层 `-16`）|
| | `ghost` | 次动作（新增 / cancel）：border-only baseline，无 fill |
| | `subtle` | 弱动作（取消 / dismiss）：仅文字 + hover 提亮，无边框 |

**入口形态 hard rule（v0.10 裁定）**：

1. **「新增」入口一律 `pill` 文字按钮**（`Button` shape=pill, intent=ghost），文案如「+ 新增 Macro」。`ModifierGrid` 四象限的 icon-square 加号**改为文字 pill**，与 Macro/Composition 统一。
2. **`square`（`IconButton`）仅用于真正无标签的工具位**：行内编辑的 confirm（`Check`）/ cancel（`X`）、卡片悬浮 `ActionCluster` 的 edit/delete 图标。这些位置文字 pill 会过重，图标方块合理。
3. **按钮自身不承载 ontology fill 除非是 primary 意图**：promote/discard 等"送资产进某层"的动作按钮，自身非层成员，用 ghost（border-only），强调靠字重 + 图标位置而非层色（沿用 §10.4.3 promote 不染绿的决策）。
4. 按钮 focus 统一 `--accent` outline（§11 focused；v0.12 起 focus ring 全量从 `--protocol` 改中性 `--accent`）。

| 典型按钮 | 形状 | 层 | 意图 | 出处 |
|---------|------|-----|------|------|
| 新增 Macro / Modifier / Composition | pill | neutral | ghost | 各区域底部入口（**统一后**；v0.12 去层色）|
| 行内编辑 save | pill | neutral | primary | `EditorActions`（§10.2.2）|
| 行内编辑 cancel | pill | neutral | subtle | `EditorActions` |
| 编辑 confirm `Check` / cancel `X` | square | neutral | ghost | `IconButton` 工具位 |
| 卡片悬浮 edit / delete | square | neutral | ghost | `ActionCluster` |
| DraftCard promote / discard | pill | neutral | ghost | §10.4.3（不染层色）|

---

### 10.8 Promptscape 吸收组件视觉契约（v0.11 — 涟漪 [[018-absorb-promptscape-design]]）

> 承接 [[018-absorb-promptscape-design]] 组合 A1+B1+C1+D+E，落地三个新 chrome 组件的视觉。三者皆**改造现有结构而非平行新建**（C1），语义内容/数据不变。

#### 10.8.1 Header（顶部 slim 行）

| 区域 | 视觉契约 |
|------|---------|
| 容器 | `--surface-1` 底 + 底部 hairline `--border-1`；padding `--s-2`/`--s-3_5`；行内 flex，gap `--s-3` |
| logo | `--s-8` 32px 方块，圆角 `--r-4`，**染 `--accent`/`--accent-fg`**（B2 中性强调面——非 ontology）；lucide `Layers` 16px |
| 标题 | 「prompt-hub」`--w-600` `--t-14`（**不改名 Promptscape**，spec 定位）+ 副标「提示词资产 · 全景仪表盘」`--fg-3` `--t-11` |
| 搜索 | 内嵌 `SearchBar`，flex-1 占据中段（由整行 border-only 改为圆角内联字段，行 chrome 上移到 Header）|
| gear | `IconButton` `--h-quickfind` 36px，lucide `Settings`，点击 `openSettings`（⌘,）；hover `--surface-2`/`--fg-1` |
| 禁止 | ❌ 账号头像（spec §8.2 单用户无账号）❌ logo 染 ontology 色 |

#### 10.8.2 ProtocolBand（协议层容器 band）

| 字段 | 视觉契约 |
|------|---------|
| 层 | protocol（容器壳允许染协议层强调，与内容同层）|
| 容器 | inset margin + `--surface-1` 底 + hairline 框 + `--r-frame` 8px |
| 标签 | `Route` icon「协议层」pill，`--surface-2` 底 + `--fg-2` 文字（v0.12 中性——layer 身份靠 band 位置，非颜色）|
| 内容 | 包裹既有 `PhaseBar` + `AlignmentPhrases`，二者数据/逻辑/`data-region`/tabindex **不变**；band 接管底色后，PhaseBar/AlignmentPhrases 自身底色改 transparent、去重复 border |

#### 10.8.3 SettingsModal（设置弹窗）

| 区域 | 视觉契约 |
|------|---------|
| 遮罩 | 全屏 `--scrim`（`rgba(0,0,0,.45)`）+ 居中；点遮罩 / Esc 关闭（`role="dialog"` `aria-modal`）|
| 弹窗 | `--surface-1` 底 + `--border-2` 框 + `--r-frame`；宽 `--w-settings-modal` 560px，max-height 80vh |
| 左导航 | 宽 `--w-settings-nav` 140px，「外观 / 更新」两项；激活态 `--surface-2`+`--border-2`；焦点环 `--accent`（中性强调，B2 安全）|
| 外观页 | 主题三态分段控件（浅色/深色/跟随系统，lucide `Sun`/`Moon`/`Monitor`，激活边框 `--accent`）+ 5 色强调 swatch（dot 染 `--accent-swatch-*`，选中 `Check`）|
| 更新页 | opt-in `role="switch"` 开关（on 态染 `--accent`）+ 状态行（error 态 `--task` 提示）+「检查更新」/「下载并安装」按钮（复用 updaterStore，[[017-enable-auto-update]]）|
| 禁止 | ❌ 强调色/焦点环染 protocol/task ❌ 更新页造 channel 概念（updaterStore 无）|

> **B2 复检**：本组三处「强调」（logo / swatch / 焦点环 / 开关 on 态）全部用 `--accent` 中性强调 token，物理隔离于 ontology；唯一染协议紫的是 ProtocolBand 标签 pill——其本就是协议层成员，合规。

---

## 11. States（每组件多态契约）

> 每个组件**必须**实现以下态（empty / loading 视组件性质可选），不允许只实现 default + hover。

| # | 态 | 触发 | 视觉契约 | 备注 |
|---|----|------|---------|------|
| 1 | default | 无交互 | §10.1 default 行 | 基线 |
| 2 | hover | pointer over | §10.1 hover 行 | 鼠标场景，键盘用户不依赖 |
| 3 | active / pressed | 按下中 | §10.1 active 行 | 8% fill 短暂 `--d-fast` |
| 4 | selected | 持续选中态（PhaseBar 当前 Phase / chip 持续高亮）| §10.1 selected 行 | 16% fill + 同色边框，持续展示 |
| 5 | focused | keyboard Tab 到 | §10.1 focused 行 | 2px outline，所有可交互 must |
| 6 | disabled | 不可交互 | §10.1 disabled 行 | NO semantic color，仅 `--op-dim` |
| 7 | flash | 复制成功 / 保存成功瞬间 | `--d-fast` semantic fill 后回 default | 复制反馈专用 |
| 8 | loading | 异步数据中 | §10.1 loading 行 | skeleton 动画 `--ease`，neutral gray |
| 9 | empty | 无数据 | §10.1 empty 行 | EmptyState primitive |

**hard rule**：focused 不可省略（键盘用户 + Accessibility）。focused outline 必须用 `--accent`（中性强调色，所有组件统一）— focused 不承载 ontology 含义；v0.12（[[019-supersede-flat-visual-anchor]]）起 focus ring 全量从 `--protocol` 改中性 `--accent`，无障碍口径不变。

**flash 态共享契约（v0.10 新增）**：

> **背景**：截至 v0.9，flash 复制/保存反馈在三处重名重定义——`MacroGrid.macroCopyFlash`、`ScenePanel` + `PhaseBar` 各自的 `phaseCopyFlash`（同名却各写一份）、`AlignmentPhrases` 用静态 `.flash`。逻辑完全相同，实现各写各的。

- **单一 `@keyframes` 真源**：flash 动画只允许定义**一次**，命名 `ph-flash`，落在 `primitives.module.css`。所有组件复用，**禁止**组件本地再定义 `@keyframes`（无论同名或异名）。
- **fill 由调用方传参**：`ph-flash` 用 `--layer-16` 占位，flash 的 fill 由组件经 `.task`/`.protocol`/`.neutral` class 注入；v0.12（ADR-019）起三 class 统一解析为中性 `--surface-3`（不再按层取 `--task-16`/`--protocol-16`），动画曲线统一 `--d-fast` + `--ease`。
- **时长锁定**：flash = `--d-fast` 120ms semantic fill → 回 default，禁止自定义时长（§3.1 hard rule）。

**hard rule**：新增需要"瞬时高亮"反馈的组件，复用 `ph-flash`，不新建 keyframes。

---

## 12. Icon 系统

### 12.1 库与规格

| 字段 | 值 |
|------|-----|
| 库 | `lucide-react@^0.460.0`（bundle 派生）|
| 默认尺寸 | 14px（与 `--t-14` region header 对齐）|
| stroke 宽度 | 1.5px（lucide 默认）|
| 默认透明度 | `--op-icon` 0.7（弱化 chrome 感知）|
| 颜色 | **跟随父元素 text color**（`color: currentColor`），不承载 ontology |

### 12.2 Icon 不承载 ontology（关键决策）

**Icon 跟文字同色，永远不用 semantic palette（`--protocol` / `--task` / `--aux`）**：

- 理由 1：icon 是装饰 + 语义辅助，不是 ontology 标记。ontology 由背景 / 边框承载，icon 多染色会**视觉过载** + **稀释 ontology 信号**
- 理由 2：跟随 text color 让 icon 在 dark/light mode 自动 sync
- 理由 3：bundle 视觉锚点要求 icon 克制（与 Linear 视觉一致）

**唯一例外**：状态指示 dot（`StatusBar` 状态点）可用 ontology 色，但**不是 lucide-react，是自绘 dot**。

### 12.3 v1.0 已用 icon 清单

| Icon | 来源 | 用途 |
|------|------|------|
| `Flame` | lucide-react | MacroGrid 热门 Macro 标识 |
| `Search` | lucide-react | SearchBar 左侧占位图标 |
| `Inbox`（v0.8）| lucide-react | PendingBadge / DraftInbox tab 入口 + 列表 RegionHeader（**替代 emoji 📥**，§10.4）|
| `Check`（v0.8）| lucide-react | DraftCard promote 动作（§10.4.3）|
| `Trash2`（v0.8）| lucide-react | DraftCard discard 动作（§10.4.3）|

**hard rule**：新增 icon 需评估是否必要——bundle 视觉密度下 icon 不是默认装饰，能用 typography 表达就不引 icon。

### 12.4 适用范围（chrome vs 用户内容）

§12.1-§12.3 的 hard rule（lucide-react / 14px / `--op-icon` 0.7 / 跟随 text color / 克制）**只覆盖 chrome 系统图标**——即 prompt-hub 应用自身渲染的 UI 装饰（Flame on Macro 热门徽章 / SearchBar 占位 / StatusBar Kbd / 主形态导航图标等）。

**用户内容图标允许任意字符**：

| 场景 | 字段位置 | 允许字符 |
|------|---------|----------|
| Scene icon | `scenes.icon`（DB schema）| emoji / 单字 / lucide name string |
| Macro 自定义图标（未来）| `macros.icon` | 同上 |
| AlignmentPhrase 自定义图标（未来）| 同上 | 同上 |

**理由**：
- 用户内容图标承载**用户表达**而非 chrome 视觉规范——强制 lucide 会剥夺用户语义自由（emoji 通常更直观）
- chrome 图标受 §12.1-§12.3 约束以保证系统视觉一致；用户内容图标形态自由，仅守 §13 颜色用法约束（v0.12 后默认中性、不作装饰，非「禁跨层」）

**当前 v1.0 实测**（`src-tauri/migrations/0002_seed.sql`）：
- `scene-plan`: `📐` 方案设计
- `scene-research`: `🔍` 调研
- `scene-debug`: `🔧` 排查

合规——属于「用户内容」分类（即使是 seed 数据，本质仍是用户可编辑字段）。

---

## 13. 视觉权重（layer 规约）

> **⚠️ v0.12 重定向（[[019-supersede-flat-visual-anchor]] Option A）**：旧版「视觉权重 = 哪一层有 ontology 颜色」前提已废。放弃颜色本体论后，视觉权重靠 **位置（ProtocolBand band / 区域归属）+ 形状（chip / 卡片 / 横条）+ typography rhythm + elevation** 表达，**不再靠颜色绑层**。

### 13.1 层规约（v0.12：颜色降为可选强调）

| 视觉层 | 模块 | 颜色（v0.12 后）| 视觉权重 |
|-------|------|-----------|---------|
| **协议层** | PhaseBar / AlignmentPhrases / Modifier | 默认中性；`--protocol` 紫降为**可选**强调，新组件优先中性 | 最高（哲学七）——靠 **ProtocolBand 位置 + 区域顶置**表达，非颜色 |
| **任务层** | Macro / Scene / Composition / SOP | 默认中性；`--task` 绿降为**可选**强调 | 高（高频，主战场）——靠**全景区位置 + 卡片密度**表达 |
| **辅助层（米灰）** | SearchBar / RecentList / StatusBar / meta | `--aux` + `--fg-*`（中性，不受变更影响）| 低（兜底 / 历史 / 状态）|
| **中性强调** | Header logo / 主操作 / 焦点环 / SettingsModal swatch（v0.11）| `--accent` family（物理隔离）| 中性——**不承载语义**，可由用户换 swatch |

> **中性强调 ≠ 第四语义层**（v0.11 / [[018-absorb-promptscape-design]]）：`--accent` 是 NEUTRAL 强调，物理独立于 ontology 三色 token，只染品牌标记/主操作/焦点环等中性面。它本就不承载 ontology 语义。
> （v0.12 备注：颜色本体论已降为可选强调（§2.4.1），ontology 三色与 `--accent` 同为「中性/可选强调」性质，二者区别从「语义 vs 非语义」弱化为「既有遗留强调 vs 品牌强调」；中性气质统一是新基线。原表述「swatch 不可能重染语义层」的 B2 论证已不需要——颜色不归 B2 管。）

### 13.2 颜色用法约束（v0.12：从「违宪」降为「视觉一致性」）

> **⚠️ v0.12 重大变更（[[019-supersede-flat-visual-anchor]]）**：本节旧标题「Cross-contamination = constitutional violation」已废。
> - **澄清**：颜色绑层从来不是 [[02-constitution#B2]] 的内容——B2（`02-constitution.md:54`）只管**结构分离**（AlignmentPhrase 不入 SOP / Macro 不展示 AlignmentPhrase 等，纯结构），不约束颜色。「跨层用色 = 违宪」是 v0.7-v0.11 自行拔高的措辞，本版撤回。
> - **新基线**：颜色不再绑层（§2.4.1），不存在「跨层污染」违规。下列仍有效的约束，依据是**视觉一致性 / 反装饰底线**，非宪法。

**v0.12 仍有效的颜色约束**（违反属视觉不一致，review 应拦，但非违宪）：

- ✅ 新组件**默认中性强调**（§2.4.4 `--accent`），不随手撒 `--protocol`/`--task`——保持 Promptscape 中性气质统一
- ✅ 颜色**不作装饰**（never gradient / never accent-of-month / never decorative outline）——这条是密度工具底线（§8.2 同源），不随颜色降级松动
- ✅ **drafts 三组件保持 aux 中性**（DraftCard 不按 target_type 染色，只用中性 `.ph-meta` 文字角标，§10.4.3）——drafts 是 promote 前暂态，中性最稳，且与「新组件默认中性」一致
- ✅ 若某组件**选择**保留 ontology 强调色（如既有 PhaseBar 紫），应整组一致，不在同一层内紫绿混用造成噪音

**code review 自检（v0.12）**：

1. 这个组件用了颜色强调吗？默认应否中性（§2.4.1 新基线）？
2. 颜色是否被当装饰用（gradient / 随意 outline）？是 → 拦
3. focused outline 统一 `--accent`（§11；v0.12 从 `--protocol` 改中性）

> **结构分离仍是铁律**：[[02-constitution#B2]] 的物理分离（AlignmentPhrase 不入 SOP / Macro 不展示 AlignmentPhrase / 不与 Macro 互转 / 不归属 Scene）**不受本次变更影响**——那是结构约束，与颜色无关，违反它才是真违宪。

### 13.3 视觉权重不靠尺寸蛮力

核心洞察：**视觉权重通过 typography rhythm + 位置 + elevation 表达，不通过 raw size**（v0.12：旧表述「+ ontology color」改为「+ 位置 + elevation」，因颜色本体论已放弃）。

- v0.6 PhaseBar 80px 高 → v0.7 收敛到 `--h-phasebar` 44px，视觉权重靠 typography + ProtocolBand 位置而非高度
- Macro 卡不需要"比 Scene row 大一档"，差异通过全景区位置 + 卡片形状 + 网格布局表达（不再靠 `--task` 绿边框）
- StatusBar 28px 高（最矮）不代表"不重要"，承载持续状态的视觉位置足够

---

**关联文件**：
- [[01-spec]] — 项目定位与哲学
- [[03-product-spec]] — UI 契约（信息架构 / 模块布局 / 用户旅程 / UI 草案）
- [[012-lock-visual-quality-anchor]] — 视觉锚点 ADR
- [[CLAUDE-DESIGN]] — Claude Design sticky context（视觉锚点 + ontology + 组件 pattern + states + icon 派生源）

---

## 修订记录

### v0.12（2026-06-26）— ⚠️ 重大涟漪 ADR-019：推翻 flat 锚点 + 放弃颜色本体论

涟漪 [[019-supersede-flat-visual-anchor]]（omar 拍板 **Option A**，[[012-lock-visual-quality-anchor]] 被 Superseded）。推翻 ADR-012 的「反 polish / Bloomberg-flat」视觉锚点：引入 subtle elevation + 放弃颜色本体论，全面对齐 Promptscape。🤝 共创起草，待 omar 人审。

| 章节 | 改动 |
|------|------|
| §2.4.1 | 颜色本体论从「hard rule / 违宪级」**降为视觉选择级**；三色 token 保留但不再强制绑层，新组件默认中性；删「跨层污染 = 违宪 [[02-constitution#B2]]」措辞，澄清颜色从来不是 B2 内容 |
| §5 | 反设计清单：撤反阴影；「颜色单一维度」条改为协议/任务区分靠**位置 + 形状**冗余编码（不靠颜色）|
| §6 | PhaseBar 激活态 `--protocol` 紫降为可选，可保留或转中性强调 |
| §8.1 | 锚点来源/优先级重定向：`ADR-019 > Promptscape > CLAUDE-DESIGN > bundle`；目标改「Linear typography + 密度 + subtle elevation」|
| §8.2 | 撤 `❌ box-shadow` hard exclusion；新增 **§8.2.1 elevation 允许范围**（`--shadow-*` token / 仅浮层类 / subtle / 禁 glow·inset·彩色·多层）|
| §10.1 | hover「NO shadow」→ 浮层类可加 subtle `--shadow-*` 抬起态 |
| §10.2 / §10.3 | primitive 层变体规则随颜色降级软化；PanoramaSeparator/DraftInbox「无阴影」改为「hairline 类不适用 elevation」|
| §13 | 整章重定向：视觉权重靠位置+形状+typography+elevation 而非 ontology 颜色；§13.2「Cross-contamination = constitutional violation」重写为「颜色用法约束（视觉一致性级）」；保留 drafts 中性 + 反装饰用色 + 结构分离铁律 |

**未触动**：[[02-constitution]] / [[01-spec]]——颜色本体论与反阴影底线住 design-spec（🤝 AI 可起草层），无 🧑 人主笔门槛（ADR-019 §3 校正）。

**下游待办**（Step 2-4，本次未做）：tokens.css 加 `--shadow-*`；[[CLAUDE-DESIGN]] 移除「No box-shadow」+ bump 重传；features/product-spec/CHANGELOG/MANIFEST 回写；8-15 组件 CSS 转中性 + 抬起态。

### v0.11（2026-06-25）— ADR-018 涟漪：Promptscape 设计吸收视觉契约

涟漪 [[018-absorb-promptscape-design]]（组合 A1+B1+C1+D+E）。把 Claude Design「Promptscape 全景仪表盘」设计稿按「改造现有组件」方式吸收，新增中性强调色 + 主题三态 + 三个 chrome 组件视觉。🤖 AI 主笔起草，待 omar 人审。

| 章节 | 改动 |
|------|------|
| §2.4.4（新增）| 中性强调色 token 族（`--accent` / `--accent-swatch-*` / `--accent-fg`）+ `--scrim` 遮罩；标注 B2 硬边界——强调色物理隔离于 ontology，只染中性面 |
| §2.5 | 标题改「暗色模式 + 主题三态」；补 `.dark` 显式钉死 + 三态（light/dark/system）切换契约；切换 API 更新为 settingsStore.applyAppearance 示意 |
| §10.3 | `MacroGrid` 改紧凑横条契约 / `ScenePanel` 改子阶段多列全景契约；新增 `Header` / `ProtocolBand` / `SettingsModal` 三行 |
| §10.8（新增）| 三个吸收组件视觉契约（Header slim 行 / ProtocolBand 协议层 band / SettingsModal 设置弹窗）+ B2 复检 |
| §13.1 | 层表加「中性强调（非 ontology）」行 + 显式声明「中性强调 ≠ 第四语义层」 |

**三处与设计稿偏离**（[[018-absorb-promptscape-design]] 记录）：去账号头像（spec §8.2）/ 不引 Modifier 右栏（B1）/ 省略全局「新建」按钮（避免死按钮）。

### v0.10（2026-06-21）— UI 一致性治理：共享 primitive 收敛

诊断主形态 UI「整体风格不一致」，定位根因 = **缺共享 primitives 层**：截至 v0.9，`primitives.module.css` 仅三件套，Card/Button/Input/Chip/EditorPanel 各组件复制 CSS 并漂移（editor 五件套复制 4 份、action/confirm 图标按钮复制 4 份、`.addBtn` 分叉成 text-pill vs icon-square、flash 动画重名定义 3 份、卡片圆角 `--r-3`/`--r-4` 混用）。本批为 A 阶段（自建 primitives 重构）提供视觉契约真源。🤖 AI 主笔起草，待 omar 人审。

**调研结论**（2 Agent + codex review）：不引样式组件库——styled libs（shadcn/Mantine/MUI 等）均带第二套 token 引擎与 tokens.css 双轨，且 shadcn 撞 ADR-009（拒 Tailwind）、MUI/Ant 运行时 CSS-in-JS 撞 C1 200ms。正解是自建 primitives。headless 库（Base UI/Radix）仅留作未来 a11y 行为层，本阶段不引（无 ADR）。

| 章节 | 改动 |
|------|------|
| §2.2 圆角 | 新增 surface→radius 归一表（hard rule）；**裁定卡片类 surface（Macro/Modifier/DraftCard）统一 `--r-4` 6px**，此前 Macro/Modifier 用 `--r-3` 4px 与「外层卡片 = `--r-4`」规则不一致 |
| §10.2 | 「三件套」→ **完整 primitive 清单**：§10.2.1 chrome 三件套（沿用）+ §10.2.2 新增 `CardSurface`/`ListRowSurface`/`Button`/`IconButton`/`Input`+`EditorInput`/`EditorPanel`+`EditorActions`/`Chip`/`ActionCluster`/`ConfirmInline`，含 task/protocol/neutral 层变体 + 「变体而非逐字抽取」原则 |
| §10.6（新增）| Card vs List 范式决策矩阵：按资产性质（信息量/粒度/操作密度/排列）判定；归属 hard rule（Macro/Modifier=Card，Scene/Composition/DraftInbox=List Row，AlignmentPhrases=Chip 行）|
| §10.7（新增）| Button 形态矩阵：形状(pill\|square)×层×意图(primary\|ghost\|subtle)；**裁定「新增」入口统一文字 pill**（ModifierGrid icon-square 加号改 pill），square 仅留无标签工具位 |
| §11 flash | 新增 flash 共享契约：单一 `ph-flash` `@keyframes` 真源落 primitives，禁组件本地重定义；语义色按层注入 |

**关键决策**：

1. **不引样式库，自建 primitives**——避免 token 双轨，守 ADR-009 / C1 / tokens.css 单一真源。
2. **圆角归一 `--r-4` 6px**（卡片类）——消除 `--r-3`/`--r-4` 漂移，与 §2.2 既有规则 + DraftCard 对齐。
3. **「新增」统一文字 pill**——`ModifierGrid` 四象限 icon-square 加号改文字 pill；icon-square 仅留无标签工具位。
4. **primitive 带层变体而非抹平**（采纳 codex）——`CompositionWorkbench`/`AlignmentPhrases` 局部差异通过变体表达，域内布局留本地。
5. **不开 ADR**——自建 primitives 无新依赖、无不可逆选型，design-spec 本身即决策记录。

**影响半径**：下游 A 阶段 `primitives.module.css` + 9 组件迁移（本次不动代码）；features.md (07) 回写 UI 一致性治理记录；product-spec 不动（Card vs List 属视觉范畴）；CLAUDE §4.1 token 铁律已有，codex 建议的裸值 lint gate 列为 A 阶段工程项不入本文。

**frontmatter**：version v0.9 → v0.10 / last_modified 2026-06-05 → 2026-06-21 / status ratified → draft（待人审）/ description 补 §10.6/§10.7/§11 flash。

**A 阶段验证要求**（codex review 最大风险 = 类抽取导致交互回归）：迁移 `MacroGrid`/`ModifierGrid`/`AlignmentPhrases`/`CompositionWorkbench` 后**必须**做键盘可达性 + 拖拽命中区 + focus 可见性 + task/protocol 分色的真机验证，不只跑 `pnpm test`。

### v0.9（2026-06-05）— ADR-016 涟漪：全景区可拖列布局视觉契约

回应 [[asset-editing-and-adaptive-layout]] P4 落地（Dashboard 固定 grid → `react-resizable-panels` v4 可拖列 + localStorage 持久化）：

| 章节 | 改动 |
|------|------|
| §10.3 组件清单 | 新增 `PanoramaSeparator`（v0.9）行——hairline baseline + hover 加深 + focus outline，无 polish |
| §10.5（新增）| 全景区可拖列布局机制 + **ADR-012 合规评估**（结论不违反：反设计清单 / 一屏全景 / 色块即本体三底线均守，列宽可调 ≠ 面板自由布局；布局存 localStorage 守 A2）|

**评估结论**：P3/P4 列机制变更未触动 [[012-lock-visual-quality-anchor]] 锚点，**无需修订 §8**，仅补 §10.5 + §10.3 一行。🤝 共创，待 omar 审。

**frontmatter**：version v0.8 → v0.9 / last_modified 2026-06-01 → 2026-06-05 / related 加 `[[016-choose-dnd-and-resizable-layout]]` + `[[asset-editing-and-adaptive-layout]]`。

### v0.8（2026-06-01）— ADR-015 涟漪：MCP write pipeline 组件视觉

回应 [[015-expose-mcp-write-pipeline]]（M-X.0 涟漪），承接 [[03-product-spec]] v0.7 留下的「视觉细节下沉 design-spec」缺口，落地 drafts 收件箱三组件视觉。本批 🤝 共创，2026-06-01 omar 审定升 `ratified`。

**审定轮清理（2026-06-01）**：

- §10.4.2 草稿 tab 激活态去掉自问自答的 `--protocol-8` 措辞，直接落定 `--surface-2` 背景 + `--border-3` 边框（aux 中性，杜绝实现者误染协议紫）。
- §10.4.1 PendingBadge 删 `focused` 态——定性为纯状态指示器（与 StatusBar 同性质），**不进 Tab cycle**，键盘入口走 Scene region（决策见 [[03-product-spec#13.4]]）。
- 本节「上游一致性发现」由「待裁决」更新为「已解决」（product-spec §4.0.4 已回补 📥 占位全局注）。

| 章节 | 改动 |
|------|------|
| frontmatter | version v0.7.1 → v0.8 / status ratified → draft / related 加 [[015-expose-mcp-write-pipeline]] / description 补 §10.4 |
| §10.3 组件清单 | 加 3 行：`PendingBadge` / `DraftInbox` / `DraftCard`（全 aux 层）|
| §10.4 新增（全节）| MCP write pipeline 组件视觉契约：10.4.1 PendingBadge（顶部 badge）/ 10.4.2 DraftInbox（Scene 草稿入口 + 列表）/ 10.4.3 DraftCard（草稿卡片 + promote/discard 双动作）|
| §12.3 icon 清单 | 加 `Inbox`（替代 emoji 📥）/ `Check`（promote）/ `Trash2`（discard）3 个 lucide icon |
| §13.2 cross-contamination | 加 DraftCard 违规示例（target_type 不得染 ontology 色）|

**关键决策**：

1. **层归属铁律**——drafts 是 promote 前暂态收件箱条目，未归属 ontology 层；三组件一律 **aux 中性层**（neutral scale + `--fg-*`），禁染 `--protocol` / `--task`。资产 promote 后才在 home region 取层色。
2. **lucide `Inbox` 替代 emoji 📥**——badge / 草稿 tab 是 **chrome**（应用自渲染），受 §8.2「禁 emoji as UI」+ §12「chrome 用 lucide」约束。区别于 Scene tab 的 📐🔍🔧（`scenes.icon` 用户内容，§12.4 豁免）。
3. **promote 按钮不染 task 绿**——按钮是「送草稿进任务层」的动作，自身非层成员，染绿会误读卡片为绿层；强调靠 `--w-500` 字重 + `Check` 图标，不靠色。
4. **复用既有 preset 零新增**——name→`.ph-card-title` / preview→`.ph-card-body` / provenance + target_type→`.ph-meta`，无需新 typography preset。

**上游一致性发现（已解决）**：[[03-product-spec]] §4.0.4 / §13.2 / §13.3 用「📥」字面 emoji 描述 badge 与草稿 tab，与本文 §8.2/§12 chrome lucide 铁律曾冲突。**已回补**：product-spec §4.0.4 末尾加全局占位注「全文『📥』为阅读占位符，实渲 lucide `Inbox`，下游以 lucide 为准」（2026-06-01 M-X.0 涟漪待决策 4 解决，采单条全局注而非逐处替换，零 churn）。两文 chrome 实渲口径已一致：badge / 草稿 tab 入口为 lucide `Inbox`，非 emoji。

**待办**（v0.8 外）：dark mode 对比度实测（§2.3.2，沿 v0.7.1 欠账）/ 辅形态完整视觉规范。

### v0.7.1（2026-05-25）— Phase 5 manual verify § 12 边界澄清

Phase 5 manual verify 截图自检时发现 Scene tab 用 emoji（`📐 🔍 🔧`，来源 `migrations/0002_seed.sql`），与原 §12 lucide-react hard rule 表面冲突。根因是 §12 未区分 chrome vs 用户内容边界。

**新增 §12.4「适用范围（chrome vs 用户内容）」**：
- §12.1-§12.3 lucide-react hard rule 只覆盖 **chrome 系统图标**（应用自身渲染的 UI 装饰：Flame / Search / Kbd 等）
- **用户内容图标**（Scene icon / 未来 Macro 自定义 / AlignmentPhrase 自定义）允许 emoji / 单字 / lucide name 等任意字符
- 当前 v1.0 seed `scene-plan`=📐 / `scene-research`=🔍 / `scene-debug`=🔧 属于用户内容，合规——不需改代码

**frontmatter**：version v0.7 → v0.7.1 / last_modified 保持 2026-05-25（同日小幅 patch）。

---

### v0.7（2026-05-25）— ADR-012 Phase 4 bundle 视觉锚点固化

回应 ADR-012 Claude Design handoff（Linear-class polish + Bloomberg density）的 design-spec 落地，分两阶段 commit：

**Stage 1（commit `1aa8324`）— §1-§7 token 命名 sync 到 `tokens.css` 单一真源**：

| 章节 | 改动 |
|------|------|
| §2.1 字号 | `--fs-xs ~ --fs-xl`（6 档）→ `--t-N`（5 主 + 2 sub-grid）|
| §2.2 间距 | `--space-N` → `--s-N` + sub-grid `--s-N_M`（bundle precision tier）+ §2.2.1 组件 anchor 高度 + §2.2.2 opacity token |
| §2.3 对比度 | 保留 light WCAG 实测；dark mode 实测延后 v0.7.1 |
| §2.4 颜色 | `--color-protocol-bg/border` → `--protocol/--task/--aux` ontology + neutral scale；cross-contamination = constitutional violation 明示 |
| §2.5 暗色模式 | v1.0 占位 → v1.0 已实装（dark default + light @media + `.light` class override + runtime API）|
| §3 动画 | 4 ease → 单 `--ease`；`--duration-*` → `--d-fast/base/slow` 200ms 硬封顶 |
| §6 PhaseBar | 高度 80px → `--h-phasebar` 44px（视觉权重靠 typography + ontology，非 raw 尺寸）|

**Stage 2（本 commit）— §8-§13 新增 6 章 bundle 派生**：

| 章节 | 内容 |
|------|------|
| §8 视觉锚点 | Linear-class polish / Bloomberg terminal × Linear typography manual + 7 条 hard exclusions（no shadow / no gradient / no glassmorphism / no skeu / 装饰禁 / radius ≤ 6px functional / animation ≤ 200ms）+ anchor 同步策略 |
| §9 Typography presets | 7 个 `.ph-*` preset（region-header / card-title / card-body / meta / hotkey / empty / code），固化字号+字重+行高+tracking+颜色 |
| §10 组件 pattern | border-only baseline + 共享 primitive 三件套（RegionHeader / EmptyState / Kbd）+ v1.0 8 组件清单 |
| §11 States | 9 态契约（default / hover / active / selected / focused / disabled / flash / loading / empty）+ focused outline 统一 `--protocol`（ontology 例外） |
| §12 Icon 系统 | lucide-react@^0.460.0 / 14px / `--op-icon` 0.7 / icon 不承载 ontology（跟随 text color）+ v1.0 已用 icon 清单（Flame / Search）|
| §13 视觉权重 | 三层规约 + cross-contamination = constitutional violation + code review 自检三问 + 视觉权重不靠尺寸蛮力 |

**frontmatter**：version v0.6 → v0.7 / status pre-code → ratified / related 加 `[[02-constitution]]` + `[[CLAUDE-DESIGN]]` / description 重写。

**待办**（v0.7 外）：
- Dark mode 对比度实测 → v0.7.1
- 辅形态视觉规范完整化 → 第五阶段实施前

### v0.6（2026-05-18）— 五审稿反哺批次 3

回应 2026-05-18 五审稿评分 5.5/10 的修缮，全面 token 化 + 实测对比度。

| 章节 | 改动 |
|------|------|
| §2.1 字号 | 9 档描述性条目收敛为 6 档命名 token（`--fs-xs` ~ `--fs-xl`），加 rem 列与字重约定 |
| §2.2 间距 | 散值表重写为 4px 基准 spacing token（`--space-1` ~ `--space-20`），50px → 48px 收敛到 grid，加 WCAG 2.5.5 热区下限 |
| §2.3 对比度 | "≥ 7:1" 口号改为 11 组实测数据表；暴露绿边框 `#1D9E75` 仅 2.98:1 未达 Non-text 3:1；**2026-05-18 已采纳候选 A `#178561`**（实测 4.05:1 ✓ Non-text）|
| §2.4 颜色 | 重写为 CSS Variables 表（3 层语义 × bg/border + alias），明确"任何文字必须用 `--color-text-primary` `#1A1A1A`"|
| §2.5 暗色模式（新增）| v1.0 占位声明 + 未来 token 命名约定 + 切换机制预案 + 启动前置条件 |
| §3 动画 | 时长 + easing token 化（`--duration-*` / `--ease-*`），原场景表加 token 引用 |

**待办**（不在本次修缮内）：
- ✅ ~~绿边框 `#1D9E75` → `#178561` 修订决策（§2.3 / §2.4 同步更新）~~ — 已于 2026-05-18 采纳候选 A，§2.3 / §2.4 同步完成；代码引用全替换 TODO 已写入 plan.md §0
- 第五阶段实施前细化辅形态完整视觉规范（§7.5 沿用）
- v1.1 主形态稳定后启动暗色模式实现

### v0.5（2026-05-18）— 拆分版

从原 `prompt-hub-prd.md` §4.3 视觉设计原则 + §13 UI 草案颜色编码部分拆出。
