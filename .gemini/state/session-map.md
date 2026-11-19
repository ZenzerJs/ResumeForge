### Modified Interfaces
- `src/lib/export/zip.ts` — Replaced `extractTypstNamedArgs` with `readTypstArgValue` + `extractTypstCallArgs` (named and positional args), converted `formatTypstEntries` into a bounded multi-pass fixpoint loop handling nested `#skill-line` / `#skills-line` / `#skill-row` / `#skill-item` / `#skill-entry` / `#resume-skill` calls (named, positional, and trailing `[...]` body forms) inside `#entry(...)`, and updated `extractContentFromUnknownCallArgs` to run `formatTypstEntries` before unwrapping.
- `src/lib/jd-parser/parser.ts` — Hoisted `TECH_TERMS_WITH_REGEX`, `ALIAS_TERMS_WITH_REGEX`, and `DOMAIN_TERMS_WITH_REGEX` to module scope.
- `src/components/tailor/tailor-workspace.tsx` — Exported `shouldAutoFillRoleTitle` and guarded auto-rescan `setRoleTitle` calls against focused/user-edited `#tailor-role`; switched `saveJobNow` to read live state refs and clear `isJdDirty` only when snapshot values still match; silenced background auto-save banners (`silent: true`); set `isLoadingJob(true)` immediately on stored-active job restoration; avoided fresh `[]` allocations and redundant renders in `updateJobDescription`; gated `useDeferredValue`/`parseJobDescriptionDocument` on `jobInfoSubTab === "structured" || isDiagnosticsOpen`; debounced `resumeforge_active_tailor_job` `sessionStorage` writes by 250ms with unmount and `navigateWithSave` flushes.
- `tests/zip-export.test.ts` — Added regression tests replicating the AI-converted master resume's `#section("Skills") -> #entry(details: [#skill-line(...)])` structure (with synthetic candidate details) across `cleanTypstToText` and `generateApplicationPackageZip`, plus positional/trailing-body/nested `#skill-line` variants.
- `tests/tailor-task-sequence.test.ts` — Added unit coverage for `shouldAutoFillRoleTitle`.
- `e2e/tailor-polish-verification.spec.ts` — Added Playwright regression test verifying guest sequential typing in `/tailor?new=1` across auto-save and auto-rescan windows.

### Verified Checks
- `npm run lint` — Passed (0 warnings/errors).
- `npm run typecheck` — Passed (`tsc --noEmit`, 0 errors).
- `npm run test` — Passed (`149` test files, `1100` tests passed).
- `npm run build` — Passed (`prisma generate && next build`, 61 static/dynamic pages built cleanly).
- Playwright (`npx playwright test --config=playwright.demo.config.ts e2e/tailor-polish-verification.spec.ts`, delegated to subagent) — Passed (`6` passed, `0` failed, `0` skipped; exit code `0`).

### Open Blockers
- None.
