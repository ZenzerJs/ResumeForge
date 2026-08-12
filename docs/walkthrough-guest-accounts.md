# Full Walkthrough — Guest Access + Optional Email/Password Accounts

**Date:** 2026-08-12  
**Repo:** [ZenzerJs/ResumeForge](https://github.com/ZenzerJs/ResumeForge)  
**Commit:** [`ae3f82c`](https://github.com/ZenzerJs/ResumeForge/commit/ae3f82c) on `main`  
**Pushed to:** `https://github.com/ZenzerJs/ResumeForge.git`

This document is a complete record of what was built, why, how it works, every file touched for this product change, and every automated check that ran (including interim failures and the fixes).

---

## 1. Why this change happened

The hosted app previously used a **workspace password gate**. Visiting the site redirected to `/login`. If `APP_ACCESS_SECRET` was missing, the login page showed:

> Server is missing APP_ACCESS_SECRET

That looked like a broken signup/login product. The actual request was different:

1. Anyone should be able to **use the site without signing up** (guest).
2. Guest work **must not save to the database**.
3. Optional **email + password** signup/login should persist that user’s data to Postgres.

This is **not** Clerk/OAuth. It is a simple in-app account.

ADR-014 in `docs/decisions.md` records this and **overrides ADR-013’s page-level password gate**. Postgres, CSRF Host-header checks, master-resume protection, and SSRF controls from the hosted-security work stay in place.

---

## 2. What the product does now

### Guest (not signed in)

- Open `/`, `/editor`, `/library`, `/tracker`, `/tailor`, `/settings` with no login.
- Nav shows **Sign In** and **Sign Up**.
- A banner says work stays in the browser until you sign in.
- The Typst editor still uses **localStorage + WASM** (that is the guest persist path).
- Saving to the database returns **401** with:

```json
{
  "success": false,
  "error": "Sign in to save your work.",
  "code": "GUEST_READ_ONLY"
}
```

- List APIs (`GET /api/jobs`, `/api/resumes`, `/api/evidence`, etc.) return empty data with `guest: true` instead of locking the UI with 401.
- Stateless tools still work without an account: JD extract, ATS evaluate with Typst in the request body, AI test-connection, Typst repair.

### Signed-in user

- **Create account** or **Sign In** with email + password (`/login`, or `/login?mode=signup`).
- Password is hashed with **scrypt**. Email is unique.
- Session cookie `rf_session` is HttpOnly, SameSite=Lax, HMAC-signed.
- Resumes, evidence, and jobs are stored in Postgres and **scoped to that user**.
- Nav shows the user’s email and **Sign Out**.
- Sign Out clears the cookie and reloads `/` as a guest.

### Shared vs private data

| Data | Guest | Signed-in |
|---|---|---|
| Editor Typst buffer | localStorage | localStorage + optional Save as Master |
| Resume / Evidence / Job rows | not written | owned by `userId` |
| Discovered job feed | readable (global) | readable (global) |
| Promote discovered job into tracker | 401 | creates a Job with `userId` |

`APP_ACCESS_SECRET` is **only the cookie signing key**, not a login password. Guests can browse even if it is missing. Signup/login return 503 without it, because a session cookie cannot be minted.

### User passwords vs `APP_ACCESS_SECRET`

Users create their own password on `/login?mode=signup`. ResumeForge stores it as a **scrypt hash** in Postgres (`User.passwordHash`). `APP_ACCESS_SECRET` is a separate server secret used only to sign the `rf_session` cookie after signup/login. It is not the user’s password, and it is not a default login password.

**How the flow works**

1. The user submits an email and password.
2. The server hashes the password with scrypt (`src/lib/security/passwords.ts`). Stored form: `scrypt:<salt-base64url>:<hash-base64url>`.
3. Only that hash is saved in `User.passwordHash` — never the plaintext password.
4. The server uses `APP_ACCESS_SECRET` to HMAC-sign the `rf_session` cookie (`uid=<userId>|exp=<unix_ms>.<hmac>`).
5. On later login, the submitted password is compared to the stored hash with `timingSafeEqual`. If it matches, a new signed cookie is issued.

Passwords must not be stored in plaintext. A slow password-hashing function such as scrypt is the correct pattern ([OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)).

| Value | Who chooses it? | Where it belongs | Purpose |
|---|---|---|---|
| `APP_ACCESS_SECRET` | You, the operator | Server environment variables | Signs session cookies |
| User password | Each user | Submitted to signup/login | Authenticates that user |
| `passwordHash` | Server-generated | Postgres `User` row | Secure representation of the user password |

A 503 `Server is missing APP_ACCESS_SECRET` does **not** mean the app is missing a default login password. It means the server cannot safely mint a session after the user chooses their password. Add `APP_ACCESS_SECRET`, redeploy, and users can create accounts with their own passwords.

Do **not** put a default user password in Render or in `.env`.

---

## 3. Architecture

```
Browser
  ├─ Guest: pages + localStorage editor + WASM preview
  └─ Signed-in: same UI + Cookie: rf_session

middleware.ts
  ├─ Pages: public (no session redirect)
  ├─ Mutations: CSRF Origin/Referer vs Host header
  └─ Rate limits: auth, AI, heavy (PDF / bulk-import)

API
  ├─ getRequestUserId() → null  → GET lists empty, mutations 401 GUEST_READ_ONLY
  └─ requireUserId()    → uuid  → DB calls pass userId; ownership 404 if not owned

Postgres (Prisma)
  User 1──* Resume | EvidenceItem | Job
  DiscoveredJob stays global
```

### Session token format

```
uid=<userId>|exp=<unix_ms>.<hmac-sha256-base64url>
```

Signed with `APP_ACCESS_SECRET` (min 8 characters). Cookie name: `rf_session`. TTL: 7 days.

### Password hashing

`src/lib/security/passwords.ts` stores:

```
scrypt:<salt-base64url>:<hash-base64url>
```

---

## 4. What was implemented (by layer)

### 4.1 Database

- New `User` model: `id`, `email` (unique), `passwordHash`, timestamps.
- Optional `userId` on `Resume`, `EvidenceItem`, `Job` with indexes and `ON DELETE CASCADE`.
- Migration: `prisma/migrations/20260812200000_guest_accounts/migration.sql`
- Applied locally with `npx prisma migrate deploy` against Docker Postgres (`postgresql://resumeforge:resumeforge@localhost:5432/resumeforge`).

The same commit also includes the earlier Postgres cutover (`20260812180000_postgres_init`) and SQLite migrations archived under `prisma/migrations_sqlite_archive/`.

### 4.2 Auth APIs

| Route | Behavior |
|---|---|
| `POST /api/auth/signup` | email + password (min 8). 409 if email exists. Sets session cookie. |
| `POST /api/auth/login` | email + password. 401 on bad credentials. Sets session cookie. |
| `GET /api/auth/me` | `{ data: user \| null, guest }` |
| `POST /api/auth/logout` | Clears `rf_session` |

### 4.3 Middleware

- **No** redirect to `/login` for missing session.
- CSRF still required on mutations (Host header, not bind address `0.0.0.0`).
- Auth login/signup rate-limited (10 / 60s) **before** the public early-return.
- AI and heavy-route rate limits unchanged.

### 4.4 Persist APIs (require sign-in)

Mutations use `requireUserId`. List GETs use `getRequestUserId` and return empty for guests. By-id reads/writes check ownership (`userId` match) and 404 if not owned.

Covered routes include:

- Resumes: list/create, get/put by id, save-master, undo-master, clear-master, upload-pdf
- Evidence: list/create, get/put/delete by id
- Jobs: list/create, get/patch/delete by id, bulk-import, promote-discovered, fetch-fulltext
- Variants and cover letters (via related job/master `userId`)
- AI that needs saved master/evidence: generate-patches, apply-patches, extract-evidence, generate-cover-letter, qualitative-review
- Stats: signed-in dashboard counts, or `emptyGuestStats()`

Protected master `PUT /api/resumes/[id]` still returns **403** for authenticated owners. Overwrite still goes through **Save as Master**.

### 4.5 Public / guest-safe APIs

- `POST /api/jobs/extract` (stateless JD parse)
- `POST /api/jobs/match` (empty evidence bank for guests)
- `POST /api/ats/evaluate` when Typst is in the body
- `POST /api/ai/test-connection`, `POST /api/ai/repair-typst`
- `GET /api/jobs/discovered` (shared feed)
- `POST /api/jobs/sync-pittcsc` still fail-closed on `JOB_SYNC_SECRET`

### 4.6 UI

- `/login`: email + password, Sign In / Create account toggle, show/hide password, **Continue as guest** → `/`
- Top nav: guest → Sign In / Sign Up; authed → email + Sign Out
- Sign Out: `POST /api/auth/logout` then `window.location.assign("/")` so auth chrome actually refreshes (client `router.replace("/")` on the same path left stale “signed in” UI)
- Guest banner in `AppShell`
- Home page reads the session cookie server-side and loads that user’s stats or empty guest stats
- Metadata no longer says “password-gated”

### 4.7 Hosted / local ops (also in this commit)

This push includes the earlier host-readiness work that landed in the same working tree:

- Postgres via `docker-compose.yml`
- `render.yaml` (Web + Postgres, bind `0.0.0.0`)
- Self-hosted Typst fonts under `public/fonts/typst/`
- CSRF Host-header fix so `next start -H 0.0.0.0` does not 403 same-origin `fetch`

---

## 5. Files created or modified

Commit `ae3f82c`: **166 files**, +4188 / −2939 lines.

### Created (guest accounts + auth)

- `src/lib/security/passwords.ts`
- `src/lib/security/auth-request.ts`
- `src/lib/security/session.ts`
- `src/lib/security/protected-resume.ts`
- `src/lib/security/rate-limit.ts`
- `src/lib/security/safe-fetch.ts`
- `src/app/api/auth/signup/route.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/login/page.tsx`
- `src/middleware.ts`
- `src/lib/db/stats.ts`
- `tests/helpers/auth.ts`
- `tests/session.test.ts`
- `tests/master-protection.test.ts`
- `tests/ssrf.test.ts`
- `e2e/global-setup.ts`
- `e2e/hosted-security.spec.ts`
- `prisma/migrations/20260812200000_guest_accounts/migration.sql`

### Schema / ops

- `prisma/schema.prisma`
- `prisma/migrations/20260812180000_postgres_init/migration.sql`
- `docker-compose.yml`
- `render.yaml`
- `.env.example`
- `SECURITY.md`
- `docs/decisions.md` (ADR-014)
- `docs/phase-status.md`

### Persist APIs and DB layer (scoped to `userId`)

- `src/lib/db/resumes.ts`, `evidence.ts`, `jobs.ts`, `variants.ts`, `cover-letters.ts`
- `src/lib/ai/evidence-persist.ts`
- `src/lib/ingestion/tier1-importer.ts`
- `src/app/api/resumes/**`, `evidence/**`, `jobs/**`, `variants/**`, `cover-letters/**`
- `src/app/api/ai/generate-patches`, `apply-patches`, `extract-evidence`, `generate-cover-letter`, `qualitative-review`
- `src/app/api/ats/evaluate/route.ts`
- `src/app/api/stats/route.ts`

### UI

- `src/components/navigation/top-nav.tsx`
- `src/components/design-system/app-shell.tsx`
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/components/landing/home-landing.tsx`

### Tests updated for session cookies / ownership

- `tests/jobs-api.test.ts`
- `tests/tracker-api.test.ts`
- `tests/pdf-api.test.ts`
- `tests/master-safety.test.ts`
- `tests/editor-loading.test.ts`
- `tests/variant-api.test.ts`
- `tests/cover-letter-api.test.ts`
- `tests/evidence-extract.test.ts`
- `tests/pittcsc-api.test.ts`
- `tests/qualitative-trigger.test.ts`
- `tests/task-8.5-cover-letter.test.ts`
- `tests/task-8.6-unified-card.test.ts`
- `e2e/phase8-tracker-click-zones.spec.ts`
- `playwright.config.ts`

---

## 6. Tests and results

All of the following ran on 2026-08-12 against local Docker Postgres.

### 6.1 Required verification suite (final)

| Command | Result | Detail |
|---|---|---|
| `npm run lint` | **Pass** | Next.js ESLint, 0 warnings/errors |
| `npm run typecheck` | **Pass** | `tsc --noEmit` (after fixing `authedNextRequest` `RequestInit` / `signal: null`) |
| `npm run test` | **Pass** | Vitest **233/233** across 47 files |
| `npm run build` | **Pass** | Prisma generate + Next.js 15.5.22 production build, 43 pages |
| `npx playwright test` | **Pass** | **68/68**, 1 worker, ~1.7 min, Chromium |

Playwright was run via a dedicated subagent, as required by project guidelines. It was **not** reported as passing until the process finished.

### 6.2 Vitest (unit + API integration)

**Final run:** 47 files passed, **233 tests passed**, ~16s.

```
Test Files  47 passed (47)
     Tests  233 passed (233)
```

Suites included (among others):

- `tests/session.test.ts` — signed session tokens, CSRF Host vs Origin, public paths
- `tests/master-protection.test.ts` — guest PUT 401; authed PUT on protected master 403
- `tests/jobs-api.test.ts` — guest POST 401 `GUEST_READ_ONLY`; authed invalid payload 400
- `tests/tracker-api.test.ts` — PATCH status / appliedAt with owned jobs
- `tests/pdf-api.test.ts` — upload/clear-master with session
- `tests/master-safety.test.ts` — unconfirmed save-master 400; undo-master flow
- `tests/cover-letter-api.test.ts`, `task-8.5`, `task-8.6`
- `tests/variant-api.test.ts`, `editor-loading.test.ts`
- `tests/evidence-extract.test.ts`, `pittcsc-api.test.ts`
- Existing ATS, matcher, JD parser, redaction, SSRF, Typst, prompt, and smoke suites

**Interim Vitest failure (fixed before the green run):**

| Test | First result | Cause | Fix |
|---|---|---|---|
| `master-safety.test.ts` API save-master / undo-master | 401 instead of 400/200 | Routes now require a session | Create a test user + cookie; seed a master for that user |

After the fix: **233/233**.

**Typecheck interim failure (fixed before the green run):**

| File | Error | Fix |
|---|---|---|
| `tests/helpers/auth.ts` | `NextRequest` init `signal: null` not assignable | Pass only `method`, `headers`, `body` into `NextRequest` |

### 6.3 Playwright E2E

Config: `playwright.config.ts`  
Server: `npm run start -- -p 3005` (production build)  
Auth setup: `e2e/global-setup.ts` signs up / logs in `playwright@resumeforge.test` and writes `e2e/.auth/user.json`.

**Final run:** exit code 0, **68 passed / 0 failed / 0 skipped**.

Hosted-security cases in `e2e/hosted-security.spec.ts`:

| Test | Final |
|---|---|
| Guest `GET /api/jobs` returns empty `{ guest: true }` | Pass |
| Guest `POST /api/resumes/save-master` is 401 `GUEST_READ_ONLY` | Pass |
| Guests can open `/` without signing in | Pass |
| Login page: email, password textbox, Sign In, Continue as guest, skip link | Pass |
| Signup/login persist a session | Pass |
| Mobile nav at 375px includes Sign Out (authed storage state) | Pass |
| Sign out clears session, returns home, `GET /api/jobs` is guest | Pass |
| Protected master cannot be overwritten via PUT (403) | Pass |

Tracker click-zone cases in `e2e/phase8-tracker-click-zones.spec.ts` (all 4) also passed on the final run, along with the rest of the existing E2E suite (editor, library, tailor, ATS, cover letters, settings, polish, repair, etc.).

### 6.4 Playwright interim failures (diagnosed, fixed, re-run)

These were **not** hidden. They failed, were fixed, and the suite was re-run.

**Run 1:** 5 failed / 63 passed (68 tests, ~2.1 min)

| Test | Error | Root cause | Fix |
|---|---|---|---|
| Login page email/password/guest | `getByLabel('Password')` matched 2 elements | Show-password button `aria-label` also contains “Password” | Assert `getByRole('textbox', { name: 'Password' })` |
| Sign out clears session | `json.guest` was `undefined` | Waited for `/` while already on `/`, so the assertion ran before logout finished; also `page.request` still had the session | Wait for **Sign In** after logout |
| Tracker click-zones 1–3 | `open-original-btn` never appeared | `POST /api/jobs` Zod schema strips `notes`, so apply URL never saved; user-scoped GET no longer showed leftover jobs with links | Seed job, then `PATCH` notes with `Apply Link: https://example.com/jobs/12345` |

**Run 2:** 1 failed / 67 passed (~1.9 min)

| Test | Error | Root cause | Fix |
|---|---|---|---|
| Sign out clears session | Sign In never became visible (10s) | Sign Out used `router.replace("/")` on the same path, so TopNav did not refetch `/api/auth/me` and kept showing the authed chrome | Sign Out now `POST /logout` then `window.location.assign("/")`. Production **rebuild** required because Playwright uses `next start`. |

**Run 3 (after rebuild):** **68/68 pass**, ~1.7 min. Sign-out test ~1.5s.

### 6.5 Production build (final)

```
▲ Next.js 15.5.22
✓ Compiled successfully
✓ Generating static pages (43/43)
```

Notable routes: `/` ~168 kB first load, `/editor` ~153 kB, `/login` ~109 kB.

---

## 7. Git

Working tree was dirty on `main` (guest-accounts work plus earlier host-readiness that had not been pushed). Those changes were committed and pushed.

```
git commit  ae3f82c
message     Add guest access with optional email/password accounts.
push        origin HEAD → main
remote      https://github.com/ZenzerJs/ResumeForge.git
range       4235fc4..ae3f82c
```

`.env` was **not** committed. `.env.example` documents `APP_ACCESS_SECRET` as the cookie signing key.

---

## 8. How to try it locally

Local hosting runs the **same** server-side authentication code as Render. You still need `APP_ACCESS_SECRET` (any trimmed string ≥ 8 characters) and a working Postgres database. Guest browsing can work without those; **signup, login, and saved user data will not**.

### 8.1 Environment file

At the project root, copy `.env.example` to `.env` (Prisma CLI reads `.env`; Next.js also loads `.env` and `.env.local`):

```env
DATABASE_URL="postgresql://resumeforge:resumeforge@localhost:5432/resumeforge"
APP_ACCESS_SECRET="replace-with-a-long-random-secret"
JOB_SYNC_SECRET="another-long-random-secret"
```

Generate a server secret with:

```bash
openssl rand -base64 32
```

Do **not** name it `NEXT_PUBLIC_APP_ACCESS_SECRET`. Use exactly `APP_ACCESS_SECRET`. It must stay server-only and must never be committed to Git (`.env` and `.env*.local` are gitignored). After adding or changing it, stop and restart `npm run dev`; environment variables are read when the server starts.

`.env.local` also works for `npm run dev`. Keep `DATABASE_URL` in `.env` as well so `npx prisma migrate deploy` can see it (Prisma does not load `.env.local`).

### 8.2 Start Postgres, migrate, run the app

```bash
docker compose up -d
npx prisma migrate deploy
npm run dev
```

Confirm the database container is up:

```bash
docker compose ps
```

Then open:

```text
http://localhost:3000/login?mode=signup
```

Enter your own email and password. The password is hashed with scrypt and stored in local Postgres (`User.passwordHash`). `APP_ACCESS_SECRET` only signs the `rf_session` cookie.

You can also open `/` as a guest, use the editor, and confirm that saving to the database tells you to sign in.

### 8.3 Windows PowerShell (session-only)

From the project directory:

```powershell
$env:APP_ACCESS_SECRET = "replace-with-a-long-random-secret"
$env:DATABASE_URL = "postgresql://resumeforge:resumeforge@localhost:5432/resumeforge"
$env:JOB_SYNC_SECRET = "another-long-random-secret"
npm run dev
```

That lasts only for the current PowerShell window. A project `.env` file is the persistent option.

### 8.4 If you do not have Postgres running

Guest browsing may still work. Account creation and saved `User` / `Resume` / `EvidenceItem` / `Job` rows will not, because this commit uses Postgres for those records. Start the bundled database first:

```bash
docker compose up -d
npx prisma migrate deploy
```

### Hosted Render configuration

You need both of these on the **web service** Environment settings. Neither is a user login password:

```env
# Server-only secret used to sign sessions (min 8 characters)
APP_ACCESS_SECRET="a-long-random-server-secret"

# Postgres database where users and password hashes are saved
DATABASE_URL="postgresql://..."
```

`render.yaml` already maps `DATABASE_URL` from the linked Postgres instance and generates `APP_ACCESS_SECRET` when the blueprint is used. If the service was created without that env var, add it manually, then **redeploy**.

Generate a server secret with:

```bash
openssl rand -base64 32
```

The user’s chosen password is entered only through `/login?mode=signup`. After signup, only the scrypt hash lives in Postgres.

---

## 9. Known limitations (intentionally not in this change)

- BYOK API keys remain in `localStorage` (CSP-mitigated, not vaulted).
- Rate limits are in-memory (one Render instance).
- Clerk / OAuth is out of scope.
- Guest editor drafts are localStorage-only; clearing the browser loses them.
- Signup/login still need `APP_ACCESS_SECRET` to mint cookies. That secret is not a user password; each user still chooses their own password at signup.
- `CreateJobSchema` still omits `notes`; apply links on create go through PATCH (E2E does this).
- Live Render/Vercel provisioning is still a manual operator step (`render.yaml` is the blueprint).

---

## 10. Suggested follow-ups

1. Allow `notes` on `POST /api/jobs` so apply URLs can be set in one request.
2. Surface a dedicated “Sign in to save” toast in the editor when Save as Master returns `GUEST_READ_ONLY`.
3. Optional: copy guest localStorage drafts into the new account after first signup.
