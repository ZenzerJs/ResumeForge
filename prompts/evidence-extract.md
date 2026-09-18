# Master Resume → Evidence Bank Draft Extract

Runtime source of truth: [`src/lib/ai/evidence-prompt.ts`](../src/lib/ai/evidence-prompt.ts)

Composed via master guardrails. Used after Save as Master (opt-in) to draft Evidence Bank items for Library review.

## Task Header

`## TASK-SPECIFIC: MASTER RESUME → EVIDENCE BANK DRAFT EXTRACT`

## Guardrails

1. Extract **only** what appears in Typst — no invented metrics/companies.
2. No inflation of wording or seniority.
3. Output is **draft** intent — humans verify in Library (`status: draft`, bullets `verified: false`).
4. Prefer experience/project entries with bullets; skills as tags and/or `type: "skill"`.
5. Skip contact / hobbies → `skippedSections`.
6. JSON only.

## Output JSON Schema

```json
{
  "items": [
    {
      "type": "experience | project | skill | education | award | metric",
      "title": "...",
      "organization": "...",
      "dates": "...",
      "verifiedSummary": "factual paraphrase from Typst only",
      "tags": [],
      "bullets": [
        {
          "text": "...",
          "technologies": [],
          "roleAffinity": []
        }
      ]
    }
  ],
  "skippedSections": ["Contact"]
}
```

## Persistence Rules (Application)

- Create EvidenceItems with `status: "draft"` and bullets `verified: false`.
- Dedupe by `(type, title, organization)` — never overwrite existing `verified` items.
