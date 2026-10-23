# ResumeForge reliability and public demo plan

Status: Steps 1–4 implemented on `codex/bounded-public-demo`; step 5 demo-browser verification is pending. Unit, environment, PostgreSQL, Docker PDF smoke, and persistent-browser checks pass on the latest source.
Date: 2026-10-23 (America/New_York).
Reviewed baseline: `89439b1c10fa70b451d9cf96ebe31363107cc861`, committed at 06:08:09 Eastern.

## Release target

The product is self-hosted, with a small public demo showing most existing features. Prefer free hosting where feasible; do not design for subscription SaaS or large-scale traffic.

Keep the existing editor, evidence library, tailoring, exports, tracker, discovery, cover letters, and interview/practice surfaces. Pause new feature expansion while improving correctness and deployment readiness. Preserve the recorded choices to use checklist onboarding and keep the dedicated Cover Letter tab.

ADR-014 approved optional accounts and a shared job catalog. Existing accounts are intentional; the conflicting single-user/no-auth language in PRODUCT.md is stale. Historical decisions should retain their history, with their superseding decisions clearly identified.

Approved public demo policy: synthetic sample records; visitor drafts remain in the browser; live AI requires visitor BYOK; no operator-funded public AI fallback; public signup is disabled; maintenance/import controls stay operator-only. Self-hosted deployments keep account signup and full PostgreSQL persistence when `DEMO_MODE=false`. Do not share one writable demo account among visitors.

## 1. Contain destructive maintenance

Completed 2026-10-23 in `83c90f8`: maintenance-only endpoint, unconditional protection of application history and private artifacts, parent-row locking before eligibility checks, and preservation of protected feed links. At that phase, lint, typecheck, 652 tests across 111 files, production build, and a real-PostgreSQL cleanup-race test passed. The temporary test schema was removed. Permanent database integration coverage was added in step 2.

First implementation concern: global cleanup authorization and preservation of user work.

- Restrict global cleanup to the existing maintenance capability (`JOB_SYNC_SECRET`), rather than ordinary sign-in. Do not add an unrelated role system.
- Remove ordinary callers' ability to disable preservation of private artifacts.
- Preserve jobs referenced by any user's application history, variants, or cover letters. Define stale-listing removal separately from deleting a user's historical work.
- Examine automatic cleanup callers as well as the explicit endpoint. Make the selection and deletion safe against a user attaching work between those operations.
- Keep this concern separate from account-provider migration or UI redesign.

Acceptance: guests and ordinary users cannot invoke global cleanup; maintenance cannot delete referenced personal artifacts; rejected/archived application history is covered; concurrent reference creation cannot cause data loss.

Primary existing files: `src/app/api/jobs/cleanup/route.ts`, `src/lib/db/jobs.ts`, `src/lib/connectors/orchestrator.ts`, `src/lib/ingestion/tier1-importer.ts`, `tests/job-cleanup.test.ts`.

## 2. Verify the actual PostgreSQL contract

Completed 2026-10-23 in `6a568f0`: added a disposable PostgreSQL integration suite and CI wiring, fixed saved-job search to query `roleTitle`, and verified per-user shared-catalog isolation and critical write behavior. The phase passed 652 unit tests, four real PostgreSQL integration checks, lint, typecheck, build, and environment parity checks.

Second concern: database integration tests and the confirmed AI search field mismatch.

- Keep fast mock-based unit tests, but add an explicitly separate integration suite using a disposable PostgreSQL test database. Never reset the developer's application database.
- Exercise the same production data-access code without the unconditional Vitest mock selection.
- Replace `Job.title` query conditions with `roleTitle`; use typed Prisma inputs so invalid fields fail typecheck.
- Verify saved-job search and status filtering against per-user `JobApplication` records, including a shared catalog entry used by two accounts.
- Run the integration suite against the PostgreSQL service already present in CI. Cover cleanup authorization/preservation from step 1 against real foreign keys and transactions.

