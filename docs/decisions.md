# Architecture Decision Records (ADR Log) — ResumeForge

This document logs significant architectural decisions, trade-offs, and design choices made in ResumeForge.

---

## ADR-001: Typst over LaTeX or Markdown for Document Generation

- **Date**: 2026-08-06
- **Status**: Approved / Locked for V1

### Context
ResumeForge requires a high-quality document compilation engine capable of rendering precise, single-page resume layouts and PDF outputs. Common alternatives include LaTeX (traditional academia standard) and Markdown-to-PDF compilers (Puppeteer / HTML-pdf wrappers).

### Decision
We choose **Typst** (`typst.ts` WASM browser engine) over LaTeX and Markdown-to-PDF.

### Consequences
- **Positive**: Typst compiles instantaneously inside the browser via WebAssembly without requiring server-side TexLive installations. Markup is clean, modern, and programmatically controllable via TypeScript AST.
- **Positive**: Sub-second live preview update latency as the user accepts patches.
- **Negative**: Smaller community template ecosystem compared to legacy LaTeX, requiring custom Typst templates built specifically for ResumeForge.

---

## ADR-002: SQLite over Hosted Database for V1

- **Date**: 2026-08-06
- **Status**: Approved / Locked for V1

### Context
ResumeForge needs a local persistence engine to store master resumes, evidence bank items, job descriptions, variant drafts, and patch histories.

### Decision
We choose **SQLite** (managed via Prisma ORM) as the local file-based database for V1.

### Consequences
- **Positive**: Zero network latency, zero hosting cost, complete data privacy, and simple backup (copy `dev.db` file). Requires no external service configuration for the user.
- **Positive**: Prisma ORM provides type-safe query interfaces and clean migration tools (`npx prisma migrate`).
- **Negative**: Single-user concurrency limits, which aligns with V1 single-user local-first product requirements.

---

## ADR-003: BYOK (Bring-Your-Own-Key) over Shared API Key Gateway

- **Date**: 2026-08-06
- **Status**: Approved / Locked for V1

### Context
ResumeForge uses LLM agents to extract job requirements and propose tailored resume patches. Providing a hosted, centralized API key incurs high subscription management costs and centralizes API rate limits and data exposure risks.

### Decision
We choose a **Bring-Your-Own-Key (BYOK)** model where users supply their own OpenAI, Anthropic, Gemini API keys, or connect to a locally running proxy (e.g. Ollama or FreeLLMAPI).

### Consequences
- **Positive**: Zero API hosting overhead for the application. Complete user autonomy over model selection, temperature, and cost control.
- **Positive**: Eliminates central data exposure risks; user prompts flow directly between localhost and their chosen API provider.
- **Negative**: Users must set up their own API keys or local LLM proxy.

---

## ADR-004: Patch-Based AI Edits over Full-Document Regeneration

- **Date**: 2026-08-06
- **Status**: Approved / Locked for V1

### Context
Many AI writing assistants regenerate entire documents upon receiving a prompt. This approach leads to lost user edits, unexpected phrasing drift, fabricated claims, and difficulty reviewing what changed.

### Decision
We mandate a **Patch-Based AI Edit Contract**. The AI agent MUST output structured JSON diff objects (operations: `MODIFY_BULLET`, `ADD_SKILL`, `REPORT_GAP`) with required evidence citations (`evidenceIds`).

### Consequences
- **Positive**: Preserves total user control; every single change must be explicitly accepted or rejected.
- **Positive**: Completely prevents silent master resume rewrites and enables granular evidence verification.
- **Negative**: Requires structured JSON parsing, strict schema validation, and specialized diff-review UI components.

---

## ADR-005: Local-First Architecture over Cloud-First SaaS Architecture

- **Date**: 2026-08-06
- **Status**: Approved / Locked for V1

### Context
Career and resume data contain highly sensitive personal information. Cloud-first SaaS resume platforms require user accounts, subscription billing, remote databases, and cloud authentication servers.

### Decision
We adopt a strict **Local-First Architecture** for V1. All database files, document builds, and evidence banks reside on the user's local file system.

### Consequences
- **Positive**: Instant application responsiveness, 100% offline capability (when using local LLM proxies), complete data ownership, zero cloud server maintenance costs.
- **Positive**: Simplified engineering scope for V1 (no OAuth, session management, or multi-tenant database partitioning).
- **Negative**: Multi-device synchronization requires manual file copying or third-party file sync (e.g. Dropbox/OneDrive) in V1.

