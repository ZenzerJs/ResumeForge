---
name: ResumeForge
description: Ember Ink studio workspace framing crisp white Typst resume paper on warm espresso-black surfaces
colors:
  gold-action: "#f7bd3f"
  ember-secondary: "#ff8b3d"
  electric-signal: "#4f8fff"
  espresso-deep: "#0a0808"
  espresso-canvas: "#121010"
  espresso-inset: "#151211"
  espresso-panel: "#1b1716"
  espresso-elevated: "#272120"
  paper-sheet: "#ffffff"
  paper-ink: "#1c1e20"
  warm-chalk: "#f4eee7"
  warm-sand: "#d0c5b9"
  warm-stone: "#9e9287"
  hairline-umber: "#3a322f"
  control-umber: "#7a6e65"
  accent-ink: "#2a1c00"
  contrast-ink: "#03132f"
  signal-soft: "#93c5fd"
  paper-signal: "#1d4ed8"
  paper-signal-tint: "#dbeafe"
  ember-danger: "#ff8a80"
typography:
  display:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "Hanken Grotesk, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.1em"
rounded:
  sm: "2px"
  md: "6px"
  lg: "8px"
  surface: "10px"
  xl: "12px"
  full: "9999px"
spacing:
  unit: "4px"
  gutter: "16px"
  margin-mobile: "16px"
  panel-padding: "20px"
  margin-desktop: "32px"
components:
  button-primary:
    backgroundColor: "{colors.gold-action}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.espresso-elevated}"
    textColor: "{colors.warm-chalk}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.espresso-canvas}"
    textColor: "{colors.warm-chalk}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  card-surface:
    backgroundColor: "{colors.espresso-panel}"
    textColor: "{colors.warm-chalk}"
    rounded: "{rounded.surface}"
    padding: "20px"
  status-pill-signal:
    backgroundColor: "{colors.espresso-panel}"
    textColor: "{colors.signal-soft}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
  input-field:
    backgroundColor: "{colors.espresso-inset}"
    textColor: "{colors.warm-chalk}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
    height: "40px"
---

# Design System: ResumeForge

## Overview

**Creative North Star: "The Illuminated Drafting Desk"**

ResumeForge is built around a single luminous artifact: the white Typst-compiled resume sheet. Everything around that sheet—the warm espresso-black studio grounds, crisp 1px umber hairlines, and restrained Ember Ink accents—acts as a precision-tactile drafting desk that keeps attention on resume text, evidence citations, and patch diffs without visual clutter.

The visual system separates action from analysis. Warm Gold (`--accent-action`) and Ember (`--accent-secondary`) drive primary CTAs, focus rings, and brand gradients, while Electric Blue (`--accent-contrast`) from the opposite side of the wheel carries ATS scores, matched requirements, telemetry, and all verified/accepted states. Navy/slate darks and green/emerald/teal status hues are explicitly rejected so the warm espresso atmosphere and Ember Ink motif stay unmistakable across every surface.

**Key Characteristics:**
- **Precision-tactile craft:** Crisp `1px` hairline borders, subtle `2px` card lift on hover, and disciplined gold/ember/blue signals that never compete with the white resume sheet.
- **5-step espresso-black surface ramp:** Warm-black grounds (`#0a0808` to `#272120`) frame white `#ffffff` paper with zero navy or slate tinting.
- **Ember Ink tri-hue separation:** Analogous Gold + Ember for actions and warmth; Electric Blue for telemetry, ATS matching, and verified states.
- **Surface-scaled motion:** Expressive dynamic `AsciiWaves` behind clear-window glass on the landing hero; calm composite-only CSS atmosphere and micro-interactions across workspace pages; zero ambient distraction in `/editor`.

## Colors

The Ember Ink palette pairs two neighboring warm action hues with one cool opposite-wheel signal hue on a 5-step warm espresso-black neutral ramp and pure white paper.

