# prompt-hub Design System

A design system for **prompt-hub** — a Tauri desktop dashboard for AI-coding workflows. The app is a full-screen overlay woken by ⌥Space; it is an **information density tool**, not a marketing surface.

> **Visual anchor:** Linear-class polish (sharp typography, tight rhythm, confident hierarchy) **without** shadows, gradients, or glassmorphism. Target: a Bloomberg terminal that read Linear's typography manual.

---

## Source materials

This system was authored directly from a written brief — there was **no** attached codebase, Figma file, or screenshots. All values (colors, typography presets, layout regions, exclusions) come from the brief reproduced below. If a codebase exists, attach it and we will reconcile token names + component implementations.

- Codebase: _not provided_
- Figma: _not provided_
- Screenshots: _not provided_

---

## Product surfaces

prompt-hub is **one product, one surface**: a full-screen overlay that takes over the desktop when summoned. The overlay is decomposed into **5 regions + a status bar**, arranged as a single-screen panorama (no scroll on the primary path):

1. **PhaseBar** — protocol layer. Shows the current Modifier and AlignmentPhrase. Uses the purple ontology color.
2. **AlignmentPhrase chips** — protocol layer. The "what are we aligned on right now" surface. Purple.
3. **MacroGrid** — task layer. Compositions of macros the user can fire. Green ontology color.
4. **SceneList** — task layer. Active scenes (sessions / runs). Green.
5. **Aux / metadata column** — counts, timestamps, file paths, run counts. Beige aux color, never decorative.

Plus a **StatusBar** along the bottom — connection state, agent state, current model, keyboard hint strip.

---

## Color-as-ontology (hard rule)

Colors **carry meaning**, not vibe. Cross-contamination (e.g. purple used on a Macro card) is a hard violation. There are exactly three ontological hues:

| Token | Hex | Layer | Used on |
| --- | --- | --- | --- |
| `--protocol` | `#534AB7` | Protocol | PhaseBar, AlignmentPhrase chips, Modifier indicators |
| `--task` | `#178561` | Task | MacroGrid cards, SceneList rows, run buttons |
| `--aux` | `#888780` | Aux | Counts, timestamps, file paths, secondary meta |

Everything else (chrome, borders, text, hover bg) is a neutral gray.

Icons follow **text** color, never semantic color — icons are not ontological.

---

## Hard exclusions

Never generate any of these:

- `box-shadow` (any axis, any blur)
- gradients (linear, radial, conic)
- `backdrop-filter`, blur, glassmorphism
- skeuomorphic affordances (3D buttons, bevels, inner-glow)
- decorative illustrations, mascots, emoji as UI chrome
- rounded corners > 6px on functional surfaces
- animation > 200ms

---

## Typography presets

Not just tokens — these are the only typographic treatments allowed:

| Preset | Size / Weight / Tracking | Notes |
| --- | --- | --- |
| Region header | 14px / 600 / -0.01em | Caps region titles ("Macros", "Scenes") |
| Card title | 14px / 500 | Macro / scene names |
| Card body | 13px / 400 / 1.45 | Secondary text color |
| Meta | 12px / 400 / tabular-nums | Counts, timestamps, durations — aux color |
| Hotkey badge | 12px / 500 / mono | Inline keyboard hints |
| Empty state | 13px / 400 / tertiary | Centered, no illustration |

See `colors_and_type.css` for the token + semantic-class form, and the **Type** cards in the Design System tab for live specimens.

---

## States (every component implements these)

| State | Visual change |
| --- | --- |
| default | base treatment |
| hover | 1px border darken, **no** shadow |
| active | 8% semantic-bg fill |
| focused | 2px outline at the surface's semantic color |
| disabled | 40% opacity, no semantic color |
| loading | gray skeleton only |
| empty | centered hint, no illustration |

---

## CONTENT FUNDAMENTALS

prompt-hub copy is **terminal-curt**, not friendly. It reads like a system status line, not a SaaS dashboard. Specifics:

