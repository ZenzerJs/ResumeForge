# Pickup Plan (handoff to next agent)

**Updated**: 2026-10-21 00:56 by the reviewer. The previous coding agent (Argon) hit its quota (429) partway through.
**Background**: `docs/consumer-upgrade-progress.md` is Argon's own log. It says everything is ✅, which is overclaimed. The table below is the verified truth.

---

## 0. Verified state (2026-10-21 00:52)

| Check | Result |
|---|---|
| `npm run lint` | ✅ pass |
| `npm run typecheck` | ✅ pass |
| `npm run test` | ✅ 108 files / 620 tests |
| `npm run build` | ⚠️ not re-run |
| Git | ⚠️ 71 modified + 5 untracked, **nothing committed** (+3412 / −726) |
| Browser check | ⚠️ never done |

### Plan vs delivered

| # | Planned | Status | Evidence |
|---|---|---|---|
| P0.1 | Unified BYOK resolver, model fix, nav AI pill | ⚠️ mostly | grep-verified. **Gaps**: the dossier route drops `providerConfig` and labels fallback text `source:"llm"`; `byok-vault.ts:13` default is still `gemini-3.8-flash` (normalized at runtime) |
| P0.2 | Real tailoring in ApplySheet | ✅ | grep: calls `/api/ai/generate-patches` |
| P0.3 | Prep Sheet gets real evidence and contact info | ✅ | grep: `evidenceItems`, `candidateInfo` passed |
| P0.4 | `?tab=cover-letter` link and guest evidence migration | ✅ | tab link grep-verified. Migration is from the log only. The log says it edited `api/auth/migrate-guest-drafts/route.ts`, but **that file has no changes**. The route already accepted `evidenceItems`, so this is a harmless false claim |
| P1.1 | 3-step onboarding wizard | 🟡 partial | 4-item checklist on `/` instead |
| P1.2 | Form editor and formatting controls | 🟡 unverified | file exists. No Projects section is listed. Round-trip between form and source is untested |
| P2.1 | Dropzone restyle and preview checkboxes | ✅ claimed | log, tests, diff |
| P2.2 | Review Queue Keep Both/Merge persist | ✅ claimed | log, tests, diff |
| P2.3 | Tailor down from 4 tabs to 3 | ❌ diverged | a Cover Letter tab was **added** instead |
| P3.1 | Kanban tracker | ✅ claimed | log, tests, diff |
| P3.2 | Curated chips and match % | ✅ claimed | log, tests, diff |
| P3.3 | Practice job context | ✅ claimed | log, tests, diff |

**Score**: 8 done or claimed, 2 partial, 1 diverged, 1 with small gaps.

> [!WARNING]
> About 25 changed files are **not in any planned item**: connectors/jobs/cover-letter API routes, `lib/ingestion/*`, `lib/ai/gateway.ts`, `lib/ai/tools/executor.ts`, `middleware.ts`, `prisma.ts`, `db/*`, `next.config.ts`. They could be Argon side-work or older uncommitted work. They go in commit C10, which must be **reviewed by reading the diff first**.

---

## 1. Tasks, in order. Tick each box and add a one-line note when done

### T1: Split commits, one per planned item
Rules:
- Run from the repo root in PowerShell.
- `:(literal)` is required because of `[slug]` and `[id]` in paths.
- When a file was touched by two items, it goes whole into **one** commit (listed below). Don't split hunks; it isn't worth it.
- Intermediate commits may not build on their own. Only the final HEAD must pass all 4 checks.

