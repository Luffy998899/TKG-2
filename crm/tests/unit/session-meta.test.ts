import { describe, expect, it } from 'vitest';
import {
  ABSOLUTE_LIMIT_MS,
  IDLE_LIMIT_MS,
  decodeSessionMeta,
  encodeSessionMeta,
  sessionExpiry,
} from '@/lib/session-meta';

const SECRET = 'unit-test-secret-unit-test-secret-0123';
const USER = '11111111-1111-4111-8111-111111111111';
const T0 = 1_790_000_000_000;

describe('session timing (Q7)', () => {
  it('round-trips a signed cookie', () => {
    const meta = { userId: USER, startedAt: T0, seenAt: T0 + 5 };
    expect(decodeSessionMeta(encodeSessionMeta(meta, SECRET), SECRET)).toEqual(meta);
  });

  it('rejects a tampered or foreign-key cookie', () => {
    const value = encodeSessionMeta({ userId: USER, startedAt: T0, seenAt: T0 }, SECRET);
    const pushedForward = value.replace(`.${T0}.${T0}.`, `.${T0 + 3_600_000}.${T0 + 3_600_000}.`);
    expect(decodeSessionMeta(pushedForward, SECRET)).toBeNull();
    expect(decodeSessionMeta(value, `${SECRET}-other`)).toBeNull();
    expect(decodeSessionMeta('garbage', SECRET)).toBeNull();
    expect(decodeSessionMeta(undefined, SECRET)).toBeNull();
  });

  it('ends an admin session after 30 idle minutes, a rep session after 2 hours', () => {
    const meta = { userId: USER, startedAt: T0, seenAt: T0 };
    expect(IDLE_LIMIT_MS.admin).toBe(30 * 60_000);
    expect(IDLE_LIMIT_MS.sales_rep).toBe(2 * 60 * 60_000);
    expect(sessionExpiry(meta, USER, 'admin', T0 + 29 * 60_000)).toBeNull();
    expect(sessionExpiry(meta, USER, 'admin', T0 + 31 * 60_000)).toBe('idle');
    expect(sessionExpiry(meta, USER, 'sales_rep', T0 + 119 * 60_000)).toBeNull();
    expect(sessionExpiry(meta, USER, 'sales_rep', T0 + 121 * 60_000)).toBe('idle');
  });

  it('ends every session 12 hours after sign-in, however active', () => {
    const now = T0 + ABSOLUTE_LIMIT_MS + 1;
    expect(sessionExpiry({ userId: USER, startedAt: T0, seenAt: now - 1000 }, USER, 'sales_rep', now)).toBe('absolute');
  });

  it("refuses a cookie issued to another user or a missing one", () => {
    const meta = { userId: USER, startedAt: T0, seenAt: T0 };
    expect(sessionExpiry(meta, '22222222-2222-4222-8222-222222222222', 'admin', T0)).toBe('mismatch');
    expect(sessionExpiry(null, USER, 'admin', T0)).toBe('mismatch');
  });
});
