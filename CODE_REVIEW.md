# ResumeForge — Codebase Security & Optimization Review (`CODE_REVIEW.md`)

> Read-only Track B audit covering security (`SEC`), performance/simplification (`PERF`/`SIMP` via `/ponytail` lens), and test/config hygiene (`TEST`).

---

## 1. Security Vulnerabilities (`SEC`)

### `SEC-01` `[HIGH]` — Typst WASM Main-Thread Compilation DoS & Unbounded Queue
- **Locations:**
  - `src/lib/typst/compiler.ts:52-57, 96-143, 145-201`
  - `src/lib/typst/sanitizer.ts:16-38`
  - `src/components/editor/preview-panel.tsx:77-111, 134-182`
  - `src/components/editor/editor-workspace.tsx:493-518`
  - `src/components/tailor/suggestion-preview.tsx:79-168`
  - `src/components/landing/ats-sandbox-section.tsx:419-461`
- **Symptom:** Recursive Typst macros (`#let f(x) = f(x); #f(1)`), infinite loops (`#{ while true {} }`), or exponential layout expansions permanently freeze the browser UI thread and wedge the module-global compilation queue for the session.
- **Root Cause:** `compileTypstToSvg` (`compiler.ts:118`) and `compileTypstToPdf` (`compiler.ts:169`) invoke `$typst` directly on the main thread inside a single un-cancellable `compileQueue` (`serialized()` at `lines 52-57`) with no Web Worker isolation or execution timeout. `sanitizeTypstSource` (`sanitizer.ts:16-38`) only regex-blocks file/package directives (`#import`, `#read`, etc.).
- **Ponytail Fix:** Run `$typst` inside a single Web Worker wrapped in a timeout that calls `worker.terminate()` and spawns a fresh worker on overrun.

---

### `SEC-02` `[HIGH]` — Unauthenticated Server LLM Key Abuse, Cross-Tenant Job Metadata Leak & Outbound SSRF Probing
- **Locations:**
  - `src/app/api/ai/chat/route.ts:41, 66-75, 102`
  - `src/app/api/ai/test-connection/route.ts:6-42`
  - `src/app/api/ai/repair-typst/route.ts:53-57, 79-85`
  - `src/app/api/jobs/extract/route.ts:25-95`
  - `src/lib/ai/providers/credentials.ts:27-48`
  - `src/lib/ai/providers/custom.ts:90-124, 456-481`
- **Symptoms:**
  1. **`POST /api/ai/chat` (`route.ts:41, 66-75, 102`):** Calls `getRequestUserId` instead of `requireUserId`. Unauthenticated callers can consume server `process.env.*_API_KEY` via `resolveProviderCredentials` (`credentials.ts:40-46`) when omitting `apiKey`. Lines `66-75` also query `prisma.job.findUnique({ where: { id: context.activeJobId } })` without scoping by `userId`, leaking any user's private `roleTitle` and `company` into `buildChatContextPreamble`.
  2. **`POST /api/ai/test-connection` (`route.ts:6-42`):** Zero authentication check; lets unauthenticated callers probe server API key validity or trigger outbound `GET` requests to arbitrary public HTTPS endpoints (or localhost in non-prod) via `provider: "custom"` (`custom.ts:90-124`).
  3. **`POST /api/ai/repair-typst` (`route.ts:53-57`):** Only enforces `requireUserId` when `!providerConfigToUse?.apiKey`. Passing any dummy `apiKey` with `provider: "custom"` bypasses auth and triggers outbound server-side `POST` requests (`custom.ts:463`).
  4. **`POST /api/jobs/extract` (`route.ts:25-95`):** Zero authentication check; allows unauthenticated URL scraping (`line 47`) and server-key AI formatting (`lines 86-91`) when `providerConfig.apiKey` is omitted.
