import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/auth/current';
import { userDb } from '@/lib/auth/session';
import { PageHeader } from '@/components/app-shell/page-header';
import { FormNotice } from '@/components/ui/field';
import { CreateUserForm, UserRowActions } from './user-forms';

export const metadata: Metadata = { title: 'Users' };

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'sales_rep';
  active: boolean;
  last_login_at: string | null;
}

const dateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Vancouver',
  dateStyle: 'medium',
  timeStyle: 'short',
});

export default async function UsersPage() {
  const me = await requireAdmin();
  const db = await userDb();
  // Row level security: only an admin gets every row.
  const { data, error } = await db
    .from('profiles')
    .select('id, email, full_name, role, active, last_login_at')
    .order('active', { ascending: false })
    .order('full_name');
  const users = (data ?? []) as ProfileRow[];

  return (
    <>
      <PageHeader title="Users" description="Only an admin can create accounts. Every change here is audited." />
      <section className="mb-6 rounded-2xl border border-line bg-paper-raised p-5">
        <h2 className="mb-4 font-display text-lg font-semibold">Add someone</h2>
        <CreateUserForm />
      </section>

      {error ? <FormNotice>Users could not be loaded.</FormNotice> : null}
      <ul className="space-y-3">
        {users.map((user) => (
          <li key={user.id} className="rounded-2xl border border-line bg-paper-raised p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold">
                {user.full_name}
                {user.id === me.id ? <span className="ml-2 text-xs font-normal text-ink-mute">(you)</span> : null}
              </p>
              <p className={user.active ? 'text-xs font-semibold text-ok' : 'text-xs font-semibold text-danger'}>
                {user.active ? 'Active' : 'Deactivated'}
              </p>
            </div>
            <p className="break-all text-sm text-ink-soft">{user.email}</p>
            <p className="mt-0.5 text-xs text-ink-mute">
              {user.last_login_at ? `Last sign-in ${dateFormat.format(new Date(user.last_login_at))}` : 'Has not signed in yet'}
            </p>
            {user.id !== me.id ? (
              <UserRowActions userId={user.id} role={user.role} active={user.active} />
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
