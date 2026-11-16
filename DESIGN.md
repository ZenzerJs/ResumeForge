# DESIGN.md — ResumeForge Visual & Taste Rules

## Color

- Never use navy or blue-tinted dark grounds (`#0b1326`, `#0a1224`, `#0f172a`, `#131b2e`, `#171f33`, `#172033`, `#1e293b`, `#060e20`, `#121929`, `#030712`, `#020617`, `*-slate-*`) on app surfaces (`--surface-deep`, `--surface-canvas`, `--surface-inset`, `--surface-panel`, `--surface-elevated`), enforced by `tests/design-tokens.test.ts`.
  - Why: Navy dark grounds feel generic and muddy against warm gold accents; warm espresso-black grounds keep the editorial desk atmosphere crisp and intentional.
  <!-- 2026-11-13: User rejected navy/blue-tinted dark backgrounds across all workspace and landing surfaces in favor of warm espresso-black grounds. -->

- Define the palette around the **Ember Ink** 3-color motif: 2 neighboring warm hues (`--accent-action` Gold `#f7bd3f` / `247 189 63` + `--accent-secondary` Ember `#ff8b3d` / `255 139 61`) for primary actions, gradients, syntax, and warm glows, plus 1 contrasting hue from the opposite side of the wheel (`--accent-contrast` Electric Blue `#4f8fff` / `79 143 255`) for ATS scores, matched requirements, telemetry signals, and all semantic success/verified/accepted states.
  - Why: Separating warm action hues (Gold + Ember) from cool signal/telemetry hues (Electric Blue) creates an immediate visual hierarchy between interactive CTAs and analytical/verified states without introducing competing green/emerald/teal palettes.
  <!-- 2026-11-13: User selected Option C (Ember Ink) in the Palette Lab: Gold #f7bd3f + Ember #ff8b3d analogous warm pair with Electric Blue #4f8fff contrast signal. -->
  <!-- 2026-11-15: Unified semantic success/verified/accepted states onto Electric Blue (--status-success: var(--accent-contrast)) and banned green/emerald/teal status utilities. -->

- Keep every semantic success, verified, accepted, saved, and guardrail-clean token contrast-safe across both dark espresso panels and white resume paper (never use Tailwind `green-*`, `emerald-*`, `teal-*`, `--rf-emerald`, or green hexes like `#6bd69a`/`#10b981`):
  - **Espresso dark surfaces** (`--surface-deep`..`--surface-elevated`): use `--status-success` (`79 143 255` / `#4f8fff`, `5.03:1–6.39:1` on espresso) for icons/borders/telemetry text, `--status-success-soft` (`147 197 253` / `#93c5fd`, `.text-status-success-soft`, `.status-success-surface`) for body text on tinted `bg-status-success/10..20` fills, and `--contrast-ink` (`3 19 47` / `#03132f`, `text-contrast-ink`, `5.91:1`) for labels on solid `bg-status-success` buttons/pills (never `text-white` on `#4f8fff`).
  - **White paper highlights** (`--paper-sheet` `#ffffff`): use `.paper-highlight-accepted` (`rgb(var(--status-success) / 0.24)`) for accepted inline overlays, `--status-success-paper` (`29 78 216` / `#1d4ed8`, `6.70:1` on white) via `.paper-action-accepted` for white-text buttons, and `--status-success-paper-bg` (`219 234 254` / `#dbeafe`) + `--contrast-ink` via `.paper-marker-accepted` for paper-side badges/markers.
  - Why: `#4f8fff` passes AA on espresso darks but fails AA against `#ffffff` or `#ffffff`-on-`#4f8fff`; pairing `--status-success-soft`, `--contrast-ink`, and `--status-success-paper` preserves Ember Ink harmony with >= 4.5:1 legibility everywhere.

## Surfaces

- Maintain the 5-step warm espresso-black surface ramp (`--surface-deep: 10 8 8` `#0a0808`, `--surface-canvas: 18 16 16` `#121010`, `--surface-inset: 21 18 17` `#151211`, `--surface-panel: 27 23 22` `#1b1716`, `--surface-elevated: 39 33 32` `#272120`) and the shared elevation scale (`--shadow-1`, `--shadow-2`, `--shadow-3`, `.surface-raised`, `.glass-bar`, `.card-lift`, `.edge-glow` with 3-stop Ember-Orange -> Warm-Gold -> Electric-Blue top-edge ombre, `.ombre-bar`, `.ombre-divider`, `.btn-glow`).
  - Why: Flat, low-contrast charcoal panels make the studio look lifeless; stepped warm-black elevation and restrained glass/glow depth frame the white `#ffffff` resume sheet and workspace cards without visual clutter.

