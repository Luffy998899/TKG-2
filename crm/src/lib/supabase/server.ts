import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { serverEnv } from '@/lib/env';

/**
 * Supabase client for server components, server actions and route handlers,
 * acting AS THE SIGNED-IN USER (their session cookie). Every query it makes is
 * subject to row level security.
 */
export async function createClient() {
  const env = serverEnv();
  const store = await cookies();
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Server components cannot write cookies; the proxy refreshes the
          // session on every request, so nothing is lost.
        }
      },
    },
  });
}
