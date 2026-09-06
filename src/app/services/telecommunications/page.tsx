import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDivision, divisionPath } from '@/config/divisions';
import { themeVars } from '@/config/theme';
import { imageMeta, imageSizes } from '@/lib/images';
import { site, contactLinks } from '@/config/site';
import { getSiteSettings } from '@/lib/settings';
import { AvailabilityCheck } from '@/components/telecom/AvailabilityCheck';
import { FaqAccordion } from '@/components/security/FaqAccordion';
import { Testimonials } from '@/components/Testimonials';
import { DivisionGrid } from '@/components/DivisionGrid';
import { CTABand } from '@/components/CTABand';
import { Reveal } from '@/components/Reveal';
import { CheckIcon, PhoneIcon, WhatsAppIcon } from '@/components/icons';
import { breadcrumbJsonLd, serviceJsonLd, faqJsonLd } from '@/lib/jsonld';

/**
 * Telecommunications - built around ONE question: what can this address
 * actually get?
 *
 * Every other division page leads with what the division does and puts the
 * form at the bottom. This one inverts that, because a telecom customer is not
 * shopping for a description - they want to know which plans exist at their
 * property and what they really cost. So the address check IS the hero, and
 * the explanatory copy sits underneath it for the people who want it.
 *
 * Today the check collects a qualified lead: the exact address plus what the
 * customer wants, so a representative can come back with real availability.
 * The step is deliberately shaped so that a live provider-availability API can
 * be dropped in behind it later without changing what the customer does.
 */

const SLUG = 'telecommunications';

export function generateMetadata(): Metadata {
  const division = getDivision(SLUG);
  if (!division) return {};
  const meta = imageMeta(SLUG);
  const title = 'Internet & TV plans available at your address';
  const description =
    'Check which internet, TV and home phone plans are available at your address in the Lower Mainland and Fraser Valley. Enter your address and we come back with the real options and the real price.';

  return {
    title,
    description,
    alternates: { canonical: divisionPath(SLUG) },
    openGraph: {
      title: `${title} | ${site.name}`,
      description,
      url: divisionPath(SLUG),
      type: 'website',
      images: meta ? [{ url: meta.src, width: meta.width, height: meta.height }] : undefined,
    },
  };
}

