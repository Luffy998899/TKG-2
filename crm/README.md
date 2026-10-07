# TKG CRM

The customer and sales CRM for TKG Ventures Ltd, at
**`https://tkgventuresltd.ca/crm`**. It is used mostly on phones by sales reps
and an admin, and it holds Canadian customers' personal information. **A data
leak is the worst possible outcome.** Every design choice below follows from
that.

Next.js (App Router) + TypeScript + Tailwind, served from the same VPS as the
marketing site (nginx sends `/crm` here), with its own **PostgreSQL** on that
server. No third-party database, auth or storage service. It shares no code and
no environment file with the marketing site in the repository root; the site
only sends it signed sales inquiries.

Deploying: [`DEPLOY.md`](DEPLOY.md) - in short, `sudo ./update.sh` on the
server does everything. The build plan, the table design, the access matrix and
every decision are in [`../plans/crm/00-plan.md`](../plans/crm/00-plan.md).

---

## Security model, in one screen

| Control | Where it is enforced |
| --- | --- |
| No public sign-up; accounts exist only when an admin creates them (first admin: `scripts/create-admin.sh`) | `public.create_user()` / `bootstrap_admin()` in `db/migrations/*_local_auth.sql` |
| Passwords: bcrypt (cost 12), 12+ characters with upper, lower and a digit, checked in the database | `app.hash_password()`, `app.password_ok()` |
| Sessions: random 256-bit cookie token, only its SHA-256 stored; idle 30 min (admin) / 2 h (rep), 12 h absolute; deactivation ends them on the next request | `auth.sessions`, `public.resolve_session()`, `src/proxy.ts` |
| Login lockout: 5 failures per email / 20 per IP in 15 min | `login_check` / `login_record` |
| Row level security on **every** table, default deny | `db/migrations/*_rls.sql`; `tests/db/structure.test.ts` fails if a table lacks it |
| The app's database login has **no rights of its own**: every transaction switches to `anon`, `authenticated` (with the user id) or `service_role` | `db/roles.sql` (NOINHERIT), `src/lib/db/pool.ts` |
| Reps see only records linked to deals assigned to them | RLS policies + `app.deal_owner()` / `app.rep_sees_customer()` |
| Only admins can assign, soft-delete, import, export, edit pipelines/rules, manage users | column guards (`a0_guard` triggers) + RLS + checks inside each admin function |
| No hard deletes anywhere | `DELETE` granted to no role, plus a trigger on every table (even the owner) |
| Every audited action is append-only | `audit_log` has no update/delete path for anyone |
| Service role (bypasses RLS) only for website ingestion and the daily job | `src/lib/db/service.ts`; `scripts/check-service-role.mjs` (prebuild) + `import 'server-only'` + `scripts/check-client-bundle.mjs` (postbuild) |
| Strict CSP (per-request nonce), `X-Frame-Options: DENY`, `Referrer-Policy: same-origin`, noindex everywhere | `src/proxy.ts`, `next.config.ts`, `src/app/robots.ts`, the site's `robots.txt` (`Disallow: /crm`) |
| Documents: 15 MB, PDF/JPEG/PNG/WebP/HEIC by **magic bytes**, stored outside the web root (`/var/lib/tkg-crm/documents`, mode 700), served only after an RLS-checked row read, every view/download audited | `src/lib/documents/upload.ts`, `src/app/api/documents/[id]/route.ts`, `src/lib/files/store.ts` |
| Website leads: HMAC-signed, 5-minute window, replay guard; attachments through single-use signed links that expire in 10 minutes | `src/lib/ingest/` |

Two-factor sign-in was removed at the owner's request (2026-10-07).

---

## Local development

Prerequisites: **Node 22**, **Docker Desktop**, and **Git Bash** on Windows
(the database scripts are bash).

```bash
npm install
npm run db:start      # PostgreSQL 17 in Docker on 127.0.0.1:55432, all migrations
npm run db:seed       # owner@crm-local.test (admin) and riya.rep@crm-local.test
```

`.env.local` (gitignored):

```
APP_URL=http://127.0.0.1:3001/crm
DATABASE_URL=postgres://tkg_crm_app:tkg_crm_app_local@127.0.0.1:55432/tkg_crm
CRM_SESSION_SECRET=<48 random bytes, base64>
CRM_INGEST_SECRET=<48 random bytes, base64>
CRON_SECRET=<48 random bytes, base64>
DOCUMENTS_DIR=./.data/documents
```

```bash
npm run dev           # http://127.0.0.1:3001/crm
```

`npm run db:reset` drops and rebuilds the local database. `bash
scripts/db-local.sh psql` opens a superuser shell on it.

### Tests

```bash
npm test              # unit + database tests (need db:start)
npm run test:e2e      # Playwright: 375x812 phone flow + 1280 desktop flow
npm run build         # includes the database-containment and client-bundle checks
```

The strict production CSP is checked against a production build:

```bash
npm run build && cp -r .next/static .next/standalone/.next/
PORT=3002 APP_URL=http://127.0.0.1:3002/crm node --env-file=.env.local .next/standalone/server.js
E2E_PROD_URL=http://127.0.0.1:3002/crm/ npx playwright test e2e/production-csp.spec.ts
```

The test suites **refuse to run against any non-local database**.

---

## Environment variables

On the server they live in `/etc/tkg-crm.env`, written by `scripts/server.sh`
with generated secrets the first time and kept after that. All are server-only.

| Name | What it is |
| --- | --- |
| `APP_URL` | Public address including `/crm` |
| `DATABASE_URL` | The app's own login (`tkg_crm_app`) on the local PostgreSQL. Read only by `src/lib/db/pool.ts` |
| `CRM_DB_PASSWORD`, `CRM_PG_PORT` | That login's password and the cluster's port (server only) |
| `DOCUMENTS_DIR` | Where document files are stored |
| `CRM_SESSION_SECRET` | 32+ random bytes. Keys the login-lockout email hash |
| `CRM_INGEST_SECRET` | HMAC secret shared with the marketing site (same value there) |
| `CRM_INGEST_SECRET_PREVIOUS` | Optional, only during rotation: the old secret, still accepted |
| `CRON_SECRET` | Bearer secret the 08:00 timer sends to `/crm/api/cron/digest` |
| `RESEND_API_KEY`, `DIGEST_FROM_EMAIL` | The daily reminder email. Defaults to the website's Resend key and sender; blank = no email |

---

## Data residency

- **Everything is on the VPS**: the database (PostgreSQL), the accounts and
  password hashes, the sessions and the document files. Where that is depends
  on the VPS provider's data centre; for Canadian residency it should be a
  Canadian region.
- **Email.** The daily reminder digest goes out through **Resend**, which
  **processes data in the United States**. It deliberately carries only
  customer names and days-to-expiry, never phone numbers, addresses, pricing or
  documents. Without a Resend key nothing is emailed.
- **Fonts** are downloaded at build time and served by the CRM itself.
- **Backups** are the server's: see DEPLOY.md.
