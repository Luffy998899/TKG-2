import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminConfigured, isAuthenticated } from '@/lib/admin-auth';
import { loginAction } from '@/app/admin/actions';

export const metadata: Metadata = {
  title: 'Admin login',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (adminConfigured() && isAuthenticated()) redirect('/admin');

  return (
    <div className="min-h-screen bg-paper-sunk pt-[var(--header-h)]">
      <div className="shell flex min-h-[calc(100vh-var(--header-h))] items-center justify-center py-16">
        <div className="card w-full max-w-md p-8 md:p-10">
          <p className="eyebrow">Admin</p>
          <h1 className="display-3 mt-3">Owner login</h1>

          {!adminConfigured() ? (
            <div className="mt-6 rounded-xl border border-danger/30 bg-danger/[0.06] p-4 text-caption text-ink">
              <strong className="font-semibold text-danger">/admin is switched off.</strong>{' '}
              Set <code>ADMIN_PASSWORD</code> in the server environment and restart. There is no
              default password on purpose.
            </div>
          ) : (
            <form action={loginAction} className="mt-6">
              <label htmlFor="password" className="field-label mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                className="field-control"
              />
              {searchParams.error ? (
                <p role="alert" className="mt-3 text-caption text-danger">
                  That password is not right.
                </p>
              ) : null}
              <button type="submit" className="btn btn-primary mt-6 w-full">
                Log in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
