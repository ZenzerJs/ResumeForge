# T2 Design Gate — Better Auth with AuthUser Bridge

**Branch:** sprint-1/t2-design · **Status:** AWAITING SIGNATURE
**Rule:** No implementation code is written or merged until Opus 5.5 signs
Section 9. This document is the spec implementation is measured against.

## 0. Code-verified facts this design depends on

Checked against `origin/main` (75911a3) on 2026-10-14. Implementation must
re-check any of these that changed.

| Fact | Where | Consequence |
|---|---|---|
| Two auth helpers already gate routes: `requireUserId` (401 if no session) and `getRequestUserId` (returns null; some handlers serve guests, some return 401 themselves) | `src/lib/security/auth-request.ts`, imported by 34 route files | Swap their internals to Better Auth. Do not add a parallel `requireSession()` and touch 34 files. |
| Guest mode exists: many GET handlers call `getRequestUserId` and serve a guest view when it returns null | e.g. `api/jobs`, `api/variants`, `api/stats`, `api/connectors/jobs`, `api/jobs/[id]/interview-prep` | "Everything else under `/api/*` → 401" would break guest reads. Optional-user routes stay optional. |
| Bearer route is `POST /api/jobs/sync-pittcsc` (`JOB_SYNC_SECRET`), called by `.github/workflows/ingest-jobs.yml` | `src/app/api/jobs/sync-pittcsc/route.ts` | `/api/connectors/jobs` is a public optional-user read, not the bearer route. |
| Mutations use PUT and PATCH too, not only POST/DELETE | `api/resumes/[id]`, `api/evidence/[id]`, `api/jobs/[id]`, `api/cover-letters/[id]`, `api/auth/me` | CSRF posture must cover POST/PUT/PATCH/DELETE. Middleware already origin-checks all four (`isMutationMethod`). |
| Legacy `User.passwordHash String` and `User.username String @unique` are required | `prisma/schema.prisma` | Bridge cannot insert a `User` with "no password" or no username without a schema change. See §2. |
| Rate limiter is an in-memory `Map` per process; key = last `X-Forwarded-For` hop, else `X-Real-IP`, else `"local"` | `src/lib/security/rate-limit.ts` | Resets on restart. Per-instance only. Spoofable when the app is reachable without a proxy that overwrites XFF. See §5. |
| `POST /api/connectors/sync` has no session helper and no bearer | `src/app/api/connectors/sync/route.ts` | Only the middleware's 10/min "heavy" limiter guards it. Allowlist decision required (§4). |
| `/api/ai/byok-proxy` runs on the edge runtime | `src/app/api/ai/byok-proxy/route.ts` | Better Auth DB session lookup cannot run there. BYOK files are untouchable (§7). |
| `APP_ACCESS_SECRET` also drives test-mode switches (`"playwright-test-secret"` in middleware and `session.ts`) and the `APP_ACCESS_PASSWORD` fallback | `src/middleware.ts`, `src/lib/security/session.ts`, `playwright.config.ts` | Retirement (§6) must replace those switches, not only cookie signing. |

## 1. Model name mapping (fixed before any `prisma generate`)

| Better Auth concept | Prisma model | Notes |
|---|---|---|
| user | `AuthUser` | Never `User` — legacy `User` owns all app relations |
| session | `Session` | |
| account | `Account` | emailAndPassword provider only this sprint |
| verification | `Verification` | |

Configured via Better Auth's model mapping in the auth server instance.
Open question for Opus: confirm exact mapping API against **current** docs —
do not rely on cached snippets.

`AuthUser` fields: `id` (UUID string), `email` (unique), `emailVerified`,
`name`, `createdAt`, `updatedAt`. Open question for Opus: whether Better
Auth's core user schema tolerates omitting `image`, or it must exist nullable.

## 2. Bridge: AuthUser ↔ User share the same id

- `AuthUser.id === User.id`, same UUID string.
- Id generation: Better Auth generates ids by default. Open question for
  Opus: confirm the current option for UUID generation (or a `before` hook
  that sets `id`) so the id is chosen once and reused for `User`.
- **Signup flow:** Better Auth creates `AuthUser` → user-create `after` hook
  (verify exact hook name against docs) upserts legacy `User` with the
  **same id**.
- **Legacy `User` required columns.** `passwordHash` and `username` are
  NOT NULL today. Pick one, Opus signs:
  - (a) Migration makes `User.passwordHash` nullable (`DROP NOT NULL`,
    non-destructive). Bridge writes `null`. Username comes from the signup
    form (`UsernameSchema`, `src/lib/security/usernames.ts`) passed through
    Better Auth `additionalFields`, or is derived deterministically.
  - (b) Bridge writes an unusable sentinel hash. Rejected unless (a) is
    blocked — sentinel values in credential columns are a review smell.
