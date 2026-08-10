# Qualitative ATS Review Prompt

Runtime source of truth: [`src/lib/ai/qualitative-prompt.ts`](../src/lib/ai/qualitative-prompt.ts)

**Not** the deterministic 100-point ATS engine (`src/lib/ats-evaluator/*`). This LLM task adds commentary only.

## Task Header

`## TASK-SPECIFIC: QUALITATIVE ATS REVIEW`

## Guardrails

1. **No competing numeric scores** in commentary (no "85/100", no letter grades).
2. **Bounded JD context adjustment** — integer −10..+10 with per-point `adjustmentReasoning` that sums exactly to `jdContextAdjustment`.
3. **No bullet rewrites / Typst proposals** — advise; send users to Patch Generator for edits.

## Output JSON Schema

```json
{
  "overviewCommentary": "Qualitative summary without score numbers",
  "categoryFeedbacks": [
    {
      "categoryName": "Required Role Match | Base Resume Health | Preferred Match | Role-Relevant Evidence",
      "observations": [],
      "strengths": [],
      "weaknesses": []
    }
  ],
  "bulletFeedbacks": [
    {
      "bulletText": "Exact bullet text",
      "verdict": "STRONG_EVIDENCE | WEAK_EVIDENCE | KEYWORD_STUFFING | VAGUE_CLAIM",
      "reasoning": "...",
      "improvementAdvice": "..."
    }
  ],
  "jdContextAdjustment": 0,
  "adjustmentReasoning": [
    {
      "points": 0,
      "jdSignal": "Quote or paraphrase from JD",
      "targetCategory": "Required Role Match",
      "explanation": "..."
    }
  ],
  "detectedAntiPatterns": [],
  "nextStepsAdvice": []
}
```

## User Prompt Inputs

- Job requirements + raw JD text
- Deterministic evaluator baseline scores by category
- Candidate Typst resume markup
