import type { Metadata } from 'next';
import Link from 'next/link';
import { requireStaff } from '@/lib/auth/current';
import { listOpenTasks } from '@/lib/contracts/queries';
import { vancouverToday } from '@/lib/format';
import { PageHeader } from '@/components/app-shell/page-header';
import { TaskItem } from '@/components/customers/tasks-panel';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Tasks' };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const who = await requireStaff();
  const scope = who.is_admin && (await searchParams).scope === 'all' ? 'all' : 'mine';
  const tasks = await listOpenTasks(who.id, scope);
  const today = vancouverToday();
  const groups = [
    { title: 'Overdue', rows: tasks.filter((t) => t.due_date < today) },
    { title: 'Today', rows: tasks.filter((t) => t.due_date === today) },
    { title: 'Upcoming', rows: tasks.filter((t) => t.due_date > today) },
  ];

  return (
    <>
      <PageHeader title="Tasks" description="Follow-ups and contract-renewal reminders." />
      {who.is_admin ? (
        <div className="mb-4 inline-flex rounded-xl border border-line bg-paper-raised p-1">
          {(['mine', 'all'] as const).map((value) => (
            <Link
              key={value}
              href={value === 'all' ? '/tasks?scope=all' : '/tasks'}
              aria-current={scope === value ? 'page' : undefined}
              className={cn('inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold', scope === value ? 'bg-ink text-paper-raised' : 'text-ink-soft')}
            >
              {value === 'mine' ? 'Mine' : 'Everyone'}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="grid gap-5 lg:grid-cols-3">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className={cn('mb-2 text-sm font-semibold', group.title === 'Overdue' && group.rows.length && 'text-danger')}>
              {group.title} ({group.rows.length})
            </h2>
            {group.rows.length ? (
              <ul className="space-y-2">
                {group.rows.map((task) => (
                  <li key={task.id} className="list-none">
                    <Link href={`/customers/${task.customer_id}?deal=${task.deal_id}`} className="mb-1 block text-xs font-semibold text-brand-ink underline-offset-4 hover:underline">
                      {task.customers?.full_name ?? 'Customer'}
                    </Link>
                    <ul><TaskItem task={task} /></ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-mute">None.</p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
