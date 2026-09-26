'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/admin/actions';

const items = [
  { href: '/admin', label: 'Inbox', exact: true },
  { href: '/admin/settings', label: 'Site details' },
  { href: '/admin/testimonials', label: 'Reviews' },
  { href: '/admin/branding', label: 'Favicon' },
];

export function AdminNav() {
  const pathname = usePathname();
  const active = (item: (typeof items)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <aside className="lg:sticky lg:top-[calc(var(--header-h)+2.5rem)] lg:self-start">
      <p className="eyebrow">Admin</p>
      <nav aria-label="Admin" className="mt-4">
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active(item) ? 'page' : undefined}
                className={[
                  'block rounded-full px-4 py-2 text-caption font-medium transition-[background-color,color] duration-150',
                  active(item)
                    ? 'bg-ink text-paper'
                    : 'text-ink-soft hover:bg-paper-raised hover:text-ink',
                ].join(' ')}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action={logoutAction} className="mt-6">
        <button type="submit" className="btn btn-ghost">
          Log out
        </button>
      </form>
      <p className="mt-6 max-w-[24ch] text-caption text-ink-mute">
        Changes made here are live on the site immediately - no deploy needed.
      </p>
    </aside>
  );
}
