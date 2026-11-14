# ResumeForge Unified Studio Design System — Ember Ink

Warm espresso-black studio framing with a 3-color motif (Gold + Ember neighboring warm hues, Electric Blue contrasting signal) and layered depth.

## Palette & CSS Tokens

Define the colors once in `src/app/globals.css` using space-separated sRGB channels so Tailwind opacity modifiers resolve (for example `rgb(var(--surface-panel) / <alpha-value>)`):

```css
:root {
  --surface-deep: 10 8 8;
  --surface-canvas: 18 16 16;
  --surface-inset: 21 18 17;
  --surface-panel: 27 23 22;
  --surface-elevated: 39 33 32;
  --paper-sheet: 255 255 255;
  --paper-ink: 28 30 32;
  --text-primary: 244 238 231;
  --text-secondary: 208 197 185;
  --text-muted: 158 146 135;
  --border-hairline: 58 50 47;
  --border-control: 122 110 101;
  --accent-action: 247 189 63;
  --accent-secondary: 255 139 61;
  --accent-contrast: 79 143 255;
  --accent-ink: 42 28 0;
  --contrast-ink: 3 19 47;
  --status-success: 107 214 154;
  --status-warning: var(--accent-action);
  --status-danger: 255 138 128;
  --status-info: var(--accent-contrast);
  --focus-ring: var(--accent-action);
  --hairline-width: 1px;
}
```

## Surface & Control Specification

| Surface or control | Specification |
| --- | --- |
| Token migration | Map deep stage to `--surface-deep` (`#0a0808`), canvas/background/`rf-bg` to `--surface-canvas` (`#121010`), inputs to `--surface-inset` (`#151211`), card/`rf-surface`/Material container to `--surface-panel` (`#1b1716`), popover/high container/`rf-elevated` to `--surface-elevated` (`#272120`), outlines to border, primary actions/ring to `--accent-action` (`#f7bd3f`), secondary warm accents/gradients to `--accent-secondary` (`#ff8b3d`), and scores/signals/matches to `--accent-contrast` (`#4f8fff`). Never use navy or blue-tinted dark grounds (`#0b1326`, `#0a1224`, `bg-slate-900`, `bg-slate-950`). |
| Type, density and focus | Hanken Grotesk 400/600/700 for body/controls/headings. JetBrains Mono 400/600 for code and data. Use `tabular-nums` for ATS scores, breakdowns, page counts and changing percentages. Use a 4px spacing grid, 1px panel dividers, 6px controls and 10px dialogs. Apply a visible 2px accent focus ring with 2px offset. Check normal text at 4.5:1 and essential control boundaries/focus at 3:1. |
| Editor at 1440 × 900 | Keep the 48px nav, 40px document action row and 32px pane toolbar so the first paper starts within 128px at scroll top in the settled view, Grade closed. Use `bg-deep` (`#0a0808`) with a subtle warm top radial glow behind the `#ffffff` paper stage. Include guest status inline with its sign-in action. Move fit/page count, view and grade into the pane toolbar. |
| Paper and diagnostics | Deep warm stage behind the paper, panels for tools, elevated menus. A white sheet (`#ffffff`) with a 1px edge, one restrained shadow and an 8px top gutter frames the actual résumé. Keep document ink, SVG, PDF colors and page geometry intact. Grade and Tailor Diagnostics share dark panels. |
| Landing and ambient motion | Render the expressive multi-color `AsciiWaves` canvas ("Ember Ridges + Signal Glints": Warm Stone Ash troughs `#9e9287`, Ember Amber swells `#ff8b3d`, Warm Gold crests `#f7bd3f`, and Electric Blue `#4f8fff` interference nodes & cursor wake) with subtle 3-color radial ambient glows, `.text-ember-gradient` headline highlight, `.btn-glow` primary CTA, and `.surface-glass` `ProductProofCard`. Respect `prefers-reduced-motion: reduce` with a static fallback (`data-testid="atmosphere-static-fallback"`). Keep `/tracker` and workspace routes free of background wave loops. |
| Product copy | Guest drafts stay in the browser. Signed-in saves use hosted Postgres. For an AI action the app can relay the relevant text and BYOK credential to the selected provider. The browser vault holds saved BYOK keys. Use this distinction throughout the matrix, footer claim and landing cards. |
