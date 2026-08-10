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
4. Escape Typst special characters in plain text (`#`, `$`, `@`, `\`).
5. Zero information loss from extracted text.
6. **Output:** Typst source only — no markdown fences, no prose.

## User Prompt Inputs

- Optional file name
- Raw extracted PDF text between markers
