---
type: design-context
project: prompt-hub
status: active
version: v0.2
created: 2026-05-24
last_modified: 2026-06-26
audience: [ai, claude-design]
description: prompt-hub 在 Claude Design (claude.ai/design) 上的 sticky context 派生文件——一次性上传到 Claude Design 创建 "prompt-hub Design System"，此后所有 design task 自动应用；派生自 [[02-constitution]] + [[05-design-spec]] + [[019-supersede-flat-visual-anchor]]，上游变更需同步 bump。v0.2：涟漪 ADR-019——移除「No box-shadow」hard exclusion + 加 subtle elevation + 颜色本体论降为可选中性，⚠️ 须重新上传 Claude Design 替换旧 design system
related:
  - 02-constitution
  - 05-design-spec
  - 012-lock-visual-quality-anchor
  - 019-supersede-flat-visual-anchor
  - claude-design-prompts
---

# CLAUDE-DESIGN.md — Claude Design sticky context

> **用法**：
> 1. 在 `claude.ai/design` 切到 **Design systems** tab → **Create new design system**
> 2. 命名为 `prompt-hub Design System`
> 3. 复制下方 `---` 分隔线以下的全部内容粘贴进去（或直接上传本 .md 文件，Claude Design 会自动解析）
> 4. 此后所有 Prototype mode 任务下拉选 `prompt-hub Design System`，sticky context 自动应用
>
> **bump 规则**（[[~/Vault/知识库/方案模板/产品文档体系方法论#§7]] 八步流程）：上游 [[02-constitution]] / [[05-design-spec]] / [[019-supersede-flat-visual-anchor]] 变更时，本文件同步 bump version，重新上传 Claude Design 替换旧 design system
>
> **⚠️ v0.2 待重传**：本版按 ADR-019 移除「No box-shadow」+ 颜色降级，omar 须重新上传替换旧 design system，否则后续 design task 仍按旧 flat 锚点产出

---

# prompt-hub — Claude Design system context

## What this app is (one sentence)
A Tauri desktop dashboard for AI-coding workflow, woken by ⌥Space as a full-screen overlay. Information density tool, not a marketing surface.

## Aesthetic anchor
Linear-class polish (sharp typography, tight rhythm, confident hierarchy) **+ subtle elevation** (Promptscape raised feel), WITHOUT gradients or glassmorphism. High-density information tool with a quiet sense of depth — Linear's typography manual, with subtle drop-shadows for layering.

## Hard exclusions (never generate)
- No gradients (linear, radial, conic)
- No backdrop-filter / blur / glassmorphism
- No skeuomorphic affordances (3D buttons, bevels, inner-glow) — note: subtle drop-shadow elevation is NOT skeuomorphism, it is allowed (see Elevation below)
- No decorative illustrations, mascots, emoji as UI
- No rounded corners > 6px on functional surfaces
- No animation > 200ms

## Elevation (allowed since ADR-019)
- Subtle drop-shadow on floating surfaces ONLY: card / banner / overlay / popover raised & hover states
- Subtle = low alpha, small blur, near y-offset (express layer, not drama)
- No glow / no colored shadow / no inset shadow / no multi-layer shadow
- Shadow supplements the hairline border, never replaces it
- Hairline dividers / region separators get NO shadow

## Color (neutral-default — ADR-019 dropped colour-as-ontology)
- **Default to neutral**: new components use a neutral accent (`--accent`, default high-contrast neutral), NOT the legacy purple/green.
- Protocol vs task is distinguished by **position (ProtocolBand / region) + shape (chip / card / strip)**, NOT colour.
- Legacy ontology accents (optional, kept for existing components): `--protocol` `#534AB7` purple, `--task` `#178561` green, `--aux` `#888780` beige.
- These colours no longer carry mandatory meaning and are NOT bound to a layer. "Cross-contamination" is no longer a violation.
- Never use any colour decoratively (no gradient, no accent-of-the-month) — that density-tool floor still holds.

## Typography combos
- App title / region header: `--fs-md` (14px) / weight 600 / `--color-text-primary` / tracking -0.01em
- Card title: `--fs-md` (14px) / weight 500 / `--color-text-primary`
- Card body / phrase preview: `--fs-sm` (13px) / weight 400 / `--color-text-secondary` / line-height 1.45
- Meta (count, timestamp): `--fs-xs` (12px) / weight 400 / `--color-aux` / `font-feature-settings: "tnum"`
- Hotkey badge: `--fs-xs` / weight 500 / monospace / `--color-text-secondary`
- Empty state: `--fs-sm` / weight 400 / `--color-text-tertiary` / centered

## Component patterns inventory
- **SearchBox**: top region, full-width, hotkey-hint right-aligned, 36px height
- **PhaseBar**: horizontal chips (neutral by default; legacy purple optional); selected = filled, unselected = 1px border; protocol identity carried by ProtocolBand position
- **MacroGrid**: 3–4 col grid of neutral-bordered cards; card = title + 2-line preview + meta-row (use-count, last-used)
- **SceneList**: vertical neutral-bordered rows, denser than MacroGrid
- **RecentStrip**: bottom region, horizontal scroll, neutral chips (origin shown by shape/label, not colour)
- **StatusBar**: 24px tall, `--color-aux` text, system status only

## States (every component must define)
- default
- hover (1px border darken; floating surfaces may add subtle elevation, hairline/dividers do not)
- active (filled bg at 8% accent)
- focused (2px outline at accent)
- disabled (40% opacity, neutral only)
- loading (skeleton bar, neutral gray only)
- empty (centered hint text)

## Layout
- One-screen panorama: 5 regions + status bar, NO scrolling on primary path
- Grid: 8px base unit, all spacing = multiple of 8 (or 4 for tight cases)
- Density target: comparable to Linear's issue list, not Notion's doc

## Icon system
- Library: `lucide-react` (stroke 1.5px, 16px default)
- No emoji in UI chrome
- Icon color follows text color (icons are not ontological)
