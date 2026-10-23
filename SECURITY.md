# SECURITY.md — Security Model & Data Privacy Specification

## 1. Overview & Threat Model

ResumeForge is a self-hostable **BYOK** workspace backed by PostgreSQL. Guests can try the editor and local Typst WASM compilation without an account. Saved resumes, evidence, jobs, and server-proxied BYOK calls require an authenticated session and are scoped per user.

Resumes contain PII. LLM API keys have monetary value. The hosted threat model assumes a public origin: unauthenticated persist APIs, open relays, SSRF, ephemeral disks, and missing rate limits are treated as blockers.

---

## 2. Hosted Access Control

- **Accounts & Sessions**: Email + password (`scrypt`). HttpOnly `rf_session` is HMAC-SHA256 signed with `APP_ACCESS_SECRET` and verified against the user's `sessionVersion` in PostgreSQL.
- **Guest Mode vs. Authenticated Endpoints**: Pages are public so guests can try the Typst editor and local preview. Persistence mutations and `/api/ai/byok-proxy` require an authenticated session and return **401** when unauthenticated.
- **Origin Enforcement**: Mutation requests (`POST`/`PUT`/`PATCH`/`DELETE`) require a same-origin `Origin`/`Referer` matching the request host. `POST /api/ai/byok-proxy` strictly requires a same-origin `Origin` header (`403` when missing or cross-origin).
- **Rate Limits**: In-memory per-IP rate limits apply to `/api/ai/*`, bulk-import, PDF upload, and auth signup/login.
- **Job Sync Secret**: `JOB_SYNC_SECRET` is required for `/api/jobs/sync-pittcsc`; unauthenticated calls without it return `401`.

---

## 3. Bring-Your-Own-Key (BYOK) Security Policy & Relay Hardening

### Key Storage & Transmission

1. **Browser Vault (`localStorage`)**:
   - Keys configured in the browser are encrypted with Web Crypto `AES-GCM` (`src/lib/byok-vault.ts`).
   - On a public HTTPS origin, `localStorage` remains sensitive to XSS; strict CSP (`script-src 'self'`, `connect-src 'self' blob:`) is enforced in `next.config.ts`.
2. **Authenticated BYOK Relay (`/api/ai/byok-proxy`)**:
   - Browser calls for OpenAI, Anthropic, and Groq pass through `/api/ai/byok-proxy` to satisfy browser CORS and CSP (`connect-src 'self'`).
   - The relay requires an authenticated user session (`requireUserId`), a same-origin `Origin` header, `POST` only (no `OPTIONS` or `Access-Control-Allow-Origin: *`), `https:` only, and an explicit host + path prefix allowlist:
     - `api.openai.com` (`/v1/chat/completions`, `/v1/models`, `/v1/responses`)
     - `api.anthropic.com` (`/v1/messages`, `/v1/models`)
     - `api.groq.com` (`/openai/v1/chat/completions`, `/openai/v1/models`)
   - Enforces a 256 KB body size limit (`413`) and 30s upstream timeout (`504`).
   - Forwards only `authorization`, `x-api-key`, `anthropic-version`, and `content-type` (strips `cookie`, `host`, and `x-forwarded-*`).
   - The app does not store or log request bodies or keys (note that the hosting platform may log HTTP metadata).
3. **Never in the Application Database**:
   - API keys are never written to PostgreSQL (verified by `tests/db-security.test.ts`).
4. **Key Redaction Policy**:
   - API error payloads pass through `sanitizeError()` (`src/lib/ai/redact.ts`), scrubbing `sk-proj-*`, `sk-ant-*`, `AIzaSy*`, `gsk_*`, Bearer tokens, and `key=` query parameters.

---

## 4. Network Isolation & SSRF Firewall

- Outbound fetches use `assertSafePublicUrl` / `safeFetch` (`src/lib/security/safe-fetch.ts`): HTTPS-only (localhost HTTP allowed only in non-production when explicitly enabled), blocked private/loopback/link-local/metadata IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`, `fe80::`, `fc00::/7`), and manual redirect handling.
- Production database fallback is fail-closed (`src/lib/prisma.ts`): if PostgreSQL is unreachable in `NODE_ENV=production`, the app throws `RESUMEFORGE_DB_UNAVAILABLE` rather than falling back to the in-memory mock store, and setting `RESUME_FORGE_ALLOW_MOCK_DB=1` in production throws at startup unless `RESUME_FORGE_E2E=1` is also set.

---

## 5. Master Resume Data Integrity

- Master resumes are created with `isProtected: true`.
- `PUT /api/resumes/[id]` and `updateResume` reject protected records with **403**. Edits must go through **Save as Master** (`confirmOverwrite`).
- Public `POST /api/resumes` cannot set `isMaster`.
- `POST /api/ai/generate-patches` returns **404** when no master exists (it does not auto-create one).

---

## 6. Mechanical Guardrail & AI Evidence Grounding

- **Deterministic Fact Snapshots (`src/lib/facts/extract.ts`)**: Extracts verified employers, job titles, date ranges, rendered bullet metrics (with trailing subject nouns), and skills section items from both `#entry(title:, role:, location:, date:, details:)` and `#resume-entry(...)` formats, ignoring Typst layout constants.
- **Fail-Closed Verification (`src/lib/guardrail/check.ts` & `policy.ts`)**:
  - **Employers (`HARD`)**: Exact match after corporate suffix normalization (`normalizeEmployer`), plus verified Evidence Bank aliases. No substring matching.
  - **Job Titles (`HARD`)**: Candidate title tokens must be a subset of master title tokens (blocking added seniority/scope tokens like `Senior`, `Staff`, `Principal`, `Lead`), and level markers (`Intern`, `Co-op`, `Junior`, `Associate`) present in the master title cannot be dropped.
  - **Date Ranges (`HARD`)**: Candidate date ranges must be contained within the master date range at ISO month granularity (`startIso >= master.startIso` and `endIso <= master.endIso`), falling back to year-level containment only when the candidate omits explicit months (e.g. `2022 - 2023`). Shifting start months/years earlier or extending `Present` beyond a bounded master end date is hard-blocked.
  - **Metrics (`HARD` / `SOFT`)**: Non-trivial metrics must match master value and unit. When both sides carry a trailing subject noun (after singularization, e.g., `10M requests` vs `10M users`), subject mismatches are hard-blocked (`HARD`); when only one side carries a trailing subject, a `SOFT` warning is emitted.
  - **Skills (`SOFT` + Patch Gate)**: Unverified skills in a document emit a `SOFT` warning, and `assertCanApplyPatches` blocks AI patches that introduce unverified skills without explicit per-skill acknowledgement.
  - **Fail-Closed Export (`assertCanExport`)**: Exporting a derived or AI-patched variant without a frozen Master Resume snapshot throws `GuardrailBlockError` (`"Freeze your master resume first..."`), while untailored starter/master self-export remains allowed for first-run guest evaluation.
