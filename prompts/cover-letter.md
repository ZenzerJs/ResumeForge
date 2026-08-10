# Evidence-Grounded Cover Letter Generation Prompt

Runtime source of truth: [`src/lib/ai/cover-letter-prompt.ts`](../src/lib/ai/cover-letter-prompt.ts)

Composed via master guardrails. ADR-011 + [`docs/ai-guardrails.md`](../docs/ai-guardrails.md).

## Task Header

`## TASK-SPECIFIC: TAILORED COVER LETTER SPECIALIST`

## Constraints

1. **Evidence citations** — `evidenceCitations` must list every Evidence / Bullet ID used.
2. **Gap handling** — Unsupported JD requirements must not be claimed; omit or list in `gapsAddressed`.
3. **JSON only** — schema below.

## Output JSON Schema

```json
{
  "title": "Cover Letter — [Company] [RoleTitle]",
  "salutation": "Dear [Hiring Manager / Hiring Team at Company],",
  "openingParagraph": "Strong 2-3 sentence hook...",
  "bodyParagraphs": [
    "First body paragraph grounded in evidence...",
    "Second body paragraph..."
  ],
  "closingParagraph": "Polite closing...",
  "fullMarkdown": "# Cover Letter\n\n...",
  "evidenceCitations": ["exp-1", "bullet-101"],
  "gapsAddressed": []
}
```

## User Prompt Inputs

- Company, role title, role profile overlay, raw JD excerpt
- Active Evidence Bank (non-archived) with bullet IDs