- Keep homepage glass between the `AsciiWaves` field and content as a **clear window** (`backdrop-blur-[1.5px]`, `<= 2px` blur, `<= 8%` canvas tint on `landing-glass-diffusion`, and `.glass-pane` on `landing-hero-copy-glass`). Achieve `>= 4.5:1` text contrast by masking the canvas behind the hero text column (`radial-gradient(520px 420px at 26% 42%, rgb(0 0 0 / 0.35), #000 75%)`), never by frosting the pane. Foreground proof cards (`ProductProofCard`) keep `.surface-glass` so cards in front of the window read as more solid than the window. Lower homepage sections (`capability-grid-section`, `AtsSandboxSection`, `CompetitiveMatrixSection`) sit inside `landing-lower-atmosphere-stage` over subtle pure-CSS `AmbientColorBlobs`.
  - Why: Heavy frost hid the Ember Ink ASCII topography, which is the homepage's signature; clear-window glass preserves glyph sharpness while local canvas masking protects typography legibility.
  <!-- 2026-11-14: Rewrote frosted glass rule to clear-window glass per user direction. -->

- Every non-landing, non-editor page (`/library`, `/tracker`, `/tracker/feed`, `/tailor`, `/practice`, `/settings`) and its loading `PageSkeleton` (`ShellFrame` when `variant !== "editor"`) mount `WorkspaceAtmosphere` (fixed lit ground `--surface-canvas` to `--surface-deep`, 7 pure-CSS roaming `AmbientColorBlobs` orbs with muted `0.13–0.17` multi-stop feathered radial gradients and no CSS `filter: blur`, zero JS `rAF`, and `1px` `.ombre-divider` under the 64px nav) and use `.surface-raised`, `.glass-bar`, `.card-lift`, `.edge-glow`, and banner-card `PageHeader` (`border-l-2 border-primary`) rather than rendering flat cards on a flat `bg-rf-bg`.
  - Why: Workspace pages and loading skeletons share the homepage's depth and material continuity while keeping GPU blur passes off and visual calm intact for extended use.

- Use `BrandIcon` (`src/components/design-system/brand-icon.tsx`) with cherry-picked named `simple-icons` path exports (never wildcard `import *` from `simple-icons`), `fill="currentColor"` (`aria-hidden="true"`), alias normalization, and graceful `null` fallback for unmapped tech skills, companies, and AI providers.
  - Why: Monochrome `currentColor` brand marks inherit Ember Ink badge/pill semantics cleanly without multi-color visual clutter or bundling 3,400+ unused SVG paths.

## Motion

- Keep the landing hero expressive with the **dynamic** multi-color `AsciiWaves` canvas ("Ember Ridges + Signal Glints", positive `speed`, `hasCursorInteraction={false}` — no cursor ripple tracking) using the Ember Ink palette (`#f7bd3f`, `#ff8b3d`, `#4f8fff`, `#9e9287`), Gold-to-Ember gradient headline highlight (`.text-ember-gradient`), and `.surface-glass` `ProductProofCard`. Pause canvas animation offscreen via `IntersectionObserver` and switch to the static fallback when `prefers-reduced-motion: reduce` is active.
  - Why: Dynamic multi-color waves bring the Ember Ink field to life behind the clear-window glass without distracting pointer-ripple jitter, while offscreen pausing and reduced-motion fallbacks protect performance and accessibility.
  <!-- 2026-11-14: User requested dynamic Ember Ink AsciiWaves on the homepage (not frozen at speed=0) while keeping cursor ripple disabled and reduced-motion respected. -->

- Keep non-landing workspace pages (`/library`, `/tracker`, `/tracker/feed`, `/tailor`, `/practice`, `/settings`) to **interaction motion plus composite-only CSS ambient/loading motion**: `.card-lift` (2px hover lift, `160ms`), button press (`active:scale-[0.98]`), sliding tab indicators, one-time `.enter-once` page header fade-in, `AmbientColorBlobs` (7 orbs across `.ambient-blob-a`..`.ambient-blob-f` multi-waypoint `18s–24s` `translate3d` + `scale` keyframes with zero JS `rAF`), and glint-only `.skeleton-pulse::after` diagonal Ember->White->Blue specular glint sweep (`2.15s` `skeleton-glint-sweep`, no `will-change` layer pinning). `/editor` does not mount `WorkspaceAtmosphere` (only its `workspace-toolbar` uses `.glass-bar`), and all motion (including `.ambient-blob-a..f` and `.skeleton-pulse::after`) stops cleanly under `prefers-reduced-motion: reduce`.
  - Why: Calm workspaces keep attention on resumes, jobs, and diffs while subtle tactile feedback makes interactive elements feel responsive.

## Spacing & layout

- Preserve all Batch 4 structural/a11y upgrades (`1440×900` editor chrome budget `48px` nav / `40px` doc bar / `32px` pane toolbar with paper starting within `128px`, Radix `Dialog`/`Sheet` modals, `ConfirmDialog`, `:focus-visible` rings, ARIA combobox/selection targets).
  - Why: Expressive color and depth must never compromise editor vertical space, keyboard navigation, focus management, or screen-reader semantics.
  <!-- 2026-11-13: Locked alongside Ember Ink palette rollout so structural ergonomics and accessibility guarantees remain non-negotiable. -->