- **Root Cause:** `src/middleware.ts:36-72` delegates `/api/*` auth to individual handlers, while these 4 routes omit unconditional `requireUserId(request)` checks and `credentials.ts:40-46` falls back to server keys whenever `config.apiKey` is absent.
- **Ponytail Fix:** Enforce `requireUserId(request)` unconditionally at entry of all 4 routes, require `userId` scoping on `activeJobId` lookup in `/api/ai/chat`, and allow server fallback keys only when explicitly authenticated.

---

### `SEC-03` `[HIGH]` — Cross-User / Shared Catalog Job Tampering, Unscoped Deletion (`P2003`) & Unauthenticated Hydration
- **Locations:**
  - `src/lib/db/jobs.ts:90-115, 385-427`
  - `src/app/api/jobs/[id]/route.ts:75-128`
  - `src/app/api/jobs/[id]/fetch-fulltext/route.ts:12-38, 92-121`
  - `src/app/api/jobs/hydrate/route.ts:24-76`
  - `src/middleware.ts:6-11`
- **Symptoms:**
  1. **`PATCH /api/jobs/[id]` (`jobs.ts:90-115`):** `updateJob` updates `Job` fields (`lines 111-114`) using `where: { id }` without verifying `existing.userId === viewerUserId`, allowing any authenticated user to tamper with shared catalog (`userId: null`) or other users' jobs.
  2. **`DELETE /api/jobs/[id]` (`jobs.ts:385-427`):** Allows any user to permanently delete shared catalog jobs (`userId: null`) if unreferenced, and omits `patchProposalBatches` from reference checks (`lines 394-411`), causing unhandled Prisma `P2003` errors (`onDelete: Restrict` in `prisma/schema.prisma:273`).
  3. **`/api/jobs/[id]/fetch-fulltext` & `/api/jobs/hydrate`:** Use `getRequestUserId` instead of `requireUserId`, permitting unauthenticated callers to trigger Tier-2 fetches (including proxying URLs to `https://r.jina.ai/${url}` at `src/lib/ingestion/tier2-fetcher.ts:530`) and mutate shared job records. `/api/jobs/hydrate` is also absent from `HEAVY_ENDPOINT_LIMITS` (`middleware.ts:6-11`).
- **Root Cause:** Missing `userId` ownership predicates on `update`/`delete` mutations and unauthenticated write paths on shared `Job` rows.
- **Ponytail Fix:** Restrict `updateJob`/`deleteJob` mutations to `job.userId === viewerUserId` (never `null`), include `patchProposalBatches` in `deleteJob` reference checks, require `requireUserId` on hydration routes, and add `/api/jobs/hydrate` to `HEAVY_ENDPOINT_LIMITS`.

---

### `SEC-04` `[HIGH]` — Typst Markup / Link Injection in PDF Parser & `ensureTypstLinks` + Unsanitized SVG DOM Injection
- **Locations:**
  - `src/lib/pdf/parser.ts:341-346, 489-494, 508-515`
  - `src/lib/typst/ensure-links.ts:7-13, 27-29`
  - `src/components/editor/preview-panel.tsx:590-595`
  - `src/components/landing/ats-sandbox-section.tsx:602-606`
  - `next.config.ts:20-34`
- **Symptoms:**
  1. `convertTextToTypst` (`pdf/parser.ts:512`) interpolates raw PDF annotation URIs into `#link("${l.url}")[...]` without escaping `"` or `\` or validating URL protocol (`http:`/`https:`/`mailto:`), and `sanitizeForTypst` (`lines 341-346`) does not escape `[` or `]`, enabling bracket breakout into `#...` directives (`lines 489-494`).
  2. `ensureTypstLinks` (`ensure-links.ts:7-13, 27-29`) omits `[` / `]` escaping and URL scheme validation.
  3. `PreviewPanel` (`preview-panel.tsx:594`) and `AtsSandboxSection` (`ats-sandbox-section.tsx:605`) pass raw WASM SVG output into `dangerouslySetInnerHTML`, while `next.config.ts:24` CSP permits `'unsafe-inline' 'unsafe-eval'`.
