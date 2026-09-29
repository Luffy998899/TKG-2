import Link from 'next/link';
import { Bell } from 'lucide-react';
import { requireStaff } from '@/lib/auth/current';
import { createClient } from '@/lib/supabase/server';
import { BottomTabs, SideNav } from '@/components/app-shell/nav';
import { PipelineStyles } from '@/components/app-shell/pipeline-styles';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const who = await requireStaff();
  const supabase = await createClient();
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  const unread = count ?? 0;

  return (
    <div className="flex min-h-dvh">
      <PipelineStyles />
      <SideNav isAdmin={who.is_admin} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex min-h-14 items-center gap-3 border-b border-line bg-paper/95 px-4 backdrop-blur lg:px-8">
          <Link href="/dashboard" className="font-display text-lg font-semibold tracking-tight lg:hidden">
            TKG <span className="text-ink-mute">CRM</span>
          </Link>
          <p className="ml-auto hidden truncate text-sm text-ink-mute sm:block">
            {who.full_name} · {who.role === 'admin' ? 'Admin' : 'Sales rep'}
          </p>
          <Link
            href="/notifications"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            className="relative ml-auto inline-flex h-12 w-12 items-center justify-center rounded-xl hover:bg-paper-sunk sm:ml-0"
          >
            <Bell aria-hidden className="h-5 w-5" />
            {unread ? (
              <span className="absolute right-1.5 top-1.5 min-w-5 rounded-full bg-danger px-1 text-center text-[0.65rem] font-bold leading-5 text-white">
                {unread > 99 ? '99+' : unread}
              </span>
            ) : null}
          </Link>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10">{children}</main>
      </div>
      <BottomTabs />
    </div>
  );
}