---

## ADR-006: Local WASM Asset Hosting & Next.js Header Configuration

- **Date**: 2026-08-06
- **Status**: Approved / Locked for V1

### Context
Typst WASM compiler (`typst_ts_web_compiler_bg.wasm`) and renderer (`typst_ts_renderer_bg.wasm`) binaries were initially fetched from public CDN endpoints (jsDelivr). In offline environments or headless test contexts (Playwright), network latency or CDN blocking caused compiler initialization timeouts.

### Decision
We host WASM compiler and renderer binaries locally in `/public/wasm/` and configure `next.config.ts` with explicit `application/wasm` headers and Webpack WebAssembly async support.

### Consequences
- **Positive**: 100% offline compilation capability with zero network dependencies or CDN rate-limiting risks.
- **Positive**: Instant WASM initialization during development and Playwright E2E test execution.
- **Negative**: Increases local repository static footprint by ~29MB for the compiler binary.

---

## ADR-007: Single Master Resume Transactional Enforcement

- **Date**: 2026-08-06
- **Status**: Approved / Locked for V1

### Context
ResumeForge guarantees that candidates maintain exactly one protected Master Resume at any time, from which all tailored variants stem. SQLite does not support partial conditional unique indexes easily across schema variations without custom triggers.

### Decision
We enforce the single-master invariant (`isMaster: true`) in the application data access layer (`src/lib/db/resumes.ts`). When creating or updating a resume marked as `isMaster = true`, Prisma executes a database transaction (`$transaction`) that sets `isMaster = false` on all existing records before promoting the new record to master status.

### Consequences
- **Positive**: Guarantees zero race conditions or multiple master records in single-user context.
- **Positive**: Preserves prior master resumes in full as non-master `Resume` rows (providing automatic version history).
- **Positive**: Note: Creating a new master resume via POST is append-only by design (preserving complete version history), while PUT /api/resumes/[id] allows updating metadata or content of an existing resume entry.
- **Positive**: `isProtected` Field Status: The `isProtected` boolean field is included in the `Resume` schema as a reserved flag for future policy enforcement. No `DELETE /api/resumes/[id]` route exists in Phase 2, and `PUT /api/resumes/[id]` permits direct user updates; active deletion and automated overwrite guards will be implemented in future phases when deletion and AI tailoring routes are added.
- **Negative**: Requires all writes setting `isMaster: true` to flow through the centralized data layer function rather than raw DB queries.

---

## ADR-008: Deterministic-First Requirement Extraction & Evidence Matching

- **Date**: 2026-08-06
- **Status**: Approved / Locked for V1

### Context
ResumeForge requires job description ingestion to parse required skills, preferred qualifications, and domain concepts, then match them against verified Evidence Bank items. Utilizing LLMs directly in early phase development introduces non-deterministic output variation, API key dependencies, network latency, and complexity during automated testing.

### Decision
We implement a **Deterministic-First Requirement Parser and Evidence Matcher Engine** before integrating LLM gateway providers:
1. **Parser Engine**: Uses a 50+ term technical dictionary, alias canonicalization map, and regex section header heuristics (`required` / `must have` vs `preferred` / `nice to have`) to extract `requiredSkills`, `preferredSkills`, and `domainTerms` into a Zod-validated `JobRequirements` payload.
2. **Matcher Engine Scoring Formula**:
   - `Required Skill Match`: +3 points per overlapping tag/technology/text match.
   - `Preferred Skill Match`: +2 points per overlapping tag/technology/text match.
   - `Domain Term Match`: +1 point per overlapping tag/technology/text match.
   - `Match Percentage`: Calculated as `(Score / Total Possible Points) * 100`.
3. **Status Filter & Unverified Flags**:
   - `Archived Exclusion`: `EvidenceItem` records with `status === "archived"` are completely excluded from matching recommendations.
   - `Draft Unverified Signal`: `EvidenceItem` records with `status === "draft"` are included in recommendation results if they match, but are explicitly flagged with `isDraft: true` and surfaced as unverified items in data outputs and UI badges.

### Consequences
- **Positive**: 100% predictable, reproducible, and instantaneous execution with zero external network dependencies or LLM API key costs.
- **Positive**: Provides a clean, strict Zod schema contract (`JobRequirementsSchema`) that future LLM integration modules will target as a direct drop-in replacement.
- **Positive**: Enables full end-to-end user correction workflows (adding/removing extracted terms prior to persistence).
- **Negative**: Keyword matching cannot infer semantic synonyms outside the keyword dictionary (e.g. "relational database" -> "PostgreSQL" without dictionary rules), which will be enhanced when the BYOK LLM gateway is introduced in later phases.

