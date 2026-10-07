import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildCsp } from '@/lib/csp';
import { BASE_PATH } from '@/lib/base-path';
import { changePasswordSchema, passwordRule } from '@/lib/auth/schemas';
import { hashToken, newSessionToken, sessionCookieOptions } from '@/lib/auth/session-core';

describe('content security policy', () => {
  const csp = buildCsp('abc123', false);

  it('allows scripts only by nonce and forbids framing', () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('allows no third-party origin at all', () => {
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toMatch(/https?:\/\//);
  });
});

describe('password policy (same as app.password_ok in the database)', () => {
  it('needs 12+ characters with upper, lower and a digit', () => {
    expect(passwordRule.safeParse('short1A').success).toBe(false);
    expect(passwordRule.safeParse('alllowercase123').success).toBe(false);
    expect(passwordRule.safeParse('ALLUPPERCASE123').success).toBe(false);
    expect(passwordRule.safeParse('No-Digits-Here-At-All').success).toBe(false);
    expect(passwordRule.safeParse('Correct-Horse-9').success).toBe(true);
  });

  it('needs the new password typed twice, the same', () => {
    expect(changePasswordSchema.safeParse({ current: 'x', password: 'Correct-Horse-9', confirm: 'Correct-Horse-8' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ current: 'x', password: 'Correct-Horse-9', confirm: 'Correct-Horse-9' }).success).toBe(true);
  });
});

describe('session cookie', () => {
  it('is a random 256-bit token; only its SHA-256 is ever stored', () => {
    const token = newSessionToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newSessionToken()).not.toBe(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is HttpOnly, SameSite=Lax, scoped to the CRM path, and lasts at most 12 hours', () => {
    expect(sessionCookieOptions).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/crm', maxAge: 12 * 60 * 60 });
  });
});

describe('base path', () => {
  it('matches next.config.ts', () => {
    const config = readFileSync(join(__dirname, '..', '..', 'next.config.ts'), 'utf8');
    expect(config).toContain(`basePath: '${BASE_PATH}'`);
    expect(BASE_PATH).toBe('/crm');
  });
});

describe('database wire formats', () => {
  it('turns timestamptz text into ISO strings, in any offset, and leaves odd values alone', async () => {
    const { isoTimestamptz } = await import('@/lib/db/pool');
    expect(isoTimestamptz('2026-10-07 14:03:09.123456+00')).toBe('2026-10-07T14:03:09.123Z');
    expect(isoTimestamptz('2026-10-07 07:03:09-07')).toBe('2026-10-07T14:03:09.000Z');
    expect(isoTimestamptz('2026-10-07 19:33:09.5+05:30')).toBe('2026-10-07T14:03:09.500Z');
    expect(isoTimestamptz('infinity')).toBe('infinity');
  });
});
