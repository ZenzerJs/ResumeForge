# Phase Status — ResumeForge Living Progress Log

This document records completed project milestones, current state, known limitations, and instructions for upcoming work.

---

## Current Status: Phase 2 Complete

- **Phase Completed**: Phase 2 (Master Resume Persistence & Evidence Bank Data Layer)
- **Completed Date**: 2026-08-06
- **Status Summary**: Implemented database models (`Resume`, `EvidenceItem`, `Bullet`), migration `20260806170804_phase2_persistence`, Zod-validated REST API routes (`/api/resumes`, `/api/evidence`), single-master transaction logic, seed script (`prisma/seed.ts`), Editor "Save as Master Resume" persistence action, functional `/library` CRUD interface, and Playwright E2E test suite.

### Completed Work in Phase 2
- Defined Prisma models in `prisma/schema.prisma` (`Resume`, `EvidenceItem`, `Bullet`) and executed SQLite migration.
- Built database access layer (`src/lib/db/resumes.ts` & `src/lib/db/evidence.ts`) with single-master transactional enforcement (`isMaster: true` un-masters prior records).
- Created Zod-validated API routes (`src/app/api/resumes/route.ts`, `src/app/api/resumes/[id]/route.ts`, `src/app/api/evidence/route.ts`, `src/app/api/evidence/[id]/route.ts`).
- Created seed script (`prisma/seed.ts`) populating realistic initial evidence items and bullets.
- Added "Save as Master Resume" button in `/editor` workspace header.
- Built `/library` management page (`src/app/library/page.tsx` & `src/components/library/library-workspace.tsx`) supporting list filtering, creation, editing, and archiving of evidence items.
- Added Playwright E2E persistence test suite (`e2e/phase2-persistence.spec.ts`).
- Documented single-master enforcement in `docs/decisions.md` (ADR-007).

### Verification Tests Executed
- `npm run lint` — ESLint passed with 0 errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit tests passed (5/5 tests passing).
- `npm run build` — Next.js & Prisma production build succeeded cleanly.
- `npx playwright test` — Playwright E2E tests passed (6/6 tests passing across Phase 1 & Phase 2 specs).

### Known Limitations (Phase 2 Scope)
- No UI for comparing prior non-master resume versions.
- No AI matching between Evidence Bank items and job descriptions (deferred to Phase 3/4).
- No ATS scoring panel.

---

## Phase Update: Phase 3 — Deterministic JD Parser & Rule-Based Evidence Matcher

- **Phase Completed**: Phase 3 (Deterministic JD Parser & Rule-Based Evidence Matcher Engine)
- **Completed Date**: 2026-08-06
- **Status Summary**: Implemented database model `Job`, migration `20260806172253_phase3_job_matching`, Zod-validated REST API routes (`/api/jobs`, `/api/jobs/extract`, `/api/jobs/match`), deterministic keyword dictionary (50+ tech terms) with section header heuristics, rule-based evidence matcher engine with status filtering/unverified draft signaling, `/tailor` workspace page with interactive requirement editor, unit tests, 400 rejection path tests, Playwright E2E test suite, and ADR-008.

### Completed Work
- Added `Job` model to `prisma/schema.prisma` (`id`, `company`, `roleTitle`, `rawDescription`, `source`, `extractedRequirements`, `createdAt`) and generated migration.
- Built data layer `src/lib/db/jobs.ts` for saving and fetching job records from SQLite.
- Built deterministic JD parser (`src/lib/jd-parser/*`) using 50+ tech skill terms, alias map, domain concepts dictionary, and regex section header heuristics (`required` / `must have` vs `preferred` / `nice to have`).
- Built Zod schemas `JobRequirementsSchema` and `CreateJobSchema` in `src/lib/jd-parser/types.ts`.
- Built rule-based evidence matcher (`src/lib/matching/matcher.ts`) supporting weighted scoring (Required=3pts, Preferred=2pts, Domain=1pt), requirement satisfaction mapping per bullet/item, exclusion of archived items (`status === "archived"`), and unverified draft signaling (`isDraft: true`, `status === "draft"`).
- Built REST API routes (`/api/jobs`, `/api/jobs/extract`, `/api/jobs/match`) with field-level Zod validation and 400 rejection path error responses.
- Built interactive `/tailor` workspace UI (`src/app/tailor/page.tsx` & `src/components/tailor/tailor-workspace.tsx`) with raw JD input, sample quick-fill buttons, interactive requirements term editor (removal and addition), ranked evidence cards with match percentages, satisfied requirement badges, and unverified draft badges.
- Created Vitest unit test suites (`tests/jd-parser.test.ts`, `tests/matching.test.ts`, `tests/jobs-api.test.ts`) and Playwright E2E test suite (`e2e/phase3-jd-matching.spec.ts`).
- Documented design decisions in `docs/decisions.md` (ADR-008) and updated entity definition in `docs/data-model.md`.

