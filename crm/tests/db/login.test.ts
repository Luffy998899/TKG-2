import { inject, describe, expect, it } from 'vitest';
import { passwordLogin } from '@/lib/auth/login';
import { loginEmailHash } from '@/lib/auth/email-hash';
import { resolveSessionToken } from '@/lib/auth/session-core';
import { adminSql, createAuthOnlyUser, createStaff, serviceClient, testIp } from '../helpers/stack';

const secret = () => inject('db').sessionSecret;
const login = (email: string, password: string, ip = testIp()) =>
  passwordLogin({ email, password }, { ip, userAgent: 'vitest' }, secret());

describe('password sign-in', () => {
  it('signs a rep in: a session row, a token that resolves to them, and an audit row', async () => {
    const rep = await createStaff('sales_rep');
    const result = await login(rep.email, rep.password);
    expect(result).toMatchObject({ ok: true, userId: rep.id });
    if (!result.ok) throw new Error('login failed');
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect((await resolveSessionToken(result.token)).userId).toBe(rep.id);
    const audit = await serviceClient().from('audit_log').select('action').eq('entity_id', rep.id);
    expect(audit.data).toContainEqual({ action: 'auth.login_success' });
  });

  it('lets an admin straight in (no two-factor step)', async () => {
    const admin = await createStaff('admin');
    expect(await login(admin.email, admin.password)).toMatchObject({ ok: true, userId: admin.id });
  });

  it('stores only a hash of the session token, and a bcrypt hash of the password', async () => {
    const rep = await createStaff('sales_rep');
    const result = await login(rep.email, rep.password);
    if (!result.ok) throw new Error('login failed');
    const { rows } = await adminSql().query<{ token_hash: string; password_hash: string }>(
      'select s.token_hash, u.password_hash from auth.sessions s join auth.users u on u.id = s.user_id where u.id = $1',
      [rep.id],
    );
    expect(rows[0]!.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.token_hash).not.toContain(result.token);
    expect(rows[0]!.password_hash).toMatch(/^\$2[aby]\$12\$/);
  });

  it('gives the same answer for a wrong password, an unknown email, and an account with no profile', async () => {
    const rep = await createStaff('sales_rep');
    const orphan = await createAuthOnlyUser();
    expect(await login(rep.email, 'Wrong-Password-1')).toEqual({ ok: false, reason: 'invalid' });
    expect(await login('nobody@crm-test.local', 'Wrong-Password-1')).toEqual({ ok: false, reason: 'invalid' });
    expect(await login(orphan.email, orphan.password)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('locks an email after 5 failures, even for the right password', async () => {
    const rep = await createStaff('sales_rep');
    for (let i = 0; i < 5; i += 1) {
      expect(await login(rep.email, `Wrong-Password-${i}`)).toEqual({ ok: false, reason: 'invalid' });
    }
    const locked = await login(rep.email, rep.password);
    expect(locked).toMatchObject({ ok: false, reason: 'locked' });
    if (!locked.ok) expect(locked.retryAfterSeconds).toBeGreaterThan(800);

    const audit = await adminSql().query<{ action: string }>(
      "select action from public.audit_log where metadata->>'email_hash' = $1",
      [loginEmailHash(rep.email, secret())],
    );
    expect(audit.rows.filter((row) => row.action === 'auth.login_failure')).toHaveLength(5);
    expect(audit.rows).toContainEqual({ action: 'auth.lockout' });
  });

  it('locks an IP after 20 failures across any accounts', async () => {
    const ip = testIp();
    for (let i = 0; i < 20; i += 1) {
      await login(`spray-${i}@crm-test.local`, 'Wrong-Password-1', ip);
    }
    const rep = await createStaff('sales_rep');
    expect(await login(rep.email, rep.password, ip)).toMatchObject({ ok: false, reason: 'locked' });
    expect(await login(rep.email, rep.password)).toMatchObject({ ok: true });
  });

  it('never stores the email in the attempts table', async () => {
    const rep = await createStaff('sales_rep');
    await login(rep.email, 'Wrong-Password-1');
    const rows = await serviceClient().from('login_attempts').select('*').eq('email_hash', loginEmailHash(rep.email, secret()));
    expect(rows.data).toHaveLength(1);
    expect(JSON.stringify(rows.data)).not.toContain(rep.email);
  });
});

describe('sessions', () => {
  it('ends an idle or over-12-hour session in the database, and says why', async () => {
    const rep = await createStaff('sales_rep');
    const admin = await createStaff('admin');
    const repLogin = await login(rep.email, rep.password);
    const adminLogin = await login(admin.email, admin.password);
    if (!repLogin.ok || !adminLogin.ok) throw new Error('login failed');

    // Admin idle limit is 30 minutes, a rep's 2 hours.
    await adminSql().query("update auth.sessions set last_seen_at = now() - interval '31 minutes' where user_id in ($1, $2)", [rep.id, admin.id]);
    expect((await resolveSessionToken(repLogin.token)).userId).toBe(rep.id);
    expect(await resolveSessionToken(adminLogin.token)).toMatchObject({ userId: null, ended: 'idle' });

    await adminSql().query("update auth.sessions set created_at = now() - interval '13 hours' where user_id = $1", [rep.id]);
    expect(await resolveSessionToken(repLogin.token)).toMatchObject({ userId: null, ended: 'absolute' });
    // Gone for good: the same token now finds nothing at all.
    expect(await resolveSessionToken(repLogin.token)).toEqual({ userId: null, tokenHash: null, ended: null });
  });
});
