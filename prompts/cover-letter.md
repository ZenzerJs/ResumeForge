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
8. **Natural human voice (no system meta-language):** Never mention "my Evidence Bank", "verified experience", "master resume", or "evidence citations" inside the cover letter text. Write naturally as the candidate speaking directly to the hiring team.
9. **Synchronized markdown:** `fullMarkdown` must contain the exact same text as `salutation` + `openingParagraph` + `bodyParagraphs` + `closingParagraph` + signature, separated by `\n\n`. Do not summarize or truncate inside `fullMarkdown`.

---

## Canonical valid example (copy this shape)

```json
{
  "title": "Cover Letter — Acme Corp Senior Backend Engineer",
  "salutation": "Dear Hiring Team at Acme Corp,",
  "openingParagraph": "I am writing to apply for the Senior Backend Engineer role at Acme Corp. My background building production APIs and high-throughput data systems aligns closely with your reliability and scale priorities.",
  "bodyParagraphs": [
    "At Acme Platform, I architected TypeScript REST APIs and optimized PostgreSQL indexing, cutting p95 query latency by 40% across 1,000+ daily active users.",
    "I also partnered with infrastructure engineers on containerized microservice deployments, improving release predictability and observability across core services."
  ],
  "closingParagraph": "Thank you for considering my application. I would welcome the opportunity to discuss how my backend engineering background can support Acme Corp's roadmap.",
  "fullMarkdown": "# Cover Letter — Acme Corp Senior Backend Engineer\n\nDear Hiring Team at Acme Corp,\n\nI am writing to apply for the Senior Backend Engineer role at Acme Corp. My background building production APIs and high-throughput data systems aligns closely with your reliability and scale priorities.\n\nAt Acme Platform, I architected TypeScript REST APIs and optimized PostgreSQL indexing, cutting p95 query latency by 40% across 1,000+ daily active users.\n\nI also partnered with infrastructure engineers on containerized microservice deployments, improving release predictability and observability across core services.\n\nThank you for considering my application. I would welcome the opportunity to discuss how my backend engineering background can support Acme Corp's roadmap.\n\nSincerely,\nJane Candidate",
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