- **Tone:** factual, declarative, present tense. Never apologetic, never enthusiastic. Closer to `git status` than to "Welcome back!"
- **Casing:** Sentence case for labels and titles ("Active scenes", not "Active Scenes" and not "ACTIVE SCENES"). Region headers are sentence case too — weight + tracking do the hierarchy work, not caps.
- **Pronouns:** **Neither I nor you.** Address the system, not the user. "3 scenes running" — not "You have 3 scenes running." "No macros yet" — not "You haven't created any macros."
- **Numbers:** Always numeric, never spelled out, even at low counts. "1 scene", not "one scene". Use tabular-nums so columns of numbers stay aligned.
- **Time:** Relative for recent ("2m", "14s ago"), absolute past 24h ("Mar 14 09:42"). Never "yesterday" or "earlier today".
- **Empty states:** A noun-phrase fragment, not a sentence. "No macros." "No active scenes." Optionally followed by a single hotkey hint ("⌘N to create"). Never an apology, never an illustration.
- **Errors:** Same register — what failed and what to do, in <12 words. "Connection lost. ⌘R to retry." Not "Oh no! Something went wrong."
- **Emoji:** **Never.** Not in copy, not in UI chrome, not in empty states. Unicode arrow / box glyphs (→, ⌘, ⌥, ⇧) are acceptable when they carry meaning.
- **Hotkey notation:** Mac modifier glyphs (⌘ ⌥ ⇧ ⌃) followed by the key, monospace, no plus sign. `⌘N`, `⌥Space`, not `Cmd+N`.
- **Vibe:** A trader's terminal. A pilot's checklist. A `ps aux` you wanted to read.

### Examples

| ✓ | ✗ |
| --- | --- |
| `3 scenes · 12m` | `You have 3 scenes running for 12 minutes ✨` |
| `No macros.` | `No macros yet — let's create one!` |
| `Connection lost. ⌘R to retry.` | `Oops! We couldn't reach the server.` |
| `Macros` | `MACROS` / `Your Macros` |
| `⌘N new scene` | `Press Cmd+N to create a new scene` |

---

## VISUAL FOUNDATIONS

**Color vibe.** Cool-neutral grays — slight blue undertone, never warm. The three semantic hues (`#534AB7`, `#178561`, `#888780`) read as ink-on-paper, not as brand colors. No semantic color appears decoratively; if you see purple on screen, it means *protocol layer*, full stop.

**Light & dark.** Both modes ship. Default surface in dark mode is `#0E0E10` (near-black with a 2pt blue lift); in light mode `#FAFAF9`. There is no pure black and no pure white anywhere.

**Backgrounds.** Flat fills only. No images, no textures, no gradients, no patterns, no full-bleed photos. The closest thing to "decoration" is the 1px region divider lines.

**Typography.** Geist Sans (UI) + Geist Mono (hotkeys, paths, counts). Tracking is tight (-0.01em on headers). Numbers are always tabular. Optical sizing is on. Body text uses 1.45 line-height; UI labels are line-height 1.2.

**Spacing.** 8px base grid; 4px allowed for tight cases (chip internal padding, icon-to-label gaps). Region gaps are 16px or 24px. No spacing value above 32px on the primary surface.

