# Walkthrough — Full-Repo AI Review & Hardening (2026-09-14)

## 1. Deliverable Summary

Full-repository AI review (CodeRabbit CLI unavailable → skill-based `reviewing-code` review) plus fixes for all Critical findings, full automated verification, and commit.

### Findings & Resolutions

| # | Severity | Finding | Resolution |
|---|----------|---------|------------|
| 1 | Critical | `src/lib/db/evidence.ts` `updateEvidenceItem`: `return await getEvidenceItemById(id)` was unreachable after `return await prisma.$transaction(...)` — `PUT /api/evidence/[id]` returned `data: undefined` | Moved re-read outside transaction callback; transaction result awaited separately |
| 2 | Critical | `src/components/tailor/tailor-diagnostic-panel.tsx` "Apply Fix" patched a hardcoded fake AST with fake evidence (`"Patched content"`) and showed "Patched successfully!" — fabricated success violating zero-hallucination contract | Panel now patches real variant Typst source, matches diagnostics to real Evidence Bank items, refuses document-level diagnostics without anchors, validates metric grounding, surfaces explicit fail-safe errors |
| 3 | Critical | `src/lib/prisma.ts` silently swapped Postgres → in-memory mock DB when DB unreachable, even in production — writes "succeeded" then vanished on restart | Fail-closed gate: production (or `RESUMEFORGE_ALLOW_MOCK_DB !== "1"`) throws `RESUMEFORGE_DB_UNAVAILABLE` instead of falling back. Dev/test/E2E keep offline mock fallback. Covers both initial probe and mid-session connection loss paths |
| 4 | Warning | `playwright.config.ts` inherited shell `APP_ACCESS_SECRET`, bypassing middleware's canonical `playwright-test-secret` 100/min limiter branch → auth suite hit production 10/min limiter, 3 tests failed with 429 | Pin `testSecret = "playwright-test-secret"` deterministically |
| 5 | Warning | `e2e/offline-ingest-and-patch.spec.ts` asserted the fabricated "Patched successfully!" outcome | Updated to accept either grounded-patch success or explicit guardrail error (`diagnostic-patch-success` / `diagnostic-patch-error` testids) |

### Files Created
- `tests/prisma-prod-gate.test.ts` — prod fail-closed gate + mock `$transaction` regression tests
- `tests/evidence-update-return.test.ts` — regression: `updateEvidenceItem` returns updated record with recreated bullets

### Files Modified
- `src/lib/db/evidence.ts`
- `src/components/tailor/tailor-diagnostic-panel.tsx`
- `src/components/tailor/tailor-workspace.tsx`
- `src/lib/prisma.ts`
- `playwright.config.ts`
- `e2e/offline-ingest-and-patch.spec.ts`

## 2. Automated Verification Results

| Check | Result |
|-------|--------|
| `npm run lint` | Pass (0 warnings, 0 errors) |
| `npm run typecheck` | Pass (0 errors) |
| `npm run test` | Pass (518/518 across 96 files, incl. 5 new regression tests) |
| `npm run build` | Pass (Next.js production build clean) |
| `npx playwright test` | Pass (96/96 across full suite, 2.4m) |

Initial Playwright run: 3 failures (`hosted-security.spec.ts` auth tests) — diagnosed as environment inheritance issue (finding 4), fixed, re-run green. No code regressions.

## 3. Known Limitations & Deferred Scope
- Signup TOCTOU race (concurrent duplicate username) falls to generic 500 instead of P2002 409 — low-risk, deferred.
- Mock DB remains the offline fallback in dev/test by design (ADR-aligned offline-first); only production is fail-closed.
- CodeRabbit CLI not installed on machine; `npx` package resolution failed (404). Review executed via `reviewing-code` + `review-security` skills instead. Install CLI from https://www.coderabbit.ai/cli for future AI reviews.
- Evidence-match in diagnostic panel is substring-based over `verifiedSummary` + tags; semantic matching deferred to AI patch generator.

## 4. Suggested Next Task
- Wire `TailorDiagnosticPanel` "Apply Fix" to persist patched content into a saved `ResumeVariant` (currently updates working copy in memory; user must save/re-run guardrail).
