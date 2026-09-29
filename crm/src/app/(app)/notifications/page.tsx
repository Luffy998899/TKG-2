import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { dateTime } from '@/lib/format';
import { PageHeader } from '@/components/app-shell/page-header';
import { MarkAllRead } from './mark-all-read';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from('notifications')
    .select('id, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  const rows = (data ?? []) as { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }[];
  const unread = rows.filter((row) => !row.read_at).map((row) => row.id);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <PageHeader title="Notifications" />
        {unread.length ? <MarkAllRead ids={unread} /> : null}
      </div>
      {rows.length ? (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
          {rows.map((row) => (
            <li key={row.id}>
              <Link href={row.link ?? '/dashboard'} className={cn('block px-4 py-3 hover:bg-paper-sunk', !row.read_at && 'bg-brand-soft/40')}>
                <p className="text-sm font-semibold">{row.title}</p>
                {row.body ? <p className="text-sm text-ink-soft">{row.body}</p> : null}
                <p className="mt-0.5 text-xs text-ink-mute">{dateTime(row.created_at)}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-soft">You are all caught up.</p>
      )}
    </>
  );
}
