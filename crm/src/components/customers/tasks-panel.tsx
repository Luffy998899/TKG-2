'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FormNotice, Input, Label } from '@/components/ui/field';
import { addFollowUpAction, setTaskDoneAction } from '@/lib/contracts/actions';
import { dateOnly, daysUntil } from '@/lib/format';
import type { Task } from '@/lib/contracts/queries';
import { cn } from '@/lib/utils';

export function TaskItem({ task, customerName }: { task: Task; customerName?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const due = daysUntil(task.due_date);
  const done = task.status === 'done';
  return (
    <li className="flex items-start gap-3 rounded-xl border border-line bg-paper-raised p-3">
      <label className="-m-2 inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={done}
          disabled={pending}
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
          onChange={(event) =>
            startTransition(async () => {
              const result = await setTaskDoneAction(task.id, event.target.checked);
              if (!result.ok) setError(result.error);
              router.refresh();
            })
          }
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-medium', done && 'text-ink-mute line-through')}>{task.title}</p>
        <p className={cn('mt-0.5 text-xs', !done && due < 0 ? 'font-semibold text-danger' : 'text-ink-mute')}>
          {customerName ? `${customerName} · ` : ''}
          {task.type === 'contract_expiry' ? <><CalendarClock aria-hidden className="mr-1 inline h-3.5 w-3.5" />{task.milestone}-day reminder · </> : null}
          Due {dateOnly(task.due_date)}
          {!done ? (due < 0 ? ` · ${-due} days overdue` : due === 0 ? ' · today' : '') : ''}
        </p>
        {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      </div>
    </li>
  );
}

export function TasksPanel({ dealId, tasks }: { dealId: string; tasks: Task[] }) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const open = tasks.filter((t) => t.status === 'open');
  const closed = tasks.filter((t) => t.status === 'done');

  return (
    <div className="space-y-3">
      {open.length ? (
        <ul className="space-y-2">{open.map((task) => <TaskItem key={task.id} task={task} />)}</ul>
      ) : (
        <p className="text-sm text-ink-soft">Nothing open.</p>
      )}
      <form
        method="post"
        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            setError(null);
            const result = await addFollowUpAction({ dealId, title, dueDate: due });
            if (!result.ok) return setError(result.error);
            setTitle('');
            setDue('');
            router.refresh();
          });
        }}
      >
        <div>
          <Label htmlFor={`task-${dealId}`}>Add a follow-up</Label>
          <Input id={`task-${dealId}`} value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Call back with a quote" />
        </div>
        <div>
          <Label htmlFor={`due-${dealId}`}>Due</Label>
          <Input id={`due-${dealId}`} type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </div>
        <Button type="submit" variant="secondary" disabled={pending || !title || !due}>Add</Button>
      </form>
      {error ? <FormNotice>{error}</FormNotice> : null}
      {closed.length ? (
        <details className="text-sm">
          <summary className="min-h-12 cursor-pointer py-3 text-ink-soft">Done ({closed.length})</summary>
          <ul className="space-y-2">{closed.map((task) => <TaskItem key={task.id} task={task} />)}</ul>
        </details>
      ) : null}
    </div>
  );
}
