---
type: workflow
project: prompt-hub
status: active
version: v0.1
created: 2026-05-24
audience: [human, ai]
description: prompt-hub 在 Claude Design (claude.ai/design) 上的 per-task prompt 模板与工作流——配合 [[CLAUDE-DESIGN]] sticky context 使用，覆盖全主形态 mockup / 单组件 / 状态规格三类任务 + 回流仓库的 handoff 路径 + 迭代 checklist + footguns
related:
  - CLAUDE-DESIGN
  - 012-lock-visual-quality-anchor
  - 05-design-spec
  - 03-product-spec
---

# Claude Design Prompt 模板与工作流

> **前提**：已按 [[CLAUDE-DESIGN]] 在 `claude.ai/design` 创建 `prompt-hub Design System`。本文件的 prompt 模板都依赖该 sticky context 自动应用色块即本体 / 反设计禁忌 / typography 组合 / 组件清单——**不要在每个 prompt 里重复**。

---

## §1 整体工作流

```
一次性 Setup（半年级生效）：
  CLAUDE-DESIGN.md → 上传 claude.ai/design → "prompt-hub Design System"

每次 Task：
  选 prompt 模板（α/β/γ） → 填占位符 → 附现状截图 → Claude Design 生成
    ↓
  Wireframe 验布局 → 切 HiFi 验质感 → branch 而不是覆盖
    ↓
  "Handoff bundle to Claude Code" 导出
    ↓
  docs/mockups/v2/<task-name>/
    ↓
  Claude Code 翻译 HTML → React + CSS Modules（必须用 token，不能裸值）
    ↓
  src/components/<component>/  →  pnpm lint 验证
```

---

## §2 三类任务的 prompt 模板

### Task α — 全主形态 mockup（一屏全景）

适用：重做整张主形态 / 大区域改版。

```
Mode: Prototype → Wireframe first, then toggle HiFi.

Goal: One-screen main-form panorama for prompt-hub (Tauri overlay, 1440×900 viewport).

Regions (top to bottom, fixed):
1. SearchBox (36px tall, full-width)
2. PhaseBar (protocol-purple, ~48px tall, horizontal chips)
3. MacroGrid (3-col task-green cards, fills ~40% vertical)
4. SceneList (task-green rows, fills ~25%)
5. RecentStrip (horizontal scroll, ~80px)
6. StatusBar (24px, --color-aux only)

Constraints:
- Fit ALL regions on one screen at 1440×900. No vertical scroll on primary path.
- Information density target: Linear issue list. Not Notion.
- Apply ALL Hard Exclusions from design system.
- Color-as-ontology is mandatory: purple ONLY on PhaseBar, green ONLY on MacroGrid/SceneList.

Out of scope:
- Settings, onboarding, secondary windows
- Hover/active states (separate prompt)
- Any modal or overlay

Reference image attached: [SCREENSHOT_OF_CURRENT_ENGINEER_WIREFRAME] — this is what NOT to do. Same regions, but visual treatment is amateur. Replace, do not iterate.

Deliver: wireframe first. I'll branch to HiFi after I approve structure.
```

### Task β — 单组件（孤立画布）

适用：一次只验一个组件的 chrome / 状态 / typography。**推荐第一个真实任务用 β，验证整条管线**。

```
Mode: Prototype → HiFi.

Component: [COMPONENT_NAME] (single instance, isolated on canvas).

Spec:
- Width [W]px, height auto (target ~[H]px)
- 1px solid var(--color-[LAYER]) border, [RADIUS]px radius
- Padding: [P]px
- Content: title (14px/500) + 2-line preview (13px/400/--color-text-secondary, ellipsis) + meta row (use-count + last-used, 12px/--color-aux, tabular-nums)
- Hotkey badge top-right corner: monospace 12px, neutral gray box

States to render side-by-side: default / hover / active / focused / disabled / loading-skeleton / empty.

Hard constraints: no shadow, no gradient, no fill on default state (border-only). Active = bg at 8% var(--color-[LAYER]).

Out of scope: card click behavior, drag-reorder, context menu.
```

### Task γ — 状态规格 sheet

适用：补 design-spec v0.7 状态章节、生成空 / loading / disabled / error 视觉样本。

```
Mode: Prototype → HiFi → Slide-deck export.

Generate a state-spec sheet for [SCENARIO_LIST]:
1. [SCENARIO_1] — [LAYOUT_HINT]
2. [SCENARIO_2] — [LAYOUT_HINT]

For each: render default, loading, empty, error. Each state on its own slide with a 1-line caption.

Constraints: all Hard Exclusions apply. Empty state uses --color-text-tertiary centered hint, no illustration.

Export: slide deck PDF + HTML. I'll pull screenshots into design-spec v0.7 §state-spec.
```

