# PDF → Typst Conversion Prompt

Runtime source of truth: [`src/lib/ai/pdf-prompt.ts`](../src/lib/ai/pdf-prompt.ts)

Composed via master guardrails.

## Task Header

`## TASK-SPECIFIC: PDF-TO-TYPST CONVERSION SPECIALIST`

Convert extracted PDF resume text into a single-page Typst document using the **mandatory template exemplar** (`#let section`, `#let entry`, fixed `#set page` / `#set text` blocks).

## Rules (Summary)

1. Reuse exemplar helpers exactly (`#let section`, `#let entry`, `#let resume-entry`, `#let project-entry`, `#let skill-line`) — do not rename/redefine.
2. Do not alter global style blocks.
3. **Two-row header geometry:** Never collapse Company + Role onto a single pipe-separated line; Row 1 holds `title` and `location`, Row 2 holds `role`/`subtitle` and `date`.
4. **Preserve candidate section order & exact headings:** Keep the exact top-to-bottom section order from the PDF (or default to Experience → Education → Projects → Skills when ambiguous).
5. **Preserve inline bolding & metrics:** Keep `*bold*` emphasis on technologies, metrics, and outcomes inside bullets.
6. **Preserve all hyperlinks:** every scraped PDF URL / mailto / LinkedIn / GitHub / Portfolio must appear as `#link("URL")[Label]` in the header or project `links` field.
7. **Skills section formatting:** Render skill categories using `#skill-line(category: "...", items: "...")` or clean `#entry(details: [...])`.
8. Escape Typst special characters in plain text (`#`, `\$`, `@`, `\`), and never use LaTeX number spacing (`1\,000+` → `1,000+`).
9. Zero information loss from extracted text.
10. **Forbidden angle-bracket labels:** Never wrap emails or URLs in `<...>` (e.g., `<example.com>`), as Typst parses angle brackets as document label references.
11. **Forbidden labels:** Do not emit `#label(...)` commands.
12. **Approved font stack:** Use `font: "Liberation Sans"` (or bundled `("New Computer Modern", "Libertinus Serif")`) and do not output lowercased/custom font overrides.
13. **Output:** Typst source only — no markdown fences, no prose.

## User Prompt Inputs

- Optional file name
- Verified PDF hyperlinks (when annotations / text URLs were scraped)
- Raw extracted PDF text between markers
