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
