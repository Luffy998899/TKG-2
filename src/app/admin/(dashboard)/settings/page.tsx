import { site } from '@/config/site';
import { readOverrides } from '@/lib/store';
import { saveSettingsAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

interface FieldDef {
  key: string;
  label: string;
  help?: string;
  type?: 'text' | 'tel' | 'email' | 'url' | 'textarea';
  fallback: string;
}

const groups: { title: string; note?: string; fields: FieldDef[] }[] = [
  {
    title: 'Contact',
    note: 'These feed every call, WhatsApp and email link on the site, the header, the footer and the floating buttons.',
    fields: [
      { key: 'phoneDisplay', label: 'Phone (as shown)', type: 'tel', fallback: site.contact.phoneDisplay },
      { key: 'phoneHref', label: 'Phone (dialable)', type: 'tel', help: 'Digits with country code, e.g. +17789275027.', fallback: site.contact.phoneHref },
      { key: 'whatsapp', label: 'WhatsApp number', type: 'tel', help: 'Digits only with country code, e.g. 17789275027. Must be a number registered on WhatsApp.', fallback: site.contact.whatsapp },
      { key: 'email', label: 'Email', type: 'email', fallback: site.contact.email },
    ],
  },
  {
    title: 'Address and hours',
    note: 'Shown on the contact page and in search-engine data only once filled in. Leave blank to hide.',
    fields: [
      { key: 'addressLine', label: 'Street address', fallback: site.contact.addressLine },
      { key: 'locality', label: 'City', fallback: site.contact.locality },
      { key: 'region', label: 'Province', fallback: site.contact.region },
      { key: 'postalCode', label: 'Postal code', fallback: site.contact.postalCode },
      { key: 'country', label: 'Country', fallback: site.contact.country },
      { key: 'hours', label: 'Business hours', help: 'e.g. Mon–Fri 9am–6pm, Sat 10am–4pm', fallback: site.contact.hours },
    ],
  },
  {
    title: 'Wording',
    fields: [
      { key: 'tagline', label: 'Tagline', help: 'Shown in the hero, the footer and the browser tab.', fallback: site.tagline },
      { key: 'description', label: 'Description', type: 'textarea', help: 'Used for search-engine and social previews.', fallback: site.description },
    ],
  },
  {
    title: 'Social',
    note: 'Full URLs. Shown in the footer once filled in.',
    fields: [
      { key: 'facebook', label: 'Facebook', type: 'url', fallback: '' },
      { key: 'instagram', label: 'Instagram', type: 'url', fallback: '' },
      { key: 'linkedin', label: 'LinkedIn', type: 'url', fallback: '' },
    ],
  },
];

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: { saved?: string };
}) {
  const overrides = (await readOverrides()) as Record<string, string | undefined>;

  return (
    <div>
      <p className="eyebrow">Site details</p>
      <h1 className="display-2 mt-3">Contact, address, wording.</h1>
      <p className="mt-3 max-w-prose text-caption text-ink-mute">
        Anything you leave blank falls back to the built-in default shown beneath the field.
        Saving publishes immediately.
      </p>

      {searchParams.saved ? (
        <p role="status" className="mt-6 rounded-xl border border-ok/30 bg-ok/[0.06] p-4 text-caption text-ink">
          Saved. The site is updated.
        </p>
      ) : null}

      <form action={saveSettingsAction} className="mt-8 grid gap-6">
        {groups.map((group) => (
          <fieldset key={group.title} className="card p-6 md:p-8">
            <legend className="font-display text-card-title font-semibold text-ink">
              {group.title}
            </legend>
            {group.note ? <p className="mt-2 text-caption text-ink-mute">{group.note}</p> : null}
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              {group.fields.map((f) => {
                const id = `s-${f.key}`;
                const value = overrides[f.key] ?? '';
                const isArea = f.type === 'textarea';
                return (
                  <div key={f.key} className={isArea ? 'sm:col-span-2' : ''}>
                    <label htmlFor={id} className="field-label mb-2">
                      {f.label}
                    </label>
                    {isArea ? (
                      <textarea
                        id={id}
                        name={f.key}
                        defaultValue={value}
                        rows={3}
                        placeholder={f.fallback}
                        className="field-control resize-y"
                      />
                    ) : (
                      <input
                        id={id}
                        name={f.key}
                        type={f.type ?? 'text'}
                        defaultValue={value}
                        placeholder={f.fallback || '—'}
                        className="field-control"
                      />
                    )}
                    <p className="mt-1.5 text-caption text-ink-mute">
                      {f.help ? `${f.help} ` : ''}
                      {f.fallback ? (
                        <>
                          Default: <span className="text-ink-soft">{f.fallback}</span>
                        </>
                      ) : (
                        'No default - hidden when blank.'
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div>
          <button type="submit" className="btn btn-primary">
            Save and publish
          </button>
        </div>
      </form>
    </div>
  );
}