### Verification Tests Executed
- `npm run lint` — ESLint passed with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit and integration tests passed (15/15 tests passing across 5 test suites).
- `npx playwright test` — Playwright E2E tests passed (8/8 tests passing across Phase 1, 2 & 3 specs).
- `npm run build` — Next.js and Prisma production build succeeded cleanly.

### Known Limitations (Phase 3 Scope)
- Deterministic extraction relies on keyword dictionary and section header heuristics; semantic synonym extrapolation outside dictionary rules is deferred to Phase 4 (BYOK LLM Gateway).
- AI Patch proposal diff generation (patching master resume to produce tailored variants) deferred to Phase 4.
- 100-point ATS quality evaluator panel deferred to Phase 4.

### Suggested Next Task
- **Phase 4.2: Structured AI Patch Generator & Evidence Citation Verifier**: Implement AI prompt templates and structured JSON `PatchProposal` generation, diff review workspace UI, and evidence citation validation.

---

## Phase Update: Phase 4.1 — BYOK AI Provider Gateway & Connection Testing

- **Phase Completed**: Phase 4.1 (BYOK AI Provider Gateway Configuration & Connectivity)
- **Completed Date**: 2026-08-06
- **Status Summary**: Implemented thin AI provider adapters (`src/lib/ai/providers/*`) supporting OpenAI, Anthropic, Gemini, and Custom OpenAI-compatible endpoints, unified gateway abstraction (`src/lib/ai/gateway.ts`), automated API key redaction utility (`src/lib/ai/redact.ts`), ping route (`/api/ai/test-connection`), Settings configuration page (`/settings`), database key security assertions, unit & integration tests, Playwright E2E test suite, and ADR-009.

### Completed Work
- Created API key redaction utility (`src/lib/ai/redact.ts`) to scrub `sk-proj-*`, `sk-ant-*`, `AIzaSy*`, and Bearer tokens from all logs and error messages.
- Built thin provider connection adapters (`src/lib/ai/providers/openai.ts`, `anthropic.ts`, `gemini.ts`, `custom.ts`) with latency measurement and key-scrubbed error handling.
- Built unified gateway dispatcher (`src/lib/ai/gateway.ts`) and Zod schemas (`src/lib/ai/types.ts`).
- Created ping REST API route (`POST /api/ai/test-connection`) with validation and raw key exclusion guarantees.
- Built interactive settings configuration UI (`src/app/settings/page.tsx` & `src/components/settings/settings-workspace.tsx`) with provider selector, masked key input, custom endpoint base URL input, `localStorage` key persistence, and connection test status banner.
- Updated top navigation header in `EditorWorkspace` to include direct link to `/settings`.
- Created Vitest unit & integration test suites (`tests/redaction.test.ts`, `tests/ai-gateway.test.ts`, `tests/db-security.test.ts`).
- Created Playwright E2E settings test suite (`e2e/settings-byok.spec.ts`).
- Documented security practices, `localStorage` client persistence trade-offs, and generic endpoint naming rules in `SECURITY.md` and `docs/decisions.md` (ADR-009).

