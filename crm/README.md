# TKG CRM

The customer and sales CRM for TKG Ventures Ltd, at `crm.tkgventuresltd.ca`.
It is used mostly on phones by sales reps and an admin, and it holds Canadian
customers' personal information. **A data leak is the worst possible outcome.**
Every design choice below follows from that.

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui on Vercel, with
Supabase (Postgres, Auth, private Storage) in **ca-central-1**. This is a
separate app from the marketing site in the repository root. It shares no
code, no environment variables and no Vercel project with it.

The build plan, the table design, the access matrix and every decision are in
[`../plans/crm/00-plan.md`](../plans/crm/00-plan.md).

---

## Security model, in one screen

| Control | Where it is enforced |
| --- | --- |
| No public sign-up; users exist only by admin invitation | `supabase/config.toml` (`enable_signup = false`), `/admin/users` |
| Row level security on **every** table, default deny | `supabase/migrations/*_rls.sql`; pgTAP fails if a table lacks it |
| Reps see only records linked to deals assigned to them | RLS policies + `app.deal_owner()` / `app.rep_sees_customer()` |
| Admin rights need an **MFA-verified (aal2)** session | `app.is_admin()` checks `aal`; admins are forced to enrol |
| Deactivation is immediate | every policy re-reads `profiles.active`; sessions are deleted and the user is banned |
| No hard deletes anywhere | `DELETE` granted to no role, plus a trigger on every table (even the service role) |
| Only admins can assign, soft-delete, import, export, edit pipelines/rules, manage users | column guards (`a0_guard` triggers) + RLS |
| Every audited action is append-only | `audit_log` has no update/delete path for anyone |
| The browser never talks to Supabase's API | the Supabase keys are **server-only** (no `NEXT_PUBLIC_`), so login lockout cannot be bypassed |
| Login lockout: 5 failures per email / 20 per IP in 15 min | `login_check` / `login_record` in the database, called before Auth sees the password |
| Session idle timeout (admin 30 min, rep 2 h), 12 h absolute | signed HttpOnly cookie checked in `src/proxy.ts` |
| Service-role key only in allow-listed server modules | `scripts/check-service-role.mjs` (prebuild) + `import 'server-only'` + `scripts/check-client-bundle.mjs` (postbuild) |
| Strict CSP (per-request nonce), HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, noindex everywhere | `src/proxy.ts`, `next.config.ts`, `src/app/robots.ts` |
| Documents: private bucket, 15 MB, PDF/JPEG/PNG/WebP/HEIC only, ≤60 s signed URLs after an RLS check | `*_storage.sql`; every upload is magic-byte checked before it is listed (`src/lib/files/sniff.ts`) |

The service role is used by exactly three modules, and the build fails if a
fourth appears:

- `src/lib/admin/users.ts`: inviting, role changes, deactivation (approved
  decision Q2). Every call re-verifies that the caller is an active admin on
  an aal2 session, and writes an audit row even when it refuses.
- `src/lib/ingest/ingest.ts`: website leads, only after the HMAC signature,
  5-minute window and replay checks.
- `src/lib/cron/digest.ts`: the daily job, only with the `CRON_SECRET` bearer.

---

## Local development

Prerequisites: **Node 22**, and **Docker Desktop** for the local Supabase stack.
On Windows 11 Home, Docker Desktop needs WSL 2: run `wsl --install --no-distribution`
in an admin terminal, then reboot.

```bash
npm install
npm run db:start          # local Postgres/Auth/Storage in Docker (first run downloads images)
npx supabase status -o env
```

Create `.env.local` from `.env.example`:

- `APP_URL=http://127.0.0.1:3001`
- `SUPABASE_URL` from `API_URL`
- `SUPABASE_PUBLISHABLE_KEY` from `PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` from `SECRET_KEY`
- a random `CRM_SESSION_SECRET`

Then create the first admin and start the app:

```bash
npm run bootstrap:admin -- --email you@example.ca --name "Your Name" --password "Local-Only-Pass-1"
npm run dev               # open http://127.0.0.1:3001 (not localhost)
```

Use `127.0.0.1`, not `localhost`. Auth email links point to `127.0.0.1`, and
session cookies are per-host.

`--password` works only against the local stack. You will be asked to set up
two-factor on first sign-in.

Invitation and password-reset emails sent locally land in Mailpit at
<http://127.0.0.1:54324>.

Migrations run **only against the local stack**:

