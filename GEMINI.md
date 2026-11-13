# GEMINI.md — Agent Context Architecture for ResumeForge

## Stack & Verification

- **Stack:** Next.js (App Router), TypeScript, Tailwind CSS, CodeMirror, Typst WASM, Prisma + Postgres.
- **Verification:** Verify edits via `npm run typecheck && npm run test` (Vitest) and `npx playwright test` for UI/flow changes.

## Anti-Reread Circuit Breaker

- Never call `view_file` on the same file range more than once per task unless the file was modified or `/compress` occurred.
- If an edit target is ambiguous after one read, ask the user instead of re-reading.

## Noise Exclusions

- Never search or read `.next/`, `node_modules/`, `playwright-report/`, `test-results/`, or `*.db`.

## Structured State Protocol

- During multi-file execution, maintain `.gemini/state/session-map.md` with three compact sections:
  - `### Modified Interfaces`
  - `### Verified Checks`
  - `### Open Blockers`
- Update `.gemini/state/session-map.md` before any `/compress` or checkpoint.

## Safety Boundaries

- Never read, print, or modify `.env*` files.
- During read-only audits, write only to `AUDIT_REPORT.md` and make zero source edits.
