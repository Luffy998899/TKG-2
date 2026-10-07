import 'server-only';
import { isIP } from 'node:net';
import { headers } from 'next/headers';

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

/**
 * Client IP and user agent for audit rows and login lockout. nginx on the
 * server overwrites X-Real-IP with the connecting address, so that header is
 * trusted first; X-Forwarded-For can be extended by the client, so only its
 * LAST entry (the one nginx appended) is used as a fallback.
 */
export async function requestMeta(): Promise<RequestMeta> {
  const list = await headers();
  const forwarded = list.get('x-real-ip')?.trim() || list.get('x-forwarded-for')?.split(',').at(-1)?.trim() || '';
  return {
    ip: isIP(forwarded) ? forwarded : null,
    userAgent: list.get('user-agent')?.slice(0, 300) ?? null,
  };
}
