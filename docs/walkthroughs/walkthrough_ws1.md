# Phase 2: WS1 Walkthrough — Job Ingestion Failure Taxonomy & Universal Normalizer

## Deliverable Summary
- **WS1.1 (Job Ingestion Failure Taxonomy & Policy Enforcement)**:
  - Defined 13-case `ExtractFailureCode` taxonomy (`robots_disallowed`, `http_401_403`, `http_404`, `cloudflare_challenge`, `login_wall`, `js_shell_empty`, `consent_wall`, `pdf_or_binary`, `iframe_ats`, `no_job_schema`, `blocked_host`, `timeout`, `invalid_url`).
  - Added strict policy compliance check `checkHostPolicy` blocking LinkedIn scraping and Indeed search result crawling (TOS compliance) while directing users to direct manual paste.
  - Added Ashby public JSON board API integration in `ashbyApiUrlFromPosting`.
- **WS1.2 (Universal Job Normalizer)**:
  - Implemented `normalizeJob` transforming every job payload into canonical `NormalizedJob`.
  - Built location coordinate resolver recognizing Canadian metropolitan hubs (Toronto, Montreal, Vancouver, Calgary, Ottawa, Waterloo, etc.) and remote flags.
  - Added `stripBoilerplate` extracting EEO / diversity disclaimers into clean metadata.
- **WS1.3 (AI JD Formatter & Prompt)**:
  - Created `FormattedJdSchema` extracting structured seniority, tools, domain, and role profile classification (`fullstack`, `backend`, `ai_llm`, `ml`, `frontend`, `data_platform`).
  - Created `buildJdFormatSystemPrompt` with strict anti-hallucination guardrails and wired `formatJobDescriptionWithAi` into the AI gateway.
- **WS1.4 (API Route & Schema Evolution)**:
  - Upgraded `POST /api/jobs/extract` returning normalized payloads, typed 422 failure diagnostics, and optional AI formatting.
  - Added `normalized`, `formattedJd`, `extractFailure`, `lat`, `lng`, `cityNorm` to `prisma/schema.prisma` and synchronized DB.

---

## File Changes

| File | Type | Description |
|---|---|---|
| `src/lib/ingestion/types.ts` | NEW | Defined `ExtractFailureCode` and `ExtractDiagnostics` |
| `src/lib/ingestion/normalize-job.ts` | NEW | Universal job normalizer, Canadian geo-resolver, and boilerplate stripper |
| `src/lib/ingestion/tier2-fetcher.ts` | MODIFY | Added host policy checker, Ashby API support, and failure code taxonomy |
| `src/lib/ai/jd-format-schema.ts` | NEW | Zod schema for structured JD taxonomy and target role profiles |
| `src/lib/ai/jd-format-prompt.ts` | NEW | Composed system prompt with zero-hallucination guardrails |
| `src/lib/ai/gateway.ts` | MODIFY | Added `formatJobDescriptionWithAi` dispatcher |
| `src/app/api/jobs/extract/route.ts` | MODIFY | Upgraded extract route with failure taxonomy and normalization |
| `prisma/schema.prisma` | MODIFY | Added `normalized`, `formattedJd`, `extractFailure`, `lat`, `lng`, `cityNorm` |
| `src/lib/jd-parser/parser.ts` | MODIFY | Added header-based `Company:`, `Title:`, and `Location:` extraction |
| `tests/ingestion-failure-taxonomy.test.ts` | NEW | Unit tests verifying failure codes and policy rules |
| `tests/normalize-job.test.ts` | NEW | Unit tests verifying geo coordinates, remote detection, and normalizer |
| `tests/jd-format.test.ts` | NEW | Unit tests verifying JD formatter schema and prompt guardrails |
| `e2e/ws1-ingestion.spec.ts` | NEW | Playwright E2E spec verifying 422 blocked hosts and 200 normalizer responses |

---

## Verification Results

| Quality Gate | Command | Result |
|---|---|---|
| **ESLint** | `npm run lint` | **PASS** (0 warnings, 0 errors) |
| **TypeScript** | `npm run typecheck` | **PASS** (Clean `tsc --noEmit`) |
| **Vitest Unit Tests** | `npm run test` | **PASS** (68 test files, 339/339 tests passed) |
| **Next.js Production Build** | `npm run build` | **PASS** (46 static/dynamic routes compiled) |
| **Playwright E2E Tests** | `npx playwright test` | **PASS** (75/75 tests passed across 17 spec files) |

---

## Next Phase
- **WS2 (P1)**: Discover Page Filter Panel, Canadian City Geocoding, Distance Radius Filter (Haversine formula), and Blended Match Scoring (recency + ATS match).
