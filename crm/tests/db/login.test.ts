import { inject, describe, expect, it } from 'vitest';
import { passwordLogin } from '@/lib/auth/login';
import { loginEmailHash } from '@/lib/auth/email-hash';
import { cookieClient, createAuthOnlyUser, createStaff, serviceClient, signIn, enrollTotp, testIp } from '../helpers/stack';

const secret = () => inject('stack').sessionSecret;
const login = (email: string, password: string, ip = testIp()) =>
  passwordLogin(cookieClient().client, { email, password }, { ip, userAgent: 'vitest' }, secret());

describe('password sign-in', () => {
  it('signs a rep in and sets HttpOnly session cookies', async () => {
    const rep = await createStaff('sales_rep');
    const { client, jar } = cookieClient();
    const result = await passwordLogin(client, rep, { ip: testIp(), userAgent: 'vitest' }, secret());
    expect(result).toMatchObject({ ok: true, userId: rep.id, next: '/dashboard' });
    expect(jar.size).toBeGreaterThan(0);
    const audit = await serviceClient().from('audit_log').select('action').eq('entity_id', rep.id);
    expect(audit.data).toContainEqual({ action: 'auth.login_success' });
  });

  it('lets an admin without MFA straight in, and sends anyone with MFA to the code step', async () => {
    const admin = await createStaff('admin');
    expect(await login(admin.email, admin.password)).toMatchObject({ ok: true, next: '/dashboard' });

    const rep = await createStaff('sales_rep');
    await enrollTotp(await signIn(rep), rep);
    expect(await login(rep.email, rep.password)).toMatchObject({ ok: true, next: '/login/mfa' });
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

    const audit = await serviceClient()
      .from('audit_log')
      .select('action')
      .eq('metadata->>email_hash', loginEmailHash(rep.email, secret()));
    expect(audit.data?.filter((row) => row.action === 'auth.login_failure')).toHaveLength(5);
    expect(audit.data).toContainEqual({ action: 'auth.lockout' });
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
