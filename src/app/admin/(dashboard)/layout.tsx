import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { adminConfigured, isAuthenticated } from '@/lib/admin-auth';
import { storeIsEphemeral } from '@/lib/store';
import { AdminNav } from '@/app/admin/AdminNav';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

/** Reads cookies and the store on every request; never cached. */
export const dynamic = 'force-dynamic';

/**
 * The gate. Every page inside this route group renders only for a logged-in
 * owner; anyone else is sent to the login page (or told /admin is off).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!adminConfigured()) redirect('/admin/login');
  if (!isAuthenticated()) redirect('/admin/login');

  return (
    <div className="min-h-screen bg-paper-sunk pt-[var(--header-h)]">
      <div className="shell py-10 md:py-14">
        {storeIsEphemeral() ? (
          <div
            role="alert"
            className="mb-8 rounded-card border border-danger/40 bg-danger/[0.06] p-5 text-caption text-ink"
          >
            <strong className="font-semibold text-danger">
              This host does not keep files between deploys.
            </strong>{' '}
            Submissions, uploads and settings saved here will be lost on the next deploy or
            restart. Move the store to a hosted database or object storage before relying on it -
            see the note at the top of <code>src/lib/store.ts</code>.
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
          <AdminNav />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