### Primary
- **Gold Action** (`--accent-action`): Primary CTAs, active focus rings (`--focus-ring`), primary borders on `PageHeader`, and warm headline gradients. Paired with deep **Accent Ink** (`--accent-ink`) for high-contrast button labels.
- **Ember Secondary** (`--accent-secondary`): Gradient partner to Gold Action in `.ombre-bar`, `.ombre-divider`, `.edge-glow`, and `.text-ember-gradient` highlights.

### Secondary
- **Electric Signal** (`--accent-contrast`): ATS scores, matched requirements, telemetry signals, and all semantic success/verified/accepted states (`--status-success: var(--accent-contrast)`). Paired with **Contrast Ink** (`--contrast-ink`) on solid blue pills/buttons, **Signal Soft** (`--status-success-soft`) for body text on tinted dark surfaces, and **Paper Signal** (`--status-success-paper`) + **Paper Signal Tint** (`--status-success-paper-bg`) on white resume paper.
  <!-- 2026-11-13: User selected Option C (Ember Ink) in the Palette Lab: Gold #f7bd3f + Ember #ff8b3d analogous warm pair with Electric Blue #4f8fff contrast signal. -->
  <!-- 2026-11-15: Unified semantic success/verified/accepted states onto Electric Blue (--status-success: var(--accent-contrast)) and banned green/emerald/teal status utilities. -->

### Tertiary
- **Ember Danger** (`--status-danger`): Destructive actions, unverified gap alerts, and error states.

### Neutral
- **Espresso Deep** (`--surface-deep`): Deepest studio backdrop and fixed atmosphere floor.
- **Espresso Canvas** (`--surface-canvas`): Default page background (`--rf-bg`).
- **Espresso Inset** (`--surface-inset`): Recessed wells, code/editor gutters, and eyebrow pill backgrounds.
- **Espresso Panel** (`--surface-panel`): Raised cards, panes, and workspace containers (`--rf-surface`).
- **Espresso Elevated** (`--surface-elevated`): Popovers, menus, and hovered/elevated controls.
- **Paper Sheet** (`--paper-sheet`) & **Paper Ink** (`--paper-ink`): Pure white resume sheet and crisp dark ink for Typst output and inline diff previews.
- **Warm Chalk** (`--text-primary`), **Warm Sand** (`--text-secondary`), **Warm Stone** (`--text-muted`): Three-step warm neutral text hierarchy.
- **Hairline Umber** (`--border-hairline`) & **Control Umber** (`--border-control`): Structural `1px` dividers and interactive control strokes.

### Named Rules
**The Zero-Navy Rule.** Never use navy or blue-tinted dark grounds (`#0b1326`, `#0a1224`, `#0f172a`, `#131b2e`, `#171f33`, `#172033`, `#1e293b`, `#060e20`, `#121929`, `#030712`, `#020617`, `*-slate-*`) on app surfaces (`--surface-deep` through `--surface-elevated`), enforced by `tests/design-tokens.test.ts`.
  <!-- 2026-11-13: User rejected navy/blue-tinted dark backgrounds across all workspace and landing surfaces in favor of warm espresso-black grounds. -->

**The Zero-Green Rule.** Never use Tailwind `green-*`, `emerald-*`, `teal-*`, `--rf-emerald`, or green hexes (`#6bd69a`, `#10b981`) anywhere in the UI. Every semantic success, verified, accepted, saved, and guardrail-clean token uses Electric Blue (`--status-success`) and stays contrast-safe (`>= 4.5:1`) across both dark espresso panels (`--status-success-soft` on tinted fills, `--contrast-ink` on solid fills, never `text-white` on `#4f8fff`) and white paper (`.paper-highlight-accepted`, `.paper-action-accepted`, `.paper-marker-accepted`).

## Typography

**Display Font:** Hanken Grotesk (`--font-hanken`, local `.ttf` weights 400, 600, 700)
**Body Font:** Hanken Grotesk (`--font-hanken`)
**Label/Mono Font:** JetBrains Mono (`--font-mono`, local `.ttf` weights 400, 600)

**Character:** Clean geometric-humanist sans-serif for editorial legibility paired with crisp monospace labels and numeric telemetry (`kern` and `liga` enabled globally).

