# Self-host ResumeForge

Self-hosted installations use PostgreSQL as the only persistent application database. The Compose stack runs PostgreSQL and the production Next.js app. The app runs `prisma migrate deploy` before it starts; do not use `prisma db push` for deployment.

## Start

### Quickstart (One-Line Installer + Prebuilt GHCR Image)

1. Install Docker Engine or Docker Desktop with Compose v2.
2. Run the one-line installer for your OS:
   - **Windows (PowerShell):** `irm https://raw.githubusercontent.com/ZenzerJs/ResumeForge/main/install.ps1 | iex`
   - **macOS / Linux:** `curl -fsSL https://raw.githubusercontent.com/ZenzerJs/ResumeForge/main/install.sh | bash`
3. The installer creates `~/resumeforge/.env` on first run with generated random secrets (never overwriting an existing `.env`), picks free local ports if `3000` or `5432` are busy, pulls `ghcr.io/zenzerjs/resumeforge:latest`, runs `prisma migrate deploy`, and waits for `/login` readiness.
4. To build from source instead of pulling the prebuilt image inside a cloned repository, run `.\install.ps1 -Build` (Windows) or `./install.sh --build` (macOS/Linux), or use `docker compose up --build -d` after copying `.env.example` to `.env` and replacing every `change-me` placeholder (use an alphanumeric PostgreSQL password so it is URI-safe in `DATABASE_URL`).
5. **Custom HTTPS domain / reverse proxy:** Session `Secure` cookie detection falls back to `x-forwarded-proto` at runtime, while `NEXT_PUBLIC_APP_URL` sets metadata base URLs (the prebuilt GHCR image compiles with `http://localhost:3000`; pass `NEXT_PUBLIC_APP_URL` as a build arg and run `docker compose up --build -d` when baking a custom public origin into the client bundle). Keep the app bound to loopback (`127.0.0.1`) and terminate TLS at your reverse proxy.
6. Public signup is enabled only when `DEMO_MODE=false`; `DEMO_MODE=true` disables signup and all persistent API writes.

Compose stores PostgreSQL data in the named `resumeforge_pgdata` volume. Restarting or recreating containers preserves that volume. It is not a backup. Avoid running `prisma db seed` against a database containing real user data.

## Backup

Make a compressed logical backup using the database container and a file on the host:

```powershell
New-Item -ItemType Directory -Force backups | Out-Null
$backupPath = Join-Path .\backups "resumeforge-$((Get-Date -Format yyyyMMdd-HHmmss)).dump"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > $backupPath
```

Use PowerShell 7.4 or newer so binary output redirection preserves the custom-format dump.

Keep backup files outside the Compose volume and protect them like the database: they contain account and resume data. Copy them to a separate encrypted backup location according to your retention needs.

## Restore to a separate database

Test a backup before relying on it. Create a separate empty database on the same PostgreSQL service, then restore there; this keeps the running app's database untouched.

```powershell
$backupPath = Resolve-Path .\backups\resumeforge-YYYYMMDD-HHMMSS.dump
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" resumeforge_restore_check'
docker compose cp $backupPath postgres:/tmp/resumeforge-restore-check.dump
docker compose exec postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d resumeforge_restore_check --no-owner --no-privileges /tmp/resumeforge-restore-check.dump'
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d resumeforge_restore_check -c "\dt"'
```

Use a separate disposable database name for every restore check. Review the database name before issuing any restore command. A production restore should follow a separately planned maintenance window, a fresh backup of the current database, and a verified restore test.

## Public demo mode

Set `DEMO_MODE=true` only for the public demo deployment. It disables signup and all normal API persistence, including writes made with existing signed-in cookies. Synthetic samples and visitor drafts stay in browser storage. Demo AI requires visitor BYOK; provider keys configured in server environment are ignored. Operator import/maintenance routes remain protected by their existing `JOB_SYNC_SECRET` checks.

The public demo's local drafts are not a backup and do not move between browsers. Self-hosted mode (`DEMO_MODE=false`) retains normal PostgreSQL persistence for signed-in users.

## Hosting notes

These are options to investigate after measuring the production image, memory use, WASM assets, and database growth. Free plans can change and do not establish that an always-on deployment will remain free.

- [Render's free plan](https://render.com/docs/free) sleeps a web service after 15 minutes without traffic and takes about a minute to wake. Its free PostgreSQL database is limited to 1 GB and expires 30 days after creation, so it is not suitable for durable self-hosted user data.
- [Neon's pricing page](https://neon.com/pricing) lists a Free allowance of 100 CU-hours per project each month and 1 GB storage per project. A separately hosted demo app plus Neon may suit a low-traffic trial, subject to app runtime limits, measured use, and the account's current terms.
- [Vercel Hobby](https://vercel.com/docs/plans/hobby) is restricted to personal, non-commercial use; check that condition before considering it for a public product demo.

No hosting provider has been selected or deployed from this guide.

## Current build measurements

The latest combined Docker build on 2026-10-23 produced a 2,219,172,975-byte image. A stateless PDF-upload smoke returned a browser-local Typst draft; `User` and `Resume` database row counts remained zero before and after the request. The earlier full lifecycle run applied all 10 migrations, verified app health, HTTPS build origin and Secure signup cookie, persisted a synthetic login across app and database restarts, and restored a custom-format `pg_dump` into a separate database with one synthetic user and 10 migration rows. It used a unique Compose project, disposable volume, and temporary restore file; cleanup completed. The PDF-route refinement changed no schema, so the earlier lifecycle result remains valid.

Earlier synthetic measurements on the demo worktree found idle app memory of 263 MiB and idle PostgreSQL memory of 40.64 MiB. Static assets measured then: the two Typst WASM files total 29,297,603 bytes, Typst fonts total 8,713,432 bytes, and the PDF worker is 1,265,413 bytes. These asset and idle-memory values are not peak-load estimates and have not been repeated on the final combined image or a target host. Measure target-host memory before choosing a provider; the image size and WASM download make an always-free hosted demo uncertain.

## Resetting a Local Account Password

Self-hosted deployments without an outbound email server can reset any local account password via the operator CLI. This hashes the new password with `scrypt` and increments `User.sessionVersion` so all previously issued session cookies are immediately revoked:

```bash
npx tsx scripts/reset-user-password.ts --email you@example.com
```

To script non-interactively without placing the password in shell history, pipe it on stdin:

```bash
printf '%s\n' 'YourNewStrongPassword!' | npx tsx scripts/reset-user-password.ts --email you@example.com --stdin
```
