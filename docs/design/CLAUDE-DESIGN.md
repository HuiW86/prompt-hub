---
type: design-context
project: prompt-hub
status: active
version: v0.1
created: 2026-05-24
audience: [ai, claude-design]
description: prompt-hub 在 Claude Design (claude.ai/design) 上的 sticky context 派生文件——一次性上传到 Claude Design 创建 "prompt-hub Design System"，此后所有 design task 自动应用；派生自 [[02-constitution]] + [[05-design-spec]] + [[012-lock-visual-quality-anchor]]，上游变更需同步 bump
related:
  - 02-constitution
  - 05-design-spec
  - 012-lock-visual-quality-anchor
  - claude-design-prompts
---

# CLAUDE-DESIGN.md — Claude Design sticky context

> **用法**：
> 1. 在 `claude.ai/design` 切到 **Design systems** tab → **Create new design system**
> 2. 命名为 `prompt-hub Design System`
> 3. 复制下方 `---` 分隔线以下的全部内容粘贴进去（或直接上传本 .md 文件，Claude Design 会自动解析）
> 4. 此后所有 Prototype mode 任务下拉选 `prompt-hub Design System`，sticky context 自动应用
>
> **bump 规则**（[[~/Vault/知识库/方案模板/产品文档体系方法论#§7]] 八步流程）：上游 [[02-constitution]] / [[05-design-spec]] / [[012-lock-visual-quality-anchor]] 变更时，本文件同步 bump version，重新上传 Claude Design 替换旧 design system

---

# prompt-hub — Claude Design system context

## What this app is (one sentence)
A Tauri desktop dashboard for AI-coding workflow, woken by ⌥Space as a full-screen overlay. Information density tool, not a marketing surface.

## Aesthetic anchor
Linear-class polish (sharp typography, tight rhythm, confident hierarchy) — WITHOUT Linear's shadows, gradients, or glassmorphism. Target: a Bloomberg terminal that read Linear's typography manual.

## Hard exclusions (never generate)
- No box-shadow (any axis, any blur)
- No gradients (linear, radial, conic)
- No backdrop-filter / blur / glassmorphism
- No skeuomorphic affordances (3D buttons, bevels, inner-glow)
- No decorative illustrations, mascots, emoji as UI
- No rounded corners > 6px on functional surfaces
- No animation > 200ms

## Color-as-ontology (HARD RULE — colors carry meaning, not vibe)
- `--color-protocol`: `#534AB7` (purple) — 协议层 / Modifier / AlignmentPhrase. Used ONLY on protocol-layer surfaces.
- `--color-task`: `#178561` (green) — 任务层 / Composition / Macro / Scene. Used ONLY on task-layer surfaces.
- `--color-aux`: `#888780` (beige) — 辅助层 / metadata, counts, timestamps.
- Neutral grays for chrome, borders, text. Never use the three semantic colors decoratively.
- Cross-contamination (e.g. purple on a Macro card) is a constitutional violation.

## Typography combos
- App title / region header: `--fs-md` (14px) / weight 600 / `--color-text-primary` / tracking -0.01em
- Card title: `--fs-md` (14px) / weight 500 / `--color-text-primary`
- Card body / phrase preview: `--fs-sm` (13px) / weight 400 / `--color-text-secondary` / line-height 1.45
- Meta (count, timestamp): `--fs-xs` (12px) / weight 400 / `--color-aux` / `font-feature-settings: "tnum"`
- Hotkey badge: `--fs-xs` / weight 500 / monospace / `--color-text-secondary`
- Empty state: `--fs-sm` / weight 400 / `--color-text-tertiary` / centered

## Component patterns inventory
- **SearchBox**: top region, full-width, hotkey-hint right-aligned, 36px height
- **PhaseBar**: horizontal protocol-purple chips; selected = filled, unselected = 1px border
- **MacroGrid**: 3–4 col grid of task-green-bordered cards; card = title + 2-line preview + meta-row (use-count, last-used)
- **SceneList**: vertical task-green-bordered rows, denser than MacroGrid
- **RecentStrip**: bottom region, horizontal scroll, mixed protocol/task chips (color = origin layer)
- **StatusBar**: 24px tall, `--color-aux` text, system status only

## States (every component must define)
- default
- hover (1px border darken, NO shadow)
- active (filled bg at 8% semantic color)
- focused (2px outline at semantic color)
- disabled (40% opacity, NO semantic color)
- loading (skeleton bar, neutral gray only)
- empty (centered hint text)

## Layout
- One-screen panorama: 5 regions + status bar, NO scrolling on primary path
- Grid: 8px base unit, all spacing = multiple of 8 (or 4 for tight cases)
- Density target: comparable to Linear's issue list, not Notion's doc

## Icon system
- Library: `lucide-react` (stroke 1.5px, 16px default)
- No emoji in UI chrome
- Icon color follows text color, never semantic colors (icons are not ontological)
