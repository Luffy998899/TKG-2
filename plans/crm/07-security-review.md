# TKG CRM — Phase 7 security self-review

Date: 2026-09-29. Scope: `crm/` (all phases) and the marketing-site changes
(`src/app/api/inquiry/route.ts` + the approved attachment and SEO work).
Everything below was run against the **local** Supabase stack only.

Results of the final run:

| Check | Result |
| --- | --- |
| CRM typecheck / lint | clean / clean |
| CRM Vitest: unit + local-stack database tests | **173 passed** (36 unit, 137 DB) |
| pgTAP structural checks inside Postgres | **20/20** |
| Playwright: 375×812 phone flow + 1280 desktop flow | **2 passed** (production-CSP spec is opt-in, see below) |
| Production-build CSP scan (11 screens × phone + desktop) | **passed**: zero violations, no server-rendered `style=` |
| `next build` with prebuild service-role check + postbuild bundle scan | clean |
| Marketing site: typecheck, lint, production build | clean |
| Marketing site: `node --test` (CRM forward + attachments) | **14 passed** |

---

## Every item in `<security_requirements>`

| Requirement | How it is met | Evidence |
| --- | --- | --- |
| Roles `admin`, `sales_rep`; enum extensible to `manager` | `public.app_role` enum; `ALTER TYPE … ADD VALUE 'manager'` needs no rewrite | migration `…120000_foundation.sql` |
| No public sign-up; users only via admin invite | `[auth] enable_signup = false`; invite only through `src/lib/admin/users.ts` | `tests/db/anon.test.ts` "cannot sign up" |
| Deactivated users lose access immediately | Every policy goes through `app.current_user_id()`, which re-reads `profiles.active`; deactivation also deletes the user's sessions and bans them | `tests/db/user-admin.test.ts` (same token reads 0 rows, refresh fails, password refused); pgTAP |
| RLS on EVERY table, default deny | RLS enabled in a loop over all tables; nothing granted to `anon`; `authenticated` gets per-table grants | pgTAP: RLS on all 24 tables, no anon grants, views `security_invoker`; `anon.test.ts` over every table and view |
| Reps: only records linked to their assigned deals; own commissions | Policies via `app.deal_owner()` / `app.rep_sees_customer()`; commissions `rep_id = self` | `access.test.ts`, `workflow.test.ts`, `reports.test.ts`, pgTAP role simulation |
| Only admin can assign / delete (soft only) / import / export / edit pipelines & rules / manage users / view other reps' numbers | Column guards (`a0_guard` triggers) + admin-only policies + `requireAdmin()`; no DELETE grant anywhere and a no-delete trigger on every table | `access.test.ts` (assign, delete, pipelines, rules, stages, commissions), `import.test.ts`, `user-admin.test.ts`, `reports.test.ts` (leaderboard), E2E (export 404 for rep) |
| No hard deletes anywhere | DELETE revoked from every API role; `a0_no_delete` trigger on every table (even owner and service role) except the audited retention job | pgTAP (no DELETE grant, trigger on every table, owner delete raises); `access.test.ts` (service-role delete refused) |
| Service-role key only in server code, build fails otherwise | Read only in `src/lib/supabase/service-role.ts` (`import 'server-only'`), imported only by 3 allow-listed modules; `check-service-role` (prebuild) + `check-client-bundle` (postbuild, scans for name and value) + ESLint rule | `tests/unit/check-service-role.test.ts` (4 planted violations caught); final `grep` below |
| MFA (TOTP) mandatory for admins; available and prompted for reps | **Changed 2026-09-29 by owner decision: optional for everyone.** Anyone who turns it on must enter the code before any right applies (`app.mfa_ok()`); the dashboard prompts everyone without it | `access.test.ts` (admin without MFA has rights; with MFA at aal1 sees nothing), `login.test.ts`, pgTAP, E2E desktop |
| Session idle timeout | Signed HttpOnly cookie: admin 30 min idle, rep 2 h idle, 12 h absolute (Q7); Supabase time-box 12 h in production | `tests/unit/session-meta.test.ts` |
| Login rate limiting / lockout | `login_check` / `login_record` in the DB: 5 per email, 20 per IP per 15 min; the Supabase key is server-only, so Auth cannot be called around it; TOTP failures count too | `login.test.ts` (email lockout, IP lockout, audit rows, no email stored) |
| Password reset via email only | `/forgot-password` → email link → `/auth/confirm` (POST) → set password; no admin "set password" exists | code review; flows exercised in the browser in Phase 1 |
| Documents: private bucket, signed URLs ≤ 60 s after an RLS-checked query | Bucket `public = false`; no storage policy except read/write tied to a `documents` row the caller may see; `createSignedUrl(path, 60)` runs as the user after the row query | `access.test.ts` (Rep A refused Rep B's URL), pgTAP (bucket private, 15 MB) |
| Validate MIME and size (≤ 15 MB) server-side | Bucket limits + **magic-byte sniffing** before a document becomes visible, for both manual uploads and website attachments | `ingest.test.ts` (exe renamed .pdf rejected, late upload rejected), `ingest-units.test.ts` |
| Audit log: logins, exports, deletions, role changes, assignment changes, document downloads | `audit_log` (append-only for everyone); written by triggers or definer functions that stamp the actor | `login.test.ts`, `user-admin.test.ts`, `access.test.ts` (soft delete), `workflow.test.ts` (assignment), E2E desktop (export), `expiry.test.ts` (end-date change), `import.test.ts` |
| Strict CSP, HSTS, X-Frame-Options DENY, Referrer-Policy, noindex everywhere, robots disallow | Per-request nonce CSP (scripts `strict-dynamic`, styles nonce-only in production); HSTS 2 years + preload; XFO DENY + `frame-ancestors 'none'`; `Referrer-Policy: same-origin` (see note 1); `X-Robots-Tag` + meta robots; `robots.txt Disallow: /` | `auth-routing.test.ts` (CSP), production-CSP scan, header checks in Phase 1 |
| All input validated with zod on the server | Every server action and route handler parses with zod before doing anything | code review of `src/lib/**/actions.ts`, `src/lib/ingest/ingest.ts` |
| No secrets in the repo; every env var documented | `.env*` ignored except `.env.example` (placeholders only) | `git grep` for key-shaped strings: only placeholders |
| Data-residency note | `crm/README.md` → Data residency | — |

**Note 1, Referrer-Policy.** Phase 1 used `no-referrer`. The Playwright run
showed that browsers then send `Origin: null` on ordinary form POSTs, which
made the logout CSRF check refuse the real Sign out button. It is now
`same-origin`. The Referer header still never leaves for third parties such as
WhatsApp links or Supabase, which is what the policy is for.

---

## The `<acceptance_tests>`

| Acceptance test | Status | Where |
| --- | --- | --- |
| Unauthenticated request cannot read any table | ✅ | `tests/db/anon.test.ts` (24 tables + 2 views + RPCs + storage) and pgTAP |
| Rep A cannot read, update, or get a signed URL for Rep B's customer, deal, or document | ✅ | `tests/db/access.test.ts` |
| A sales_rep cannot assign, import, export, delete, or read another rep's commission | ✅ | `access.test.ts`, `import.test.ts`, `e2e/rep-call-flow.spec.ts` (export 404) |
| Ingestion rejects a bad signature, a stale timestamp, and a replay; the same valid submission twice creates one deal | ✅ | `tests/db/ingest.test.ts` |
| Expiry job run twice on the same day creates each milestone task exactly once | ✅ | `tests/db/expiry.test.ts` |
| Playwright at 375×812: login → open a lead → log a call note → move to Contacted → see it in the timeline | ✅ | `e2e/rep-call-flow.spec.ts` (also asserts ≥ 48 px touch targets) |
| `grep` for the service-role env var finds it only in server-only files | ✅ | see below |
| A careers application submitted on the website never creates a CRM record | ✅ | site: `scripts/test-crm-forward.test.mjs` (no request made); CRM: `ingest.test.ts` (422, nothing written); manual end-to-end run in Phase 2 |
| The daily digest run twice on the same day sends each rep at most one email | ✅ | `tests/db/expiry.test.ts` (twice concurrently + once more) |

`grep -rl SUPABASE_SERVICE_ROLE_KEY crm` (excluding `node_modules`, `.next`, the gitignored `.env.local`):

```
.env.example                    placeholder
DEPLOY.md, README.md            documentation
scripts/bootstrap-admin.mjs     one-off CLI, never bundled
scripts/check-client-bundle.mjs the build check itself
src/lib/supabase/service-role.ts  THE ONLY runtime reader (import 'server-only')
tests/setup/env.ts              test harness, local stack only
```

---

## Bugs this review and the test runs caught (all fixed)

| Found by | Problem | Fix |
| --- | --- | --- |
| pgTAP | `anon` had EXECUTE on internal `app.*` functions (PostgreSQL's PUBLIC default; a per-schema revoke cannot remove it) | Global default-privilege revoke + an explicit sweep in every migration |
| Browser | A form submitted before hydration fell back to GET and put the password in the URL | Every form `method="post"`, submit disabled until hydrated |
| Supabase CLI | `[auth.email] enable_signup = false` disabled email login entirely | Two switches documented; a test proves public sign-up is still refused |
| Ingestion test | Two retries in the same second signed identically → 409 replay → the site would tag a delivered lead `[NOT IN CRM]` | Per-attempt nonce in the signed body |
| DB tests | `v_missing \|\| 'text'` parsed as an array literal; CASE text → enum without a cast | `array_append`; explicit cast |
| Browser | zod 4 `record(enum)` requires every key, which broke the CSV mapping | `partialRecord` |
| Playwright | Header wordmark was a 28 px touch target | 48 px target |
| Playwright | `Referrer-Policy: no-referrer` → `Origin: null` → logout refused | `same-origin` + `Sec-Fetch-Site` check |
| Production CSP scan | Pipeline colours in an inline `<style nonce>` were blocked after client-side navigation (a new request's nonce); Radix's scroll-lock `<style>` had no nonce | Same-origin `/pipeline-styles.css`; nonce handed to runtime style injection |
| Site build | The site's `tsconfig` type-checked `/crm`, which would have failed the site's next deploy | `"exclude": ["node_modules", "crm"]` (approved) |

---

## Residual risks and limits (known and accepted, or for you to decide)

1. **Data outside Canada.**
   - Vercel's edge network and platform logs are US-operated; functions are pinned to `yul1`.
   - Resend (the digest email) processes in the US. The digest carries customer names and days to expiry only.
   - The marketing site's own notification emails (full inquiry content) also go through Resend.
2. **Signed upload URLs from Storage last 2 hours** and cannot be shortened.
   - Mitigations: each URL can be written once (`KeyAlreadyExists`), and the CRM rejects anything arriving outside its own 10-minute window.
3. **Development mode relaxes `style-src`** for Next's error overlay. Production is nonce-only, which the production-CSP spec verifies.
4. **Soft-deleted records have no "restore" screen.** An admin restores through SQL (`update … set deleted_at = null`), which is audited as `record.restored`.
5. **Staff names are visible to all staff** (timelines, `staff_directory`). No other staff fields are.
6. **Forgot-password throttling** relies on Supabase's email rate limits; the CRM's own lockout covers sign-in and TOTP.
7. **MFA recovery** (lost phone) is done in the Supabase dashboard by removing the factor. There is no self-service backup code.
8. **Staged import rows hold personal data for up to 30 days** (Q13 retention) before the daily job deletes them.
9. **The marketing site runs `next@14.2.15`,** which npm flags with a published advisory. A separate upgrade task was suggested.
10. **Tests run only against the local stack.** After `supabase db push` to production, run the pgTAP suite there once (read-only checks) and walk through DEPLOY.md step 5.