---

## ADR-009: Bring-Your-Own-Key (BYOK) Client Storage, Generic Custom Endpoints & Key Redaction Architecture

- **Date**: 2026-08-06
- **Status**: Approved / Locked for V1

### Context
ResumeForge introduces a Bring-Your-Own-Key (BYOK) gateway service to test LLM provider connectivity (OpenAI, Anthropic, Gemini, and Custom OpenAI-compatible endpoints) without requiring centralized SaaS API keys. Storing API keys securely while preserving single-user local-first usability requires explicit choices regarding client persistence, error sanitization, and generic protocol branding.

### Decision
1. **Client-Side Key Persistence (`localStorage`)**:
   - The Settings UI persists configured API keys, selected provider choices, and custom base URLs in browser `localStorage` (`resumeforge_ai_settings`).
   - Server-side environment variables (`.env.local`) serve as a fallback default resolution path.
   - **Trade-off & Scope Limit**: For a local-first single-user desktop application executing on `localhost`, `localStorage` provides seamless key persistence across page reloads without requiring background server daemons. This approach is acceptable for local single-user tools, but MUST be revisited before any multi-user or hosted SaaS deployment.
2. **Database Key Isolation**:
   - API keys are strictly forbidden from SQLite persistence. Automated security tests (`tests/db-security.test.ts`) assert that no Prisma schema models or columns store key strings.
3. **Automated Key Redaction Utility**:
   - All network logs, stack traces, and API responses run through `src/lib/ai/redact.ts`. Key patterns (`sk-proj-*`, `sk-ant-*`, `AIzaSy*`, Bearer tokens) are scrubbed to `[REDACTED_KEY]`.
4. **Generic Custom Endpoint Branding**:
   - Custom provider options are strictly labeled generically as "Custom OpenAI-compatible endpoint" or "Local / self-hosted endpoint". Third-party brand names or tool names are excluded from committed code, comments, and public documentation.

### Consequences
- **Positive**: Complete privacy; raw keys are never written to SQLite, logged in server output, or committed to git.
- **Positive**: Works out of the box with any standard OpenAI-compatible `/v1/models` endpoint.
- **Positive**: Comprehensive key scrubbing prevents accidental key leaks in debugging traces or browser console logs.
- **Negative**: Storing keys in `localStorage` requires browser-level security boundaries; native desktop OS keychain storage (`keytar`) is deferred as a future desktop packaging enhancement.

### E2E Test Suite Scope Note
The original 10-vs-12 test-count discrepancy could not be root-caused because no version control existed in this repository at the time it occurred, so no historical snapshot exists to compare against. This is now corrected: version control was initialized and the first commit (`a2e2c99`) establishes a verifiable baseline. As of this baseline, the codebase contains 12 e2e tests across 4 spec files (editor-workspace.spec.ts: 4, phase2-persistence.spec.ts: 3, phase3-jd-matching.spec.ts: 3, settings-byok.spec.ts: 2), confirmed passing.

---

## ADR-010: Two-Tier Job-Board Ingestion Architecture & Manual Refresh Protocol

- **Date**: 2026-08-07
- **Status**: Approved / Product Owner Scope Amendment
- **Supersedes**: Explicitly overrides the Phase 5 handoff exclusion: *"No new job-board scraping or Simplify ingestion."*

### Context
Initial project guidelines excluded automated job board scraping to focus on core document compilation. However, managing job applications effectively requires importing real postings at scale without manually copy-pasting metadata for hundreds of listings. The product owner (single stakeholder, personal-use tool) explicitly amended product scope to include job-posting ingestion.

