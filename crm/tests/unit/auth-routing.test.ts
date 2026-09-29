import { describe, expect, it } from 'vitest';
import { routeAfterAuth } from '@/lib/auth/types';
import { buildCsp } from '@/lib/csp';
import { newPasswordSchema, otpLinkSchema } from '@/lib/auth/schemas';

describe('routing after sign-in', () => {
  it('sends anyone with an unverified factor to the MFA step', () => {
    expect(routeAfterAuth({ role: 'sales_rep', mfa_ok: false, is_admin: false })).toBe('/login/mfa');
    expect(routeAfterAuth({ role: 'admin', mfa_ok: false, is_admin: false })).toBe('/login/mfa');
  });

  it('forces an admin without MFA to enrol', () => {
    expect(routeAfterAuth({ role: 'admin', mfa_ok: true, is_admin: false })).toBe('/mfa/enroll');
  });

  it('lets a rep without MFA in (prompted, not forced)', () => {
    expect(routeAfterAuth({ role: 'sales_rep', mfa_ok: true, is_admin: false })).toBe('/dashboard');
    expect(routeAfterAuth({ role: 'admin', mfa_ok: true, is_admin: true })).toBe('/dashboard');
  });
});

describe('content security policy', () => {
  const csp = buildCsp('abc123', 'https://proj.supabase.co', false);

  it('allows scripts only by nonce and forbids framing', () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('names only the Supabase project as a third-party origin', () => {
    expect(csp).toContain('connect-src \'self\' https://proj.supabase.co');
    expect(csp.match(/https:\/\/[^\s;]+/g)?.every((origin) => origin === 'https://proj.supabase.co')).toBe(true);
  });
});

describe('auth input validation', () => {
  it('enforces the password policy from config.toml', () => {
    expect(newPasswordSchema.safeParse({ password: 'short1A', confirm: 'short1A' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: 'alllowercase123', confirm: 'alllowercase123' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: 'Correct-Horse-9', confirm: 'Correct-Horse-8' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: 'Correct-Horse-9', confirm: 'Correct-Horse-9' }).success).toBe(true);
  });

  it('accepts only invite and recovery links', () => {
    expect(otpLinkSchema.safeParse({ token_hash: 'pkce_abcdef1234567890', type: 'recovery' }).success).toBe(true);
    expect(otpLinkSchema.safeParse({ token_hash: 'pkce_abcdef1234567890', type: 'signup' }).success).toBe(false);
    expect(otpLinkSchema.safeParse({ token_hash: '../../etc/passwd', type: 'invite' }).success).toBe(false);
  });
});
