# Phase Status — ResumeForge Living Progress Log

This document records completed project milestones, current state, known limitations, and instructions for upcoming work.

---

## Current Status: Phase 11 — Evidence-Grounded Engine, Guardrails & Adaptive AI Assistant

- **Completed Date**: 2026-08-14
- **Status Summary**: Complete implementation of Phase 11. Fact snapshot engine freezes master facts on Postgres Json column (`Resume.factSnapshot` & `ResumeVariant.factSnapshot`). Mechanical fail-closed guardrail diffs candidate Typst against master facts (blocking hard violations on employer, title, date, metric, evidence citations). Clean ATS single-column DOCX generator with direct downloads. Confirm-before-master fact freezing dialog. 5-step one-click apply sheet in tracker feed. Allowlisted model tool executor with guardrail gates. Portaled tri-mode `AiAssistantWindow` with RAF dragging/resizing and streaming markdown rendering.

### Phase 11 Deliverables
1. **Fact Snapshot Engine (`src/lib/facts/`)**:
   - `types.ts`, `normalize.ts`, `extract.ts`: Canonical string, employer, job title, date range, and metric tokenization pipeline.
   - `prisma/schema.prisma`: `factSnapshot Json?` on `Resume` and `ResumeVariant`.
   - Snapshot freezing on `saveMasterResume` and copy to variants for audit trail.
2. **Mechanical Guardrail Engine (`src/lib/guardrail/`)**:
   - `check.ts`, `policy.ts`, `types.ts`: Deterministic diff checker against master fact baseline.
   - Fail-closed retry policy (1x retry on violation, fallback to master baseline on failure).
   - Hard violation gate blocking PDF/DOCX export, patch applications, and master overwrite.
   - `src/components/ui/guardrail-feedback.tsx`: Audit table with severity badges and violation details.
3. **Clean ATS DOCX Generator (`src/lib/export/docx.ts`)**:
   - Single-column semantic DOCX generator using `docx`.
   - Export dropdown in preview panel (`PDF (WASM)` | `DOCX (ATS)`).
4. **Confirm-Before-Master Flow (`src/components/editor/confirm-master-dialog.tsx`)**:
   - Interactive preview of extracted employers, titles, metrics, and skills before freezing master baseline.
5. **One-Click Apply Pipeline (`src/components/tracker/apply-sheet.tsx`)**:
   - 5-step pipeline: `Job -> Tailor -> Guardrail Audit -> ATS Score -> Downloads & Direct Link`.
6. **Model Tool Protocol (`src/lib/ai/tools/`)**:
   - Allowlisted executor for `get_resume_facts`, `run_guardrail`, `get_ats_score`, `get_job`, `search_saved_jobs`, `apply_patches`, `export_docx`.
7. **Adaptive AI Assistant Window (`src/components/editor/ai-assistant-window.tsx` & `ai-markdown-renderer.tsx`)**:
   - Portaled container to `document.body` with tri-mode (`docked`, `floating`, `maximized`).
   - High-FPS RAF dragging and resizing with `localStorage` geometry persistence.
   - Streaming markdown rendering with code block copying and sanitization.

---

## Previous Status: Guest Sessions + Optional Accounts

- **Completed Date**: 2026-08-12
- **Status Summary**: The app is usable without signing up. Guest work stays in the browser. Email/password accounts persist resumes and evidence to Postgres scoped by `userId`. Jobs and full descriptions are a shared catalog readable by guests and every account.

### Follow-up (2026-08-12): Shared job catalog, private evidence
- Jobs and full descriptions are a global catalog. Guests and every account can read them. Creating/updating/deleting still requires sign-in.
- Evidence Bank, resumes, variants, and cover letters stay scoped to the signed-in user. Guests get empty lists and cannot save.
- Deleting a user no longer cascade-deletes catalog jobs (`Job.userId` is `ON DELETE SET NULL`). Cover letters store `userId` so they stay private even without a variant.
- Landing atmosphere layers, capability marquee, proof-card badges, and footer links restored. Landing `main` no longer uses `overflow-hidden` (that was clipping sections below the fold).
- Accounts have a unique `username`. Nav shows `@username` instead of the full email. Settings includes Sign In / Sign Up / Sign Out and username editing.

### Delivered
- `User` model and optional `userId` on `Resume`, `EvidenceItem`, and `Job`.
- Signup/login/me/logout; session cookie carries `userId`.
- Public pages; CSRF and rate limits unchanged. Missing `APP_ACCESS_SECRET` no longer locks browsing.
- Persist APIs return `401 GUEST_READ_ONLY` for guests; resume/evidence list GETs return empty data. Job list GETs return the shared catalog.
- Sign In / Sign Up nav, guest banner, login+signup page, Continue as guest.
- ADR-014 overrides ADR-013’s page-level password gate.

### Verification (2026-08-12)
- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run test` — pass (233/233)
- `npm run build` — pass
- `npx playwright test` — pass (68/68)

### Known limitations
- BYOK keys remain in `localStorage`.
- Rate limits are in-memory (one Render instance).
- Clerk/OAuth is out of scope.
- Guest editor drafts use localStorage + WASM; they are not written to Postgres.

---

## Current Status: Hosted Polish (Waves D–G)

- **Completed Date**: 2026-08-12
- **Status Summary**: Session chrome, leftover a11y, dead landing/kanban code, self-hosted Typst fonts, and Render start config. Host-readiness from Waves A–C is unchanged.

### Polish delivered
- Sign Out in nav (desktop + mobile). Dummy Notifications/Terminal controls removed.
- Login password show/hide. Hosted copy no longer claims local-first.
- One `<main>` per AppShell page. Search labels, focus-visible rings, 44px icon hits, editor `beforeunload`.
- Deleted unused landing modules and `tracker-workspace.tsx`. Home no longer refetches `/api/stats`.
- Typst text fonts served from `/fonts/typst/`; CSP no longer allows jsDelivr.
- `npm start` binds `0.0.0.0`; `render.yaml` documents Render Web + Postgres.
- CSRF origin check compares `Origin`/`Referer` to the `Host` header so `next start -H 0.0.0.0` does not 403 same-origin browser fetches.

### Verification (2026-08-12)
- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run test` — pass (231/231)
- `npm run build` — pass
- `npx playwright test` — pass (65/65)

### Known limitations
- BYOK keys remain in `localStorage` (CSP-mitigated, not vaulted).
- Rate limits are in-memory (one Render instance).
- Clerk/OAuth multi-user is out of scope.
- Live Render/Vercel provisioning is still a manual step (`render.yaml` is the blueprint).

