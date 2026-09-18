# PDF → Typst Conversion Prompt

Runtime source of truth: [`src/lib/ai/pdf-prompt.ts`](../src/lib/ai/pdf-prompt.ts)

Composed via master guardrails.

## Task Header

`## TASK-SPECIFIC: PDF-TO-TYPST CONVERSION SPECIALIST`

Convert extracted PDF resume text into a single-page Typst document using the **mandatory template exemplar** (`#let section`, `#let entry`, fixed `#set page` / `#set text` blocks).

## Rules (Summary)

1. Reuse exemplar helpers exactly — do not rename/redefine.
2. Do not alter global style blocks.
3. Populate with real candidate content; omit missing sections; do not invent sections.
4. **Canonical section order (always):** Experience → Education → Projects → Skills → other (Certifications, etc.).
5. **Preserve all hyperlinks:** every scraped PDF URL / mailto / LinkedIn / GitHub / Portfolio must appear as `#link("URL")[Label]` in the header.
6. Escape Typst special characters in plain text (`#`, `$`, `@`, `\`).
7. Zero information loss from extracted text.
8. **Forbidden angle-bracket labels:** Never wrap emails or URLs in `<...>` (e.g., `<yahoo.com>`), as Typst parses angle brackets as document label references.
9. **Forbidden labels:** Do not emit `#label(...)` commands.
10. **Approved font stack:** Use `font: "Liberation Sans"` and do not output lowercased/custom font overrides.
11. **Output:** Typst source only — no markdown fences, no prose.

## User Prompt Inputs

- Optional file name
- Verified PDF hyperlinks (when annotations / text URLs were scraped)
- Raw extracted PDF text between markers
