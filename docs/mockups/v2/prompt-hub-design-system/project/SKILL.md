---
name: prompt-hub-design
description: Use this skill to generate well-branded interfaces and assets for prompt-hub, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference

- **Visual anchor:** Linear-class polish without shadows, gradients, or glassmorphism. A Bloomberg terminal that read Linear's typography manual.
- **Hard exclusions:** no `box-shadow`, no gradients, no `backdrop-filter`, no skeuomorphism, no rounded corners > 6px on functional surfaces, no animation > 200ms, no emoji in UI chrome.
- **Color ontology:** `#534AB7` purple = protocol layer (PhaseBar, AlignmentPhrase); `#178561` green = task layer (MacroGrid, SceneList); `#888780` beige = aux/meta. Never decorative.
- **Type:** Geist Sans + Geist Mono. Region header 14/600/-0.01em; card title 14/500; body 13/400/1.45; meta 12/400/tabular; hotkey 12/500/mono.
- **Density:** Linear issue list, not Notion. 8px base grid; 4px allowed for tight cases. Rows 28–32px.
- **Iconography:** lucide only, stroke 1.5, 16px. Icon color = text color (never semantic).

## Files

- `README.md` — full design brief, content fundamentals, visual foundations, iconography.
- `colors_and_type.css` — design tokens (color, type, spacing, radii, motion) + semantic classes.
- `fonts/` — Geist Sans Variable + Geist Mono Variable (woff2).
- `assets/icons/` — 95 lucide SVGs, pre-rewritten to stroke 1.5.
- `preview/` — design system cards (Type, Colors, Spacing, Components, Brand).
- `ui_kits/prompt-hub/` — JSX components for the overlay (PhaseBar, AlignmentPhrases, MacroGrid, SceneList, AuxPanel, StatusBar) + an interactive `index.html` demo.

When creating a new artifact, start by importing `colors_and_type.css` and consulting the relevant preview cards before drawing any component — most patterns already exist.
