import { requireStaff } from '@/lib/auth/current';
import { BottomTabs, SideNav } from '@/components/app-shell/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const who = await requireStaff();
  return (
    <div className="flex min-h-dvh">
      <SideNav isAdmin={who.is_admin} />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-line bg-paper/95 px-4 backdrop-blur lg:px-8">
          <p className="font-display text-lg font-semibold tracking-tight lg:hidden">
            TKG <span className="text-ink-mute">CRM</span>
          </p>
          <p className="ml-auto truncate text-sm text-ink-mute">
            {who.full_name} · {who.role === 'admin' ? 'Admin' : 'Sales rep'}
          </p>
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-5 lg:px-8 lg:pb-10">{children}</main>
      </div>
      <BottomTabs />
    </div>
  );
}
