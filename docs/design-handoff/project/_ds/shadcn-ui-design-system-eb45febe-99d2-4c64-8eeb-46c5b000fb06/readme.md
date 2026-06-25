# shadcn/ui Design System

A faithful, dependency-free recreation of **shadcn/ui** — the open-source component collection by [@shadcn](https://github.com/shadcn). This build follows the **new-york** style on the **neutral** base color (the project default), with **Geist** typography and **Lucide** icons.

> shadcn/ui is famously *not* a component library you install — it's a set of components you copy into your app and own. The aesthetic is its signature: quiet, neutral, high-contrast, generous whitespace, subtle borders and shadows, and almost no color until you add it. This design system captures that look as plain CSS custom properties + self-contained React components, so it can be consumed without Tailwind.

## Source

Built by reading the canonical source directly:

- **Repo:** https://github.com/shadcn-ui/ui
- **Tokens:** `apps/v4/app/globals.css` (oklch color system, radius scale, `@theme` mappings)
- **Components:** `apps/v4/registry/new-york-v4/ui/*` (Button, Badge, Card, Input, Checkbox, Switch, Tabs, Alert, Avatar, …)
- **Fonts:** `apps/v4/lib/font-definitions.ts` (Geist + Geist Mono are the defaults)
- **Assets:** `apps/v4/public/` (brand mark, avatars)

Explore that repository for deeper coverage — it contains ~50 primitives, blocks, charts, and full example apps that go well beyond the subset recreated here.

---

## CONTENT FUNDAMENTALS

shadcn/ui's voice is **developer-direct, lowercase-friendly, and unfussy**. It reads like good documentation written by an engineer, not marketing copy.

- **Tone:** Plain, confident, a little dry. "Build your component library." "Copy and paste into your apps." No hype, no exclamation-mark energy, no emoji.
- **Person:** Addresses **you** (the developer) directly and imperatively — "Add components to your app", "Pick a style", "Make it yours." First person plural ("we") appears only rarely.
- **Casing:** **Sentence case** everywhere — headings, buttons, menu items ("Create project", "Add to cart", not "Create Project"). The brand itself is lowercase: `shadcn/ui`.
- **Brevity:** Labels are 1–3 words. Descriptions are one short sentence. Card descriptions trail off rather than over-explain ("Deploy your new project in one click.").
- **Microcopy examples** (verbatim from the demos): "Heads up!", "You can add components to your app using the cli.", "An unexpected error occurred.", "Login to your account", "Enter your email below to login."
- **Numbers & UI strings:** Tabular, terse — "$1,250.00", "+12.5%", "1,234". Status words are Title-ish but short: "In Process", "Done".
- **No emoji, no exclamation inflation.** Icons (Lucide) carry the visual punctuation instead of emoji.

The vibe: **calm, precise, gets out of your way.**

---

## VISUAL FOUNDATIONS

**Overall feeling:** monochrome-first, editorial whitespace, crisp 1px borders, barely-there shadows. Color is reserved for meaning (destructive red, chart blues). It should feel like clean print on paper.

### Color
- **oklch** throughout. Light theme is near-pure white surfaces (`--background: oklch(1 0 0)`) on near-black text (`oklch(0 0 0)`). The **primary** is pure black in light mode and near-white in dark mode — actions are monochrome, not branded blue.
- Neutral grays do the heavy lifting: `--muted`/`--secondary`/`--accent` are all `oklch(0.97 0 0)` (a whisper of gray) in light mode; `--muted-foreground` is `oklch(0.556 0 0)`.
- **Semantic color is rare:** `--destructive` (red `oklch(0.577 0.245 27.325)`) for danger; chart colors are a 5-step Tailwind **blue** ramp. There is no green/yellow/purple in the core token set.
- **Dark mode** is a true neutral dark (`--background: oklch(0.145 0 0)`, cards `oklch(0.205 0 0)`) with translucent borders (`oklch(1 0 0 / 10%)`).

### Type
- **Geist** (sans) for everything; **Geist Mono** for code, numbers, and labels. Headings reuse the sans family (`--font-heading: var(--font-sans)`).
- Tailwind type scale (xs 12 → 4xl 36). Headings are **semibold (600)** with tight tracking (`-0.025em`); body is **normal (400)**; UI labels and buttons are **medium (500)**.
- `font-synthesis-weight: none` and `text-rendering: optimizeLegibility` — they care about crisp rendering.

### Spacing & layout
- 4px base unit (Tailwind `--spacing: 0.25rem`). Components breathe: cards use 24px padding, 24px gaps between sections.
- Layouts are restrained and grid-based; max content widths around 1400px. Fixed chrome (sidebar, top bar) with a scrolling content well.

### Radius
- Base `--radius: 0.625rem` (10px) with a derived scale: sm 6 / md 8 / lg 10 / xl 14 / 2xl 18. Buttons and inputs use **md (8px)**; cards use **xl (14px)**; badges and avatars are **fully rounded**.

### Borders & shadows
- **1px borders** in a light neutral (`--border: oklch(0.922 0 0)`) define almost every surface — this is the dominant separator, not shadow.
- **Shadows are minimal**: `shadow-xs` (a 1px hairline) on inputs/buttons-outline, `shadow-sm` on cards. Heavy elevation (`shadow-lg`+) is reserved for popovers/dialogs only. No glows, no colored shadows.

### States & motion
- **Hover:** solid fills lighten via `color-mix(... 90%)` (primary) or shift to the `accent` gray (ghost/outline). Links underline on hover.
- **Press:** buttons/links drop to `opacity: 0.6` momentarily (mobile especially).
- **Focus:** a **3px ring** at `ring/50` plus a border color change — the signature shadcn focus treatment (`focus-visible:ring-[3px]`).
- **Invalid:** destructive border + destructive-tinted ring.
- **Transitions** are short and functional (~150ms on color/box-shadow/transform). No bounces, no decorative looping animation. A subtle `pulse` is used only for skeletons.

### Imagery & texture
- **No gradients, no textures, no illustration in the core brand.** Surfaces are flat solid color. The only "imagery" is user content (avatars) and data visualization. Where photos appear they are neutral and unfiltered.
- Transparency/blur is used sparingly — overlays/scrims behind dialogs, translucent borders in dark mode.

### Cards (the signature element)
- White (`--card`) surface, **1px border**, **`radius-xl` (14px)**, **`shadow-sm`**, **24px** internal padding, **24px** vertical gap between header/content/footer. Title is semibold, description is `muted-foreground` at `text-sm`.

---

## ICONOGRAPHY

- **Lucide** ([lucide.dev](https://lucide.dev)) is the icon system — it's shadcn's default and is used pervasively (`import { CheckIcon } from "lucide-react"`).
- **Style:** outline, **2px stroke**, rounded caps/joins, drawn on a 24×24 grid. Icons inherit `currentColor` and default to **16px** (`size-4`) inside buttons/inputs, **18px** in nav.
- **No emoji, no unicode glyphs as icons, no filled icon sets.** Consistency comes from staying entirely within Lucide.
- **Usage in this kit:** loaded from the Lucide UMD CDN (`lucide.min.js`) and rendered via `<i data-lucide="name">` + `lucide.createIcons()`. In a real React app use `lucide-react`. The check inside `Checkbox` is an inline masked SVG of the Lucide check so it needs no JS.
- A few common names you'll reach for: `search`, `settings`, `bell`, `plus`, `check`, `trending-up`, `circle-check`, `chevron-right`, `sun`, `moon`, `terminal`, `circle-help`.

> Substitution flagged: see Caveats — Geist is loaded from the Google Fonts CDN rather than bundled binaries.

---

## Index / manifest

**Root**
- `styles.css` — the single entry point consumers link (an `@import` manifest only).
- `components.css` — the `ui-*` component classes (plain CSS over the tokens).
- `README.md` — this guide. `SKILL.md` — portable Agent Skill wrapper.

**`tokens/`** — `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadows.css`
**`fonts/`** — `fonts.css` (Geist + Geist Mono via Google Fonts)

**`components/`** (React primitives — `Name.jsx` + `Name.d.ts` + `Name.prompt.md`)
- `buttons/` — **Button**, **Badge**
- `forms/` — **Input**, **Textarea**, **Label**, **Checkbox**, **Switch**
- `display/` — **Card** (+ Header/Title/Description/Content/Footer), **Avatar** (+ Image/Fallback), **Alert** (+ Title/Description), **Separator**, **Tabs** (+ List/Trigger/Content)

**`guidelines/`** — foundation specimen cards (Colors, Type, Spacing, Brand, Iconography) shown in the Design System tab.

**`ui_kits/dashboard/`** — interactive analytics dashboard composed from the components.

**`assets/`** — `logo-mark.png` (the black `/` mark), `logo-mark-rounded.png`, `favicon-32x32.png`, `placeholder.svg`, and `avatars/` (real photos from the repo).

### Consuming
Link the one stylesheet and read components off the global namespace:
```html
<link rel="stylesheet" href="styles.css" />
<script src="_ds_bundle.js"></script>
<script>
  const { Button, Card, Badge } = window.ShadcnUiDesignSystem_eb45fe
</script>
```

---

## Caveats
- **Fonts load from the Google Fonts CDN** (Geist + Geist Mono) rather than self-hosted binaries, so the compiler reports 0 `@font-face` rules. If you want offline/self-hosted fonts, drop the `.woff2` files in `fonts/` and I'll add real `@font-face` rules — **please send them or confirm the CDN is fine.**
- **Components are recreated in plain CSS**, not Tailwind, so consumers don't need a build step. They match the new-york/neutral look but aren't byte-identical to the Tailwind output in edge cases (e.g. exact `color-mix` hover math).
- This is a **subset** of shadcn/ui's ~50 primitives — the most-used ones. Tell me which others you want (Dialog, Dropdown, Select, Tooltip, Table, Toast, Command, Sidebar…) and I'll add them.