### Decision
We implement a **Two-Tier Job Ingestion Engine**:
1. **Tier 1 (Bulk Metadata Ingestion)**: Manual, on-demand parsing of structured job listing feeds (e.g. SimplifyJobs-style markdown tables) into `Job` records using `createJob` and `CreateJobSchema` validation. Imports company, role title, location, posting date, and apply URL.
2. **Tier 2 (On-Demand Best-Effort Extraction)**: When the user opens a specific posting to tailor a resume or cover letter, an on-demand extractor attempts to fetch the full JD text from the apply URL. On failure (paywalls, heavy JS rendering), the app degrades gracefully to a manual paste prompt.
3. **Manual Refresh Protocol**: Ingestion is strictly triggered manually via user actions ("Refresh from source"). Background scheduled polling and automated scrapers are prohibited.
5. **Quality Gate Threshold & SSRF Protections**:
   - Extracted text quality gate enforces a 180-character threshold (lowered from 200 chars to support concise authentic job postings while cleanly rejecting 404/500/SPA error shells under 120 chars).
   - SSRF & Protocol Safety: `extractFullTextFromUrl` strictly validates `http://` or `https://` schemes, rejecting non-HTTP protocols (`file:`, `gopher:`, `ftp:`) and enforcing an 8-second `AbortController` timeout on all external HTTP requests.

### Consequences
- **Positive**: Users can browse and track hundreds of real job postings inside the Tracker workspace.
- **Positive**: Card click-zone separation ensures clicking card headers opens original external URLs while action buttons trigger internal tailoring without accidental navigation.
- **Negative**: Tier 2 web extraction varies across ATS platforms and paywalls, requiring manual paste fallbacks when web scraping is blocked.

---

## ADR-011: On-Demand Evidence-Grounded Cover Letter Generation & Gap Guardrails

- **Date**: 2026-08-07
- **Status**: Approved / Product Owner Scope Amendment
- **Supersedes**: Explicitly overrides the Phase 5 handoff exclusion: *"No cover letters."*

### Context
Cover letter generation was originally excluded from Phase 5 scope. However, tailored cover letters are a natural paired artifact alongside tailored resumes during job applications. Free-form prose in cover letters carries a higher risk of AI fabrication than structured resume patches, requiring strict evidence citation boundaries.

### Decision
We implement an **On-Demand Evidence-Grounded Cover Letter Generator**:
1. **Data Model**: `CoverLetter` Prisma model linked directly to `jobId` and optional `variantId`.
2. **Strict Citation Guardrail Contract**: Every claim or achievement in the generated cover letter prose MUST map to verified evidence IDs in the user's Evidence Bank (`verifyEvidenceCitations`).
3. **Gap Handling Policy**: If a job description requirement lacks supporting evidence in the candidate's Evidence Bank, the cover letter MUST omit the claim or explicitly flag the requirement as a gap — papering over missing experience with generic confident filler is strictly forbidden.
4. **User Review Protocol**: The "AI proposes, user reviews" pattern applies — all generated cover letters are presented as modular, editable markdown cards before being saved or exported.

### Consequences
- **Positive**: Provides a complete end-to-end candidate workflow: Job Ingestion → Resume Tailoring → Cover Letter Generation.
- **Positive**: Strict citation rules prevent AI hallucination from polluting cover letter submissions.
- **Negative**: Unsupported job requirements result in explicit gap notices or omitted paragraphs, requiring candidate review when evidence is missing.

---

## ADR-012: Unified Master AI System Prompt & Composition Pattern

- **Date**: 2026-08-08
- **Status**: Approved

### Context
Prior to Task 9.4, AI system prompts (`prompt-template.ts`, `qualitative-prompt.ts`, `cover-letter-prompt.ts`) duplicated ResumeForge's core AI guardrails — zero hallucination, mandatory evidence citations, explicit gap reporting, anti-ATS gaming rules, and strict JSON output formatting — independently. This duplication created drift risk across prompt files and made it difficult to guarantee that new AI features followed the same non-negotiable contracts.

### Decision
We implement a **Unified Master AI System Prompt Engine**:
1. **Single Source of Truth (`src/lib/ai/master-prompt.ts`)**: Export `RESUMEFORGE_MASTER_SYSTEM_PROMPT` containing all 5 core guardrails:
   - Zero Hallucination & Strict Evidence Grounding
   - Mandatory Evidence Citation (`evidenceIds` / `evidenceCitations`)
   - Explicit Gap Reporting (never fabricate missing experience)
   - Anti-ATS Gaming Enforcement (no white text or keyword stuffing)
   - Strict JSON Output Contracts
2. **Composition Pattern (`buildComposedSystemPrompt`)**: Every task-specific prompt builder (`buildPatchSystemPrompt`, `buildQualitativeReviewSystemPrompt`, `buildCoverLetterSystemPrompt`) prepends `RESUMEFORGE_MASTER_SYSTEM_PROMPT` before appending task-specific instructions and JSON schemas.
3. **Schema Invariance**: Output schemas (`PatchProposal`, qualitative review JSON, cover letter JSON) remain 100% unchanged.