- **Root Cause:** Legacy PDF parser and link utility bypass `typstString`, `typstContent`, and `safeDestination` (`src/lib/typst/inline-content.ts:14-21`), and SVG output is rendered without sanitization.
- **Ponytail Fix:** Reuse `typstString`, `typstContent`, and `safeDestination` from `inline-content.ts` in `pdf/parser.ts` and `ensure-links.ts`, and sanitize WASM SVG strings or strip `<script>`/`on*` handlers before injection.

---

### `SEC-05` `[MEDIUM]` — Unsanitized `model` Path Interpolation in Gemini Provider & Weak Duplicate `safeFetch`
- **Locations:**
  - `src/lib/ai/types.ts:10`
  - `src/lib/ai/providers/gemini.ts:24-30, 124, 187, 250, 313, 377, 478`
  - `src/lib/connectors/http.ts:23-91`
- **Symptoms:**
  1. `ProviderConfigSchema` (`types.ts:10`) accepts any string for `model`, and `gemini.ts` interpolates `${model}` directly into `${baseUrl}/v1beta/models/${model}:generateContent` without validation or `encodeURIComponent`, allowing `../` or `?` path injection on `generativelanguage.googleapis.com` with server credentials.
  2. `src/lib/connectors/http.ts:23-91` re-implements `safeFetch` using `dns.resolve4` followed by global `fetch` (TOCTOU DNS rebinding window, no IPv6/AAAA check, silently ignores `resolve4` errors at `lines 65-70`) instead of reusing `src/lib/security/safe-fetch.ts:24-44`.
- **Ponytail Fix:** Validate `model` against `/^[a-zA-Z0-9._-]+$/` in `ProviderConfigSchema` (`src/lib/ai/types.ts:10`) and delete the duplicate `safeFetch` in `connectors/http.ts` in favor of `src/lib/security/safe-fetch.ts`.

---

### `SEC-06` `[MEDIUM]` — Rate-Limiter `X-Forwarded-For` Spoofing & Shared 1,000-Bucket Eviction
- **Locations:**
  - `src/lib/security/rate-limit.ts:14-25, 41-50`
  - `src/middleware.ts:19-33`
  - `src/app/api/auth/login/route.ts:34-43`
  - `src/app/api/auth/signup/route.ts:47-55`
- **Symptoms:** Direct Node deployments trust spoofable `x-forwarded-for`/`x-real-ip` headers unconditionally (`rate-limit.ts:41-50`), and flooding 1,000 distinct usernames (`auth:login:user:<random>`) evicts active IP lockout buckets from the single global `MAX_BUCKETS = 1000` Map (`lines 14-25`).
- **Ponytail Fix:** Trust proxy headers only when configured/behind Vercel (`x-vercel-forwarded-for` or `TRUST_PROXY`), and prune expired buckets first before evicting only within the same prefix namespace.

---

### `SEC-07` `[MEDIUM]` — Same-Origin Worker Cookie Access & Node `vm` / Python `spawnSync` Escape Surface
- **Locations:**
  - `src/lib/dsa-runner.ts:110-250, 313-507, 512-621`
  - `src/lib/practice/code-runner.ts:124-141`
  - `src/lib/practice/run-user-code.ts:34-55`
- **Symptoms:** Browser Web Workers (`dsa-runner.ts:247-249`, `run-user-code.ts:50`) run under the main app origin with access to `self.fetch`/`XMLHttpRequest` + `HttpOnly` `rf_session` cookies. Server-side/Vitest execution falls back to `node:vm` (`this.constructor.constructor("return process")()`) and `spawnSync("python", ["-"])`.
- **Ponytail Fix:** Execute browser code inside a sandboxed `<iframe sandbox="allow-scripts">` (opaque origin) without `allow-same-origin` or network CSP, and disable server-side `vm`/`spawnSync` execution in runtime handlers.

