import type { Metadata } from 'next';
import { site, telHref, waHref } from '@/config/site';
import { divisions } from '@/config/divisions';
import { quoteForm } from '@/config/general-forms';
import { InquiryForm } from '@/components/form/InquiryForm';
import { Reveal } from '@/components/Reveal';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { PhoneIcon, WhatsAppIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Request a quote',
  description: `Request a quote from ${site.name}. One form covers all ${divisions.length} divisions - automotive, real estate, security, moving, cleaning, telecom and business services.`,
  alternates: { canonical: '/quote' },
  openGraph: {
    title: `Request a quote | ${site.name}`,
    description: `One form covers all ${divisions.length} divisions.`,
    url: '/quote',
  },
};

const steps = [
  { title: 'You send the details', body: 'The more specific, the more accurate the number.' },
  { title: 'We check what it involves', body: 'If something is unclear we call before quoting.' },
  { title: 'You get a price', body: 'With what is included, and what would change it.' },
];

export default function QuotePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Request a quote', path: '/quote' },
            ]),
          ),
        }}
      />

      <section className="border-b border-line bg-paper">
        <div className="shell pb-16 pt-[calc(var(--header-h)+3.5rem)] md:pb-24 md:pt-[calc(var(--header-h)+6rem)]">
          <p className="eyebrow">Request a quote</p>
          <h1 className="display-1 mt-5 max-w-[15ch]">
            Tell us the job. We&rsquo;ll price it.
          </h1>
          <p className="mt-6 max-w-prose text-lead text-ink-soft">
            One form for every division. If you would rather talk it through, call{' '}
            <a
              href={telHref}
              className="phone-number font-medium text-accent-ink underline underline-offset-4"
            >
              {site.contact.phoneDisplay}
            </a>
            .
          </p>
        </div>
      </section>

      <section className="bg-paper">
        <div className="shell py-section md:py-section-lg">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
            <div>
              <Reveal as="ol" className="space-y-8">
                {steps.map((step, i) => (
                  <li key={step.title} data-reveal className="flex gap-4">
                    <span className="counter pt-1.5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>
                      <span className="block font-display text-body-lg font-semibold text-ink">{step.title}</span>
                      <span className="mt-1 block text-caption text-ink-soft">{step.body}</span>
                    </span>
                  </li>
                ))}
              </Reveal>

              <div className="card mt-12 bg-paper-sunk p-6">
                <p className="text-caption text-ink-soft">
                  Quotes are estimates until we have confirmed the details. Anything that changes
                  the price is flagged before work starts, never after.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <a href={telHref} data-cta="call" className="btn btn-ghost">
                    <PhoneIcon />
                    Call instead
                  </a>
                  <a
                    href={waHref}
                    data-cta="whatsapp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                  >
                    <WhatsAppIcon />
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>

            <InquiryForm form={quoteForm} source="page:quote" />
          </div>
        </div>
      </section>
    </>
  );
}
