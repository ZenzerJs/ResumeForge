# Test Plan & Verification Strategy — ResumeForge

## 1. Quality Gate Rule (Standing Mandate)

Every development phase and feature branch in ResumeForge MUST pass the four core quality gates before being merged or declared complete:

1. **Static Analysis & Linting**: `npm run lint` must pass with zero ESLint errors or warnings.
2. **Type Safety**: `npm run typecheck` (`tsc --noEmit`) must compile with zero errors.
3. **Automated Testing**: `npm run test` (Vitest) must execute all unit and integration test suites cleanly.
4. **Production Compilation**: `npm run build` must successfully generate production Next.js build artifacts and Prisma client bindings.

---

## 2. Phase-by-Phase Testing Outline

### Phase 0: Scaffold & Architecture (Current Phase)
- **Smoke Tests**: Verify test runner setup, Node.js environment invariants, and basic project configuration.
- **Database Connection**: Verify SQLite migration execution (`npx prisma migrate dev --name init`) and Prisma client generation.

### Phase 1: Typst Editor Shell & WASM Preview
- **Unit Tests**: Typst markup generation helpers, document template AST parser.
- **Integration Tests**: `typst.ts` WASM compiler instantiation in browser environment, live preview rendering trigger upon editor changes.

### Phase 2: Master Resume & Evidence Bank Persistence
- **Database Model Tests**: Prisma CRUD unit tests for `Resume`, `EvidenceItem`, `Bullet`, `Job`, and `ResumeVariant`.
- **Validation Tests**: Ensure `isProtected` flag prevents unauthorized deletion/overwriting of master records.

### Phase 3: Job Description Parser & Matcher Engine
- **Parser Unit Tests**: Requirement extraction logic, hard skill vs soft skill categorization, role profile detection algorithms.
- **Matcher Unit Tests**: Verification of deterministic matching algorithms comparing Evidence Bank tags against job requirements.

### Phase 4: AI Gateway & Patch Object Validation
- **Schema Validation Tests**: Validate AI provider responses against `PatchProposal` JSON schema.
- **Guardrail Unit Tests**: Test evidence citation requirement enforcement (`evidenceIds`) and mandatory gap reporting when evidence is missing.
- **Adversarial Input Tests**: Verify system behavior when job posting requires unverified technologies (e.g., Kubernetes without evidence).

### Phase 5: ATS Rubric & Export Engine
- **Rubric Unit Tests**: 100-point base rubric calculator accuracy across backend, frontend, AI/ML, and data role profiles.
- **Export Verification**: Verify single-page PDF generation layout boundaries.
