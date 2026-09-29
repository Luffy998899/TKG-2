'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ADMIN_ITEMS, MORE_ITEMS, TABS, type Item } from '@/components/app-shell/nav-items';
import { cn } from '@/lib/utils';

const MORE_PATHS = [...MORE_ITEMS, ...ADMIN_ITEMS].map((item) => item.href);
const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Bottom tab bar below 1024px. Every target is 48px or more. */
export function BottomTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper-raised pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            isActive(pathname, href) ||
            (href === '/leads' && pathname.startsWith('/customers')) ||
            (href === '/more' && MORE_PATHS.some((path) => isActive(pathname, path)));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium', active ? 'text-brand-ink' : 'text-ink-mute')}
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
  const groups: { title?: string; items: Item[] }[] = [
    { items: TABS.filter((tab) => tab.href !== '/more') },
    { items: MORE_ITEMS },
    ...(isAdmin ? [{ title: 'Admin', items: ADMIN_ITEMS }] : []),
  ];
  return (
    <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto border-r border-line bg-paper-raised lg:block">
      <p className="px-5 py-5 font-display text-lg font-semibold tracking-tight">
        TKG <span className="text-ink-mute">CRM</span>
      </p>
      {groups.map((group, index) => (
        <div key={index} className="mb-3 px-2">
          {group.title ? <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-mute">{group.title}</p> : null}
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href) || (href === '/leads' && pathname.startsWith('/customers'));
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium', active ? 'bg-brand-soft text-brand-ink' : 'text-ink-soft hover:bg-paper-sunk')}
                  >
                    <Icon aria-hidden className="h-4 w-4" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
