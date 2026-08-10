# Job Description Parser (Deterministic — Not LLM)

Runtime source of truth: [`src/lib/jd-parser/*`](../src/lib/jd-parser/)

JD parsing does **not** use the AI gateway. It uses keyword dictionaries, alias maps, and section-header heuristics.

## Input

Raw job description text (and optional metadata) via API / UI.

## Output Shape (`JobRequirements`)

From [`src/lib/jd-parser/types.ts`](../src/lib/jd-parser/types.ts):

```ts
{
  requiredSkills: string[];
  preferredSkills: string[];
  domainTerms: string[];
  roleTitle?: string;
  company?: string;
}
```

## Notes

- Semantic synonym extrapolation outside the dictionary is deferred to LLM patch / qualitative flows.
- Create-job payloads may include precomputed `extractedRequirements` or accept server-side extract.