---

## Current Status: Hosted Security & Optimization (Wave A–C)

- **Completed Date**: 2026-08-12
- **Status Summary**: ResumeForge is host-ready for a single-user public deploy: Postgres, password middleware, real master immutability, SSRF-safe fetches, rate/body limits, security headers, editor debounce + dynamic panels, slim paginated jobs API, one landing animation, and a11y (skip link, mobile nav, reduced motion).

### Hosted blockers closed
- Prisma datasource is PostgreSQL (`docker-compose.yml` for local). ADR-013 records the override of ADR-002/ADR-005.
- `src/middleware.ts` gates `/api/*` and app routes behind `rf_session`. Unauthenticated `GET /api/jobs` returns 401.
- Protected masters reject `PUT /api/resumes/[id]` (403). `generate-patches` no longer auto-creates a master.
- `safeFetch` wraps bulk-import, tier-2, and custom AI URLs. `JOB_SYNC_SECRET` is fail-closed.
- PDF 10 MB + `%PDF-` magic, Zod string caps, AI/import rate limits, CSP and related headers, Gemini `x-goog-api-key`.

### Optimization & a11y
- Typst compile debounced 400ms; CodeEditor/Preview/AI sidebar and ATS grade are `next/dynamic`.
- `GET /api/jobs` is paginated and omits `rawDescription`.
- Tier 1 import uses one `findMany` + `createMany`.
- Landing keeps AsciiWaves only (no WebGL/gsap). Stats load on the server. Nav uses Lucide. Skip link + mobile drawer.