### Verification Tests Executed
- `npm run lint` — ESLint passed with 0 errors or warnings.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (22/22 tests passing across 8 test suites).
- `npx playwright test` — Playwright E2E tests passed (10/10 tests passing across all suites).
- `npm run build` — Next.js & Prisma production build succeeded cleanly.

### Known Limitations (Phase 4.1 Scope)
- Structured `PatchProposal` generation, AI prompt logic, diff review UI, and ATS rubric evaluation deferred to Phase 4.2.
- Native OS-Keychain integration (`keytar`) deferred as a future desktop packaging enhancement.

---

## Current Status: Phase 4.2 Complete — AI Patch Generator & Evidence Citation Verifier

- **Phase Completed**: Phase 4.2 (Structured AI Patch Generator, Gap Reporter & Diff Review UI)
- **Completed Date**: 2026-08-06
- **Status Summary**: Implemented `PatchProposal` & `Gap` Zod schemas matching `docs/ai-guardrails.md`, strict whole-patch citation verifier (`verifyEvidenceCitations`, Amendment 1), `ResumeVariant` and `Patch` Prisma models (`20260806181118_phase4_2_patches`), `variants.ts` data layer with hard `isProtected` master resume isolation (Amendment 3), system prompt builder (`src/lib/ai/prompt-template.ts`), provider `generatePatches` adapters for OpenAI/Anthropic/Gemini/Custom, BYOK gateway dispatch (`src/lib/ai/gateway.ts`), API routes (`/api/ai/generate-patches`, `/api/ai/apply-patches`), `PatchDiffReview` side-by-side review UI with per-patch accept/reject and Typst WASM compilation validation gate (Amendment 2), unit tests (`tests/patch-schema.test.ts`, `tests/variant-isolation.test.ts`), Playwright E2E spec (`e2e/phase4-patch-generator.spec.ts`), and git commits.

### Completed Work
- Defined Prisma models `ResumeVariant` and `Patch` in `prisma/schema.prisma` and generated SQLite migration `20260806181118_phase4_2_patches`.
- Built Zod schemas (`PatchProposalSchema`, `GapSchema`, `PatchResponseSchema`) in `src/lib/ai/patch-schema.ts`.
- Implemented `verifyEvidenceCitations()` enforcing Amendment 1: zero-tolerance citation check — any patch citing an invalid/non-existent evidence ID is rejected in its entirety, preventing AI hallucination from reaching resume drafts.
- Built `src/lib/db/variants.ts` data access layer enforcing Amendment 3: hard security guard (`assertNotProtectedResume`) refusing AI write operations on `Resume` records where `isProtected = true`.
- Built system and user prompt templates in `src/lib/ai/prompt-template.ts` enforcing zero-hallucination rules, mandatory evidence citations, explicit gap reporting, and Typst compatibility.
- Extended all four provider adapters (`openai.ts`, `anthropic.ts`, `gemini.ts`, `custom.ts`) with `generatePatches` methods for structured JSON completion.
- Extended `src/lib/ai/gateway.ts` with `generatePatchProposals` dispatcher.
- Built REST API routes `POST /api/ai/generate-patches` and `POST /api/ai/apply-patches`.
- Built `PatchDiffReview` UI component (`src/components/tailor/patch-diff-review.tsx`) featuring: gaps panel with severity badges, rejected patches panel displaying invalid citation warnings, side-by-side "Before" vs "After" diff view, evidence citation badges, individual per-patch Accept/Reject controls, and Amendment 2 Typst compile validation gate before creating variants.
- Integrated `PatchDiffReview` into `/tailor` workspace (`src/components/tailor/tailor-workspace.tsx`).
- Created Vitest unit test suites (`tests/patch-schema.test.ts`, `tests/variant-isolation.test.ts`) verified via fail-first protocol (proving tests fail when guards are disabled).
- Created Playwright E2E test suite (`e2e/phase4-patch-generator.spec.ts`).

