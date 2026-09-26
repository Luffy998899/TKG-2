import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSubmission, markSubmissionRead } from '@/lib/store';
import { markReadAction, deleteSubmissionAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-CA', { dateStyle: 'long', timeStyle: 'short' });

/** Field keys -> readable labels. Unknown keys are title-cased. */
const pretty = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());

function renderValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') {
    const v = value as { name?: string; size?: number };
    if (v.name) return `${v.name}${v.size ? ` (${Math.round(v.size / 1024)} kB)` : ''}`;
    return JSON.stringify(value);
  }
  return String(value);
}

export default async function SubmissionPage({ params }: { params: { id: string } }) {
  const submission = await getSubmission(params.id);
  if (!submission) notFound();

  // Opening it is reading it.
  if (!submission.readAt) await markSubmissionRead(submission.id, true);

  const fileFields = new Set(submission.files.map((f) => f.field));
  const entries = Object.entries(submission.values).filter(([key]) => !fileFields.has(key));

  return (
    <div>
      <Link href="/admin" className="text-caption text-ink-mute hover:text-ink">
        &larr; Back to inbox
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{submission.source}</p>
          <h1 className="display-3 mt-3">{renderValue(submission.values.name)}</h1>
          <p className="mt-2 text-caption text-ink-mute">Received {fmt(submission.submittedAt)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={markReadAction}>
            <input type="hidden" name="id" value={submission.id} />
            <input type="hidden" name="read" value="false" />
            <input type="hidden" name="back" value="/admin" />
            <button type="submit" className="btn btn-ghost">
              Mark unread
            </button>
          </form>
          <form action={deleteSubmissionAction}>
            <input type="hidden" name="id" value={submission.id} />
            <button type="submit" className="btn btn-ghost text-danger">
              Delete
            </button>
          </form>
        </div>
      </div>

      <div className="card mt-8 p-6 md:p-8">
        <dl className="divide-y divide-line">
          {entries.map(([key, value]) => (
            <div key={key} className="grid gap-1 py-3.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
              <dt className="text-caption font-semibold text-ink-mute">{pretty(key)}</dt>
              <dd className="whitespace-pre-wrap break-words text-body text-ink">
                {key === 'email' && typeof value === 'string' && value ? (
                  <a href={`mailto:${value}`} className="text-accent-ink underline underline-offset-4">
                    {value}
                  </a>
                ) : key === 'phone' && typeof value === 'string' && value ? (
                  <a href={`tel:${value.replace(/[^\d+]/g, '')}`} className="phone-number text-accent-ink underline underline-offset-4">
                    {value}
                  </a>
                ) : (
                  renderValue(value)
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {submission.files.length > 0 ? (
        <div className="card mt-5 p-6 md:p-8">
          <p className="eyebrow">Attachments</p>
          <ul className="mt-4 grid gap-2">
            {submission.files.map((file) => (
              <li key={file.storedName} className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{file.originalName}</span>
                  <span className="text-caption text-ink-mute">
                    {pretty(file.field)} · {Math.round(file.size / 1024)} kB
                  </span>
                </span>
                <a
                  href={`/api/admin/files/${file.storedName}?as=${encodeURIComponent(file.originalName)}`}
                  className="btn btn-primary"
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