### Hierarchy
- **Display** (`700`, `40px` desktop / `32px` mobile, `1.2` line-height, `-0.02em` tracking): Landing hero headlines and top-level display statements.
- **Headline** (`700`, `28px` xl / `22px` lg, `1.3` line-height, `-0.02em` to `-0.01em` tracking): Section titles and workspace `PageHeader` headings (`20px–24px`).
- **Title** (`600`, `18px`, `1.4` line-height): Card titles, modal headers, and pane headings.
- **Body** (`400`, `16px` regular at `1.6` line-height / `14px` dense at `1.4` line-height): Prose, job descriptions, and dense workspace lists (`max-w-2xl` on header descriptions).
- **Label** (`600`, `12px`, `16px` line-height, `0.1em` tracking, uppercase `JetBrains Mono`, plus `13px` `mono-data` and `11px` `caption`): Section eyebrows, ATS scores, badges, and status pills.

### Named Rules
**The Mono-Telemetry Rule.** Use `JetBrains Mono` (`font-mono`) for uppercase section labels, ATS rubric numbers, timestamps, and status pills so analytical data scans distinctly from Hanken Grotesk prose.

**The 12px Typography Floor.** Keep UI copy, labels, and scaled preview text at `>= 12px` (never clamp landing/card typography below `12px`, e.g., no `Math.max(8, ...)`). Only micro-telemetry indicators (`StatusPill`, diff line numbers) may sit at `10px`–`11px` when paired with `JetBrains Mono`.

## Layout

Workspace layouts balance generous breathing room on analytical surfaces (`/library`, `/tracker`, `/tracker/feed`, `/tailor`, `/practice`, `/settings`) with strict vertical efficiency in `/editor`.

- **Spacing rhythm:** `4px` base unit, `16px` gutters and mobile margins, `20px` panel padding, `32px` desktop margins.
- **Editor chrome budget (`1440×900`):** Preserve all Batch 4 structural/a11y upgrades—`48px` top nav, `40px` document bar, and `32px` pane toolbar so the white resume paper starts within `128px` of the top of the viewport.
- **Workspace shell:** Non-editor workspace pages use a `64px` nav with a `1px` `.ombre-divider` underneath and responsive `PageHeader` banners (`flex-col` on mobile, `md:flex-row` on desktop).
  <!-- 2026-11-13: Locked alongside Ember Ink palette rollout so structural ergonomics and accessibility guarantees remain non-negotiable. -->

## Elevation & Depth

Depth is achieved through a 5-step warm espresso tonal ramp paired with inset top-edge specular highlights (`--shadow-1` through `--shadow-3`), restrained glass bars, and pure-CSS ambient light fields—never heavy drop-shadows on flat charcoal.

### Shadow Vocabulary
- **Shadow 1** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.04) inset, 0 2px 6px rgb(0 0 0 / 0.30)`): Resting `.surface-raised` cards and workspace panes.
- **Shadow 2** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.05) inset, 0 10px 28px rgb(0 0 0 / 0.38)`): Hovered `.card-lift` cards and elevated popovers/menus.
- **Shadow 3** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.06) inset, 0 24px 60px rgb(0 0 0 / 0.45)`): Modals, sheets, and high-priority floating overlays.

### Atmosphere & Motion
- **Landing hero:** Dynamic multi-color `AsciiWaves` canvas ("Ember Ridges + Signal Glints", positive `speed`, `hasCursorInteraction={false}`) using `#f7bd3f`, `#ff8b3d`, `#4f8fff`, and `#9e9287`, paused offscreen via `IntersectionObserver` and static under `prefers-reduced-motion: reduce`. Glass between the canvas and copy (`.glass-pane` on `landing-hero-copy-glass`, `landing-glass-diffusion`) stays a **clear window** (`backdrop-blur-[1.5px]`, `<= 2px` blur, `<= 8%` canvas tint); text contrast `>= 4.5:1` comes from masking the canvas behind the hero text column (`radial-gradient(520px 420px at 26% 42%, rgb(0 0 0 / 0.35), #000 75%)`), never by frosting the pane. Foreground `ProductProofCard` elements use `.surface-glass` so they read as more solid than the window. Lower homepage sections (`capability-grid-section`, `AtsSandboxSection`, `CompetitiveMatrixSection`) sit in `landing-lower-atmosphere-stage` over `AmbientColorBlobs`.
  <!-- 2026-11-14: Rewrote frosted glass rule to clear-window glass per user direction. -->
  <!-- 2026-11-14: User requested dynamic Ember Ink AsciiWaves on the homepage (not frozen at speed=0) while keeping cursor ripple disabled and reduced-motion respected. -->