---

### `SEC-08` `[LOW]` — Co-Located JWK Master Key in `localStorage` & Raw Error Leakage
- **Locations:**
  - `src/lib/byok-vault.ts:67-94, 171-185, 249-263`
  - `src/app/api/companies/[slug]/dossier/generate/route.ts:100-102`
  - `src/app/api/connectors/status/route.ts:59`
  - `src/app/api/practice/problems/route.ts:100`
- **Symptoms:** `byok-vault.ts:91` stores the plaintext JWK master key in `localStorage["rf_vault_master_key"]` alongside encrypted keys and forgets to remove legacy `resumeforge_ai_settings.apiKey` after migration (`lines 171-181`). Three API routes return raw `err.message` instead of `sanitizeError(err)`.
- **Ponytail Fix:** Delete `parsed.apiKey` from `resumeforge_ai_settings` upon vault migration, keep non-extractable IndexedDB `CryptoKey` or session-only storage, and wrap the 3 error responses with `sanitizeError(err)`.

---

## 2. Dead & Unoptimized Code (`PERF` / `SIMP`)

### `PERF-01` `[HIGH]` — Infinite `POST /api/ats/evaluate` Loop & Re-Render Cascade in `/editor`
- **Locations:**
  - `src/components/editor/editor-workspace.tsx:972-1006`
  - `src/components/tailor/ats-score-panel.tsx:97-137`
- **Symptom:** When the ATS Score tab is open in `/editor` with a selected job, the browser triggers an infinite loop of `POST /api/ats/evaluate` requests and state updates while idle.
- **Root Cause:** `EditorWorkspace` allocates a new `extractedRequirements` object literal (`lines 995-999`) and inline `onEvaluationComplete={(res) => setLatestAtsScore(res)}` (`line 1003`) every render. `AtsScorePanel` includes both in `runEvaluation`'s `useCallback` deps (`ats-score-panel.tsx:133`) and calls `runEvaluation` in `useEffect` (`lines 135-137`), triggering `setLatestAtsScore` -> re-render -> new props -> infinite loop.
- **Ponytail Fix:** Stabilize `onEvaluationComplete` with `useCallback` (or ref inside `AtsScorePanel`) and `useMemo` `extractedRequirements` in `EditorWorkspace`.

---

### `PERF-02` `[HIGH]` — Multi-Pass Main-Thread PDF/Canvas Compilations on Keystrokes & Patch Clicks
- **Locations:**
  - `src/components/editor/editor-workspace.tsx:493-518`
  - `src/components/editor/preview-panel.tsx:77-111, 134-182`
  - `src/components/tailor/suggestion-preview.tsx:72-168`
- **Symptoms:**
  1. Each `/editor` edit runs up to 5 serialized WASM compilations: `compileTypstToSvg` (`editor-workspace.tsx:504`), up to 3 `fitManagedLayout` PDF+PDF.js passes (`preview-panel.tsx:86-90`), and a 4th `measureTypstDocument` PDF+canvas pixel-ink scan (`lines 99, 134-182`).
  2. Clicking Accept/Reject on a single patch in `/tailor` (`suggestion-preview.tsx:75-168`) invalidates `key` (which includes `decisions`) and re-compiles all `N + 1` full PDF probe documents from scratch.
- **Ponytail Fix:** Decouple static per-patch anchor probing from mutable `decisions` state in `SuggestionPreview`, and run canvas density measurement lazily or only when `fitMode` / `page-target` checks are triggered.

---

### `PERF-03` `[HIGH]` — In-Memory Regex Parsing & Geocoding of 500 Full Job Descriptions per Feed Request
- **Locations:**
  - `src/app/api/connectors/jobs/route.ts:133-216`
