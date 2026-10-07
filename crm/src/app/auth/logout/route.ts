import { NextResponse, type NextRequest } from 'next/server';
import { requestMeta } from '@/lib/request-meta';
import { clearSessionCookie, currentSession } from '@/lib/auth/session';
import { anonDb, dbForUser } from '@/lib/auth/session-core';
import { serverEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Same-origin form posts only: the browser says so in Sec-Fetch-Site, or
  // the Origin header matches. (SameSite=Lax cookies already keep a cross-site
  // POST from carrying the session.)
  const origin = request.headers.get('origin');
  const sameSite = request.headers.get('sec-fetch-site') === 'same-origin';
  if (!sameSite && origin && origin !== new URL(serverEnv().APP_URL).origin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const session = await currentSession();
  if (session.userId) {
    const meta = await requestMeta();
    await dbForUser(session.userId).rpc('log_audit_event', {
      p_action: 'auth.logout', p_entity_type: 'profile', p_entity_id: session.userId,
      p_ip: meta.ip, p_user_agent: meta.userAgent,
    });
    await anonDb().rpc('sign_out', { p_token_hash: session.tokenHash });
  }
  await clearSessionCookie();
  // Built from APP_URL, the one address the CRM is served on.
  return NextResponse.redirect(`${serverEnv().APP_URL}/login?reason=signed_out`, 303);
}

export function GET() {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
