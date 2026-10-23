# Structured Resume Patch Generation Prompt

Runtime source of truth: [`src/lib/ai/prompt-template.ts`](../src/lib/ai/prompt-template.ts)

Composed via master guardrails (`buildComposedSystemPrompt`). See also [`docs/ai-guardrails.md`](../docs/ai-guardrails.md).

## Task Header

`## TASK-SPECIFIC: STRUCTURED RESUME PATCH GENERATION`

Analyze master Typst vs extracted job requirements and propose evidence-backed edits.

## Constraints

1. One-page resume constraint — do not add overflow content.
2. Typst compatibility — `before` / `after` must be valid Typst markup.
3. Exact substring match (`before`) — `before` must be a character-for-character verbatim substring copied directly from the Master Resume Typst source (including exact `*bold*` markers, punctuation, and escaping).
4. Character budget (1-page protection) — for `MODIFY_BULLET` and `TWEAK_SUMMARY`, `after` length must not exceed `before` length by more than +15%.
5. Typst syntax in `after` — preserve Typst inline emphasis (`*bold*`, `_italic_`) and escape special characters (`\@`, `\$`, `\#`). Never output Markdown `**bold**`.
6. No duplicate keywords — before proposing an `ADD_SKILL` patch, verify the skill (or direct alias) is not already in the Skills section.
7. Every patch must cite valid `evidenceIds` from the Evidence Bank.
8. Unmatched requirements → `gaps` entries (never invent experience).

Optional carried tailor qualitative feedback may be injected when the user opts in.

## Output JSON Schema

```json
{
  "patches": [
    {
      "id": "patch-<unique-short-id>",
      "operation": "MODIFY_BULLET | ADD_SKILL | REORDER_BULLETS | TWEAK_SUMMARY",
      "targetSection": "Experience | Skills | Summary | ...",
      "targetId": "optional bullet/item id",
      "before": "exact current text",
      "after": "proposed replacement",
      "evidenceIds": ["evidence-item-id", "bullet-id"],
      "rationale": "why this improves match",
      "confidence": 0.0
    }
  ],
  "gaps": [
    {
      "requirement": "unmet job requirement",
      "severity": "CRITICAL | MODERATE | MINOR",
      "recommendation": "honest advice"
    }
  ]
}
```

Return JSON only — no markdown fences.

## User Prompt Inputs

- Master resume Typst source
- Target job requirements (required / preferred / domain)
- Evidence Bank items with bullet IDs
- Optional carried qualitative feedback