### Verification Tests Executed
- `npm run lint` — ESLint passed cleanly with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (50/50 tests passing across 10 test suites).
- `npx playwright test` — Playwright E2E tests passed cleanly across all spec files.
- `npm run build` — Next.js & Prisma production build succeeded cleanly.

### Known Limitations (Phase 4.2 Scope)
- 100-point ATS quality evaluator panel completed in Phase 4.3.
- Cover letter generator and job tracker deferred to subsequent phases.

---

## Current Status: Phase 4.3 Complete — 100-Point ATS Rubric Evaluator & Quality Score Panel

- **Phase Completed**: Phase 4.3 (Deterministic 100-Point ATS Quality Score Panel & Role Profile Selector)
- **Completed Date**: 2026-08-06
- **Status Summary**: Implemented deterministic 100-point ATS evaluation engine (`src/lib/ats-evaluator/*`), 4-category rubric matching `docs/ats-rubric.md` (Base Resume Health 30, Required Role Match 40, Preferred Match 15, Role-Relevant Evidence 15), 6 Role Profile overlays (`Full-stack`, `Backend`, `AI/LLM`, `ML`, `Frontend`, `Data/Platform`), REST API route `POST /api/ats/evaluate`, `AtsScorePanel` UI component with per-skill demonstration tracing (`DEMONSTRATED_IN_EXPERIENCE`, `LISTED_IN_SKILLS_ONLY`, `UNSUPPORTED_GAP`), fail-first verified unit test suite (`tests/ats-evaluator.test.ts`, `tests/ats-api.test.ts`), and Playwright E2E test suite (`e2e/phase4-ats-score-panel.spec.ts`).

### Completed Work
- Updated `docs/ats-rubric.md` to establish the 4-category 100-point deterministic rubric and 6 Role Profiles as the canonical source of truth.
- Created `src/lib/ats-evaluator/types.ts` defining `RoleProfile`, `SkillMatchStatus`, `SkillEvaluation`, `CategoryResult`, `AtsEvaluationResult`, and Zod request validation schemas.
- Built `src/lib/ats-evaluator/profile-inference.ts` for auto-inferring role profile overlays from job title and posting text.
- Built `src/lib/ats-evaluator/evaluator.ts` implementing the 100% deterministic evaluation engine (0 LLM calls) with anti-gaming detection (penalizing hidden text), 1-page length heuristics, and skill demonstration status tracing.
- Built REST API endpoint `POST /api/ats/evaluate` (`src/app/api/ats/evaluate/route.ts`) supporting on-the-fly variant scoring, DB resolution, and field-level 400 rejection responses.
- Built `AtsScorePanel` UI component (`src/components/tailor/ats-score-panel.tsx`) featuring overall match badge, interactive 6-profile selector buttons, 4 category cards with progress meters, per-skill demonstration badges, and truthful actionable gap guidance.
- Integrated `AtsScorePanel` into `/tailor` page (`src/components/tailor/tailor-workspace.tsx`).
- Created Vitest unit & integration test suites (`tests/ats-evaluator.test.ts`, `tests/ats-api.test.ts`) verified via fail-first protocol (proving tests fail when score is altered).
- Created Playwright E2E test suite (`e2e/phase4-ats-score-panel.spec.ts`).

### Verification Tests Executed
- `npm run lint` — ESLint passed cleanly with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (59/59 tests passing across 12 test suites).
- `npm run build` — Next.js & Prisma production build succeeded cleanly.
- `npx playwright test` — Playwright E2E tests passed cleanly (17/17 tests passing across 6 spec files).

### Known Limitations (Phase 4.3 Scope)
- Purely deterministic rule-based evaluation (zero LLM calls).
- Cover letter generator and job tracker deferred to subsequent phases.

---

## Current Status: Phase 4.3b Complete — On-Demand AI Qualitative Reviewer