```bash
npm run db:reset          # re-applies supabase/migrations from scratch
```

### Tests

```bash
npm test                  # unit + database tests (database tests need db:start)
npm run test:db           # pgTAP: structural security checks inside Postgres
npm run test:e2e          # Playwright: 375x812 phone flow + 1280 desktop flow
npm run build             # includes the service-role and client-bundle checks
```

The strict production CSP can only be checked against a production build:

```bash
npm run build && npx next start --port 3002
E2E_PROD_URL=http://127.0.0.1:3002 npx playwright test e2e/production-csp.spec.ts
```

The database tests read the local stack from `supabase status` and **refuse
to run against any non-localhost Supabase URL**.

---

## Environment variables

All are server-only. None is `NEXT_PUBLIC_`. Placeholders are in `.env.example`.

| Name | What it is |
| --- | --- |
| `APP_URL` | Public origin of the CRM, used in auth email links |
| `SUPABASE_URL` | Supabase project URL (ca-central-1) |
| `SUPABASE_PUBLISHABLE_KEY` | Publishable (anon) key. Kept on the server on purpose |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key. Bypasses RLS. Read only by `src/lib/supabase/service-role.ts` |
| `CRM_SESSION_SECRET` | 32+ random bytes. Signs the session-timing cookie and keys login-lockout hashes |
| `CRM_INGEST_SECRET` | HMAC secret shared with the marketing site (same value there). 32+ characters |
| `CRM_INGEST_SECRET_PREVIOUS` | Optional, only during rotation: the old secret, still accepted |
| `CRON_SECRET` | Bearer secret Vercel Cron sends to `/api/cron/digest`. 32+ characters |
| `RESEND_API_KEY` | A CRM-only Resend key (sending access only) for the daily digest |
| `DIGEST_FROM_EMAIL` | Digest sender, on a domain verified in Resend |

---

## Production settings (done by hand; the full guide comes in Phase 7)

Nothing in this repository touches a hosted Supabase project or Vercel. These
steps are for the owner.

**Supabase project**:
- Region **ca-central-1**, **Pro** plan (daily backups; the free tier pauses).
- Apply migrations with `npx supabase link` and `npx supabase db push`.
- Auth → Providers: the **Email provider stays enabled** (it is how staff sign in). **"Allow new users to sign up" off**. Anonymous sign-ins off. In the CLI config these are two different switches (`[auth] enable_signup = false`, `[auth.email] enable_signup = true`); turning off the second one disables email login entirely.
- Auth → Password: minimum 12 characters; lower, upper case and digits required; leaked-password protection on.
- Auth → MFA: TOTP enabled.
- Auth → Sessions: **time-box 12 hours**; access-token (JWT) expiry 900 seconds.
- Auth → URL configuration: Site URL `https://crm.tkgventuresltd.ca`; redirect allow-list `https://crm.tkgventuresltd.ca/auth/confirm`.
- Auth → Email templates: paste `supabase/templates/invite.html` and `recovery.html`. Their links carry a `token_hash` to `/auth/confirm`.
- Auth → SMTP: a custom SMTP sender. Supabase's built-in sender is for testing only and heavily rate-limited.
- API → Exposed schemas: `public` only. (GraphQL is removed by migration.)

**Vercel project `tkg-crm`**:
- Root Directory `crm`, Node 22.
- Function region **`yul1` (Montréal)**.
- The environment variables above, **not shared** with the marketing site's project.
- **Pro plan**: Hobby is for non-commercial use.

**DNS:** CNAME `crm` → Vercel.

**Lost authenticator:** an admin removes the user's MFA factor in the Supabase dashboard (Auth → Users), and the user enrols again at next sign-in.

---

## Data residency

- **Supabase: `ca-central-1` (Montréal, Canada).** All customer data lives here: the database, the auth users and the document files.
- **Vercel:** serverless functions are pinned to `yul1` (Montréal). Vercel is a US company. Requests may pass through its global edge network, and its platform logs and metadata are processed in the US.
- **Email.** Auth emails (invites, password resets) go out through the SMTP provider configured in Supabase. From Phase 4, a daily digest goes out through **Resend**, which **processes data in the United States**. The digest deliberately carries only customer names and days-to-expiry, never phone numbers, addresses, pricing or documents.
- **Fonts** (Archivo, Inter) are downloaded at build time and served from the CRM itself, so there are no runtime requests to Google.
- The marketing site's existing Resend notifications (full inquiry content) are a separate system and are outside this app.
