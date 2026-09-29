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
  /** Active admin on an aal2 session. */
  is_admin: boolean;
}

export type AfterAuthPath = '/login/mfa' | '/mfa/enroll' | '/dashboard';

/** Where a signed-in, active user must go next. */
export function routeAfterAuth(who: Pick<Whoami, 'role' | 'mfa_ok' | 'is_admin'>): AfterAuthPath {
  if (!who.mfa_ok) return '/login/mfa';
  // MFA is mandatory for admins: an admin without a factor must enrol first.
  if (who.role === 'admin' && !who.is_admin) return '/mfa/enroll';
  return '/dashboard';
}
