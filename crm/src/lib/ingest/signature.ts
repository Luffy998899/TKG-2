import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Website -> CRM request signing.
 *
 *   X-TKG-Timestamp: <unix seconds>
 *   X-TKG-Signature: v1=<hex HMAC-SHA256(secret, `${timestamp}.` + raw body bytes)>
 *
 * The marketing site's src/app/api/inquiry/route.ts produces exactly this.
 */
export const MAX_AGE_SECONDS = 300;
export const MAX_FUTURE_SECONDS = 30;

export type SignatureCheck = { ok: true; signatureHash: string } | { ok: false; reason: 'missing' | 'stale' | 'bad_signature' };

export function signBody(secret: string, timestamp: number, body: Uint8Array): string {
  const mac = createHmac('sha256', secret);
  mac.update(`${timestamp}.`);
  mac.update(body);
  return `v1=${mac.digest('hex')}`;
}

export function verifySignature(
  body: Uint8Array,
  timestampHeader: string | null,
  signatureHeader: string | null,
  secrets: string[],
  nowSeconds = Math.floor(Date.now() / 1000),
): SignatureCheck {
  if (!timestampHeader || !signatureHeader || !/^\d{9,11}$/.test(timestampHeader) || !/^v1=[0-9a-f]{64}$/.test(signatureHeader)) {
    return { ok: false, reason: 'missing' };
  }
  const timestamp = Number(timestampHeader);
  if (nowSeconds - timestamp > MAX_AGE_SECONDS || timestamp - nowSeconds > MAX_FUTURE_SECONDS) {
    return { ok: false, reason: 'stale' };
  }
  const given = Buffer.from(signatureHeader);
  // Always compare against every configured secret, so timing does not reveal which matched.
  let matched = false;
  for (const secret of secrets) {
    const expected = Buffer.from(signBody(secret, timestamp, body));
    if (expected.length === given.length && timingSafeEqual(expected, given)) matched = true;
  }
  if (!matched) return { ok: false, reason: 'bad_signature' };
  return { ok: true, signatureHash: createHash('sha256').update(signatureHeader).digest('hex') };
}