- **Phase Completed**: Phase 4.3b (On-Demand AI Qualitative Reviewer & Bounded JD Context Adjustment)
- **Completed Date**: 2026-08-06
- **Status Summary**: Implemented opt-in, user-triggered AI Qualitative Reviewer (`src/lib/ai/qualitative-schema.ts`, `qualitative-prompt.ts`, `src/app/api/ai/qualitative-review/route.ts`), Bounded JD Context Adjustment (-10 to +10 pts max with strict Zod sum & quote validation), `QualitativeReviewPanel` UI component (`src/components/tailor/qualitative-review-panel.tsx`), "Get AI Feedback" opt-in button on `/tailor`, fail-first verified unit tests (`tests/qualitative-schema.test.ts`, `tests/qualitative-trigger.test.ts`), Playwright E2E test (`e2e/phase4-qualitative-review.spec.ts`), and security guardrail audit.

### Completed Work
- Built `src/lib/ai/qualitative-schema.ts` defining `AtsQualitativeReviewSchema` with Zod refinements rejecting competing score fractions (e.g. 85/100), enforcing `jdContextAdjustment` bounds (-10 to +10 inclusive), verifying reasoning sum equality, and filtering generic `jdSignal` strings.
- Built `src/lib/ai/qualitative-prompt.ts` with system and user prompt templates instructing models on qualitative commentary, Bounded JD Context Adjustment, and zero replacement bullet generation.
- Extended BYOK gateway dispatcher (`src/lib/ai/gateway.ts`) and all 4 provider adapters (`openai.ts`, `anthropic.ts`, `gemini.ts`, `custom.ts`) with `generateQualitativeReview`.
- Created REST API endpoint `POST /api/ai/qualitative-review` (`src/app/api/ai/qualitative-review/route.ts`) with input validation, key redaction via `sanitizeError`, and Zod guardrail response parsing.
- Built `QualitativeReviewPanel` (`src/components/tailor/qualitative-review-panel.tsx`) featuring cyan-bordered layout, JD-adjusted score banner (`Base Score: 84 / 100 → JD-Adjusted: 87 / 100 (+3)`), expandable reasoning lines with quoted `jdSignal` text, bullet verdict badges (`STRONG_EVIDENCE`, `WEAK_EVIDENCE`, `VAGUE_CLAIM`, `KEYWORD_STUFFING`), and next steps guidance.
- Updated `AtsScorePanel` (`src/components/tailor/ats-score-panel.tsx`) with "Get AI Feedback" opt-in button. Verified zero auto-triggering on page load, patch apply, or score recalculation.
- Created unit & anti-auto-trigger test suites (`tests/qualitative-schema.test.ts`, `tests/qualitative-trigger.test.ts`) verified via fail-first protocol.
- Created Playwright E2E test suite (`e2e/phase4-qualitative-review.spec.ts`).
- Conducted AI Security Guardrail Audit using Sonnet 4.6.

### Verification Tests Executed
- `npm run lint` — ESLint passed cleanly with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (68/68 tests passing across 14 test suites).
- `npm run build` — Next.js & Prisma production build succeeded cleanly.
- `npx playwright test` — Playwright E2E tests passed cleanly (19/19 tests passing across 7 spec files).

### Known Limitations (Phase 4.3b Scope)
- Cover letter generator and job application tracker deferred to Phase 5.

### Suggested Next Task
- **Phase 5: Cover Letter Generator & Job Application Tracker**: Implement tailored cover letter generation and job application tracking.

---

## Mandatory Update Template for Future Agents

All AI agents completing subsequent phases MUST update this file using the following markdown format:

```markdown
---

## Phase Update: [Phase Number & Name]

- **Phase Completed**: [e.g. Phase 1 — Typst Editor Shell]
- **Completed Date**: [YYYY-MM-DD]
- **Status Summary**: [Brief 1-2 sentence description of deliverables]

### Completed Work
- [List specific components, features, or modules implemented]

### Verification Tests Executed
- `npm run lint` — [Pass / Fail status]
- `npm run typecheck` — [Pass / Fail status]
- `npm run test` — [Pass / Fail status]
- `npm run build` — [Pass / Fail status]

### Known Limitations
- [List any remaining gaps, stubs, or intentionally deferred items]

### Suggested Next Task
- [Recommended next phase or feature module]
```
