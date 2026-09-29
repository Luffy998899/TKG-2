export type AppRole = 'admin' | 'sales_rep';

/** Row returned by the `whoami()` database function. */
export interface Whoami {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  active: boolean;
  /** aal2, or no verified MFA factor. */
  mfa_ok: boolean;
  /** Active admin whose session satisfies mfa_ok (two-factor is optional). */
  is_admin: boolean;
}

export type AfterAuthPath = '/login/mfa' | '/dashboard';

/**
 * Where a signed-in, active user must go next. Two-factor is optional for
 * everyone (owner decision, 2026-09-29), but once turned on the code is needed.
 */
export function routeAfterAuth(who: Pick<Whoami, 'role' | 'mfa_ok' | 'is_admin'>): AfterAuthPath {
  if (!who.mfa_ok) return '/login/mfa';
  return '/dashboard';
}