Acceptance: the suite demonstrably uses PostgreSQL; search works with nonempty text; user A cannot see user B's private application state; failures in critical write transactions roll back.

Primary existing files: `src/lib/prisma.ts`, `src/lib/ai/tools/executor.ts`, `vitest.config.ts`, `.github/workflows/ci.yml`, `tests/ai-tools.test.ts`, `tests/shared-jobs-private-evidence.test.ts`. Any new integration configuration must be distinct from the unit configuration.

## 3. Restore durable patch provenance

Step 3a completed 2026-10-23 in `ae4c539`: added durable `PatchCitation` storage and validation while retaining legacy citation JSON. Step 3b completed 2026-10-23 in `6dd93db`: generation stores server-bound proposals; apply accepts proposal IDs and acknowledgements, revalidates them, reconstructs against the bound source revision, and writes variants and citations atomically. The latest 3b checks passed 662 unit tests, lint, typecheck, build, environment parity (28 names), and six real PostgreSQL checks. Both subphases passed their acceptance checks without deleting legacy citation data.

Two dependent implementation concerns, landed as separate commits.

### 3a. Add citation storage without removing legacy data

- Add the signed `PatchCitation` design while retaining `Patch.evidenceCitations`.
- Require at least one of `evidenceId` or `bulletId`; when both exist, verify the bullet belongs to that evidence item. Resolve ownership and verified/non-archived status before acceptance.
- Keep hard-delete restriction distinct from application-level archive behavior.
- Define compatibility for legacy JSON citations. Report unresolved historical references; never invent mappings.
- Any destructive migration requires a verified dry-run report committed to its PR. Do not drop the legacy field in the additive PR.

Acceptance: valid evidence-only, bullet-only, and matching-pair citations succeed; empty, mismatched, foreign-user, or unavailable citations fail; existing records remain readable.

### 3b. Make apply-patches authoritative on the server

- Store validated proposals with their owner, target job, and master revision context. Inspect existing callers before selecting the final API shape.
- Have the client submit accepted proposal identifiers and explicit acknowledgements, rather than treating merged client text as proof of valid patches.
- Revalidate citations, ownership, current evidence eligibility, and guardrail policy; reconstruct the result from the bound source revision.
- Reject stale source revisions clearly. Save the variant, accepted patches, and citations atomically.
- Preserve browser Typst compilation and export checks. Do not claim that citation existence alone proves semantic truthfulness.
- Cover each existing apply entry point so the editor/sidebar and Tailor paths enforce the same policy.

Acceptance: invalid citations and fabricated protected facts cannot be persisted through the AI apply route; stale proposals fail safely; reloading a saved variant retains its accepted changes and citations; failed writes leave no partial variant.

Primary existing files: `prisma/schema.prisma`, `src/lib/ai/patch-schema.ts`, `src/app/api/ai/generate-patches/route.ts`, `src/app/api/ai/apply-patches/route.ts`, `src/lib/db/variants.ts`, `src/lib/ai/tools/executor.ts`, `src/components/tailor/patch-diff-review.tsx`, `src/components/editor/ai-sidebar.tsx`.

## 4. Prepare a bounded public demo and self-hosting path

Implemented 2026-10-23 in `9ce6079` and integrated with steps 3b and parser fix `ebe5ec5`; the latest production Docker image built successfully and its stateless PDF-import smoke test confirmed no database writes. Full synthetic lifecycle and backup/restore validation passed on the prior image; no database schema changed in the PDF-route refinement. Persistent browser checks passed; demo browser verification remains in step 5. The approved visitor policy remains unchanged: synthetic samples, visitor drafts in browser storage, visitor-provided BYOK, no public signup, and no operator-funded AI fallback. Demo mode blocks persistent application writes even for signed-in visitors and reads visitor resume/evidence/job data from browser storage. Self-hosted mode retains signup and PostgreSQL persistence when `DEMO_MODE=false`.

