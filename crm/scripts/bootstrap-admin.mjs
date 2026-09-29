#!/usr/bin/env node
/**
 * Creates the FIRST admin. There is no public sign-up, so someone has to.
 *
 *   node --env-file=.env.local scripts/bootstrap-admin.mjs --email you@x.ca --name "Your Name"
 *
 * Production: sends a normal invitation email (set password, then MFA).
 * Local stack only: add --password '...' to create a ready-to-use account
 * without email. --password is refused unless SUPABASE_URL is localhost.
 *
 * Refuses to run once any active admin exists; after that, admins invite
 * people from /admin/users, where every change is audited.
 */
import { parseArgs } from 'node:util';
import { createClient } from '@supabase/supabase-js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    password: { type: 'string' },
  },
});

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const appUrl = process.env.APP_URL;
if (!url || !key || !appUrl) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and APP_URL (e.g. node --env-file=.env.local ...).');
  process.exit(1);
}
const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
  console.error('Usage: --email you@example.ca --name "Full Name" [--password ... (local only)]');
  process.exit(1);
}
const local = ['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname);
if (values.password && !local) {
  console.error('--password is only allowed against a local Supabase stack. Production admins set their own password from the invitation.');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const existing = await admin.from('profiles').select('id').eq('role', 'admin').eq('active', true).limit(1);
if (existing.error) {
  console.error(`Could not read profiles: ${existing.error.message}`);
  process.exit(1);
}
if (existing.data.length > 0) {
  console.error('An active admin already exists. Invite people from /admin/users instead.');
  process.exit(1);
}

const created = values.password
  ? await admin.auth.admin.createUser({ email, password: values.password, email_confirm: true, user_metadata: { full_name: name } })
  : await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: name }, redirectTo: `${appUrl}/auth/confirm` });
if (created.error || !created.data.user) {
  console.error(`Could not create the user: ${created.error?.message}`);
  process.exit(1);
}
const userId = created.data.user.id;

const profile = await admin.from('profiles').insert({ id: userId, email, full_name: name, role: 'admin' });
if (profile.error) {
  await admin.auth.admin.deleteUser(userId);
  console.error(`Could not create the profile: ${profile.error.message}`);
  process.exit(1);
}
await admin.auth.admin.updateUserById(userId, { app_metadata: { role: 'admin' } });
await admin.from('audit_log').insert({
  actor_id: null,
  action: 'user.invited',
  entity_type: 'profile',
  entity_id: userId,
  after: { email, full_name: name, role: 'admin' },
  metadata: { bootstrap: true },
});

console.log(
  values.password
    ? `Admin ${email} created. Sign in at ${appUrl}/login - you will be asked to set up two-factor.`
    : `Invitation sent to ${email}. They set a password, then two-factor, on first sign-in.`,
);
