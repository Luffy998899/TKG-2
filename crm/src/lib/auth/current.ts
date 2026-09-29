import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { routeAfterAuth, type Whoami } from '@/lib/auth/types';

/** The signed-in user's standing, once per request. Null when signed out. */
export const getWhoami = cache(async (): Promise<Whoami | null> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc('whoami').maybeSingle<Whoami>();
  return data ?? null;
});

/**
 * For every page and action inside the app. The proxy already routes users,
 * but pages check again: the proxy is a convenience, and row level security
 * is what actually decides.
 */
export async function requireStaff(): Promise<Whoami> {
  const who = await getWhoami();
  if (!who || !who.active) redirect('/login');
  const next = routeAfterAuth(who);
  if (next !== '/dashboard') redirect(next);
  return who;
}

/** Admin-only pages 404 for everyone else rather than admitting they exist. */
export async function requireAdmin(): Promise<Whoami> {
  const who = await requireStaff();
  if (!who.is_admin) notFound();
  return who;
}
