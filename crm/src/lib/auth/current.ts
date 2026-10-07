import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { userDb } from '@/lib/auth/session';
import type { Whoami } from '@/lib/auth/types';

/** The signed-in user's standing, once per request. Null when signed out. */
export const getWhoami = cache(async (): Promise<Whoami | null> => {
  const db = await userDb();
  const { data } = await db.rpc('whoami').maybeSingle<Whoami>();
  return data ?? null;
});

/**
 * For every page and action inside the app. The proxy already sends signed-out
 * users to the login page, but pages check again: the proxy is a convenience,
 * and row level security is what actually decides.
 */
export async function requireStaff(): Promise<Whoami> {
  const who = await getWhoami();
  if (!who || !who.active) redirect('/login');
  return who;
}

/** Admin-only pages 404 for everyone else rather than admitting they exist. */
export async function requireAdmin(): Promise<Whoami> {
  const who = await requireStaff();
  if (!who.is_admin) notFound();
  return who;
}