- Implement the approved visitor signup/save policy; document which features are live, local-only, or sample-backed.
- Reconcile PRODUCT.md and active architecture documentation with PostgreSQL and the approved account/catalog model. Do not remove historical ADR context.
- Verify Docker installation, migration, asset packaging, restart persistence, and backup/restore on synthetic data. The complete app-plus-PostgreSQL Compose path is implemented and has passed combined synthetic lifecycle and custom-format backup/restore validation.
- Verify that public AI cannot use operator fallback credentials, provider networking works under the production CSP, and public users cannot trigger unrestricted imports or maintenance.
- Keep expensive job refreshes on-demand and operator-controlled. Bound imported records and upload/request sizes based on measured use, without deleting user history to control costs.
- Compare current hosting offerings only after measuring production memory, build requirements, database/storage use, and WASM asset sizes. Check sleep/cold-start behavior, execution limits, egress, database expiry, and current pricing. A zero-dollar deployment is a target, not an established fact.

Acceptance: a new user can follow the self-hosting instructions successfully; the public demo shows its limitations honestly; projected demo resource use fits the chosen provider's verified limits; personal data and shared records cannot be mutated through demo bypasses.

## 5. Prove the release journey

In progress. The combined PostgreSQL integration run passed all six checks. The latest Docker image is 2,219,207,990 bytes; its PDF-upload smoke returned a browser-local Typst draft while `User` and `Resume` row counts stayed at zero. The full 10-migration lifecycle, Secure signup cookie, restart persistence, and separate-database restore passed on the prior image; no schema changed in the PDF-route update. Persistent Playwright passed 2/2 journeys, covering accepted/rejected patch review, compile/apply, citation reload, exports, tracker isolation, and authenticated PDF import. Demo Playwright remains in progress. Earlier per-phase checks are recorded in the walkthrough and are not substitutes for the final demo browser result.

Use synthetic resume/evidence fixtures and real PostgreSQL for persistence verification:

1. Import a resume and inspect conversion fidelity.
2. Review extracted draft evidence; verify selected items and freeze the master.
3. Select a job, generate deterministic test proposals, accept/reject changes, and save a variant.
4. Reload and verify source content, citations, private ownership, and master immutability.
5. Export PDF/DOCX/package; verify document content and guardrail rejection cases.
6. Record an application and verify its persistence and isolation from a second account.
7. Exercise the public visitor path and show local draft behavior and BYOK requirements.

Use mocked provider responses for repeatable browser tests; identify any live-provider smoke test separately. Include stale revision, invalid citation, network failure, and master overwrite confirmation cases.

Acceptance: the agreed core browser journeys pass against a production build, with screenshots/traces for failures and walkthrough evidence for the final result.

Playwright execution must be delegated to GPT-6 Luna. The primary agent reviews its report, evidence, and any changes, then fixes issues before delivery. No other delegation is required by this plan.

## Delivery discipline and deferred work

- One branch/PR per concern, using `codex/` branch names by default and conventional commits.
- Each implementation PR must pass lint, typecheck, test, and build. Run check:env when environment reads change; run the PostgreSQL integration checks when data access changes.
- Record actual verification results and the required walkthrough after each major phase. Preserve unrelated existing screenshots and untracked browser specs.
- No auth cutover, billing, subscriptions, scheduled scraping, collaboration, new job sources, broad UI rewrite, or speculative scale infrastructure in this pass.
- Retain the signed Better Auth design for its eventual task; keep APP_ACCESS_SECRET until that cutover. Keep the signed empty-requirements scoring behavior; RF-SCORE-NULL remains deferred.
- Keep the implementation history above and in the walkthrough. The current combined source has passed lint, typecheck, 674 tests across 115 files, `check:env` (32 declared names), six PostgreSQL integration checks, latest Docker build/PDF smoke, and both persistent Playwright journeys. Demo Playwright remains pending; do not claim step 5 complete until that journey is recorded.

Next actionable task: finish step 5 release verification with the combined source, then update the walkthrough with exact final results.