### Consequences
- **Positive**: Eliminates prompt drift risk across AI features. Any new AI capability (e.g. editor chat) imports the master prompt module to inherit all core guardrails automatically.
- **Positive**: Maintains 100% backward compatibility with all existing provider adapters and Zod validation schemas.
- **Negative**: Adds a small static overhead (~350 tokens) to system prompt payloads, well within all LLM context window limits.

---

## ADR-013: Hosted Single-User Gate, Postgres, and SSRF Controls

- **Date**: 2026-08-12
- **Status**: Approved (overrides ADR-002 and ADR-005 for public hosting)
- **Supersedes for hosted deploys**: ADR-002 (SQLite) and ADR-005 (no auth / local-first only)

### Context
A public Render/Vercel deployment cannot use SQLite on ephemeral disks, and unauthenticated APIs would expose PII, job data, and BYOK-proxied AI spend. Clerk/OAuth multi-user is out of scope for this personal hosted tool.

### Decision
1. **Postgres** via Prisma (`provider = "postgresql"`). Local development uses `docker-compose.yml`. Hosted deploys use Render Postgres or Neon.
2. **Single-user password gate**: HttpOnly `rf_session` cookie signed with `APP_ACCESS_SECRET`. Next.js middleware covers app and `/api/*` except `/login`, `/api/auth/*`, icons, `/wasm/*`, and static assets. Mutation requests require a matching Origin/Referer.
3. **Fail-closed secrets**: `JOB_SYNC_SECRET` must be set or Pitt CSC sync returns 401. `APP_ACCESS_SECRET` missing returns 503/redirect.
4. **SSRF**: Server-side fetches (bulk-import, tier-2 apply URLs, custom AI `baseUrl`) go through `safeFetch` (HTTPS-only except localhost in non-production, private/metadata host block, `redirect: "manual"`, import host allowlist).
5. **BYOK on HTTPS**: Keys remain in `localStorage` and POST bodies to the same origin. CSP and redaction reduce XSS/leak risk; this is an accepted trade-off versus OS keychain for V1 hosted.

### Consequences
- **Positive**: Resume/PII survive deploys; anonymous internet cannot mutate data or drain AI credits without the password.
- **Negative**: Operators must run Postgres and set secrets. Local SQLite `dev.db` is no longer the runtime store.
- **Negative**: BYOK keys are still XSS-reachable in the browser; CSP is the primary mitigation until a vault/keychain migration.

---

## ADR-014: Guest Sessions with Optional Email/Password Accounts

- **Date**: 2026-08-12
- **Status**: Approved (overrides ADR-013 password gate for pages)
- **Supersedes for product access**: ADR-013 item 2 (single-user workspace password on all pages)

### Context
A hosted password wall blocked anyone without `APP_ACCESS_SECRET` and made the product look like a private workspace. Users should be able to try the editor without signing up. Saved resumes, evidence, and jobs must not land in a shared database for anonymous visitors.

### Decision
1. **Pages are public.** Middleware no longer redirects unauthenticated browsers to `/login`. Missing `APP_ACCESS_SECRET` does not lock the site.
2. **Guest work is local-only.** Persist APIs require a signed-in `User`. Guests receive `401` `{ code: "GUEST_READ_ONLY" }` on save mutations. List GETs return empty `{ data: [], guest: true }`.
3. **Optional accounts.** Email + password signup/login (`scrypt` hash) create a `User` row. Session cookie `rf_session` is `uid=...|exp=....hmac` signed with `APP_ACCESS_SECRET` (cookie signing key only — not a login password).
4. **Data scoping.** `Resume`, `EvidenceItem`, and `Job` have optional `userId`. API routes always pass the session user id. Direct DB helpers used by unit tests may omit it.
5. **Shared discovery feed.** `DiscoveredJob` stays global. Promoting a discovered job into the tracker requires auth and writes `userId`.
6. **Stateless tools stay public.** JD extract, ATS evaluate with body `typstContent`, AI test-connection, and Typst repair do not require a session.

### Consequences
- **Positive**: Anyone can use the editor; signed-in users keep private Postgres data.
- **Negative**: Signup/login still need `APP_ACCESS_SECRET` to mint cookies. Guest work is lost if the browser storage is cleared.
- **Negative**: Clerk/OAuth remains out of scope.

---







