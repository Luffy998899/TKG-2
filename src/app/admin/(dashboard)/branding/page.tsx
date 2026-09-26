import { readOverrides } from '@/lib/store';
import { uploadFaviconAction, clearFaviconAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const messages: Record<string, { tone: 'ok' | 'danger'; text: string }> = {
  saved: { tone: 'ok', text: 'Favicon updated. Browsers may take a moment to refresh their copy.' },
  cleared: { tone: 'ok', text: 'Back to the default TKG icon.' },
  missing: { tone: 'danger', text: 'Choose a file first.' },
  size: { tone: 'danger', text: 'That file is over 512 kB. A favicon should be far smaller.' },
  type: { tone: 'danger', text: 'Use a PNG, ICO or SVG.' },
};

export default async function AdminBrandingPage({
  searchParams,
}: {
  searchParams: { saved?: string; cleared?: string; error?: string };
}) {
  const overrides = await readOverrides();
  const flash =
    (searchParams.saved && messages.saved) ||
    (searchParams.cleared && messages.cleared) ||
    (searchParams.error && messages[searchParams.error]) ||
    null;
  const current = overrides.favicon
    ? `/api/favicon?v=${overrides.faviconVersion ?? '1'}`
    : '/icon.svg';

  return (
    <div>
      <p className="eyebrow">Favicon</p>
      <h1 className="display-2 mt-3">The browser-tab icon.</h1>
      <p className="mt-3 max-w-prose text-caption text-ink-mute">
        Square, ideally 256×256 or larger. PNG, ICO or SVG. It also shows up in bookmarks and on
        the home screen when someone saves the site on their phone.
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

      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card p-6 md:p-8">
          <h2 className="font-display text-card-title font-semibold text-ink">Current</h2>
          <div className="mt-5 flex items-center gap-5">
            {/* Plain <img>: this is a tiny, owner-uploaded, dynamically served
                file - next/image optimisation has nothing to add. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current}
              alt="Current favicon"
              width={64}
              height={64}
              className="h-16 w-16 rounded-xl border border-line bg-paper object-contain"
            />
            <div className="text-caption text-ink-mute">
              {overrides.favicon ? 'Your uploaded icon.' : 'The built-in default.'}
            </div>
          </div>
          {overrides.favicon ? (
            <form action={clearFaviconAction} className="mt-6">
              <button type="submit" className="btn btn-ghost">
                Remove and use the default
              </button>
            </form>
          ) : null}
        </div>

        <form action={uploadFaviconAction} className="card p-6 md:p-8">
          <h2 className="font-display text-card-title font-semibold text-ink">Upload a new one</h2>
          <label htmlFor="favicon" className="field-label mb-2 mt-5">
            Icon file
          </label>
          <input
            id="favicon"
            name="favicon"
            type="file"
            accept=".png,.ico,.svg,image/png,image/x-icon,image/svg+xml"
            required
            className="field-control field-file"
          />
          <p className="mt-2 text-caption text-ink-mute">Up to 512 kB.</p>
          <button type="submit" className="btn btn-primary mt-6">
            Upload and publish
          </button>
        </form>
      </div>
    </div>
  );
}
