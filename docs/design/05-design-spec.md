---
type: design-spec
project: prompt-hub
version: v0.7
created: 2026-05-18
last_modified: 2026-05-25
status: ratified
author: co  # 🤝 人机共创（CLAUDE §5.2）
related: [[01-spec]], [[02-constitution]], [[03-product-spec]], [[012-lock-visual-quality-anchor]], [[CLAUDE-DESIGN]]
description: 手动 AI 编程仪表盘的视觉规范——token 命名与 tokens.css 单一真源对齐（--t-/--s-/ontology + neutral scale），WCAG light 实测 + dark v1.0 实装；v0.7 加 §8 视觉锚点 / §9 typography presets / §10 组件 pattern / §11 states / §12 icon / §13 视觉权重 6 章 bundle 派生
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

#### 2.4.1 Ontology 三色（hard rule — carry meaning）

> 跨层污染（如紫色出现在 Macro 卡）= **违宪**，违反 [[02-constitution#B2]]（协议层与任务层物理分离）。

| Token | 值 | 角色 | 适用模块 |
|-------|----|------|---------|
| `--protocol` | `#534AB7` | 协议层（紫）| Modifier / AlignmentPhrase / PhaseBar |
| `--protocol-fg` | `#FFFFFF` | 协议层 fg（filled chip / button 上的文字）| 同上 filled 态 |
| `--protocol-8` | `rgba(83, 74, 183, 0.08)` | active press fill | PhaseBar 当前段 / chip pressed |
| `--protocol-16` | `rgba(83, 74, 183, 0.16)` | selected fill | PhaseBar 当前 Phase 持续选中 |
| `--task` | `#178561` | 任务层（绿）| Macro / Scene / Composition |
| `--task-fg` | `#FFFFFF` | 任务层 fg | 同上 filled 态 |
| `--task-8` | `rgba(23, 133, 97, 0.08)` | active press fill | Macro 卡 pressed |
| `--task-16` | `rgba(23, 133, 97, 0.16)` | selected fill | Macro 卡 selected/copying |
| `--aux` | `#888780` | 辅助层（米灰）| meta text / count / timestamp |

**Ontology 三铁律**：
1. 三色**绑定层**，跨层使用 = constitutional violation（[[02-constitution#B2]]）
2. 三色**仅作 ontology 标记**（边框 / chip fill / icon semantic state），never decoratively（never bg-gradient / never accent-of-month / never decorative outline）
3. 三色**不作正文文字**（filled 态下用配套 `-fg` token）— 用 `--fg-1` ~ `--fg-4` 替代

**颜色编码语义**（哲学映射）：
- 协议层（紫）= 哲学七视觉权重最高，余光感知 → 相位带、激活态
- 任务层（绿）= 高频使用要醒目 → Macro/Scene 主战场
- 辅助层（米灰）= 兜底 / 历史 / 状态，视觉压低 → meta / count / timestamp

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

### 2.5 暗色模式（v1.0 已实装）

**状态**：已实装（ADR-012 Phase 2 / commit `9a822d8`）。

**实装方式**：
1. **Dark 为 default** — `:root` 直接定义 dark neutral scale
2. **Light @media override** — `prefers-color-scheme: light` 自动切换（`:root:not(.dark)` selector）
3. **`.light` class override** — 手动 class 切换（绕开系统偏好，配置面板可控）

**为何 Dark 是 default**：
- 扫视优先场景下 dark UI 降低眼睛疲劳（驾驶舱仪表盘类比 — 夜航主导）
- 协议/任务/辅助三色（紫/绿/米灰）在 dark canvas 上对比度更高（待 §2.3.2 dark mode 实测确认）
- bundle 视觉锚点（Linear-class polish，[[012-lock-visual-quality-anchor]]）默认 dark surface

**切换 API**（v1.0 提供 runtime API，配置面板 UI 未做）：

```js
// 切到 light（绕开系统偏好）
document.documentElement.classList.add('light')
// 切回跟随系统
document.documentElement.classList.remove('light')
```

**未来扩展锚点**（v1.x backlog）：
- 配置面板手动开关 UI
- HDR / 高对比度模式（Accessibility）
- 切换动画（CSS transition `--canvas` / `--fg-1`）— **不在 v1.0 路径**

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

> bundle 视觉锚点的 hard exclusions（无 shadow / 无 gradient / 无 glassmorphism / 无 skeu / radius ≤ 6px / animation ≤ 200ms）见 §8.2；本节是 v0.5/v0.6 确立的反设计原则，与 §8.2 互补不重复。

| 反设计 | 理由 |
|--------|------|
| ❌ 小型 X 关闭按钮 | 扫视优先场景需要大热区 |
| ❌ 多层嵌套的菜单 | 违背一屏全景哲学（哲学二）|
| ❌ 需要悬停才显示的内容 | 主形态唤起后用户不会把鼠标停在界面上等待 tooltip |
| ❌ 依赖颜色单一维度传递信息 | 需要颜色 + 形状 + 位置多维度冗余编码 |
| ❌ 需要长按才能触发的操作 | 手动挡阶段不接受"藏起来"的功能 |
| ❌ 用花哨的图表 | 手动挡阶段追求信息密度，不是炫技 |
| ❌ 把配置项藏在设置页 | 常用配置应该在首屏就能调 |
| ❌ 用复杂的设置系统 | 每个配置项应该是"点一下就切换"的简单开关 |

---

## 6. 相位带视觉权重的特殊说明

相位带承载哲学七（协议对齐），是协议层视觉权重最高的模块。**v0.7 起视觉权重通过 typography + ontology color 而非 raw 高度体现**（bundle 锚点重定向 — Linear-class polish 用排版表达层级，非用尺寸蛮力）：

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

## 8. 视觉锚点（bundle / ADR-012 派生）

### 8.1 anchor 来源

> Linear-class polish — 锐利的 typography / 紧凑的 rhythm / 自信的 hierarchy — WITHOUT Linear 的 shadow / gradient / glassmorphism。
>
> 目标：**"a Bloomberg terminal that read Linear's typography manual"**。信息密度工具，不是营销表面。

视觉锚点来源：
- [[012-lock-visual-quality-anchor]] ADR-012 视觉决策（Linear typography + Bloomberg density）
- [[CLAUDE-DESIGN]] sticky context（Claude Design 创建 design system 时 sticky 应用）
- bundle preview HTML（设计师 / Claude Design output 视觉基线）

任何视觉决策与上述三源冲突时，**优先级**：ADR-012 > CLAUDE-DESIGN > bundle preview。

### 8.2 Hard exclusions（never generate）

| 禁项 | 理由 |
|------|------|
| ❌ `box-shadow`（任意轴 / 任意 blur）| Bloomberg 密度的对立面，密度工具不靠 shadow 制造层级 |
| ❌ `linear-gradient` / `radial-gradient` / `conic-gradient` | 营销表面属性，扫视场景视觉噪音 |
| ❌ `backdrop-filter` / `blur` / glassmorphism | Apple iOS 调性而非 Linear/Bloomberg；GPU 成本 |
| ❌ 拟物化（3D button / bevel / inner-glow）| Material 之前的视觉债，与 Linear-class polish 对立 |
| ❌ 装饰性插画 / mascot / emoji as UI | 信息密度工具不需要装饰 |
| ❌ functional surface `border-radius > 6px` | Linear/Bloomberg 圆角克制；overlay frame 例外（`--r-frame` 8px）|
| ❌ animation > 200ms | 与 [[02-constitution#C1]] 双重锁定 |

**违反 hard exclusion = 视觉锚点崩塌**，需走方法论 §7 八步流程开 ADR 推翻 ADR-012。

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
| hover | `--hairline` `--border-2`（darken）| transparent | preset 默认 | **NO shadow**（§8.2）|
| active (pressed) | `--hairline` `--border-3` | `--protocol-8` / `--task-8`（按层）| preset 默认 | 8% semantic fill |
| selected（持续）| `--hairline` `--protocol` / `--task` | `--protocol-16` / `--task-16` | preset / `-fg` filled 态 | 16% semantic fill + 同色边框 |
| focused（keyboard）| `--border-thick` `--protocol` outline | inherit prev | inherit prev | 2px outline-offset 1px |
| disabled | `--hairline` `--border-1` | transparent | `--fg-4` + `--op-dim` | NO semantic color |
| loading | skeleton bar | `--skeleton` / `--skeleton-hi` 动画 | hidden | neutral gray only，不染色 |
| empty | n/a | n/a | `.ph-empty` 中央 | 见 §10.3 EmptyState |

### 10.2 共享 primitive 三件套

bundle 派生的 3 个跨组件 primitive，避免重复实现：

| Primitive | 用途 | 视觉契约 |
|-----------|------|---------|
| `RegionHeader` | 每个区域顶部 header（图标 + 标题 + 右侧 meta count / action）| `--h-region-header` 40px / 内边距 `--s-3_5` 14px / typography `.ph-region-header` / 右侧 meta `.ph-meta` |
| `EmptyState` | 区域无数据时的中央提示 | 中央对齐 / typography `.ph-empty` / 与 region edge 距离 `--s-6` 24px |
| `Kbd` | 快捷键 badge（⌘K / ⌥Space / ⌘1-8）| 矩形 / `--r-1` 2px 圆角 / 内边距 `--s-0_5` 2px × `--s-1_25` 5px / typography `.ph-hotkey` |

**hard rule**：不允许组件自己实现 header / empty / kbd 视觉，必须用 primitive。实现见 `src/components/primitives/primitives.module.css`。

### 10.3 组件清单（v1.0）

| 组件 | 主层 | 高度 / 尺寸 | 典型 pattern |
|------|------|------|------|
| `SearchBar` | aux | `--h-quickfind` 36px | border-only + focused outline `--protocol` |
| `PhaseBar` | protocol | `--h-phasebar` 44px | border-only segmented + active 段 `--protocol-8` + 2px `--protocol` 下边框 |
| `AlignmentPhrases` | protocol | `--h-phrases` 44px | chip 行（`--h-chip` 24px），每 chip border-only + clicked → flash `--protocol-16` |
| `MacroGrid` | task | 3-col grid（最小卡 `--s-12` 48px）| 卡 border-only + hover darken + active `--task-8` / Flame icon |
| `ScenePanel` | task | row `--h-scene-row` 32px | row border-only + active `--task-8` |
| `RecentList` | aux | 行列表 | row border-only + meta time 右侧 |
| `SopProgress` | task | 进度条 | `--skeleton` 底 + `--task` 填充 |
| `StatusBar` | aux | `--h-statusbar` 28px | dot + meta text + 右侧 Kbd 群 |

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

**hard rule**：focused 不可省略（键盘用户 + Accessibility）。focused outline 必须用 `--protocol`（协议层强调色，所有组件统一）— 这是 ontology 的例外：focused 不承载 ontology 含义，统一用 `--protocol` 是无障碍标准。

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

**hard rule**：新增 icon 需评估是否必要——bundle 视觉密度下 icon 不是默认装饰，能用 typography 表达就不引 icon。

---

## 13. 视觉权重（layer 颜色规约 hard rule）

> 视觉权重不是"哪个组件大"，是"哪一层有 ontology semantic 颜色"。

### 13.1 三层规约

| 视觉层 | 模块 | ontology 色 | 视觉权重 |
|-------|------|-----------|---------|
| **协议层（紫）** | PhaseBar / AlignmentPhrases / Modifier | `--protocol` family | 最高（哲学七，余光感知）|
| **任务层（绿）** | Macro / Scene / Composition / SOP | `--task` family | 高（高频使用，主战场）|
| **辅助层（米灰）** | SearchBar / RecentList / StatusBar / meta | `--aux` + `--fg-*` | 低（兜底 / 历史 / 状态）|

### 13.2 Cross-contamination = constitutional violation

> 三色绑定层，跨层使用 = 违反 [[02-constitution#B2]]（协议层与任务层物理分离）。

**典型违规**：

- ❌ Macro 卡用紫色边框（紫属协议层，Macro 属任务层）
- ❌ AlignmentPhrase chip 用绿色 fill（绿属任务层，chip 属协议层）
- ❌ StatusBar dot 用紫色表示"普通状态"（紫是协议层 ontology，不是装饰）

**code review 自检三问**：

1. 这个组件属于哪一层？（protocol / task / aux）
2. 我用的 ontology 色是这一层的吗？
3. 如果跨层了，是不是 §11 focused outline 例外？

任一答案为否 → **不许 merge**。

### 13.3 视觉权重不靠尺寸蛮力

bundle 视觉锚点的核心洞察：**视觉权重通过 typography rhythm + ontology color 表达，不通过 raw size**。

- v0.6 PhaseBar 80px 高 → v0.7 收敛到 `--h-phasebar` 44px，视觉权重靠 ontology + typography 而非高度
- Macro 卡不需要"比 Scene row 大一档"，差异通过 `--task` 边框 + 网格布局表达
- StatusBar 28px 高（最矮）不代表"不重要"，承载持续状态的视觉位置足够

---

**关联文件**：
- [[01-spec]] — 项目定位与哲学
- [[03-product-spec]] — UI 契约（信息架构 / 模块布局 / 用户旅程 / UI 草案）
- [[012-lock-visual-quality-anchor]] — 视觉锚点 ADR
- [[CLAUDE-DESIGN]] — Claude Design sticky context（视觉锚点 + ontology + 组件 pattern + states + icon 派生源）

---

## 修订记录

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