- **Atomicity.** The `after` hook generally runs outside the adapter's
  create transaction. Required behavior: the hook upsert is idempotent by
  id; `requireUserId` / `getRequestUserId` perform a "bridge repair" upsert
  when a valid session's `userId` has no `User` row, then proceed. A
  half-committed signup therefore self-heals on the next request rather than
  surfacing 500s. Opus confirms or replaces with a true transaction.
- **Sign-in path:** `session.userId` IS `User.id`. No join, no lookup table.
- **Existing owner data (account claim).** The owner's resumes and evidence
  belong to an existing `User.id`. A fresh Better Auth signup creates a new
  id and would not see them, and would also collide with the legacy row's
  unique `email` during the bridge upsert.
  **Auto-claiming a legacy `User` by matching email is forbidden**: anyone
  who signs up with the owner's email would take over the owner's data
  (no email verification exists this sprint).
  Required path: operator-only CLI `scripts/link-legacy-user.ts`, run
  locally against the DB, that creates the `AuthUser` + credential `Account`
  with `id = <legacy User.id>`. Not reachable over HTTP. `--dry-run` prints
  the target row first. Bridge upsert on email collision with a different
  id fails closed with a generic signup error (no account enumeration).
- **Legacy `User` survives this sprint untouched** apart from the optional
  nullable `passwordHash` in (a). No deletion, no consolidation.
  Consolidation is gated on `docs/user-fk-map.md` and a later sprint.

## 3. Session & cookie specification

| Setting | Value |
|---|---|
| Cookie name | Better Auth default; no rename — less drift |
| `httpOnly` | always true |
| `secure` | true iff `NODE_ENV === "production"` |
| `sameSite` | `lax` |
| Session TTL | 7 days; `updateAge` 1 day |
| `trustedOrigins` | explicit list: `NEXT_PUBLIC_APP_URL`, plus `http://localhost:3000` and `http://127.0.0.1:3005` only when `NODE_ENV !== "production"` (Playwright uses 3005). No wildcards. |

CSRF posture: `sameSite=lax` + Better Auth `trustedOrigins` on its own
endpoints + existing middleware `originAllowed` on every POST/PUT/PATCH/DELETE.
GET handlers never mutate. Written one-paragraph justification in the PR.
Opus checks: `originAllowed` returns true when both `Origin` and `Referer`
are absent (non-browser clients) — acceptable only because cookies are
`sameSite=lax`; confirm.

**Enforcement point:** existing `requireUserId` / `getRequestUserId` in
`src/lib/security/auth-request.ts`, reimplemented on Better Auth's server
session API (node runtime). Middleware keeps rate-limit + origin checks
only. No auth in edge middleware.

## 4. Route classification (one constant, explicit entries)

One exported constant (e.g. `ROUTE_AUTH` in `src/lib/security/`) lists every
non-session API route with its mode. Diffs to it require review. A unit test
enumerates `src/app/api/**/route.ts` and fails if a route is neither in the
constant nor calls `requireUserId` / `getRequestUserId`.

| Mode | Routes |
|---|---|
| `better-auth` | `/api/auth/[...all]` (Better Auth handler). Legacy `/api/auth/login`, `/signup`, `/logout` are removed at cutover — they would shadow the catch-all. |
| `bearer` | `POST /api/jobs/sync-pittcsc` (`JOB_SYNC_SECRET`) |
| `public` | `/api/connectors/status`, `/api/practice/problems`, `GET /api/companies/[slug]/dossier`, `/api/jobs/discovered` |
| `optional-user` (guest view when no session) | GET handlers calling `getRequestUserId` that serve a guest view, incl. `/api/connectors/jobs` and `/api/jobs/[id]/interview-prep` (dynamic segment matched by pattern, one segment, no `**`) |
| `required-user` | every handler calling `requireUserId`, plus handlers that call `getRequestUserId` and return 401 themselves (e.g. `PATCH /api/auth/me`). Classify per method, not per file. |
| path collision (Opus) | `/api/auth/me` and `/api/auth/migrate-guest-drafts` sit under Better Auth's default base path. Either move Better Auth's `basePath` or move these two routes; pick one. |
| **decide** (Opus) | `POST /api/connectors/sync` (no auth today), `/api/jobs/extract`, `/api/ai/test-connection`, `/api/ai/repair-typst`, `/api/ai/byok-proxy` (edge, BYOK — untouchable) |

Public **pages** stay as in `isPublicPath`: `/discover`, `/practice`,
`/interview`, `/tracker` and their subpaths.

## 5. Rate limiting

