import type { Metadata } from 'next';
import Link from 'next/link';
import { site, contactLinks } from '@/config/site';
import { getSiteSettings, hasAddress } from '@/lib/settings';
import { divisions, divisionPath } from '@/config/divisions';
import { contactForm } from '@/config/general-forms';
import { InquiryForm } from '@/components/form/InquiryForm';
import { Reveal } from '@/components/Reveal';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { PhoneIcon, WhatsAppIcon, MailIcon } from '@/components/icons';
import { CopyButton } from '@/components/CopyButton';

export const metadata: Metadata = {
  title: 'Contact us',
  description: `Call, message or email ${site.name}. One point of contact for all ${divisions.length} divisions across the ${site.serviceArea.join(' and the ')}.`,
  alternates: { canonical: '/contact' },
  openGraph: {
    title: `Contact ${site.name}`,
    description: `One point of contact for all ${divisions.length} divisions.`,
    url: '/contact',
  },
};

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const { tel, wa, mail } = contactLinks(settings);

  const channels = [
    {
      label: 'Call',
      value: settings.contact.phoneDisplay,
      href: tel,
      Icon: PhoneIcon,
      body: 'Fastest for anything time-sensitive.',
      cta: 'call' as const,
      external: false,
      /** A phone number must never break across two lines. */
      nowrap: true,
      copy: undefined as string | undefined,
    },
    {
      label: 'Text / WhatsApp',
      value: 'Message us',
      href: wa,
      Icon: WhatsAppIcon,
      body: 'Send photos, addresses or a quick question.',
      cta: 'whatsapp' as const,
      external: true,
      nowrap: false,
      copy: undefined as string | undefined,
    },
    {
      label: 'Email',
      value: settings.contact.email,
      href: mail,
      Icon: MailIcon,
      body: 'Best for detail you want in writing.',
      cta: 'email' as const,
      external: false,
      nowrap: false,
      /* Offered for copying, because a mailto: link is a dead button on a
         machine with no mail client registered. */
      copy: settings.contact.email as string | undefined,
    },
  ];

  const showAddress = hasAddress(settings);
  const showHours = Boolean(settings.contact.hours);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Contact us', path: '/contact' },
            ]),
          ),
        }}
      />

      <section className="border-b border-line bg-paper">
        <div className="shell pb-16 pt-[calc(var(--header-h)+3.5rem)] md:pb-24 md:pt-[calc(var(--header-h)+6rem)]">
          <p className="eyebrow">Contact us</p>
          <h1 className="display-1 mt-5 max-w-[15ch]">One number. Every division.</h1>
          <p className="mt-6 max-w-prose text-lead text-ink-soft">
            Whichever service you need, it starts in the same place. Tell us roughly what is going
            on and we will route it to the right team.
          </p>
        </div>
      </section>

      <section className="bg-paper">
        <div className="shell py-section md:py-section-lg">
          <Reveal as="ul" className="grid gap-5 md:grid-cols-3">
            {channels.map(({ label, value, href, Icon, body, cta, external, nowrap, copy }) => (
              <li key={label} data-reveal className="card card-interactive group relative">
                {/*
                  The email card is built differently from the other two: its
                  copy button cannot live inside the card-wide <a>, because a
                  button nested in a link is invalid and unreachable by
                  keyboard. So that card links only its address, and the copy
                  control sits beside it. See <CopyButton> for why it is there
                  at all.
                */}
                <div className="flex h-full flex-col gap-4 p-7 md:p-9">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                    <Icon width={20} height={20} />
                  </span>
                  <div>
                    <span className="eyebrow block">{label}</span>
                    <a
                      href={href}
                      data-cta={cta}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                      className={[
                        'mt-2 block break-words font-display text-card-title font-semibold text-ink underline-offset-4 hover:underline',
                        nowrap ? 'phone-number' : '',
                        // The two simple cards keep their whole-card hit area.
                        copy ? '' : 'after:absolute after:inset-0 after:content-[""]',
                      ].join(' ')}
                    >
                      {value}
                    </a>
                    <span className="mt-2 block text-caption text-ink-soft">{body}</span>
                    {copy ? <CopyButton value={copy} label={label.toLowerCase()} className="mt-4" /> : null}
                  </div>
                </div>
              </li>
            ))}
          </Reveal>

          <div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
            <div>
              <p className="eyebrow">Company details</p>
              <dl className="mt-6 space-y-5 text-body">
                {/* Address and hours render only once the owner has entered
                    them in /admin - an empty row is worse than no row. */}
                {showAddress ? (
                  <div>
                    <dt className="text-caption text-ink-mute">Address</dt>
                    <dd className="mt-1 text-ink">
                      {settings.contact.addressLine}
                      <br />
                      {settings.contact.locality}, {settings.contact.region}{' '}
                      {settings.contact.postalCode}
                      <br />
                      {settings.contact.country}
                    </dd>
                  </div>
                ) : null}
                {showHours ? (
                  <div>
                    <dt className="text-caption text-ink-mute">Hours</dt>
                    <dd className="mt-1 text-ink">{settings.contact.hours}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-caption text-ink-mute">Legal name</dt>
                  <dd className="mt-1 text-ink">{settings.legalName}</dd>
                </div>
                <div>
                  <dt className="text-caption text-ink-mute">Service area</dt>
                  <dd className="mt-1 text-ink">{settings.serviceArea.join(', ')}</dd>
                </div>
              </dl>

              <p className="mt-8 max-w-prose text-caption text-ink-soft">
                Know which division you need? Each one has its own form with the right questions
                on it, which is usually faster than a general message.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {divisions.map((division) => (
                  <li key={division.slug}>
                    <Link href={divisionPath(division.slug)} className="chip">
                      {division.shortName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <InquiryForm form={contactForm} source="page:contact" />
          </div>
        </div>
      </section>
    </>
  );
}