**Borders.** Hairline 1px, neutral. `border-radius` ≤ 6px on every functional surface — most surfaces are 4px, chips are 3px, the overlay frame itself is 8px (the only exception, and only because it's the outermost edge). No rounded-pill buttons.

**No shadow system.** None. Surfaces sit on the canvas directly. Elevation is communicated by **border contrast and background fill**, never by shadow.

**Hover.** Border darkens by one step (one neutral-scale token). Background fill does **not** brighten. Cursor changes to `pointer`. No transform, no scale, no shadow lift.

**Press / active.** Background fills with the surface's own semantic color at 8% opacity. So pressing a Macro card flashes a faint green; pressing an AlignmentPhrase chip flashes a faint purple. The fill is the only state cue.

**Focus.** 2px outline in the surface's semantic color, offset 0 (sits on the border). Focus rings are the **only** place semantic color appears as an outline-like cue.

**Animation.** 120–200ms, `cubic-bezier(0.2, 0, 0, 1)` for state changes; `linear` for skeleton shimmer. No bounces, no springs, no entrance animations on the primary panorama (it's a terminal — terminals don't fade in).

**Transparency / blur.** None on the overlay. No `backdrop-filter`, no semi-transparent layers stacked over the desktop. The overlay is opaque.

**Imagery.** None on the primary surface. If imagery ever appears (file thumbnails, model icons), it is a 16×16 or 24×24 monochrome glyph that follows text color.

**Iconography.** lucide-react, stroke 1.5px, 16px default. Icon color = current text color. Never tinted with semantic colors.

**Cards.** 1px hairline border. 4px radius. Flat background (one neutral-scale step above the canvas). No shadow, no inner glow. Internal padding 12px or 16px depending on density.

**Layout rules.** One-screen panorama on the primary path; no vertical scroll. If content overflows, it scrolls within its region — never the page. The status bar is fixed bottom.

**Density target.** Linear's issue list, **not** Notion. Rows are 28–32px tall, padded by border-color not by whitespace.

---

---

## ICONOGRAPHY

prompt-hub uses **lucide** icons exclusively. There is no custom icon font, no PNG icons, no emoji in UI chrome, and no SVG illustrations.

- **Library:** [lucide](https://lucide.dev) — copied from `lucide-static@0.460.0`. The React form (`lucide-react`) is the canonical runtime import in product code.
- **Stroke:** 1.5px. Lucide ships at stroke 2; we rewrite every imported SVG to `stroke-width="1.5"` to land the slightly lighter, more terminal-precise feel.
- **Default size:** 16px (`w-4 h-4`). Use 14px in tightest density (chips); 20px reserved for the only large surface, the empty-state hint icon (also rare).
- **Color:** `currentColor`. Icons follow the text color of their container — **never** purple, **never** green, **never** beige. Icons are not ontological.
- **Two-tone, filled, duotone variants:** never. Lucide line icons only.
- **Emoji:** never in UI chrome. Unicode arrow + modifier glyphs (`→ ← ↑ ↓ ⌘ ⌥ ⇧ ⌃ ⏎ ⎋`) are not icons; they are typography and may appear in monospace contexts (hotkey badges, kbd hints).

### Where they live

- `assets/icons/*.svg` — a curated subset (~95 icons) used by the UI kit, pre-rewritten to stroke 1.5.
- In code, prefer the React import: `import { Command, Search, Layers } from 'lucide-react'` and set `strokeWidth={1.5}`.

### Naming + usage notes

| Icon | Used for |
| --- | --- |
| `Command`, `Option` | Modifier glyphs in hotkey badges |
| `Search` | Quick-find input affordance |
| `Layers` | Macro composition layer |
| `Workflow`, `GitBranch` | Scene lineage |
| `Terminal`, `FileCode` | Path / file refs |
| `CircleDashed` / `CircleDot` | Connection / agent state |
| `Loader2` | Loading skeleton accent (rarely visible) |
| `TriangleAlert`, `CircleX`, `Info` | Status bar warnings |

If you need an icon not in `assets/icons/`, add it via the same script (lucide-static unpkg URL, force stroke 1.5, save to `assets/icons/`). Don't draw it.

---

## Index

| File / folder | What's in it |
| --- | --- |
| `README.md` | This file — product brief, content & visual foundations, iconography |
| `SKILL.md` | Cross-compatible Agent Skill manifest |
| `colors_and_type.css` | All tokens (colors, type, spacing, radii, motion) + semantic classes |
| `fonts/` | Geist Sans + Geist Mono (variable woff2) |
| `assets/icons/` | 95 lucide SVGs, pre-rewritten to stroke 1.5 |
| `preview/` | Design-system tab cards (Type / Colors / Spacing / Components / Brand) |
| `ui_kits/prompt-hub/` | Pixel-fidelity recreation of the overlay (5 regions + status bar) |
| `ui_kits/prompt-hub/index.html` | Interactive click-thru of the overlay |


