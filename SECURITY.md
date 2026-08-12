# SECURITY.md — Security Model & Data Privacy Specification

## 1. Overview & Threat Model

ResumeForge is a **BYOK** workspace. Guests can use the editor without an account. Saved resumes, evidence, and jobs require an email/password account and are scoped per user.

Resumes contain PII. LLM API keys have monetary value. The hosted threat model assumes a public origin: unauthenticated persist APIs, SSRF, ephemeral disks, and missing rate limits are treated as blockers.

---

## 2. Hosted Access Control

- **Optional accounts**: email + password (`scrypt`). HttpOnly `rf_session` is signed with `APP_ACCESS_SECRET` (cookie signing key, not a login password).
- **Pages are public.** Guests can use the editor. Persist mutations require a session and return **401** `{ code: "GUEST_READ_ONLY" }`. List GETs return empty `{ guest: true }` data.
- Mutation requests (POST/PUT/PATCH/DELETE) require a same-origin `Origin` or `Referer` matching the `Host` header (not the server bind address).
- In-memory per-IP rate limits apply to `/api/ai/*`, bulk-import, PDF upload, and auth signup/login.
- `JOB_SYNC_SECRET` is **required**. Sync without it returns 401. Browser session users may omit the Bearer header; cron jobs should send `Authorization: Bearer <secret>`.

---

## 3. Bring-Your-Own-Key (BYOK) Security Policy & Client Storage

### Key Storage Mechanisms & Trade-offs

1. **Browser Local Storage (`localStorage`)**:
   - Settings persist API keys in `resumeforge_ai_settings`.
   - On a public HTTPS origin this is XSS-sensitive. CSP (`script-src` limited to `'self'` plus WASM eval) is the primary mitigation. Keys are never echoed in API error payloads.
2. **Environment Variables (`.env.local`)**:
   - Server-side provider keys may be set via environment variables. Never commit them.
3. **OS Keychain Integration (Future Enhancement)**:
   - Native desktop packaging may store keys in the OS keychain.
4. **NEVER in the application database**:
   - API keys must not be written to Postgres. Verified by `tests/db-security.test.ts`.
5. **NEVER Committed to Version Control**:
   - `.env` and `.env.local` are gitignored.

### Key Redaction Policy

- API error payloads use `sanitizeError()` (`src/lib/ai/redact.ts`).
- Patterns scrubbed: `sk-proj-*`, `sk-ant-*`, `AIzaSy*`, Bearer tokens, `key=` query params.
- Gemini requests send `x-goog-api-key` headers rather than `?key=` query strings.

---

## 4. Network Isolation, SSRF, and Custom Endpoints

- Bulk-import source URLs must be HTTPS hosts on the allowlist (`raw.githubusercontent.com` plus `ALLOWED_IMPORT_HOSTS`).
- Tier-2 apply-URL fetches and custom AI `baseUrl` calls use `safeFetch`: HTTPS-only (localhost HTTP allowed in non-production), blocked private/loopback/metadata hosts, `redirect: "manual"`.
- Apply links rendered in the UI must pass `isSafeHref` (http/https only).
- Cloud provider requests go to official APIs or the user-configured custom base URL after the SSRF checks above.
- Zero telemetry: no analytics or remote logging SDKs.

---

## 5. Master Resume Data Integrity

- Master resumes are created with `isProtected: true`.
- `PUT /api/resumes/[id]` and `updateResume` reject protected records with **403**. Edits must go through **Save as Master** (`confirmOverwrite`).
- Public `POST /api/resumes` cannot set `isMaster`.
- `POST /api/ai/generate-patches` returns **404** when no master exists (it does not auto-create one).
- AI writes go to `ResumeVariant` records, never the protected master row.

---

## 6. Upload Limits and Security Headers

- PDF uploads: 10 MB max and `%PDF-` magic-byte check.
- Large string fields are Zod-capped (job descriptions, Typst source, bulk markdown).
- `next.config.ts` sets CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production.
- Typst text fonts are served from `/fonts/typst/` (self-hosted). WASM binaries stay on `/wasm/*`. CSP `connect-src` is `'self' blob:` only.

