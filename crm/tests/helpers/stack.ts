import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { inject } from 'vitest';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/*
 * Test harness for the LOCAL stack only (tests/setup/local-stack.ts refuses
 * anything else). Users are created through the Auth admin API with random
 * addresses, so runs never collide and nothing needs cleaning up.
 */

const stack = () => inject('stack');
const noPersist = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };

export const anonClient = () => createClient(stack().url, stack().publishableKey, noPersist);
export const serviceClient = () => createClient(stack().url, stack().serviceKey, noPersist);

/** A @supabase/ssr client over an in-memory cookie jar, like the app's server client. */
export function cookieClient() {
  const jar = new Map<string, string>();
  const client = createServerClient(stack().url, stack().publishableKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => {
        for (const { name, value } of list) {
          if (value) jar.set(name, value);
          else jar.delete(name);
        }
      },
    },
  });
  return { client, jar };
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  role: 'admin' | 'sales_rep';
  totpSecret?: string;
}

export async function createStaff(role: 'admin' | 'sales_rep', name = role === 'admin' ? 'Test Admin' : 'Test Rep'): Promise<TestUser> {
  const service = serviceClient();
  const email = `${role}-${randomUUID().slice(0, 8)}@crm-test.local`;
  const password = `Pw-${randomBytes(9).toString('base64url')}9a`;
  const created = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error('createUser failed');
  const id = created.data.user.id;
  const profile = await service.from('profiles').insert({ id, email, full_name: name, role });
  if (profile.error) throw profile.error;
  return { id, email, password, role };
}

/** A user with no staff profile at all (e.g. created outside the invite flow). */
export async function createAuthOnlyUser(): Promise<TestUser> {
  const email = `nobody-${randomUUID().slice(0, 8)}@crm-test.local`;
  const password = `Pw-${randomBytes(9).toString('base64url')}9a`;
  const created = await serviceClient().auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error('createUser failed');
  return { id: created.data.user.id, email, password, role: 'sales_rep' };
}

export async function signIn(user: TestUser): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return client;
}

/* ------------------------------------------------------------------ TOTP */

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((byte) => parseInt(byte, 2)));
}

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) - what authenticator apps compute. */
export function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

async function verifyWithRetry(client: SupabaseClient, factorId: string, secret: string) {
  // A code already used in this 30 s window can be refused; try the next one.
  let result = await client.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) });
  if (result.error) {
    await new Promise((resolve) => setTimeout(resolve, 31_000 - (Date.now() % 30_000)));
    result = await client.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) });
  }
  if (result.error) throw result.error;
}

/** Enrols TOTP for a signed-in client, leaving it at aal2. */
export async function enrollTotp(client: SupabaseClient, user: TestUser): Promise<void> {
  const enrolled = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `test-${randomUUID().slice(0, 6)}` });
  if (enrolled.error) throw enrolled.error;
  user.totpSecret = enrolled.data.totp.secret;
  await verifyWithRetry(client, enrolled.data.id, user.totpSecret);
}

/** Signs in and completes MFA (enrolling on first use): an aal2 session. */
export async function signInAal2(user: TestUser): Promise<SupabaseClient> {
  const client = await signIn(user);
  if (!user.totpSecret) {
    await enrollTotp(client, user);
    return client;
  }
  const factors = await client.auth.mfa.listFactors();
  const factor = factors.data?.totp.find((f) => f.status === 'verified');
  if (!factor) throw new Error('no verified factor');
  await verifyWithRetry(client, factor.id, user.totpSecret);
  return client;
}

/** Random 198.18.0.0/15 (benchmarking) address, so IP lockout counters never collide. */
export const testIp = () =>
  `198.${18 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`;
