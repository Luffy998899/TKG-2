/* Navigation items, shared by client nav and server pages (a server page cannot
   read plain values out of a 'use client' module). */
import {
  BarChart3, Bell, CalendarClock, ClipboardList, FileSpreadsheet, LayoutDashboard, ListChecks, Menu, Search,
  Settings2, ShieldCheck, ScrollText, Users, Wallet, type LucideIcon,
} from 'lucide-react';

export interface Item {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const TABS: Item[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/renewals', label: 'Renewals', icon: CalendarClock },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/more', label: 'More', icon: Menu },
];

/** Everything under "More" on a phone; listed in full in the desktop sidebar. */
export const MORE_ITEMS: Item[] = [
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/notifications', label: 'Notifications', icon: Bell },
  { href: '/commissions', label: 'Commissions', icon: Wallet },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings/security', label: 'Security', icon: ShieldCheck },
];

export const ADMIN_ITEMS: Item[] = [
  { href: '/admin/users', label: 'Users', icon: ClipboardList },
  { href: '/admin/pipelines', label: 'Pipelines & rules', icon: Settings2 },
  { href: '/admin/import', label: 'Import clients', icon: FileSpreadsheet },
  { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
];