---

## §3 输出 → 仓库 handoff workflow

1. Claude Design 内迭代到满意（wireframe → HiFi → approve）
2. 用 **"Handoff to Claude Code"** 导出 bundle（HTML + assets + `claude-code-instructions.md`）
3. 落到 `docs/mockups/v2/<task-name>/`（**不要**覆盖 `docs/mockups/prompt-hub.html`，旧版留作 archive）
4. 在仓库根目录开 Claude Code，指向 `docs/mockups/v2/<task-name>/claude-code-instructions.md`，让 Claude Code 把 HTML 翻译成 React + CSS Modules，使用 `src/styles/tokens.css` 现有 token
5. Claude Code 必须替换所有字面量 hex / px / ms 为 `var(--*)` 引用（[[CLAUDE#§4.1]] 铁律）。`pnpm lint` 验证
6. 跑下方 [§5 迭代 checklist](#§5-迭代-checklist) 做宪法 review
7. 合入 `src/components/<component>/` 后，**第一阶段** mockup 全部迁完时把 `docs/mockups/prompt-hub.html` → `docs/mockups/archive/v1-engineer-aesthetic.html`

---

## §4 Mode 选择速查表

| 任务类型 | Claude Design Mode | Fidelity | 输出形态 |
|---|---|---|---|
| 全主形态布局验证 | Prototype | Wireframe 先 → HiFi | HTML（in-canvas） |
| 单组件视觉验证 | Prototype | HiFi | HTML + 状态对比图 |
| 状态规格 sheet | Prototype | HiFi | Slide deck PDF + HTML |
| design-spec 文档插图 | Slide deck | — | PDF / PPTX |
| 不知道选什么 | Other（沙盒） | — | 自由探索后再迁正式 mode |

---

## §5 迭代 checklist

每次 Claude Design 生成后跑一遍，**全 ✅ 才能进 handoff**：

- [ ] 三个语义色（紫 / 绿 / 米）**只**出现在各自归属区域，无交叉污染
- [ ] Zero 阴影 / 渐变 / 模糊（放大 200% 查边缘）
- [ ] 1440×900 一屏适配，主路径无垂直滚动
- [ ] 信息密度 ≥ Linear issue list（数主形态可见数据点，应 ≥ 30）
- [ ] Typography hierarchy 在 <2 秒内能读出层次（眯眼测试）
- [ ] UI chrome 无 emoji（只 lucide icons）
- [ ] 所有间距是 4px 倍数（抽 5 个 gap 验）
- [ ] **Branch 决策**：结构问题 → 新 branch `v2-<change>`。Polish 问题 → 同画布 inline 评论。不要混
- [ ] **宪法 B2 自检**：拿掉颜色还能不能传达本体？能 → ontology 正确。不能 → 颜色是装饰 → reject

---

## §6 Footguns（prompt-hub × Claude Design 专属雷区）

### F1 — 别用「Linear」预设 design system
Linear 预设的 brand-purple **看似与** `--color-protocol` `#534AB7` 接近，**实际语义完全不同**：Linear 的紫是品牌色（装饰性），你的紫是协议层本体（语义性）。预设会在颜色决策上**静默覆盖**你的 sticky context，结果是「看起来对、ontology 错」。**必须自建 `prompt-hub Design System`**。

### F2 — 别跳过 Wireframe mode 「省一步」
HiFi-first 时 DS 层颜色会**掩盖结构问题**——你会 approve 一个漂亮但结构错的 mockup，到实施阶段才发现「为什么感觉不对」。Wireframe 关掉 DS 层强制只看布局/层级/留白，**这正是工程师审美**最容易出错的地方。

### F3 — 别把 `05-design-spec.md` 原文塞给 Claude Design
原文 306 行**只有 token 没有组合规则**，Claude Design 会把它理解为「这些是颜色，装饰性使用」，**完全丢失 ontology**。[[CLAUDE-DESIGN]] 是正确的压缩：token + 语义映射 + 反设计禁忌 + typography 组合，全在 ~50 行里。**只上传 [[CLAUDE-DESIGN]]，不上传 design-spec**。

---

## §7 相关

- 上游 sticky context：[[CLAUDE-DESIGN]]
- 决策依据：[[012-lock-visual-quality-anchor]]（Linear 整体气质锚定）
- 视觉契约：[[05-design-spec]]（token 体系）/ [[03-product-spec]] §13（区域结构）
- 宪法约束：[[02-constitution]] B2 色块即本体 / §5 反设计清单
- bump 规则：[[~/Vault/知识库/方案模板/产品文档体系方法论#§7]] 八步流程
