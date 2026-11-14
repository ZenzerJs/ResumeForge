# ResumeForge Unified Studio Design System

Calm paper-on-desk framing for résumé editing and review.

## Palette & CSS Tokens

Define the colors once in `src/app/globals.css` using space-separated sRGB channels so Tailwind opacity modifiers resolve (for example `rgb(var(--surface-panel) / <alpha-value>)`):

```css
:root {
  --surface-canvas: 21 24 26;
  --surface-panel: 28 32 35;
  --surface-elevated: 37 42 45;
  --surface-inset: 17 20 22;
  --paper-sheet: 255 255 255;
  --paper-ink: 28 30 32;
  --text-primary: 237 239 237;
  --text-secondary: 194 201 199;
  --text-muted: 151 161 159;
  --border-hairline: 55 62 64;
  --border-control: 119 130 129;
  --accent-action: 241 181 101;
  --accent-ink: 31 24 14;
  --status-success: 124 204 165;
  --status-warning: var(--accent-action);
  --status-danger: 242 148 144;
  --status-info: 145 186 217;
  --focus-ring: var(--accent-action);
  --hairline-width: 1px;
}
```

## Surface & Control Specification

| Surface or control | Specification |
| --- | --- |
| Token migration | Map canvas/background/`rf-bg` to canvas, card/`rf-surface`/Material container to panel, popover/high container/`rf-elevated` to elevated, inputs to inset, outlines to border, and action/ring to accent. Use direct full-color aliases for legacy `var(--rf-…)` consumers and channel aliases for `/opacity` utilities. Keep shadcn semantic class names usable. Remove duplicate values, global `body:has([data-workspace-theme])` overrides and competing hardcoded chrome colors. Remove aliases once their last use disappears. |
| Type, density and focus | Hanken Grotesk 400/600/700 for body/controls/headings. JetBrains Mono 400/600 for code and data. Replace Hanken 800/900 and unsupported medium/mono-bold requests on live surfaces. Use `tabular-nums` for ATS scores, breakdowns, page counts and changing percentages. Use a 4px spacing grid, 1px panel dividers, 6px controls and 10px dialogs. Apply a visible 2px accent focus ring with 2px offset. Check normal text at 4.5:1 and essential control boundaries/focus at 3:1. Hairlines serve as separators. |
| Editor at 1440 × 900 | Reduce the estimated 215–265px stack to a 48px nav, 40px document action row and 32px pane toolbar. First paper starts within 128px at scroll top in the settled view, Grade closed. Include guest status inline with its sign-in action. Move fit/page count, view and grade into the pane toolbar. Put secondary actions in the existing menu pattern. Keep actionable failures, pending approvals and Undo reachable with keyboard and screen reader. On narrow screens use overflow actions, respect safe-area insets and retain touch targets. |
| Paper and diagnostics | Canvas behind the stage, panels for tools, elevated menus. A white sheet with a 1px edge, one restrained shadow and an 8px top gutter frames the actual résumé. Keep document ink, SVG, PDF colors and page geometry intact. Grade and Tailor Diagnostics share dark panels. Use labeled urgent/danger, non-urgent/warning and cosmetic/info badges with subdued fills and explicit borders. |
| Landing and ambient motion | Remove the full-viewport `AsciiWaves` canvas and glow/blur overlay, the tracker’s 72s `.workspace-wave-texture` / `workspace-wave-drift` animation and its pause controls, `ProductProofCard` mouse tilt, terminal dots and typewriter, and `StaggeredText` word-by-word blur-slide. Use a static heading and useful product content. Replace the infinite rainbow capability marquee with a short static list or remove duplicate links. Remove the fixed `w-[70%]` “Processing…” demo, glass/neon glows and ornamental terminal labels. Preserve the interactive ATS sandbox. Use specific color/opacity transitions up to 160ms and respect reduced motion. |
| Product copy | Guest drafts stay in the browser. Signed-in saves use hosted Postgres. For an AI action the app can relay the relevant text and BYOK credential to the selected provider. The browser vault holds saved BYOK keys. Use this distinction throughout the matrix, footer claim and landing cards. |
