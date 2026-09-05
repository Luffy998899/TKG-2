import Link from 'next/link';
import { listSubmissions, type Submission } from '@/lib/store';
import { markReadAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

/** A submission's most useful one-line identity: name, then email, then phone. */
function who(s: Submission): string {
  const v = s.values;
  const name = typeof v.name === 'string' ? v.name : '';
  const email = typeof v.email === 'string' ? v.email : '';
  const phone = typeof v.phone === 'string' ? v.phone : '';
  return [name, email || phone].filter(Boolean).join(' · ') || '(no name)';
}

/** "division:telecommunications" -> "Telecommunications"; "careers:x" -> "Careers: x". */
function label(source: string): string {
  const [kind, rest = ''] = source.split(':');
  const pretty = rest.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  if (kind === 'division') return pretty;
  if (kind === 'page') return pretty;
  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}: ${pretty}`;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: { deleted?: string; filter?: string };
}) {
  const all = await listSubmissions();
  const unread = all.filter((s) => !s.readAt).length;
  const filter = searchParams.filter === 'unread' ? 'unread' : 'all';
  const rows = filter === 'unread' ? all.filter((s) => !s.readAt) : all;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Inbox</p>
          <h1 className="display-2 mt-3">
            {all.length} {all.length === 1 ? 'submission' : 'submissions'}
          </h1>
          <p className="mt-2 text-caption text-ink-mute">
            {unread} unread. Every form on the site lands here.
          </p>
        </div>
        <div className="flex gap-1">
          <Link
            href="/admin"
            className={['chip', filter === 'all' ? 'border-accent bg-accent-soft text-accent-ink' : ''].join(' ')}
          >
            All
          </Link>
          <Link
            href="/admin?filter=unread"
            className={['chip', filter === 'unread' ? 'border-accent bg-accent-soft text-accent-ink' : ''].join(' ')}
          >
            Unread {unread > 0 ? `(${unread})` : ''}
          </Link>
        </div>
      </div>

      {searchParams.deleted ? (
        <p role="status" className="mt-6 rounded-xl border border-ok/30 bg-ok/[0.06] p-4 text-caption text-ink">
          Submission deleted.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="card mt-8 p-10 text-center">
          <p className="font-display text-card-title font-semibold text-ink">Nothing here yet.</p>
          <p className="mt-2 text-caption text-ink-mute">
            {filter === 'unread'
              ? 'You are all caught up.'
              : 'Submissions from every form on the site will appear here as they arrive.'}
          </p>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line overflow-hidden rounded-card border border-line bg-paper-raised">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap">
              <span
                aria-label={s.readAt ? 'Read' : 'Unread'}
                className={[
                  'h-2.5 w-2.5 shrink-0 rounded-full',
                  s.readAt ? 'bg-line-strong' : 'bg-accent',
                ].join(' ')}
              />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/admin/submissions/${s.id}`}
                  className={[
                    'block truncate font-display text-body',
                    s.readAt ? 'font-medium text-ink-soft' : 'font-semibold text-ink',
                  ].join(' ')}
                >
                  {who(s)}
                </Link>
                <p className="mt-0.5 truncate text-caption text-ink-mute">
                  {label(s.source)}
                  {s.files.length > 0 ? ` · ${s.files.length} file${s.files.length > 1 ? 's' : ''}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-caption tabular-nums text-ink-mute">
                {fmt(s.submittedAt)}
              </span>
              <form action={markReadAction} className="shrink-0">
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="read" value={s.readAt ? 'false' : 'true'} />
                <input type="hidden" name="back" value={`/admin${filter === 'unread' ? '?filter=unread' : ''}`} />
                <button type="submit" className="chip">
                  {s.readAt ? 'Mark unread' : 'Mark read'}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