Keep one limiter (`src/lib/security/rate-limit.ts`); no parallel system.

- Login: 10 / 15 min per IP **and** 5 / 15 min per email
- Signup: 3 / hour per IP
- 429 with `Retry-After`.
- Per-IP limits live in middleware (as today). **Per-email limits cannot
  live in middleware** without reading the body; they live in a Better Auth
  `before` hook on the sign-in endpoint, keyed on normalized lowercase email.
  Opus confirms the hook API against current docs, or Better Auth's built-in
  rate limiter with custom rules if it can key on email.
- Known limits, accepted for single-instance Render: in-memory buckets reset
  on deploy/restart and are per-instance. IP key trusts `X-Forwarded-For`;
  Opus confirms Render overwrites/appends it so the last hop is the real
  client, and that no direct-to-origin path exists.

## 6. sessionVersion retirement — criteria, not dates

`sessionVersion`, `rf_session`, and the `APP_ACCESS_SECRET` code path retire
only after ALL of:
1. Password change revokes that user's other sessions (verify the Better
   Auth option for revoking other sessions on password change)
2. Integration test "password change rejects the previous session" passes
3. All `required-user` and `optional-user` routes pass on Better Auth
   sessions
4. Test-mode switches keyed on `"playwright-test-secret"` (middleware auth
   limit, `session.ts`) are re-keyed to an explicit test flag

Then: stop issuing `rf_session` (legacy cookies → 401, force re-login),
delete the legacy session code path, remove `APP_ACCESS_SECRET` and
`APP_ACCESS_PASSWORD` from code, `vitest.config.ts`, `playwright.config.ts`,
CI env, and `.env.example` in the SAME PR — `npm run check:env` is the
enforcement that they are really gone.

`BETTER_AUTH_SECRET` (and `BETTER_AUTH_URL` if required) are added to
`.env.example` and CI env in the T2 implementation PR, with a generation
command in the comment.

## 7. Untouchables (verified in review, diff-level)

- BYOK stays client-side. No server-side key persistence. T2 diff must not
  touch `src/lib/byok-vault.ts` or `src/app/api/ai/byok-proxy/route.ts`.
- `src/lib/security/safe-fetch.ts` private-IP block: unchanged.
- Connector ingestion logic: unchanged.

## 8. Migration & test requirements

- One Prisma migration: `AuthUser`, `Session`, `Account`, `Verification`
  tables, plus `User.passwordHash DROP NOT NULL` if §2 (a) is signed.
  `npx prisma migrate diff` shows no `DROP TABLE` / `DROP COLUMN`. No data
  migration. No `DELETE` statements anywhere in the PR.
- Tests (all must pass):
  - Unauthenticated request to a `required-user` route → 401
  - `optional-user` route without session → 200 guest view
  - Each `public` entry reachable without session (one test per entry)
  - Bearer route: valid secret → 200, wrong secret → 401
  - Route-classification test from §4 (no unclassified route)
  - Login sets cookie with expected flags (`secure` only under
    `NODE_ENV=production`)
  - Password change → previous session rejected
  - Signup bridge: `AuthUser` and `User` rows exist with identical id
  - Bridge repair: session with missing `User` row self-heals
  - Signup with an email owned by a different legacy `User.id` → generic
    error, no row created, no data exposure
  - Per-email login limit trips at 6th attempt across rotating IPs

## 9. Adversarial review — Opus signs here, blocking

You are a hostile reviewer. Attempt to defeat this design, then sign. Answer
every open question in §1, §2, §3, §5, §6 in writing with a link to the
current Better Auth doc page you used.

- [ ] Session theft: any path to read/forge/replay the cookie?
- [ ] CSRF: state-changing route (POST/PUT/PATCH/DELETE) reachable cross-origin?
- [ ] Brute force: limits beaten via `X-Forwarded-For` spoofing, parallel
      requests, or restart reset?
- [ ] Session fixation / stale sessions: revocation on password change confirmed?
- [ ] Bridge atomicity: signup half-commit — what does the user see; does
      bridge repair recover it?
- [ ] Account claim: any HTTP path that binds a new `AuthUser` to an
      existing `User.id`?
- [ ] Secrets: any secret in logs, error bodies, or client bundles?
- [ ] Untouchables: diff touches BYOK, safe-fetch, or connectors? → block
- [ ] Route classification: every "decide" row resolved; any route that
      should be private but is `public` / `optional-user`?
- [ ] Better Auth usage verified against current docs (not training memory)?

**Signature:** model, date, approve / block-with-changes, one-line rationale.

## 10. Out of scope

Legacy `User` deletion or table consolidation · auth UI redesign · OAuth
providers · multi-user support · edge-middleware auth · email verification.