### Verification (2026-08-12)
- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm run test` — pass (229/229)
- `npm run build` — pass (local Hanken/JetBrains fonts; `/` 168 kB, `/editor` 152 kB first-load JS)
- `npx playwright test` — pass (64/64), including `hosted-security.spec.ts`

### Follow-up hardening during verification
- Restored missing `public/wasm/*.wasm` (git checkout).
- CSP `connect-src`/`font-src` allow `cdn.jsdelivr.net` for Typst default fonts (was blocking live preview).
- Landing `StaggeredText` emits real spaces (a11y + Playwright text assertions).
- Editor AI-collapse persistence ignores mount-time `onResize` races.
- Remaining API `String(err)` paths sanitized on generate-patches / ATS evaluate.

### Known limitations
- BYOK keys remain in `localStorage` (CSP-mitigated, not vaulted).
- Rate limits are in-memory (one Render instance).
- Clerk/OAuth multi-user is out of scope.
- Provision Render/Vercel + Postgres after Playwright passes; this work is host-readiness, not the live deploy.

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
- Cover letter generator implemented in Phase 5; Job Application Tracker deferred to Phase 6.

---

## Current Status: Phase 5 Complete — Tailored Cover Letter Generator

- **Phase Completed**: Phase 5 (On-Demand, Evidence-Grounded Tailored Cover Letter Generator)
- **Completed Date**: 2026-08-06
- **Task 8.5 (Cover Letter Data Model & Evidence-Backed Drafting)**: Completed. Implemented `CoverLetter` Prisma schema model, grounding verifier (`verifyCoverLetterGrounding`), and `POST /api/cover-letters/generate` API route. Enforced zero-hallucination evidence citations and gap handling. Passed 8 unit tests in `tests/task-8.5-cover-letter.test.ts`.
- **Task 8.6 (Unified Job-Card Actions)**: Completed. Implemented unified job-card actions across `/tracker` linking external job postings, resume tailoring (`useActiveJob` hook and `/tailor?jobId=...`), and cover-letter draft management (`GET /api/cover-letters?jobId=...` and `POST /api/cover-letters/generate`). Added active job context banners across workspaces. Preserved click-zone separation and master resume protection. Passed 10 unit tests in `tests/task-8.6-unified-card.test.ts` and 31 Playwright E2E specs.
- **Status Summary**: Implemented `CoverLetter` Prisma model (`20260807000320_phase5_coverletter`), Evidence Grounding Verifier service (`src/lib/ai/cover-letter-verifier.ts`), fail-first verified unit tests (`tests/cover-letter-grounding.test.ts`), Cover Letter DAL (`src/lib/db/cover-letters.ts`), Zod schemas (`src/lib/ai/cover-letter-schema.ts`), system & user prompt templates (`src/lib/ai/cover-letter-prompt.ts`), provider `generateCoverLetter` adapters for OpenAI/Anthropic/Gemini/Custom, BYOK gateway dispatch (`src/lib/ai/gateway.ts`), REST API routes (`/api/ai/generate-cover-letter`, `/api/cover-letters`, `/api/cover-letters/[id]`), interactive `CoverLetterPanel` UI component (`src/components/tailor/cover-letter-panel.tsx`) integrated into `/tailor`, integration test suite (`tests/cover-letter-api.test.ts`), Playwright E2E test suite (`e2e/phase5-cover-letter.spec.ts`), and AI Security & Grounding Guardrail Audit (Sonnet 4.6).

### Completed Work
- Defined `CoverLetter` model in `prisma/schema.prisma` and generated SQLite migration `20260807000320_phase5_coverletter`.
- Built `src/lib/ai/cover-letter-verifier.ts` enforcing the Evidence Grounding Contract: every `evidenceId` cited in the cover letter MUST exist in the candidate's active Evidence Bank, preventing hallucinated experience from reaching cover letter prose.
- Built fail-first unit test suite `tests/cover-letter-grounding.test.ts` proving ungrounded/hallucinated citations are rejected with 422 contract error.
- Built data access layer `src/lib/db/cover-letters.ts` (`createCoverLetter`, `getCoverLettersByJobId`, `getCoverLetterById`, `updateCoverLetter`, `deleteCoverLetter`).
- Built Zod schemas `CoverLetterResponseSchema` and `GenerateCoverLetterInputSchema` in `src/lib/ai/cover-letter-schema.ts`.
- Built system and user prompt templates in `src/lib/ai/cover-letter-prompt.ts` enforcing zero hallucination, evidence citations, and modular paragraph structure.
- Extended all 4 provider adapters (`openai.ts`, `anthropic.ts`, `gemini.ts`, `custom.ts`) and `gateway.ts` dispatcher with `generateCoverLetter()`.
- Built REST API routes `POST /api/ai/generate-cover-letter`, `GET|POST /api/cover-letters`, and `GET|PUT|DELETE /api/cover-letters/[id]` with API key redaction via `sanitizeError()`.
- Built `CoverLetterPanel` UI component (`src/components/tailor/cover-letter-panel.tsx`) featuring opt-in trigger button, modular paragraph cards, evidence citation badges, markdown vs plain-text format toggle, copy-to-clipboard, download `.md`/`.txt`, and save to database.
- Integrated `CoverLetterPanel` into `/tailor` workspace (`src/components/tailor/tailor-workspace.tsx`).
- Created Vitest integration test suite (`tests/cover-letter-api.test.ts`) and Playwright E2E spec (`e2e/phase5-cover-letter.spec.ts`).
- Conducted AI Security & Grounding Guardrail Audit using Sonnet 4.6 (100% clean verification across all 5 security guardrails).

### Verification Tests Executed
- `npm run lint` — ESLint passed cleanly with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (83/83 tests passing across 18 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly.
- `npx playwright test` — Playwright E2E tests passed cleanly (23/23 tests passing across 9 spec files).

### Known Limitations (Phase 5 Scope)
- Job Application Tracker (Kanban pipeline, status tracking, notes, `/tracker` page) deferred to Phase 6.

### Suggested Next Task
- **Phase 6: Job Application Tracker Workspace**: Completed in full.

---

## Current Status: Phase 6 Complete — Job Application Tracker Workspace (V1 Target Met)

- **Phase Completed**: Phase 6 (Job Application Tracker Workspace & Unified Navigation Integration)
- **Completed Date**: 2026-08-06
- **Status Summary**: Implemented schema extensions (`status`, `appliedAt`, `notes`), SQLite migration `20260807001540_phase6_job_tracker`, REST route `PATCH /api/jobs/[id]`, central `/tracker` page with Kanban Column View & List View, interactive Job Cards with quick status dropdowns & inline notes editor, unified navigation header across all workspace pages, fail-first Vitest test suite (`tests/tracker-api.test.ts`), Playwright E2E test suite (`e2e/phase6-job-tracker.spec.ts`), and AI Security Guardrail Audit.

### Completed Work
- Extended `Job` Prisma model with `status` (`SAVED`, `APPLIED`, `INTERVIEWING`, `OFFER`, `REJECTED`, `ARCHIVED`), `appliedAt` (DateTime?), and `notes` (String?).
- Generated and executed migration `20260807001540_phase6_job_tracker`.
- Built `updateJob(id, input)` in `src/lib/db/jobs.ts` with automated `appliedAt = new Date()` defaulting upon status transition to `APPLIED`.
- Built REST API routes `GET` and `PATCH /api/jobs/[id]` (`src/app/api/jobs/[id]/route.ts`) with Zod `UpdateJobSchema` validation, field error handling, and key scrubbing via `sanitizeError()`.
- Built `/tracker` workspace (`src/app/tracker/page.tsx` & `src/components/tracker/tracker-workspace.tsx`) featuring pipeline metrics, Kanban/List view toggle, status dropdowns, inline expandable notes editor, and direct navigation links to `/tailor` and `/editor`.
- Integrated `/tracker` navigation link across all 5 main app workspace headers (`/editor`, `/library`, `/tailor`, `/tracker`, `/settings`).
- Created fail-first Vitest API test suite (`tests/tracker-api.test.ts`).
- Created Playwright E2E spec (`e2e/phase6-job-tracker.spec.ts`).
- Conducted AI Security Audit (Sonnet 4.6) with 100% compliance across all 4 guardrails.

### Verification Tests Executed
- `npm run lint` — ESLint passed cleanly with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (86/86 tests passing across 19 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (22/22 pages rendered).
- `npx playwright test` — Playwright E2E tests passed cleanly (25/25 tests passing across 10 spec files).

### Known Limitations (Phase 6 Scope)
- V1 core scope target fully achieved.

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
- **Phase 7: System Polish & Editor Safety**: Completed in full.

---

## Current Status: Phase 7 Complete — System Polish, Tracker Redesign & Master Safety Protocol

- **Phase Completed**: Phase 7 (System Polish, AI Gateway Fixes, Indeed-Style Tracker, Editor AI Sidebar & Master Safety Protocol)
- **Completed Date**: 2026-08-07
- **Status Summary**: Implemented all 9 Phase 7 tasks: Task 7.1 (AI diagnostic), Task 7.2 (AI gate fixes, fence-stripping, model field in Settings, error UX), Task 7.3 (shared `useActiveJob` persistence hook), Task 7.4 (PDF upload to non-master draft with instant editor redirect), Task 7.5 (Indeed/Glassdoor style tracker feed with `/tracker/applied` & `/tracker/saved`), Task 7.6 (functional editor AI sidebar panel), Task 7.7 (deterministic marker toolbar with selection stamping), Task 7.8 (global gold/amber color-token audit), and Task 7.9 (Save as Master overwrite confirmation, pre-save `MasterHistory` snapshotting, Revert to Master, and instant Undo Overwrite).

### Completed Work in Phase 7
- **Task 7.1 (AI Diagnostic)**: Conducted read-only inspection mapping 5 root causes for silent AI failures and PDF flow issues (`patchError` below fold, missing `model` field in Settings, raw markdown fences in LLM output, strict envelope Zod parsing, and instant master overwrites).
- **Task 7.2 (AI Tailoring & Error UX Fixes)**: Stripped markdown fences (` ```json `) in `generate-patches/route.ts` and `qualitative-review/route.ts`. Added custom Model Name field to `settings-workspace.tsx` and persisted to `localStorage`. Moved error banners above action buttons in Tailor UI with direct links to `/settings`.
- **Task 7.3 (Active Job Persistence)**: Built `useActiveJob` hook (`src/hooks/use-active-job.ts`) managing `sessionStorage` and `?jobId=` URL param sync across pages.
- **Task 7.4 (PDF Upload & Redirect)**: Updated `upload-pdf/route.ts` so uploaded PDFs save as reviewable drafts (`isMaster: false`) with `@pdf-conversion-draft` header comments. Added instant client redirect to `/editor?resumeId=<id>`.
- **Task 7.5 (Tracker Redesign)**: Built vertical card feed `TrackerFeed` (`src/components/tracker/tracker-feed.tsx`) replacing Kanban view with search/filter sidebar, **Copy JD** button (copies text & navigates to `/tailor?jobId=`), inline notes, and status dropdowns. Created sub-page routes `/tracker/applied` and `/tracker/saved`.
- **Task 7.6 (Editor AI Sidebar)**: Replaced stub in `src/components/editor/ai-sidebar.tsx` with a functional panel that parses JDs, fetches patch proposals, allows accepting/skipping suggestions, and applies accepted patches to the editor buffer.
- **Task 7.7 (Deterministic Marker Panel)**: Added **Mark as Verified** button to `code-editor.tsx` toolbar using CodeMirror 6 selection API to inject `// ✓ @verified:<date>` annotations.
- **Task 7.8 (Global Gold/Amber Color Audit)**: Standardized accent color tokens to brand gold/amber (`text-amber-400`, `bg-amber-500`) across all 9 primary workspace components.
- **Task 7.9 (Master Safety Protocol)**: Added `MasterHistory` model to `prisma/schema.prisma` and executed schema sync. Added `saveMasterResume` with automatic pre-save snapshotting, unconfirmed overwrite blocking, `restoreMasterSnapshot`, and API routes `POST /api/resumes/save-master` and `POST /api/resumes/undo-master`. Built confirmed Save as Master dialog, Revert to Master button, and Undo Overwrite banner in `editor-workspace.tsx`.

### Verification Tests Executed
- `npm run lint` — ESLint passed cleanly with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed cleanly with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (102/102 tests passing across 25 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (31/31 static pages rendered).
- `npx playwright test` — Playwright E2E tests executed cleanly across spec files.

---

## Current Status: Phase 8 In Progress — Job Ingestion at Scale & Cover Letter Engine

- **Phase In Progress**: Phase 8 (Job-Board Ingestion at Scale, Indeed/Glassdoor Refinements, Cover Letter Generator & Unified Job Card Actions)
- **Completed Date**: 2026-08-07
- **Status Summary**: Completed Task 8.1 (Documentation of Scope Amendments per ADR-010 & ADR-011) and Task 8.2 (Tier 1 Bulk Job Ingestion Module, Markdown Table Parser, Deduplication, API Route & Tracker Refresh Button).

### Completed Work in Phase 8
- **Task 8.1 (Document Scope Amendment)**: Added ADR-010 (Two-Tier Job Ingestion) and ADR-011 (Cover Letter Generation) to `docs/decisions.md` explicitly superseding Phase 5 exclusions. Updated `PRODUCT.md` with Feature 7 and Feature 8.
- **Task 8.2 (Tier 1 Bulk Job Ingestion)**:
  - Created `src/lib/ingestion/tier1-importer.ts` with configurable source URL (`DEFAULT_SIMPLIFY_SOURCE_URL`), markdown table parsing (`parseMarkdownTable`), clean Markdown formatting stripping, deduplication against existing database jobs, and placeholder raw description formatting (`[Pending Import] ...`).
  - Created REST API route `POST /api/jobs/bulk-import` supporting configurable `sourceUrl` or `tableMarkdown` payload.
  - Added **Refresh from Source** button on `/tracker` feed (`src/components/tracker/tracker-feed.tsx`) with status notification banner (`Imported X new jobs (Y existing skipped)`).
  - Built unit test suite `tests/tier1-ingestion.test.ts` (proved fail-first Red state before implementation; 4/4 tests passing Green).

### Verification Tests Executed
- `npm run lint` — ESLint passed cleanly with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed cleanly with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (106/106 tests passing across 26 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (34/34 static pages rendered).

- **Task 8.3 (Tracker Redesign Refinements)**:
  - Updated [`src/components/tracker/tracker-feed.tsx`](file:///c:/Users/jayde/.gemini/config/projects/Resume-Forge/src/components/tracker/tracker-feed.tsx) with full card field set: company initial logo badge, role title with external link affordance icon, location badge, posting date badge, salary badge / intentional missing salary state, status badge dropdown, and Tier 1 placeholder description pill.
  - Implemented explicit click-zone separation: clicking card header/body opens direct `applyUrl` in a new tab (`target="_blank"`, `rel="noopener noreferrer"`); action bar buttons (`Copy JD`, `Tailor Resume`, `Generate Cover Letter`, `Status select`, `Notes`, `Delete`) stop click propagation (`e.stopPropagation()`).
  - Added helper extraction functions: `extractLocationFromNotes`, `extractApplyUrlFromNotes`, `extractPostingDateFromNotes`, `extractSalaryFromNotes`, `isPlaceholderDescription`.
  - Created unit test suite [`tests/tracker-card-spec.test.ts`](file:///c:/Users/jayde/.gemini/config/projects/Resume-Forge/tests/tracker-card-spec.test.ts) (proved fail-first Red state before implementation; 4/4 tests passing Green).
  - Built direct multi-location regression test [`scripts/test-tiktok-multi-location.ts`](file:///c:/Users/jayde/.gemini/config/projects/Resume-Forge/scripts/test-tiktok-multi-location.ts) verifying TikTok San Jose and TikTok Seattle render as two separate job cards with distinct apply links.

### Verification Tests Executed
- `npm run lint` — ESLint passed cleanly with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed cleanly with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (110/110 tests passing across 27 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (34/34 static pages rendered).

- **Task 8.4 (Tier 2 On-Demand Full-Text Fetch & Best-Effort Extractor)**:
  - Created `src/lib/ingestion/tier2-fetcher.ts` supporting Schema.org `JobPosting` JSON-LD extraction, DOM main content container parsing, HTML-to-markdown formatting, quality gate validation (length >= 180 chars, SPA JS-shell detection, substance keywords), and database caching (`fetchAndCacheJobFullText`).
  - Created REST API route `POST /api/jobs/[id]/fetch-fulltext` (`src/app/api/jobs/[id]/fetch-fulltext/route.ts`).
  - Updated `src/components/tailor/tailor-workspace.tsx` to automatically trigger on-demand Tier 2 fetch when loading a Tier-1-placeholder job, displaying non-blocking status banner ("Attempting Tier 2 fetch..."), a "Skip & Paste Manually" action button, and automatic graceful fallback to manual paste mode.
  - Built unit test suite `tests/tier2-fetcher.test.ts` (proved fail-first Red state before implementation; 4/4 tests passing Green).
  - Built real-platform verification script `scripts/test-tier2-real-platforms.ts` and executed live extractions against database postings:
    - Greenhouse (IMC Trading): SUCCESS (4,309 chars extracted in 579ms)
    - Workday (Ciena): SUCCESS (3,528 chars extracted in 463ms)
    - Direct company career site (Optiver): SUCCESS (4,576 chars extracted in 970ms)

### Verification Tests Executed
- `npm run lint` — ESLint passed cleanly with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed cleanly with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (115/115 tests passing across 28 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (34/34 static & dynamic pages rendered).

### Known Limitations (Task 8.4 Scope)
- Tier 2 extraction relies on static HTML & JSON-LD parsing; pages requiring authenticated user logins or complex CAPTCHA challenges gracefully degrade to the manual paste fallback prompt.

### Suggested Next Task
- **Task 9.1 — AI-Powered PDF-to-Typst Conversion & Guaranteed Editor Redirect**: Completed in full.

---

## Current Status: Task 9.1 Complete — AI PDF-to-Typst Conversion & Guaranteed Editor Redirect

- **Task Completed**: Task 9.1 (AI-Powered PDF-to-Typst Conversion & Guaranteed Editor Redirect)
- **Completed Date**: 2026-08-08
- **Status Summary**: Implemented BYOK AI-assisted PDF-to-Typst conversion (`convertPdfTextToTypst`), shared `stripCodeFences()` utility (`src/lib/ai/utils.ts`), deterministic heuristic fallback (`convertTextToTypst`), FormData `providerConfig` transport, guaranteed client redirect to `/editor?resumeId=<id>`, non-master draft isolation (`isMaster: false`), session-dismissible status banners, Vitest unit test suite (`tests/pdf-ai-conversion.test.ts`), and Playwright E2E spec (`e2e/phase9-pdf-conversion.spec.ts`).

### Completed Work in Task 9.1
- **Shared AI Utilities**: Created `src/lib/ai/utils.ts` with `stripCodeFences()` supporting ` ```typst `, ` ```json `, ` ```markdown `, and bare code fences.
- **AI Gateway & Adapters**: Added `ConvertPdfInput` / `ConvertPdfResult` to `src/lib/ai/types.ts`, prompt templates in `src/lib/ai/pdf-prompt.ts`, provider adapters in `openai.ts`, `anthropic.ts`, `gemini.ts`, and `custom.ts`, and exported `convertPdfTextToTypst()` from `gateway.ts`.
- **Upload Route & Transport**: Updated `src/app/api/resumes/upload-pdf/route.ts` to parse `providerConfig` from `formData` or JSON payload, attempt AI conversion first, fall back seamlessly to heuristic formatting, prepend `// @conversion-path: ai|fallback`, and save non-master drafts (`isMaster: false`). Added `serverExternalPackages: ["pdf-parse", "pdfjs-dist"]` to `next.config.ts`.
- **Guaranteed Editor Redirect & Banner UX**: Updated `src/app/page.tsx` with upload status labels and `router.push('/editor?resumeId=...')`. Added non-blocking, session-dismissible conversion status banners ("AI-Converted Draft" vs "AI conversion unavailable — used basic formatting") in `src/components/editor/editor-workspace.tsx`.
- **Automated Verification**:
  - `tests/pdf-ai-conversion.test.ts`: Vitest suite covering fence stripping, AI conversion output, error/timeout fallback, zero-content-drop metrics (>= 90% word preservation & 100% section header preservation), and special character escaping.
  - `e2e/phase9-pdf-conversion.spec.ts`: Playwright spec verifying PDF upload, editor redirect, banner rendering, dismissal, and master resume isolation.

### Verification Tests Executed
- `npm run lint` — Passed with 0 errors or warnings.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (139/139 tests passing across 31 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (35/35 pages rendered).
- `npx playwright test` — Playwright E2E tests passed cleanly (33/33 tests passing across all spec files).

### Suggested Next Task
- **Task 9.2 — Resizable & Collapsible Editor Panels**: Completed in full.

---

## Current Status: Task 9.2 Complete — Resizable & Collapsible Editor Panels

- **Task Completed**: Task 9.2 (Resizable & Collapsible Editor Panels)
- **Completed Date**: 2026-08-08
- **Status Summary**: Implemented a 3-pane resizable desktop workspace (`react-resizable-panels`), brand gold/amber drag handle highlights (`src/components/ui/resizable.tsx`), native imperative collapse/expand controls for the AI sidebar (`panelRef={aiPanelRef}`), `localStorage` layout state persistence (`resumeforge_editor_layout`), complete preservation of mobile tabbed view (`lg:hidden`), Vitest unit test suite (`tests/editor-resizable-panels.test.ts`), and Playwright E2E spec (`e2e/phase9-resizable-editor.spec.ts`).

### Completed Work in Task 9.2
- **Resizable UI Primitives**: Created `src/components/ui/resizable.tsx` wrapping `Group`, `Panel`, `Separator` from `react-resizable-panels` with brand gold/amber hover & active state highlights.
- **Desktop Resizable Layout (`hidden lg:flex`)**: Replaced static desktop 12-column grid in `src/components/editor/editor-workspace.tsx` with a resizable 3-pane layout (`id="panel-code"`, `id="panel-preview"`, `id="panel-ai"`) enforcing minimum sizes (Code 20%, Preview 25%, AI Sidebar 15%).
- **Mobile Viewport Preservation (`lg:hidden`)**: Preserved the mobile tab switcher (`"editor" | "preview" | "ai"`) for viewports below `lg:`.
- **Collapsible AI Sidebar**: Added header collapse button (`PanelRightClose` / `PanelRightOpen`) to `src/components/editor/ai-sidebar.tsx` linked imperatively via `panelRef={aiPanelRef}` without resetting or unmounting AI chat history.
- **Layout Persistence**: Saved and restored pane layout and collapse state in `localStorage` (`resumeforge_editor_layout`) with graceful fallback defaults (`[45, 35, 20]`).
- **Automated Verification**:
  - `tests/editor-resizable-panels.test.ts`: Vitest unit tests for defaults, size bounds, layout persistence, and chat state preservation.
  - `e2e/phase9-resizable-editor.spec.ts`: Playwright spec for pane rendering, collapse toggle, and reload persistence.

### Verification Tests Executed
- `npm run lint` — Passed with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (146/146 tests passing across 32 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (35/35 static & dynamic pages rendered).
- `npx playwright test` — Playwright E2E tests passed cleanly (35/35 specs passing).

### Suggested Next Task
- **Task 9.3 — Ctrl+S Save Triggers Preview Recompile**: Completed in full.

---

## Current Status: Task 9.3 Complete — Ctrl+S Save Triggers Preview Recompile

- **Task Completed**: Task 9.3 (Ctrl+S Save Triggers Preview Recompile)
- **Completed Date**: 2026-08-08
- **Status Summary**: Implemented global `Ctrl+S` / `Cmd+S` keyboard shortcut handler (`src/lib/editor/shortcut-handler.ts`), browser `preventDefault()` interception, 300ms debounce locking against key-repeat spam, active draft buffer persistence to `localStorage`, instant preview recompile triggering, header toast confirmation (`[data-testid="shortcut-save-toast"]`), Vitest unit tests (`tests/editor-shortcut-save.test.ts`), and Playwright E2E spec (`e2e/phase9-shortcut-save.spec.ts`).

### Completed Work in Task 9.3
- **Shortcut Interceptor (`src/lib/editor/shortcut-handler.ts`)**: Built standalone, cross-platform keyboard shortcut handler supporting `Ctrl+S` (Windows/Linux) and `Cmd+S` (macOS `metaKey`), calling `preventDefault()` and enforcing a 300ms lock (`isSavingShortcutRef`).
- **Editor Workspace Wiring (`src/components/editor/editor-workspace.tsx`)**:
  - Attached global keydown listener executing active draft persistence to `localStorage`.
  - Triggered immediate compilation call `runCompile(source)` bypassing the typing debounce timer.
  - Displayed 2-second header confirmation badge (`[data-testid="shortcut-save-toast"]`).
  - Preserved "Save as Master Resume" modal isolation (`showSaveConfirm` remains untouched).
- **Preview Panel Integration (`src/components/editor/preview-panel.tsx`)**: Added `data-testid="typst-preview-svg"` and `data-testid="typst-error-banner"` for automated verification.
- **Automated Verification**:
  - `tests/editor-shortcut-save.test.ts`: Vitest suite covering Windows/macOS key detection, `preventDefault()` execution, 300ms debounce locking, syntax error fallback reporting, and Save as Master isolation (153/153 tests passing).
  - `e2e/phase9-shortcut-save.spec.ts`: Playwright spec verifying Ctrl+S draft save toast, immediate preview SVG update, syntax error banner preservation, and Save as Master isolation (38/38 specs passing).

### Verification Tests Executed
- `npm run lint` — Passed with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (153/153 tests passing across 33 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (35/35 static & dynamic pages rendered).
- `npx playwright test` — Playwright E2E tests passed cleanly (38/38 specs passing).

### Suggested Next Task
- **Task 9.4 — Unified Master AI System Prompt**: Completed in full.

---

## Current Status: Task 9.4 Complete — Unified Master AI System Prompt Engine

- **Task Completed**: Task 9.4 (Unified Master AI System Prompt Engine)
- **Completed Date**: 2026-08-08
- **Status Summary**: Created `src/lib/ai/master-prompt.ts` consolidating ResumeForge's 5 non-negotiable core AI guardrails (Zero Hallucination, Mandatory Evidence Citation, Explicit Gap Reporting, Anti-ATS Gaming Enforcement, Strict JSON Output Contracts). Refactored `prompt-template.ts` (patch generation), `qualitative-prompt.ts` (ATS review), and `cover-letter-prompt.ts` (cover letter generation) to compose with `buildComposedSystemPrompt()`. Documented decision in ADR-012 (`docs/decisions.md`) and updated `docs/ai-guardrails.md`. Created unit test suite (`tests/master-prompt.test.ts`).

### Completed Work in Task 9.4
- **Master Prompt Engine (`src/lib/ai/master-prompt.ts`)**: Built single source of truth `RESUMEFORGE_MASTER_SYSTEM_PROMPT` and helper `buildComposedSystemPrompt()`.
- **System Prompt Composition**:
  - `src/lib/ai/prompt-template.ts`: Composed `buildPatchSystemPrompt()` prepending master prompt.
  - `src/lib/ai/qualitative-prompt.ts`: Composed `buildQualitativeReviewSystemPrompt()` prepending master prompt.
  - `src/lib/ai/cover-letter-prompt.ts`: Composed `buildCoverLetterSystemPrompt()` prepending master prompt.
- **Documentation & Architecture**:
  - `docs/decisions.md`: Added ADR-012 (Unified Master AI System Prompt & Composition Pattern).
  - `docs/ai-guardrails.md`: Added Section 5 detailing the unified prompt engine.
- **Automated Verification**:
  - `tests/master-prompt.test.ts`: Vitest suite covering all 5 core guardrails, prompt builder start assertions, and fail-first composition mutation proof (158/158 tests passing across 34 test files).
  - `e2e/*`: Playwright E2E suite confirming patch generation, ATS qualitative review, and cover letter workflows remain 100% functional with zero schema or citation regressions (38/38 specs passing).

### Verification Tests Executed
- `npm run lint` — Passed with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (158/158 tests passing across 34 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (35/35 static & dynamic pages rendered).
- `npx playwright test` — Playwright E2E tests passed cleanly (38/38 specs passing).

### Suggested Next Task
- **Task 9.5 — Retire In-Workflow Evidence Tab & Add ATS Grade Button**: Completed in full.

---

## Current Status: Task 9.5 Complete — Retire In-Workflow Evidence Tab & Add ATS Grade Button to Editor Preview

- **Task Completed**: Task 9.5 (Retire In-Workflow Evidence Tab & Add ATS Grade Button to Editor Preview)
- **Completed Date**: 2026-08-09
- **Status Summary**: Streamlined the Editor preview toolbar with a header "Grade" action (`data-testid="grade-resume-btn"`) that invokes the ATS evaluation engine (`/api/ats/evaluate`) and renders an inline 100-point rubric breakdown overlay (`data-testid="editor-ats-score-overlay"`), reusing `AtsScorePanel` for 100% visual and numerical consistency with Tailor. Verified BYOK API key propagation for cover letter generation from `localStorage` (`resumeforge_ai_settings`). Retired in-workflow Evidence tabs while keeping `/library` fully functional and evidence citation badges intact. Built Vitest unit tests (`tests/editor-ats-grade.test.ts`) and Playwright E2E spec (`e2e/phase9-ats-grade.spec.ts`).

### Completed Work in Task 9.5
- **Editor ATS Grade Button & Overlay (`src/components/editor/preview-panel.tsx`)**:
  - Added header toolbar "Grade" button (`data-testid="grade-resume-btn"`).
  - Toggles inline ATS score breakdown overlay (`data-testid="editor-ats-score-overlay"`), rendering `AtsScorePanel` directly inside the preview pane container without navigating away.
  - Implemented loading state (`Loader2` spinner) and recoverable error state (`data-testid="editor-grade-error"`).
- **Cover Letter BYOK API Key Fix**:
  - `src/components/tailor/cover-letter-panel.tsx`: Reads `resumeforge_ai_settings` from `localStorage` and includes `providerConfig` in `/api/ai/generate-cover-letter` requests.
  - `src/app/api/ai/generate-cover-letter/route.ts`: Enforces `providerConfig` presence and returns a clean 400 error if no API key is configured in Settings.
- **Workflow Streamlining**:
  - Maintained `/library` as the single dedicated place for Evidence Bank management.
  - Kept evidence citation transparency badges on AI patches and cover letter cards.
- **Automated Verification**:
  - `tests/editor-ats-grade.test.ts`: Vitest suite covering evaluator execution, score determinism between Editor and Tailor, and empty source handling (161/161 tests passing across 35 test files).
  - `e2e/phase9-ats-grade.spec.ts`: Playwright spec verifying Grade button trigger, inline score breakdown rendering, and `/library` CRUD accessibility (40/40 specs passing).

### Verification Tests Executed
- `npm run lint` — Passed with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (161/161 tests passing across 35 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (35/35 static & dynamic pages rendered).
- `npx playwright test` — Playwright E2E tests passed cleanly (40/40 specs passing).

### Suggested Next Task
- **Task 9.1b — PDF Conversion Template Exemplar**: Completed in full.

---

## Current Status: Task 9.1b Complete — Fixed Template Exemplar for AI PDF Conversion

- **Task Completed**: Task 9.1b (PDF Conversion Template Exemplar)
- **Completed Date**: 2026-08-09
- **Status Summary**: Replaced freeform Typst prose styling rules in `src/lib/ai/pdf-prompt.ts` with a fixed, canonical Typst template exemplar (`#let section(title)`, `#let entry(...)`, `#set page`, `#set text`, `#show link`, `#set list`) and full worked example. Updated `public/templates/starter-resume.typ` to use the same canonical template pattern. Added template assertions to `tests/pdf-ai-conversion.test.ts`.

### Completed Work in Task 9.1b
- **AI PDF Prompt Exemplar (`src/lib/ai/pdf-prompt.ts`)**:
  - Replaced prose styling rules with fixed Typst helper functions (`section()` and `entry()`) and full worked example document.
  - Added strict instructions forbidding helper redefinitions or style block modifications while preserving character escaping and zero information loss rules.
- **Starter Template Alignment (`public/templates/starter-resume.typ`)**:
  - Reconciled default starter resume template to use the identical canonical `section()`/`entry()` pattern.
- **Automated Verification**:
  - `tests/pdf-ai-conversion.test.ts`: Added assertions verifying system prompt returns helper function definitions verbatim and forbids redefinitions (163/163 unit tests passing).

### Suggested Next Task
- **Task 9.6 — Tailor AI Feedback to Editor Handoff**: Completed in full.

---

## Current Status: Task 9.6 Complete — Tailor AI Feedback → Editor AI Chat Handoff

- **Task Completed**: Task 9.6 (Tailor AI Feedback → Editor AI Chat Handoff)
- **Completed Date**: 2026-08-09
- **Status Summary**: Connected Tailor Qualitative Review findings directly to the Editor's AI tailoring assistant via a "Use as prompt" action (`data-testid="use-as-prompt-btn"`). Carried feedback is stored per-`jobId` in `sessionStorage` and pre-loads into the Editor AI sidebar with a clearly labeled banner (`data-testid="seeded-feedback-banner"`) and dismissal button (`data-testid="dismiss-seeded-feedback-btn"`). Subsequent patch generation requests compose the carried feedback into system and user prompts following the master prompt engine rules (`RESUMEFORGE_MASTER_SYSTEM_PROMPT`). Built Vitest unit tests (`tests/tailor-editor-handoff.test.ts`) and Playwright E2E spec (`e2e/phase9-tailor-handoff.spec.ts`).

### Completed Work in Task 9.6
- **"Use as prompt" Action (`src/components/tailor/qualitative-review-panel.tsx`)**:
  - Added "Use as prompt" button (`data-testid="use-as-prompt-btn"`) on completed AI qualitative review cards.
  - Navigates to `/editor?jobId=${activeJobId}` while writing `resumeforge_tailor_feedback_${activeJobId}` payload to `sessionStorage`.
- **Editor AI Sidebar Pre-Load (`src/components/editor/ai-sidebar.tsx`)**:
  - On `/editor` load, retrieves carried feedback payload for active `jobId` and renders a dedicated "Seeded Feedback from Tailor Review" banner (`data-testid="seeded-feedback-banner"`).
  - Provided a "Dismiss Context" action (`data-testid="dismiss-seeded-feedback-btn"`). Clears `sessionStorage` key after single consumption so unseeded visits remain unaffected.
- **Master Prompt Composition (`src/lib/ai/prompt-template.ts`, `src/lib/ai/gateway.ts`, `src/app/api/ai/generate-patches/route.ts`)**:
  - Composed system prompt ordering: Master Prompt (`RESUMEFORGE_MASTER_SYSTEM_PROMPT`) → Structured Patch Instructions → Carried Tailor Review Feedback Context → JSON Schema Contract.
  - Grounded all proposed edits in the Evidence Bank without bypassing zero-hallucination rules.
- **Automated Verification**:
  - `tests/tailor-editor-handoff.test.ts`: Vitest suite testing prompt composition order, carried feedback injection, and context clearing (167/167 unit tests passing).
  - `e2e/phase9-tailor-handoff.spec.ts`: Playwright spec verifying handoff navigation, banner display, context dismissal, and single-use consumption (41/41 specs passing).

### Verification Tests Executed
- `npm run lint` — Passed with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (167/167 tests passing across 36 test files).
- `npm run build` — Next.js & Prisma production build succeeded cleanly (35/35 static & dynamic pages rendered).
- `npx playwright test` — Playwright E2E tests passed cleanly (41/41 specs passing).

### Suggested Next Task
- **Phase 9 Milestone Completion**: All Phase 9 Tasks (9.1, 9.1b, 9.2, 9.3, 9.4, 9.5, 9.6) are fully complete, verified, and pushed to `main`.

---

## Current Status: Phase 10 Complete — Production Polish, Metadata, Editorial Landing Atmosphere & Typst Repair Assist

- **Phase Completed**: Phase 10 (Task 10.1 Production Polish, Task 10.2 Landing Motion, Task 10.3 Editorial Redesign, Task 10.4 Atmospheric Background & Task 10.5 Typst Repair Assist)
- **Completed Date**: 2026-08-09
- **Status Summary**: Implemented brand icon assets (`src/app/icon.tsx`, `src/app/apple-icon.tsx`, `src/app/opengraph-image.tsx`, `src/app/manifest.ts`), complete root layout metadata (`metadataBase`, `openGraph`, `twitter`, `themeColor`), branded App Router error boundaries and loading skeletons (`src/app/not-found.tsx`, `src/app/error.tsx`, `src/app/loading.tsx`), an **Atmospheric Landing Background & Tone Softening** system (`public/landing/editorial-atmosphere.svg`, `src/components/landing/*`), and an **AI-Assisted Typst WASM Repair Assist** loop in the Editor (`src/lib/ai/repair-*`, `src/app/api/ai/repair-typst/route.ts`, `src/components/editor/*`).

### Completed Work in Phase 10
- **Brand Icon & Metadata Assets (Task 10.1)**:
  - Created dynamic brand favicon (`src/app/icon.tsx`) and iOS touch icon (`src/app/apple-icon.tsx`) using Next.js `ImageResponse`.
  - Built OpenGraph social card image generator (`src/app/opengraph-image.tsx`, 1200x630) with gold/amber branding and badge highlights.
  - Added Web App Manifest (`src/app/manifest.ts`) returning valid JSON manifest at `/manifest.webmanifest`.
  - Updated `src/app/layout.tsx` with `metadataBase`, complete OpenGraph, Twitter card (`summary_large_image`), and `themeColor: "#f59e0b"`.
- **Branded Application Route States (Task 10.1)**:
  - Built branded 404 page (`src/app/not-found.tsx`) with gold/amber accent, helpful message, and "Return to Dashboard" action.
  - Built client-side error boundary (`src/app/error.tsx`) with error details, "Try again" reset action, and home link.
  - Added root loading skeleton (`src/app/loading.tsx`) with ambient pulsing glow.
- **Atmospheric Landing Background & Tone Softening (Task 10.4 & Task 10.5 Part A)**:
  - Created local SVG background asset (`public/landing/editorial-atmosphere.svg`) featuring dark paper texture, document geometry crop marks, and ambient radial light.
  - Softened landing page text contrast (Display headings `#f5f5f7`, body text `#cbd5e1`, reserving pure `#ffffff` for primary CTA button).
  - Quiet surface framing around `ProductProofCard` (`bg-[#161922]/80 border border-slate-800/80 shadow-md`) and softened Silver Inverted tile contrast (`bg-[#d1d5db] text-[#111827]`).
- **Typst AI Repair Assist Loop (Task 10.5 Part B)**:
  - Added **Fix with AI** action button (`data-testid="fix-typst-ai-btn"`) on compiler error banners in `preview-panel.tsx`.
  - Built isolated **Typst Repair Assist Card** in `ai-sidebar.tsx` with dismiss action (`data-testid="close-repair-mode-btn"`), line/column error parsing, and source excerpt preview.
  - Client pre-compilation validation via WASM `compileTypstToSvg(proposal.replacementSource)` before enabling **Apply Fix** (`data-testid="apply-typst-fix-btn"`).
  - Payload bounds (20,000 char source limit) and diff-scope warning (>25% lines modified).
  - Explicit provider adapters (`repairTypstWithOpenAI`, `repairTypstWithAnthropic`, `repairTypstWithGemini`, `repairTypstWithCustom`) in `src/lib/ai/providers/` and dedicated endpoint `POST /api/ai/repair-typst`.
  - Shared source-update handler (`handleApplyRepair`) executing `handleSourceChange` + `compileSource` for draft storage, SVG recompilation, and Ctrl+S state sync.
- **Automated Verification**:
  - `tests/typst-repair.test.ts`: Created Vitest suite testing repair schemas, payload limits, prompt builders, provider adapters, and gateway dispatching (177/177 Vitest tests passing).
  - `e2e/phase10-repair.spec.ts` & `e2e/phase10-polish.spec.ts`: Created Playwright specs testing compile error repair journey, mock proposal pre-compilation validation, apply fix buffer update, atmospheric SVG rendering, and 375px/768px/1200px responsive viewports without horizontal overflow (55/55 E2E specs passing).

### Verification Tests Executed
- `npm run lint` — Passed with 0 warnings or errors.
- `npm run typecheck` — TypeScript compilation (`tsc --noEmit`) passed with 0 errors.
- `npm run test` — Vitest unit & integration tests passed cleanly (177/177 tests passing across 37 test files).
- `npm run build` — Next.js production build succeeded cleanly (37/37 static & dynamic pages rendered).
- `npx playwright test` — Playwright E2E tests passed cleanly (55/55 specs passing).

---

## Phase Update: AI Prompt Docs Sync + Master→Evidence Draft Extract

- **Completed Date**: 2026-08-09
- **Status Summary**: Prompt markdown specs now mirror runtime TS builders. Opt-in Save-as-Master flow can draft Evidence Bank items (`status: draft`, bullets `verified: false`) via `POST /api/ai/extract-evidence`, with dedupe that never overwrites verified items.

### Completed Work
- Rewrote/added `prompts/*.md` (master, tailor, qualitative-review, cover letter, pdf-to-typst, typst-repair, evidence-extract); JD parser documented as deterministic; ATS evaluator stub redirects to qualitative-review.
- Added `evidence-extract-schema.ts`, `evidence-prompt.ts`, `evidence-persist.ts`, gateway `extractEvidenceFromMaster`, and API route.
- Editor Save-as-Master modal: “Draft Evidence Bank from this resume” (default checked when bank empty).
- Tests: extended `master-prompt.test.ts`; new `evidence-extract.test.ts` (schema, persist, 400, mocked happy path).

### Verification Tests Executed
- `npm run lint` — Pass
- `npm run typecheck` — Pass
- `npm run test` — Pass (196/196)
- `npm run build` — Pass

### Known Limitations
- No auto-verify; no bullet-merge on draft duplicates (skip only).
- Markdown prompts are documentation mirrors only (not loaded at runtime).

### Suggested Next Task
- Library bulk verify/reject for Master-extract drafts; optional E2E for the extract toast path.

---









