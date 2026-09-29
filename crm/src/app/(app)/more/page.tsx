import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { requireStaff } from '@/lib/auth/current';
import { PageHeader } from '@/components/app-shell/page-header';
import { SignOutButton } from '@/components/auth/sign-out-button';

export const metadata: Metadata = { title: 'More' };

export default async function MorePage() {
  const who = await requireStaff();
  const links = [
    { href: '/settings/security', label: 'Security and two-factor' },
    // Admin entries are hidden for reps AND refused for them server-side.
    ...(who.is_admin ? [{ href: '/admin/users', label: 'Users and invitations' }] : []),
  ];
  return (
    <>
      <PageHeader title="More" />
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="flex min-h-14 items-center justify-between px-4 text-[0.95rem] font-medium hover:bg-paper-sunk">
              {link.label}
              <ChevronRight aria-hidden className="h-4 w-4 text-ink-mute" />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <SignOutButton />
      </div>
    </>
  );
}
