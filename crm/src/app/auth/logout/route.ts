import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requestMeta } from '@/lib/request-meta';
import { clearSessionClock } from '@/lib/auth/session-cookie';
import { serverEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Same-origin form posts only.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(serverEnv().APP_URL).origin && origin !== request.nextUrl.origin) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const meta = await requestMeta();
    await supabase.rpc('log_audit_event', {
      p_action: 'auth.logout', p_entity_type: 'profile', p_entity_id: data.user.id,
      p_ip: meta.ip, p_user_agent: meta.userAgent,
    });
    await supabase.auth.signOut({ scope: 'local' });
  }
  await clearSessionClock();
  return NextResponse.redirect(new URL('/login?reason=signed_out', request.url), 303);
}

export function GET() {
  return new NextResponse('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
