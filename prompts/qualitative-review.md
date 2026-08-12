# Qualitative ATS Review — Output Guide for Models

Runtime source of truth: [`src/lib/ai/qualitative-prompt.ts`](../src/lib/ai/qualitative-prompt.ts)

This task adds **commentary only**. The deterministic ATS score is already computed — do not invent competing grades.

---

## Hard rules (failures happen when these are ignored)

1. Return **one JSON object only** — no markdown fences, no prose before/after.
2. `overviewCommentary` must **never** contain scores like `85/100`, `8/10`, or `Grade A`.
3. `categoryName` must be **exactly** one of:
   - `"Base Resume Health"`
   - `"Required Role Match"`
   - `"Preferred Match"`
   - `"Role-Relevant Evidence"`
4. `verdict` must be **exactly** one of:
   - `"STRONG_EVIDENCE"` | `"WEAK_EVIDENCE"` | `"KEYWORD_STUFFING"` | `"VAGUE_CLAIM"`
5. `jdContextAdjustment` is an integer from **-10 to +10**.
6. If `jdContextAdjustment` is **0**, set `"adjustmentReasoning": []`.
7. If `jdContextAdjustment` is **non-zero**, every point needs a reasoning row and **sum(points) === jdContextAdjustment**.
8. `jdSignal` must be a **specific** JD quote/paraphrase (≥5 chars). Never `"important"`, `"good fit"`, `"n/a"`.
9. Do **not** rewrite bullets or emit Typst — advice only.

**When unsure about JD adjustment: use `jdContextAdjustment: 0` and `adjustmentReasoning: []`.** That always validates.

---

## Canonical valid example (copy this shape)

```json
{
  "overviewCommentary": "Your experience aligns well with API and database work called out in the posting, while container orchestration remains lightly evidenced.",
  "categoryFeedbacks": [
    {
      "categoryName": "Base Resume Health",
      "observations": ["Clear experience section with measurable outcomes."],
      "strengths": ["Readable structure and concrete technologies."],
      "weaknesses": ["Some bullets lack scale or ownership language."]
    },
    {
      "categoryName": "Required Role Match",
      "observations": ["Core stack skills appear in experience bullets."],
      "strengths": ["PostgreSQL and API work are demonstrated in context."],
      "weaknesses": ["Kubernetes is not shown in hands-on experience."]
    },
    {
      "categoryName": "Preferred Match",
      "observations": ["Cloud keywords are limited."],
      "strengths": [],
      "weaknesses": ["Preferred cloud exposure is thin."]
    },
    {
      "categoryName": "Role-Relevant Evidence",
      "observations": ["Backend-oriented evidence dominates the draft."],
      "strengths": ["Service ownership themes match a backend overlay."],
      "weaknesses": ["Fewer end-to-end product delivery examples."]
    }
  ],
  "bulletFeedbacks": [
    {
      "bulletText": "Reduced PostgreSQL query latency by 40% through indexing and query rewrites",
      "verdict": "STRONG_EVIDENCE",
      "reasoning": "Names the technology and a concrete performance outcome.",
      "improvementAdvice": "If Evidence Bank has traffic volume, add it to show scale."
    }
  ],
  "jdContextAdjustment": 0,
  "adjustmentReasoning": [],
  "detectedAntiPatterns": [],
  "nextStepsAdvice": [
    "Add verified container orchestration evidence before claiming Kubernetes depth.",
    "Use the AI Patch Generator for evidence-backed bullet updates."
  ]
}
```

---

## Non-zero adjustment example (only when JD quote is real)

```json
{
  "jdContextAdjustment": 2,
  "adjustmentReasoning": [
    {
      "points": 2,
      "jdSignal": "Hands-on experience optimizing PostgreSQL queries in production",
      "targetCategory": "Required Role Match",
      "explanation": "The posting emphasizes production query optimization, which your bullets demonstrate clearly."
    }
  ]
}
```

---

## Common rejection causes

| Mistake | Fix |
|--------|-----|
| Markdown \`\`\`json fences | Raw `{...}` only |
| `categoryName`: `"Required Skills"` | Use `"Required Role Match"` |
| `verdict`: `"strong"` | Use `"STRONG_EVIDENCE"` |
| Adjustment 3 with empty reasoning | Use 0 + `[]` or add matching rows |
| Points sum 2 but adjustment 5 | Make them equal |
| Commentary says `78/100` | Remove all score fractions |
