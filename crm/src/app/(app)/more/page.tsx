import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requireStaff } from '@/lib/auth/current';
import { PageHeader } from '@/components/app-shell/page-header';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { ADMIN_ITEMS, MORE_ITEMS } from '@/components/app-shell/nav-items';

export const metadata: Metadata = { title: 'More' };

export default async function MorePage() {
  const who = await requireStaff();
  const groups = [
    { title: 'You', items: MORE_ITEMS },
    // Admin entries are hidden for reps AND refused for them server-side.
    ...(who.is_admin ? [{ title: 'Admin', items: ADMIN_ITEMS }] : []),
  ];
  return (
    <>
      <PageHeader title="More" description={`${who.full_name} · ${who.email}`} />
      <div className="space-y-5">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-mute">{group.title}</h2>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
              {group.items.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="flex min-h-14 items-center gap-3 px-4 text-[0.95rem] font-medium hover:bg-paper-sunk">
                    <Icon aria-hidden className="h-5 w-5 text-ink-mute" />
                    <span className="flex-1">{label}</span>
                    <ChevronRight aria-hidden className="h-4 w-4 text-ink-mute" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </>
  );
}