- **Workspace pages (`/library`, `/tracker`, `/tracker/feed`, `/tailor`, `/practice`, `/settings`):** Mount `WorkspaceAtmosphere` (on both pages and `PageSkeleton` via `ShellFrame` when `variant !== "editor"`): fixed lit ground (`--surface-canvas` to `--surface-deep`), 7 pure-CSS roaming `AmbientColorBlobs` orbs (`.ambient-blob-a`..`.ambient-blob-f`, `18s–24s` `translate3d` + `scale`, muted `0.13–0.17` feathered radial gradients, zero CSS `filter: blur`, zero JS `rAF`), and `1px` `.ombre-divider`. Interaction motion stays crisp: `.card-lift` (`2px` lift, `160ms`), button press (`active:scale-[0.98]`), sliding tab indicators, `.enter-once` header fade-in, and `.skeleton-pulse::after` diagonal Ember->White->Blue glint sweep (`2.15s` `skeleton-glint-sweep`, no `will-change` pinning).
- **Editor (`/editor`):** Does not mount `WorkspaceAtmosphere`; only `workspace-toolbar` uses `.glass-bar`. All motion stops cleanly under `prefers-reduced-motion: reduce`.

### Named Rules
**The Clear-Window Rule.** Never frost homepage hero glass (`<= 2px` blur, `<= 8%` tint). Protect `>= 4.5:1` legibility by locally masking the `AsciiWaves` canvas behind copy, keeping foreground proof cards visibly more solid than the window.

**The Edge-Glow Rule.** Signature raised containers (`.edge-glow`) carry a `1px` 3-stop Ember-Orange -> Warm-Gold -> Electric-Blue top-edge ombre hairline instead of heavy outer glow rings.

## Shapes

- **Border radii:** Crisp `2px` default/small radius for tight technical controls, `6px` (`md`) for buttons, badges, and inputs, `8px` (`lg`) for medium containers, `10px` (`surface`) for `Surface` cards, `12px` (`xl`) for `PageHeader` banners, and `9999px` (`full`) for `StatusPill` and eyebrow tags.
- **Hairline framing:** Containers rely on `1px` `--border-hairline` strokes; `PageHeader` adds a `2px` left primary accent bar (`border-l-2 border-primary`) to anchor page identity.

## Components

Every component combines `1px` umber hairlines, warm espresso surfaces, and accessible `2px` Gold Action `:focus-visible` rings (`forced-colors: active` falls back to `Highlight`).

### Buttons
- **Shape:** Gently rounded (`6px` radius on `default`/`sm`/`lg`; `4px` on `xs`).
- **Primary:** Gold Action background with Accent Ink text (`40px` height, `8px 16px` padding), subtle shadow, and `90%` hover opacity.
- **Hover / Focus:** `transition-colors`, `2px` Gold Action focus-visible ring with `2px` offset, tactile `active:scale-[0.98]` press on command buttons.
- **Secondary / Outline / Ghost / Destructive:** Secondary uses elevated espresso fill; Outline uses `1px` control border on canvas; Ghost reveals hover tint only; Destructive uses Ember Danger.

### Chips & Status Pills
- **Style:** `StatusPill` uses a full pill (`9999px` radius), `1px` tinted border, `10px` `JetBrains Mono` medium text, and `2px 10px` padding (`amber`, `emerald` mapped to `--status-success` Electric Blue, `slate`, `cyan`, `red`). `Badge` uses `6px` radius, `12px` semibold text, and `2px 10px` padding.
- **State:** `success` badges/pills always use `--status-success/15` fill, `--status-success/35–40` border, and `--status-success-soft` / `--status-success` text.