- **Symptom:** Every `GET /api/connectors/jobs` loads 500 full `IngestedJob` records (including large `description` and `descriptionHtml` columns) and runs `geocodeCanadianLocation`, `parseJobDescription`, `calculateJobCompatibility`, and `calculateBlendedScore` 500 times synchronously before slicing to `40`.
- **Ponytail Fix:** Persist parsed requirements and geocoded coordinates once during ingestion (`src/lib/connectors/orchestrator.ts`) instead of re-parsing 500 raw HTML/text bodies on every GET.

---

### `PERF-04` `[MEDIUM]` — One-Shot 250ms TCP Probe in `src/lib/prisma.ts` Can Permanently Brick DB Access
- **Locations:**
  - `src/lib/prisma.ts:38-109`
  - `src/lib/db-mock.ts:1-588`
- **Symptom:** `probePostgresPort()` (`prisma.ts:38-64`) times out after `250ms` (`line 46`). If `probePromise` resolves to `false` once during cold-start jitter, `if (!probePromise)` (`line 81`) never resets, permanently returning `RESUMEFORGE_DB_UNAVAILABLE` (`line 100`) in production or silently dropping writes into `db-mock.ts` in dev (`lines 105-108`).
- **Ponytail Fix:** Remove the custom TCP probe wrapper in runtime (connect Prisma directly; isolate `db-mock.ts` strictly to Vitest test setup).

---

### `SIMP-01` `[HIGH]` — Functional Bugs from Divergent Schemas, Stale Enum Lists & `#section(` Blindness
- **Locations:**
  - `src/app/api/cover-letters/[id]/route.ts:7-13, 87` vs `src/lib/db/cover-letters.ts:25-34, 178-216`
  - `src/app/api/connectors/jobs/route.ts:80-89` vs `prisma/schema.prisma:14-23`
  - `src/lib/ats-evaluator/evaluator.ts:404-439`
- **Symptoms:**
  1. **`PUT /api/cover-letters/[id]` silently drops edits:** Route schema accepts `{ title, proseMarkdown, typstSource, tone, targetWordCount }`, while `updateCoverLetter` ignores all except `title` (`proseMarkdown`/`typstSource`/`tone`/`targetWordCount` are never persisted).
  2. **`GET /api/connectors/jobs?source=...` breaks valid & legacy filters:** Hardcoded `VALID_SOURCES` (`route.ts:80`) rejects valid Prisma enums (`ADZUNA_CA`, `JOBICY`, `REMOTIVE`, `REMOTEOK`) with 400 and lets removed enums (`USAJOBS`, `PITTCSC`, `SIMPLIFY`) hit Prisma and crash 500.
  3. **ATS evaluator misses `#section("Skills")`:** `parseTypstSections` (`evaluator.ts:416-420`) omits `#section(`, leaving `skillsSectionText` always `""` on canonical templates so skills-only entries get scored at 100% experience weight.
- **Ponytail Fix:** Share Prisma's `JobSource` enum directly in `connectors/jobs/route.ts`, align `updateCoverLetter` fields with `UpdateCoverLetterSchema`, and add `line.includes("#section(")` to `parseTypstSections`.

---

### `SIMP-02` `[MEDIUM]` — ~2,500+ Lines of Dead Modules & 4x Duplicated AI Provider Logic
- **Locations:**
  - Dead modules: `src/lib/practice/code-runner.ts:1-194`, `src/lib/practice/run-user-code.ts:1-56`, `src/lib/practice/code-runner.worker.ts:1-8`, `src/lib/ai/patch-citations.ts:1-173`, `src/lib/evidence/mergeEvidence.ts:1-99`, `packages/schema/src/resumeFeedback.ts:1-29`, `src/components/design-system/section-heading.tsx:1-34`, `src/components/ui/accordion.tsx:1-66`, `src/components/ui/scroll-area.tsx:1-58`, `src/components/ui/sonner.tsx:1-40`, `src/components/ui/tooltip.tsx:1-61`
  - Legacy v2 renderers: `src/lib/typst/inline-content-v2-legacy.ts:1-99`, `src/lib/typst/resume-document-v2-legacy.ts:1-49`, `src/lib/typst/resume-document-v2-previous.ts:1-68`
  - 4x duplicated AI task implementations (~2,000 lines): `src/lib/ai/providers/openai.ts:1-481`, `custom.ts:1-513`, `anthropic.ts:1-505`, `gemini.ts:1-513`
