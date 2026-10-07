export type AppRole = 'admin' | 'sales_rep';

/** Row returned by the `whoami()` database function. */
export interface Whoami {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  active: boolean;
  /** Active admin on a signed-in session. */
  is_admin: boolean;
}
