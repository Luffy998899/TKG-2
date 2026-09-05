import { listTestimonials } from '@/lib/store';
import { divisions } from '@/config/divisions';
import { addTestimonialAction, deleteTestimonialAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const messages: Record<string, { tone: 'ok' | 'danger'; text: string }> = {
  saved: { tone: 'ok', text: 'Review published.' },
  deleted: { tone: 'ok', text: 'Review removed.' },
  missing: { tone: 'danger', text: 'A quote and a name are both required.' },
  permission: {
    tone: 'danger',
    text: 'You must confirm the customer gave permission before a review can be published.',
  },
  division: { tone: 'danger', text: 'Pick a valid division.' },
};

export default async function AdminTestimonialsPage({
  searchParams,
}: {
  searchParams: { saved?: string; deleted?: string; error?: string };
}) {
  const reviews = await listTestimonials();
  const flash =
    (searchParams.saved && messages.saved) ||
    (searchParams.deleted && messages.deleted) ||
    (searchParams.error && messages[searchParams.error]) ||
    null;

  return (
    <div>
      <p className="eyebrow">Reviews</p>
      <h1 className="display-2 mt-3">Customer reviews.</h1>
      <p className="mt-3 max-w-prose text-caption text-ink-mute">
        Only real reviews from real customers, with their permission. There are no placeholders
        anywhere on the site - the review sections stay hidden until you add one here.
      </p>

      {flash ? (
        <p
          role={flash.tone === 'danger' ? 'alert' : 'status'}
          className={[
            'mt-6 rounded-xl border p-4 text-caption text-ink',
            flash.tone === 'ok' ? 'border-ok/30 bg-ok/[0.06]' : 'border-danger/30 bg-danger/[0.06]',
          ].join(' ')}
        >
          {flash.text}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---------------------------------------------------------- add */}
        <form action={addTestimonialAction} className="card p-6 md:p-8">
          <h2 className="font-display text-card-title font-semibold text-ink">Add a review</h2>
          <div className="mt-6 grid gap-5">
            <div>
              <label htmlFor="quote" className="field-label mb-2">
                What they said <span className="text-danger">*</span>
              </label>
              <textarea id="quote" name="quote" required rows={4} className="field-control resize-y" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="field-label mb-2">
                  Customer name <span className="text-danger">*</span>
                </label>
                <input id="name" name="name" required className="field-control" placeholder="e.g. Priya S." />
              </div>
              <div>
                <label htmlFor="context" className="field-label mb-2">
                  Where / what
                </label>
                <input id="context" name="context" className="field-control" placeholder="e.g. Surrey · Home security install" />
              </div>
              <div>
                <label htmlFor="division" className="field-label mb-2">
                  Show on
                </label>
                <select id="division" name="division" className="field-control" defaultValue="general">
                  <option value="general">Whole site (homepage + every division)</option>
                  {divisions.map((d) => (
                    <option key={d.slug} value={d.slug}>
                      {d.name} page + homepage
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="date" className="field-label mb-2">
                  Date given
                </label>
                <input id="date" name="date" type="date" className="field-control" />
              </div>
            </div>
            <label className="field-tile">
              <input type="checkbox" name="permission" required className="h-[18px] w-[18px] shrink-0 rounded accent-[rgb(var(--accent))]" />
              <span>
                This is a genuine review from a real customer, and they have agreed to it being
                published under this name.
              </span>
            </label>
          </div>
          <button type="submit" className="btn btn-primary mt-6">
            Publish review
          </button>
        </form>

        {/* --------------------------------------------------------- list */}
        <div>
          <h2 className="font-display text-card-title font-semibold text-ink">
            Published ({reviews.length})
          </h2>
          {reviews.length === 0 ? (
            <p className="mt-4 text-caption text-ink-mute">None yet.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {reviews.map((r) => (
                <li key={r.id} className="card p-5">
                  <blockquote className="text-body text-ink">&ldquo;{r.quote}&rdquo;</blockquote>
                  <p className="mt-3 text-caption text-ink-soft">
                    <strong className="font-semibold text-ink">{r.name}</strong>
                    {r.context ? ` · ${r.context}` : ''}
                  </p>
                  <p className="mt-1 text-caption text-ink-mute">
                    {r.division === 'general' ? 'Whole site' : divisions.find((d) => d.slug === r.division)?.name ?? r.division}
                    {' · '}
                    {r.date}
                  </p>
                  <form action={deleteTestimonialAction} className="mt-3">
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="chip text-danger">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
