# Deploying TKG CRM

Every step here is done **by the owner**, in the Supabase and Vercel dashboards
and at the DNS provider. Nothing in this repository talks to a hosted project.
Follow the steps in order: the CRM must be fully configured before the
marketing site starts sending leads to it.

---

## 1. Supabase project (Canada)

1. **Create the project.** At supabase.com, choose region **Canada (Central), `ca-central-1`**. Use the **Pro** plan: it has daily backups, and free projects pause when idle.
2. **Keep the database password** in a password manager. You need it once, for `db push`.
3. **Apply the migrations** from your computer, in `crm/`:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   This creates every table, access policy, trigger, function, the private `crm-documents` bucket, the seed pipelines and stages, and the two pg_cron jobs (expiry engine 07:00 Vancouver, retention 03:00).
4. **Authentication → Sign In / Providers:**
   - **Email provider: enabled.** Staff sign in with email and password.
   - **Allow new users to sign up: OFF.** Accounts exist only by invitation.
   - Anonymous sign-ins: off. Every other provider: off.
   - Confirm email: on. Secure email change: on.
5. **Authentication → Passwords:** minimum length **12**; require lowercase, uppercase and digits; **leaked-password protection: on**.
6. **Authentication → Multi-Factor:** TOTP **enabled** (enroll and verify).
7. **Authentication → Sessions:** time-box user sessions **12 hours**; access-token (JWT) expiry **900 seconds**. Refresh-token rotation: on.
8. **Authentication → URL Configuration:**
   - Site URL: `https://crm.tkgventuresltd.ca`
   - Redirect URLs: `https://crm.tkgventuresltd.ca/auth/confirm`
9. **Authentication → Emails → SMTP:** set a real sender (for example Resend SMTP with a CRM-only key). Supabase's built-in mailer is for testing and allows only a few emails an hour.
10. **Authentication → Emails → Templates:** paste `supabase/templates/invite.html` into *Invite user* and `supabase/templates/recovery.html` into *Reset password*. Their links go to `/auth/confirm` with a token hash. The link is only used when the person presses **Continue**, so a mail scanner opening it can't burn it.
11. **API settings:** exposed schemas are **`public` only**. GraphQL is dropped by the migrations.
12. **Keys (Project Settings → API keys):** copy the **publishable** key and a **secret** key. The secret key bypasses row-level security: store it only in the Vercel environment below.

## 2. Vercel project for the CRM

1. **Create the project.** Add a new Vercel project from this repository and name it **`tkg-crm`**.
   - **Root Directory: `crm`.**
   - Framework: Next.js. Node.js: **22**.
   - Plan: **Pro**. Hobby is for non-commercial use, and its cron timing is loose.
   - Function region: `vercel.json` pins **`yul1` (Montréal)**. Check it under Settings → Functions.
2. **Environment variables** (Production). None of these is shared with the marketing site's project:

   | Name | Value |
   | --- | --- |
   | `APP_URL` | `https://crm.tkgventuresltd.ca` |
   | `SUPABASE_URL` | the project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | secret key |
   | `CRM_SESSION_SECRET` | 48 random bytes, base64 |
   | `CRM_INGEST_SECRET` | 48 random bytes, base64 (also goes on the site, step 4) |
   | `CRON_SECRET` | 48 random bytes, base64 |
   | `RESEND_API_KEY` | a **CRM-only** Resend key, "Sending access" |
   | `DIGEST_FROM_EMAIL` | e.g. `TKG CRM <crm@tkgventuresltd.ca>` (domain verified in Resend) |

   Generate each secret with:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
   ```
3. **Deploy.** The build runs `check-service-role` before and `check-client-bundle` after, and fails if the secret key could reach a browser.
4. **Crons:** `vercel.json` registers `/api/cron/digest` at 15:00 and 16:00 UTC. One of those is 08:00 in Vancouver, depending on daylight time; the other exits early. Vercel sends the `CRON_SECRET` automatically.

## 3. DNS

Add a **CNAME** for `crm.tkgventuresltd.ca` pointing to Vercel (the value Vercel shows under Settings → Domains). HSTS is on, so the CRM is only ever served over HTTPS.

## 4. The first admin

From your computer, in `crm/`, create `.env.production.local` containing only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `APP_URL` (production values). Then run:

```bash
node --env-file=.env.production.local scripts/bootstrap-admin.mjs --email you@tkgventuresltd.ca --name "Your Name"
```

**Delete that file straight away.** You'll get an invitation email: set a password. Two-factor is optional; turn it on under **Settings → Security**. Invite everyone else from **Users** in the CRM. The script refuses to run once an active admin exists.

## 5. Connect the marketing site

Only after steps 1–4 work:

1. On the marketing site's server (the VPS), add to `/etc/tkg-ventures.env`:
   ```
   CRM_INGEST_URL=https://crm.tkgventuresltd.ca/api/ingest/lead
   CRM_INGEST_SECRET=<the same value as the CRM's CRM_INGEST_SECRET>
   ```
2. Run `sudo ./update.sh`.
3. Submit a test inquiry on a division page. It should appear under **Leads** as a New Lead within seconds. If the CRM is ever down, the notification email's subject starts with **`[NOT IN CRM]`**, so you know to enter that lead by hand.

## 6. After go-live

- **Assign the fallback admin:** *Pipelines & rules → Unassigned contract reminders go to*.
- **Set the commission rules** per pipeline. Every pipeline starts at $0.
- **Rotate a secret:** put the old value in `CRM_INGEST_SECRET_PREVIOUS` and a new one in `CRM_INGEST_SECRET` on the CRM, deploy, update the site, then remove the previous value.
- **Deactivate a leaver** from **Users**. Their access ends on their next request.
- **A staff member loses their phone:** remove their MFA factor in Supabase (Authentication → Users → the user → Factors). They enrol again at next sign-in.
- **Backups:** Supabase Pro takes daily backups. Consider point-in-time recovery.
- **Migrations:** only ever through `npx supabase db push` from reviewed commits. Never edit the production schema in the dashboard.
