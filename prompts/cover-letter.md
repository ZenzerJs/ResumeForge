# Evidence-Grounded Cover Letter — Output Guide for Models

Runtime source of truth: [`src/lib/ai/cover-letter-prompt.ts`](../src/lib/ai/cover-letter-prompt.ts)

Write a tailored cover letter **only** from Evidence Bank + master resume context. Never invent employers, metrics, or skills.

---

## Hard rules (failures happen when these are ignored)

1. Return **one JSON object only** — no markdown fences, no preamble.
2. Every concrete claim must map to an Evidence / Bullet **ID** listed in the user prompt; put those IDs in `evidenceCitations`.
3. If the Evidence Bank has items, `evidenceCitations` must include **at least one** valid ID.
4. Unsupported JD requirements → omit from claims or list in `gapsAddressed`. **Never** claim them as experience.
5. Length floors (schema-enforced):
   - `openingParagraph` ≥ 20 characters
   - each `bodyParagraphs[]` entry ≥ 30 characters
   - `closingParagraph` ≥ 20 characters
   - `fullMarkdown` ≥ 100 characters
6. `fullMarkdown` must be the **complete letter** (salutation, blank-line paragraphs, closing, signature).
7. Prefer verified evidence; treat drafts as unverified if used.

---

## Canonical valid example (copy this shape)

```json
{
  "title": "Cover Letter — Acme Corp Senior Backend Engineer",
  "salutation": "Dear Hiring Team at Acme Corp,",
  "openingParagraph": "I am writing to apply for the Senior Backend Engineer role at Acme Corp. My verified backend work building APIs and data systems aligns closely with your reliability and scale priorities.",
  "bodyParagraphs": [
    "In my recent platform role, I designed service APIs and improved database performance using approaches documented in my Evidence Bank, including measurable latency reductions on production queries.",
    "I also partnered with infrastructure teammates on containerized deployments, focusing on maintainable services rather than unsupported claims outside my verified experience."
  ],
  "closingParagraph": "Thank you for considering my application. I would welcome the opportunity to discuss how my verified experience can support Acme Corp's backend roadmap.",
  "fullMarkdown": "# Cover Letter — Acme Corp Senior Backend Engineer\n\nDear Hiring Team at Acme Corp,\n\nI am writing to apply for the Senior Backend Engineer role at Acme Corp. My verified backend work building APIs and data systems aligns closely with your reliability and scale priorities.\n\nIn my recent platform role, I designed service APIs and improved database performance using approaches documented in my Evidence Bank, including measurable latency reductions on production queries.\n\nI also partnered with infrastructure teammates on containerized deployments, focusing on maintainable services rather than unsupported claims outside my verified experience.\n\nThank you for considering my application. I would welcome the opportunity to discuss how my verified experience can support Acme Corp's backend roadmap.\n\nSincerely,\nJane Candidate",
  "evidenceCitations": ["exp-1", "bullet-101"],
  "gapsAddressed": ["No verified Kubernetes production ownership in Evidence Bank."]
}
```

---

## Field checklist

| Field | Requirement |
|-------|-------------|
| `title` | Human-readable title with company/role |
| `salutation` | Real greeting with company when known |
| `openingParagraph` | Hook with role + company + value (≥20 chars) |
| `bodyParagraphs` | 1–3 paragraphs, each ≥30 chars, evidence-grounded |
| `closingParagraph` | Thanks + soft CTA (≥20 chars) |
| `fullMarkdown` | Full assembled letter (≥100 chars) |
| `evidenceCitations` | Real IDs from the prompt only |
| `gapsAddressed` | Array (may be empty) of omitted/unsupported reqs |

---

## Common rejection causes

| Mistake | Fix |
|--------|-----|
| Empty `evidenceCitations` while Evidence Bank has items | Cite real IDs you used |
| Invented citation IDs | Only use IDs from the prompt |
| Claiming Kubernetes with no evidence | Put it in `gapsAddressed` |
| Tiny paragraphs under length floors | Write complete sentences |
| Markdown fences around JSON | Return raw `{...}` |
| `fullMarkdown` shorter than assembled letter | Mirror all paragraphs into markdown |
