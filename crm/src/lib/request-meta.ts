import 'server-only';
import { isIP } from 'node:net';
import { headers } from 'next/headers';

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

/**
 * Client IP and user agent for audit rows and login lockout. On Vercel the
 * first x-forwarded-for entry is the client (Vercel overwrites the header).
 */
export async function requestMeta(): Promise<RequestMeta> {
  const list = await headers();
  const forwarded =
    list.get('x-forwarded-for')?.split(',')[0]?.trim() ?? list.get('x-real-ip') ?? '';
  return {
    ip: isIP(forwarded) ? forwarded : null,
    userAgent: list.get('user-agent')?.slice(0, 300) ?? null,
  };
}
