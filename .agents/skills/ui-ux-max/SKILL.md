---
name: ui-ux-max
description: Use when designing, building, or refining user interfaces for maximum visual excellence, intuitive UX ergonomics, accessible contrast, responsive layouts, and polished micro-interactions.
---

# UI/UX Max — Design Excellence & Ergonomics Guide

This skill governs UI/UX design standards across ResumeForge, combining maximum aesthetic polish, intuitive user workflows, high visual hierarchy, accessibility, and sub-second responsiveness.

---

## Core UI/UX Max Principles

### 1. Visual Restraint & High-End Polish
- **Harmonious Dark Theme System**: Use curated HSL slate tones (`bg-slate-950`, `bg-slate-900`, `border-slate-800`) paired with purposeful accent colors (indigo for primary actions, emerald for verified success, amber for warnings, red for gaps/penalties).
- **Typography & Scale**: Enforce clear typographic hierarchy with crisp font weights (`font-mono` for code/markup/metrics, `font-semibold` for headers, `font-sans` for main UI text).
- **Card & Border Precision**: Use subtle border dividers (`border-slate-800/80`), rounded containers (`rounded-xl`), and cohesive inner padding (`p-5`, `p-6`).

### 2. Ergonomic Workflows & Micro-Interactions
- **Instant Interactive Feedback**: Every state transition must provide feedback — loading spinners (`Loader2` animated), hover highlights (`hover:border-slate-700 hover:bg-slate-800`), and active state toggles.
- **Contextual Status Badging**: Use explicit, human-readable status badges (e.g. `✓ Demonstrated in Experience`, `~ Listed in Skills Only`, `✗ Unsupported Gap`).
- **Interactive Selectors & Toggles**: Buttons and selectors must feel tangible, responsive, and clearly highlight the currently active selection (e.g. Role Profile Selector bar).

### 3. Accessibility & High Contrast (a11y)
- **High Contrast Ratios**: Ensure all body text uses high-contrast foreground colors (`text-slate-100`, `text-slate-200`, `text-slate-300`) against dark backgrounds. Avoid low-contrast gray-on-gray body text.
- **Focus & Keyboard Navigation**: All inputs and buttons must include visible focus outlines (`focus:outline-none focus:border-indigo-500`) and standard keyboard event listeners (`onKeyDown`).
- **Semantic HTML**: Use proper HTML5 tags (`<main>`, `<section>`, `<header>`, `<nav>`, `<button>`, `<label>`, `<input>`) with explicit `type="button"` attributes.

### 4. Responsive Grid & Fluid Layouts
- **Breakpoints**: Design all workspaces to adapt fluidly from mobile single-column layouts (`grid-cols-1`) to large desktop split-screen displays (`lg:grid-cols-12`).
- **Zero Layout Shift**: Fixed container dimensions, smooth transitions, and skeleton loaders prevent cumulative layout shift (CLS).
- **Sub-Second Performance**: Client-side interactive computations execute instantly without blocking main thread interactions.

---

## Integration with `design-reference`

- Combine **`ui-ux-max`** (for visual hierarchy, contrast, accessibility, and micro-interactions) with **`design-reference`** (for surface-specific library rules and restraint guidelines).
- Maintain the local-first professional tool identity: calm, credible, and state-of-the-art.
