'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, LayoutDashboard, Menu, Search, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/renewals', label: 'Renewals', icon: CalendarClock },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/more', label: 'More', icon: Menu },
] as const;

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Bottom tab bar below 1024px. Every target is 48px or more. */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper-raised pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href) || (href === '/more' && ['/settings', '/admin'].some((p) => pathname.startsWith(p)));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium',
                  active ? 'text-brand-ink' : 'text-ink-mute',
                )}
              >
                <Icon aria-hidden className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Side navigation from 1024px. */
export function SideNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = [
    ...TABS.filter((tab) => tab.href !== '/more'),
    { href: '/settings/security', label: 'Security', icon: Menu },
    ...(isAdmin ? [{ href: '/admin/users', label: 'Users', icon: Users }] : []),
  ];
  return (
    <nav aria-label="Main" className="hidden w-56 shrink-0 border-r border-line bg-paper-raised lg:block">
      <p className="px-5 py-5 font-display text-lg font-semibold tracking-tight">
        TKG <span className="text-ink-mute">CRM</span>
      </p>
      <ul className="space-y-0.5 px-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium',
                  active ? 'bg-brand-soft text-brand-ink' : 'text-ink-soft hover:bg-paper-sunk',
                )}
              >
                <Icon aria-hidden className="h-4.5 w-4.5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