### Cards / Containers
- **Corner Style:** `10px` radius on `Surface`, `12px` on `PageHeader`.
- **Background:** `surface-raised` (`180deg` subtle white top sheen over `--surface-panel`), or `glass-bar` (`72%` panel with `14px` blur and `1.1` saturation) for sticky toolbars/dialogs.
- **Shadow Strategy:** Resting `--shadow-1`; `.card-lift` transitions in `160ms` to `--shadow-2` with `translateY(-2px)` and `28%` Gold Action border tint.
- **Border:** `1px` `--border-hairline`, optionally topped with `.edge-glow` 3-stop ombre hairline.
- **Internal Padding:** `16px` mobile / `24px` desktop on `PageHeader`; `20px` standard `panel-padding`.

### Inputs / Fields
- **Style:** `1px` `--border-control` / `--border-hairline` stroke, `--surface-inset` background, `6px` radius, `40px` height.
- **Focus:** `2px solid rgb(var(--focus-ring))` outline with `2px` offset.

### Navigation
- **Style:** Sticky `glass-bar` header (`48px` in `/editor`, `64px` in workspace shells) with `1px` `.ombre-divider` bottom hairline, `Hanken Grotesk` links, and sliding tab indicators.

### Signature Components
- **`PageHeader`:** Banner card (`surface-raised`, `edge-glow`, `12px` radius) with a `2px` left Gold Action bar, optional pill eyebrow, `20px–24px` bold title, status badge, and right-aligned action slot.
- **`BrandIcon`:** Cherry-picked named `simple-icons` SVG paths (never wildcard `import *`), `fill="currentColor"`, `aria-hidden="true"`, alias normalization, and graceful `null` fallback for unmapped skills/companies/providers.
- **`AsciiWaves` & `WorkspaceAtmosphere`:** Dynamic Ember Ink ASCII wave canvas for the landing hero and pure-CSS 7-orb `AmbientColorBlobs` stage for workspace pages.

## Do's and Don'ts

### Do:
- **Do** keep every dark app surface on the 5-step warm espresso-black ramp (`#0a0808` to `#272120`) and frame the white `#ffffff` resume sheet cleanly.
- **Do** use semantic status tokens (`--status-success`, `--status-warning`, `--status-danger`, `.status-success-surface`) for workspace status banners instead of hardcoded Tailwind `-950` shades (`bg-red-950`, `bg-amber-950`, `bg-sky-950`).
- **Do** use Electric Blue (`--status-success` / `--accent-contrast`) with contrast-safe pairings (`--status-success-soft`, `--contrast-ink`, `--status-success-paper`) for all verified, accepted, saved, and ATS-matched states.
- **Do** preserve the `1440×900` editor chrome budget (`48px` nav / `40px` doc bar / `32px` pane toolbar, paper starting within `128px`) and Radix `Dialog`/`Sheet`/`ConfirmDialog` accessibility patterns.
- **Do** mount `WorkspaceAtmosphere` on all non-landing, non-editor pages and their `PageSkeleton` fallbacks, and disable all ambient/wave motion under `prefers-reduced-motion: reduce`.
- **Do** cherry-pick named `simple-icons` exports in `BrandIcon` with `fill="currentColor"`.

### Don't:
- **Don't** use navy or blue-tinted dark backgrounds (`#0b1326`, `#0f172a`, `#1e293b`, `*-slate-*`, etc.) on any surface.
- **Don't** use Tailwind `green-*`, `emerald-*`, `teal-*`, `--rf-emerald`, or green hexes (`#6bd69a`, `#10b981`) for success or verified states, and never put `text-white` on `#4f8fff`.
- **Don't** frost homepage hero glass beyond `2px` blur or `8%` tint, and never enable cursor-ripple tracking (`hasCursorInteraction`) on `AsciiWaves`.
- **Don't** mount `WorkspaceAtmosphere` inside `/editor`, use CSS `filter: blur` on `AmbientColorBlobs`, or run JS `rAF` loops for workspace background blobs.
- **Don't** use wildcard `import *` from `simple-icons`.
