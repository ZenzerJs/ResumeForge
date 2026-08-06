---
name: design-reference
description: Use when styling, restyling, or building UI components/pages for ResumeForge. Provides approved design inspiration sources and rules for which library applies to which surface.
---

# ResumeForge Design Reference

ResumeForge is a **trustworthy, professional, local-first tool**. UI polish should read as calm and credible, not flashy. Default to restraint — subtle transitions over decorative animation.

## Approved reference libraries and where each applies

### React Bits — https://www.reactbits.dev/
Animated React components (text effects, backgrounds, interactive elements), Framer Motion/GSAP-based.
- **Use for**: subtle micro-interactions only — fade-ins, hover states, gentle transitions on cards/buttons/panels.
- **Do NOT use for**: the core editor, tailor workspace, or ATS score panel. No particle backgrounds, glitch text, scroll-hijacking, or heavy decorative animation on any authenticated app screen — it undermines the "professional resume tool" feel.
- **Acceptable surfaces**: a future public landing/marketing page only, if one gets built.

### assistant-ui — https://www.assistant-ui.com/
React primitives for AI chat interfaces (streaming responses, message threads, tool-call UI).
- **Use for**: `src/components/editor/ai-sidebar.tsx` specifically — this is the one genuinely chat-style AI surface in the app.
- **Do NOT use for**: any other component. This is not a general design system; it's scoped to that one file.

### Tailark — https://tailark.com/
shadcn-based marketing blocks (heroes, pricing, FAQ, footers), Next.js/Radix compatible.
- **Use for**: a future public landing/marketing page only, if one gets built.
- **Do NOT use for**: any authenticated app workspace screen (`/editor`, `/library`, `/tailor`, `/settings`).

## Existing stack — don't fight it

- Tailwind + shadcn/ui is already the established component system. Any new component should extend existing shadcn conventions (variants, theming via CSS vars) rather than introducing a parallel styling approach.
- If adding animation, prefer Framer Motion over GSAP — Next.js/React integrates it more natively and it's a lighter addition to the existing stack.
- Keep one-page resume constraint, Typst rendering, and existing color/typography tokens untouched unless the task explicitly says otherwise.

## Scope discipline

When given a polish task, touch only the component(s) named in the task. Do not restyle adjacent components "while you're in there" — that's scope creep and makes diffs harder to review.