export default async function TelecommunicationsPage() {
  const division = getDivision(SLUG);
  if (!division) notFound();

  const settings = await getSiteSettings();
  const { tel: telHref, wa: waHref } = contactLinks(settings);
  const meta = imageMeta(SLUG);
  const process = division.process ?? [];
  const whyPoints = division.why ?? [];
  const faqs = division.faqs ?? [];

  return (
    <div style={themeVars(division.theme)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd(SLUG)) }}
      />
      {faqs.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }}
        />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: division.name, path: divisionPath(SLUG) },
            ]),
          ),
        }}
      />

      {/* ------------------------------------------------- hero + the check */}
      <section
        id="check"
        data-header-dark
        className="on-night relative overflow-hidden bg-night scroll-mt-24"
      >
        {meta ? (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <Image
              src={meta.src}
              alt=""
              fill
              sizes={imageSizes.banner}
              placeholder="blur"
              blurDataURL={meta.blurDataURL}
              priority
              className="object-cover"
            />
          </div>
        ) : null}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-night/70" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night via-night/75 to-night/40"
        />

        <div className="shell relative pb-16 pt-[calc(var(--header-h)+3rem)] md:pb-24 md:pt-[calc(var(--header-h)+5rem)]">
          <nav aria-label="Breadcrumb" className="mb-8">
            <ol className="flex items-center gap-2 text-caption text-paper/55">
              <li>
                <Link href="/" className="transition-colors hover:text-paper">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-paper">{division.name}</li>
            </ol>
          </nav>

          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
            <div>
              <p className="eyebrow-accent">Internet · TV · Home phone</p>
              <h1 className="mt-5 max-w-[15ch] font-display text-[clamp(2rem,7.5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em] text-paper">
                Find Internet &amp; TV Plans Available at Your Address
              </h1>
              <p className="mt-6 max-w-prose text-body-lg text-paper/80">
                Enter your address and we will come back with the plans that are actually available
                at your property — with the promotional price and the price it becomes afterwards,
                side by side.
              </p>

              <ul className="mt-8 grid gap-3">
                {[
                  'Every provider, one conversation',
                  'The price after the promo, in writing',
                  'Home and business connections',
                ].map((point) => (
                  <li key={point} className="flex items-start gap-3 text-body text-paper/85">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast">
                      <CheckIcon width={14} height={14} />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-wrap gap-3">
                <a href={telHref} data-cta="call" className="btn btn-inverse">
                  <PhoneIcon />
                  <span className="phone-number">{settings.contact.phoneDisplay}</span>
                </a>
                <a
                  href={waHref}
                  data-cta="whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-inverse"
                >
                  <WhatsAppIcon />
                  WhatsApp
                </a>
              </div>
            </div>

            {/* The card sits on the light surface it needs for form controls,
                inside the dark hero. */}
            <div className="on-paper">
              <AvailabilityCheck form={division.form} source={`division:${SLUG}`} />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------ highlights strip */}
      <section aria-label="At a glance" className="border-b border-line bg-paper-raised">
        <ul className="shell grid gap-x-6 gap-y-5 py-8 sm:grid-cols-3 md:py-10">
          {division.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                <CheckIcon width={18} height={18} />
              </span>
              <span className="pt-1.5 font-display text-caption font-semibold leading-tight text-ink">
                {highlight}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------------ body */}
      <section className="bg-paper">
        <Reveal className="shell py-section md:py-section-lg">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div data-reveal>
              <p className="eyebrow">Overview</p>
              <h2 className="display-2 mt-5 max-w-[18ch]">{division.tagline}</h2>
            </div>
            <div data-reveal className="space-y-5">
              {division.body.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="max-w-prose text-body-lg text-ink-soft">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* -------------------------------------------------------- services */}
      <section aria-labelledby="services-heading" className="border-t border-line bg-paper-sunk">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-12 md:mb-16">
            <div data-reveal>
              <p className="eyebrow">What we do</p>
              <h2
                id="services-heading"
                className="mt-5 max-w-[20ch] font-display text-[clamp(1.75rem,8vw,2.75rem)] font-semibold leading-[1.06] tracking-[-0.032em] text-ink"
              >
                {division.servicesTitle ?? `${division.name} services`}
              </h2>
            </div>
          </Reveal>

          <Reveal as="ul" className="grid gap-5 md:grid-cols-2">
            {division.services.map((service, i) => (
              <li key={service.title} data-reveal className="card p-7 md:p-9">
                <span className="counter">{String(i + 1).padStart(2, '0')}</span>
                <span aria-hidden className="mt-5 block h-px w-10 bg-accent" />
                <h3 className="mt-5 font-display text-card-title font-semibold text-ink">
                  {service.title}
                </h3>
                <p className="mt-3 max-w-prose text-body text-ink-soft">{service.body}</p>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- process */}
      {process.length > 0 ? (
        <section aria-labelledby="process-heading" className="bg-paper">
          <div className="shell py-section md:py-section-lg">
            <Reveal className="mb-10 md:mb-14">
              <div data-reveal>
                <p className="eyebrow">How it works</p>
                <h2 id="process-heading" className="display-2 mt-5 max-w-[16ch]">
                  {division.processTitle ?? 'Start to finish.'}
                </h2>
              </div>
            </Reveal>
            <Reveal as="ol" className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {process.map((step, i) => (
                <li key={step.title} data-reveal className="card p-6 md:p-7">
                  <span className="counter">Step {String(i + 1).padStart(2, '0')}</span>
                  <span aria-hidden className="mt-5 block h-px w-10 bg-accent" />
                  <h3 className="mt-5 font-display text-card-title font-semibold text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-body text-ink-soft">{step.body}</p>
                </li>
              ))}
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------- why us */}
      {whyPoints.length > 0 ? (
        <section aria-labelledby="why-heading" className="border-t border-line bg-paper-sunk">
          <div className="shell py-section md:py-section-lg">
            <Reveal className="mb-10 md:mb-14">
              <div data-reveal>
                <p className="eyebrow">Why us</p>
                <h2 id="why-heading" className="display-2 mt-5 max-w-[18ch]">
                  Why telecom with {settings.name}.
                </h2>
              </div>
            </Reveal>
            <Reveal as="ul" className="grid gap-5 md:grid-cols-2">
              {whyPoints.map((item, i) => (
                <li key={item.title} data-reveal className="card flex gap-5 p-6 md:p-8">
                  <span className="counter shrink-0 pt-1">{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="font-display text-card-title font-semibold text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-body text-ink-soft">{item.body}</p>
                  </div>
                </li>
              ))}
            </Reveal>
          </div>
        </section>
      ) : null}

      <Testimonials division={SLUG} tone="paper" />

      {/* ------------------------------------------------------------ FAQs */}
      {faqs.length > 0 ? (
        <section aria-labelledby="faq-heading" className="border-t border-line bg-paper-sunk">
          <div className="shell py-section md:py-section-lg">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-16">
              <div>
                <p className="eyebrow">FAQs</p>
                <h2 id="faq-heading" className="display-2 mt-5 max-w-[12ch]">
                  Questions, answered.
                </h2>
                <p className="mt-6 max-w-prose text-body text-ink-soft">
                  Still not sure? Call{' '}
                  <a
                    href={telHref}
                    className="phone-number font-medium text-accent-ink underline underline-offset-4"
                  >
                    {settings.contact.phoneDisplay}
                  </a>{' '}
                  and ask a person.
                </p>
              </div>
              <FaqAccordion faqs={faqs} />
            </div>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------- back to the check, at the end */}
      <section className="bg-paper">
        <div className="shell py-section text-center md:py-section-lg">
          <h2 className="display-2 mx-auto max-w-[20ch]">
            Ready to see what your address can get?
          </h2>
          <p className="mx-auto mt-5 max-w-prose text-body-lg text-ink-soft">
            It takes a minute, and there is no obligation at the end of it.
          </p>
          <a href="#check" className="btn btn-primary mt-8">
            Check available plans
          </a>
        </div>
      </section>

      <section aria-labelledby="other-heading" className="border-t border-line bg-paper-sunk">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-12">
            <div data-reveal>
              <p className="eyebrow">Also from {settings.name}</p>
              <h2 id="other-heading" className="display-2 mt-5 max-w-[20ch]">
                The other divisions
              </h2>
            </div>
          </Reveal>
          <DivisionGrid excludeSlug={SLUG} />
        </div>
      </section>

      <CTABand />
    </div>
  );
}