- **Ponytail Fix:** Delete the verified unreferenced dead files and collapse the 4 AI provider adapters to a single `completeText(config, messages, jsonMode)` transport interface per provider with shared prompt/Zod parsing in `gateway.ts`.

---

## 3. Test & Config Hygiene (`TEST`)

### `TEST-01` `[MEDIUM]` — `vitest.config.ts` Config Hygiene & Vite Loader Warning
- **Locations:** `vitest.config.ts:1-25`
- **Symptom:** Running `npm run test` emits a Vite warning (`ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1)`), overrides Vitest's default `exclude` array (`line 10`) without including `.next` or `dist` explicitly, and forces `fileParallelism: false` (`line 11`). Note: `vitest.config.ts` does NOT restrict `include` (so `src/**/*.test.ts` and `packages/**/*.test.ts` do execute—already observed in `vitest run` output), though keeping default excludes via `configDefaults.exclude` prevents accidental scanning of build folders.

### `TEST-02` `[MEDIUM]` — Default Vitest Suite Masks Postgres Enum, `$queryRaw` & FK `Restrict` Bugs
- **Locations:** `src/lib/prisma.ts:69-79`, `src/lib/db-mock.ts:184-195, 575-578`
- **Symptom:** All unit tests run against `db-mock.ts`, which stubs `$queryRaw` as a no-op (`line 575`), skips `JobSource` enum validation, and ignores `onDelete: Restrict` constraints (`PatchProposalBatch.jobId`), allowing `SIMP-01` and `SEC-03` (`P2003`) to pass CI.

### `TEST-03` `[MEDIUM]` — Root Config Sprawl (10 `playwright*.config.ts` Files) & `check-env-parity.ts` Gaps
- **Locations:**
  - `playwright.config.ts:19-40` + 9 specialized configs (`playwright.contrast-logos.config.ts`, `playwright.jobs-polish.config.ts`, `playwright.release.config.ts`, `playwright.resume-layout-v2.config.ts`, `playwright.screenshots.config.ts`, `playwright.smoke.config.ts`, `playwright.suggestion-preview.config.ts`, `playwright.tailor-polish.config.ts`, `playwright.workspace-wave.config.ts`)
  - `scripts/check-env-parity.ts:19`
- **Symptom:** 10 root Playwright config files target 7 ports (`3000`, `3005`, `3147`–`3150`); `playwright.smoke.config.ts:10` and `playwright.screenshots.config.ts:11` lack `webServer` blocks; `playwright.config.ts:20` omits `APP_ACCESS_SECRET`/`DEMO_MODE` from `webServer.env`; and `check-env-parity.ts:19` omits `vitest.integration.config.ts` and the 9 `playwright.*.config.ts` files.

### `TEST-04` `[MEDIUM]` — Missing Negative Auth, IDOR, Compiler Timeout & PDF Injection Tests
- **Locations:** `tests/ai-chat.test.ts`, `tests/shared-jobs-private-evidence.test.ts:21-111`, `src/lib/typst/compiler.test.ts:1-25`, `tests/pdf-parser.test.ts`
- **Symptom:** Zero tests assert `401` on unauthenticated `/api/ai/chat`, `/api/ai/test-connection`, `/api/ai/repair-typst`, `/api/jobs/extract`, `/api/jobs/hydrate`, or `/api/jobs/[id]/fetch-fulltext`; zero negative tests verify User B cannot `PATCH`/`DELETE` User A's or shared jobs; zero tests cover Typst loop timeouts or PDF annotation URI breakout payloads.
