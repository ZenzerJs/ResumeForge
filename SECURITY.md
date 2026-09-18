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

---

## 6. Mechanical Guardrail & AI Evidence Grounding (Phase 11)

- **Deterministic Fact Snapshots**: When Master Resumes are saved or confirmed, an immutable `factSnapshot` (version: 1) extracts and freezes verified employers, titles, date ranges, metrics, and skills.
- **Fail-Closed Patch Evaluation**: Proposed AI tailoring diffs are diffed mechanically against the frozen master fact snapshot.
  - **HARD Violations** (`employer`, `title`, `date`, `metric`, hallucinated `evidenceIds`) hard-block patch application (`apply_patches`), Master overwrite, and document export (`assertCanExport`).
  - **SOFT Violations** (`skill`) generate visual audit warnings in `GuardrailFeedback` while permitting export.
  - **Automatic 1x Retry Loop**: If initial AI patch generation produces hallucinations, a retry attempt is dispatched with explicit violation feedback. If the second attempt still fails, the engine **fails closed** to the verified clean master baseline.
- **Confirm-Before-Master Flow**: Master saves and uploads require explicit user fact confirmation to prevent poisoned baseline records.
- **Client-Side WASM Typst Sandboxing**: Typst document compilation (`compileTypstToPdf`, `compileTypstToSvg`) runs client-side in browser WebAssembly without sending raw document content to third-party rendering APIs.

- AI writes go to `ResumeVariant` records, never the protected master row.

---

## 7. Job Ingestion Connectors & SSRF Firewall (Phase 12)

- **Zero Scraping & Zero Automated Submissions**: ResumeForge does not use headless browsers (Puppeteer/Playwright) or DOM scrapers. All ingestion connects strictly to public REST APIs and syndication feeds. It never auto-submits applications.
- **SSRF Network Hardening**: `safeFetch` enforces:
  - HTTPS protocol only (disallowing `http://`, `file://`, etc.).
  - Hostname allowlist: `boards-api.greenhouse.io`, `api.lever.co`, `api.ashbyhq.com`, `api.adzuna.com`, `jobicy.com`, `remotive.com`, `remoteok.com`.
  - IP range check (`ipaddr.js`): Rejects all private (`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`), loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), unique local, and carrier-grade NAT destinations.
  - Manual redirects (`redirect: "manual"`) to prevent open redirect SSRF bypass.
- **HTML Sanitization**: All ingested descriptions pass through `sanitize-html`, stripping scripts, iframes, and inline event handlers before database storage.
- **Master Fact Snapshot Isolation**: Ingested jobs are external read-only listings. They never mutate or poison the master `ResumeFacts` snapshot.

---

## 8. Upload Limits and Security Headers

- PDF uploads: 10 MB max and `%PDF-` magic-byte check.
- Large string fields are Zod-capped (job descriptions, Typst source, bulk markdown).
- `next.config.ts` sets CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production.
- Typst text fonts are served from `/fonts/typst/` (self-hosted). WASM binaries stay on `/wasm/*`. CSP `connect-src` is `'self' blob:` only.