```powershell
git checkout -b feat/consumer-saas-upgrade
function c($msg, [string[]]$files) { git add -- ($files | % { ":(literal)$_" }); git commit -m $msg }

c "feat(byok): P0.1 unified client provider resolver, gemini-2.5 default, nav AI pill" @(
 "src/lib/byok-vault.ts","src/lib/ai-provider.ts","src/lib/dsa-coach.ts","src/lib/ai/providers/gemini.ts",
 "src/components/settings/settings-workspace.tsx","src/components/navigation/top-nav.tsx",
 "src/components/editor/ai-sidebar.tsx","src/components/editor/chat-panel.tsx","src/components/editor/editor-workspace.tsx",
 "src/components/tailor/ats-score-panel.tsx","src/components/tailor/cover-letter-panel.tsx",
 "src/components/tracker/company-intel-dossier-panel.tsx","src/lib/company-dossier.ts",
 "src/app/api/companies/[slug]/dossier/generate/route.ts","src/app/api/resumes/upload-pdf/route.ts",
 "src/app/api/ai/byok-proxy/route.ts","src/app/api/ai/extract-evidence/route.ts",
 "src/app/api/ai/generate-cover-letter/route.ts","src/app/api/ai/repair-typst/route.ts")

c "fix(tracker): P0.2+P0.3 real tailoring in ApplySheet, real evidence/contact in Prep Sheet" @(
 "src/components/tracker/apply-sheet.tsx","src/components/tracker/job-detail-pane.tsx","src/components/tracker/job-types.ts")

c "fix(tailor,auth): P0.4 cover-letter deep link, migrate guest evidence" @(
 "src/components/tailor/tailor-workspace.tsx","src/components/auth/guest-migration-modal.tsx","src/components/design-system/app-shell.tsx")

c "feat(landing): P1.1 onboarding checklist, landing polish" @(
 "src/components/landing/home-landing.tsx","src/components/landing/ats-sandbox-section.tsx",
 "src/components/landing/landing-atmosphere.tsx","src/components/design-system/ascii-waves.tsx",
 "src/app/globals.css","tests/ats-sandbox-section.test.ts")

c "feat(editor): P1.2 visual form builder with Typst round-trip" @(
 "src/components/editor/resume-form-builder.tsx","src/components/editor/code-editor.tsx")

c "feat(library): P2.1+P2.2 dropzone restyle, import preview, real duplicate merge" @(
 "src/components/evidence/bulk-pdf-dropzone.tsx","src/components/library/library-workspace.tsx",
 "src/app/api/evidence/[id]/route.ts","src/lib/evidence/pdfExtractor.ts",
 "src/lib/evidence/evidence-transform.ts","src/lib/evidence/tech-extractor.ts")

c "feat(tracker): P3.1+P3.2 kanban view, curated discover chips, match badges" @(
 "src/components/tracker/tracker-feed.tsx","src/components/tracker/tracker-sub-nav.tsx",
 "src/components/tracker/discover-feed.tsx","tests/tracker-card-spec.test.ts")

c "feat(practice): P3.3 tracked-job context, DSA workspace updates" @(
 "src/components/practice/practice-workspace.tsx","src/components/interview/interview-hub.tsx",
 "src/components/interview/dsa-workspace.tsx","src/lib/dsa-runner.ts","src/lib/practice/code-runner.ts",
 "tests/dsa-runner.test.ts")

c "test,docs: consumer upgrade tests, progress log, pickup plan" @(
 "tests/consumer-saas-upgrade.test.ts","docs/consumer-upgrade-progress.md","docs/flash-pickup-plan.md")

git status --short   # REVIEW what's left: should be the unattributed C10 set only
git diff             # READ IT. Revert anything unrelated/broken before committing.
git add -A; git commit -m "chore: C10 unattributed backend changes (ingestion, connectors, gateway, middleware)"
git log --oneline -12
```
If `git status` still shows a file you expected to be committed, add it to the matching commit with `git commit --amend` only if that commit is HEAD. Otherwise let it go into C10.
- [x] done: Split commits C1-C9 and reviewed C10 unattributed changes; all cleanly committed into feat/consumer-saas-upgrade.

### T2: Build
Run `npm run build`. If it fails, fix the root cause and re-run all 4 checks. Commit the fix as `fix(build): …`.
- [x] done: npm run build passed cleanly with 54 routes compiled, 0 errors. All 4 checks verified.

### T3: Fix the dossier BYOK gap (P0.1 leftover)
1. In `src/app/api/companies/[slug]/dossier/generate/route.ts`, add an optional `providerConfig` to the zod body. **Copy** the shape from `src/app/api/ai/generate-cover-letter/route.ts`; don't invent a new one.
2. Pass it into `generateDossier()` in `src/lib/company-dossier.ts`.
3. Have `generateDossier()` report whether the LLM was actually used. On fallback, set `source` to the existing non-LLM value (grep the schema/enum first).
4. Add one vitest case for the fallback label.
5. Commit: `fix(dossier): accept BYOK providerConfig, label heuristic fallback`.
- [x] done: Accepted BYOK providerConfig in route, generateDossier reports llmUsed, labeled fallback as seed, added vitest tests.

### T4: Default model, one line
Set `src/lib/byok-vault.ts:13` to `gemini: "gemini-2.5-flash"`. Keep the normalization shims at `byok-vault.ts:269`, `settings-workspace.tsx:85`, `providers/gemini.ts:26` and `ai-provider.ts:130,159`; they migrate old saved values. Commit: `fix(byok): default gemini-2.5-flash`.
- [x] done: Set default model to gemini-2.5-flash in byok-vault.ts:13; shims preserved; tests passing.

### T5: Browser smoke check (Playwright must run in a subagent, per AGENTS.md)
Run `npm run dev`, then check:
- `/`: checklist renders (`consumer-onboarding-checklist`).
- `/editor`: Visual ↔ Source toggle (`editor-mode-visual` / `editor-mode-code`). Edit a field and confirm the preview and source both update. Toggle twice and confirm **no content is lost**. This is the riskiest new code.
- `/library`: dark dropzone, bullet checkboxes, Keep Both/Merge **survive a reload**.
- `/tracker`: Split ↔ Kanban. Drag a card, reload, and confirm the status persisted.
- `/tracker/discover`: chips and match % badge.
- `/tailor?jobId=X&tab=cover-letter`: lands on the cover letter section.
- `/practice?jobId=X`: job context banner.
- `/settings`: Test Connection works with `gemini-2.5-flash`.

Log every failure here as root cause → fix → re-test. Commit fixes separately.
- [ ] done

### T6: Scope shortfalls (ask the user before building)
- P1.1: is the checklist enough, or build the full 3-step wizard?
- P2.3: Tailor now has more tabs, not fewer. Restructure to 3?
- P1.2: check whether the form builder has **Projects**. If it's missing, add it using the same pattern as Experience. This one doesn't need the user's sign-off.
- [ ] reviewed

### T7: Finish
1. `npm run lint; npm run typecheck; npm run test; npm run build`: all green.
2. Update `docs/consumer-upgrade-progress.md` with the honest status and the deferred items.
3. Write `walkthrough.md` in the artifact dir (AGENTS.md): deliverables, files, check results, limits, next task.
4. Commit.
- [ ] done

---

## 2. Rules
- Follow AGENTS.md: scoped edits only, no extra features, all 4 checks green before claiming done.
- **Update this file after every task.** If quota runs out, the next agent starts here.
- No API keys in code, `.env` or logs.
- Grep before you trust any ✅.
