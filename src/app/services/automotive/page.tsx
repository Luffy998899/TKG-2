import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getDivision, divisionPath } from '@/config/divisions';
import {
  SOURCING_DISCLAIMER,
  sourcingProcess,
  sourcingForm,
  sellingForm,
} from '@/config/automotive';
import { themeVars } from '@/config/theme';
import { site, telHref, waHref } from '@/config/site';
import { mediaMeta, imageSizes } from '@/lib/images';
import { InquiryForm } from '@/components/form/InquiryForm';
import { SelectedVehicles } from '@/components/automotive/SelectedVehicles';
import { DivisionGrid } from '@/components/DivisionGrid';
import { CTABand } from '@/components/CTABand';
import { Reveal } from '@/components/Reveal';
import { ArrowIcon, PhoneIcon, WhatsAppIcon } from '@/components/icons';
import { breadcrumbJsonLd, serviceJsonLd } from '@/lib/jsonld';

/*
 * A static route that shadows /services/[division] for this one slug.
 *
 * The dynamic route still renders the other five divisions from config; this
 * page exists because vehicle sourcing is a different PRODUCT from a service
 * listing - it leads with a requirements form and a five-step process, and it
 * carries a disclaimer the generic template has nowhere to put.
 *
 * Everything that is still division data - name, theme, tagline - is read from
 * the config entry rather than duplicated here.
 */
const SLUG = 'automotive';
const division = getDivision(SLUG)!;

export const metadata: Metadata = {
  title: division.seo.title,
  description: division.seo.description,
  alternates: { canonical: divisionPath(SLUG) },
  openGraph: {
    title: `${division.seo.title} | ${site.name}`,
    description: division.seo.description,
    url: divisionPath(SLUG),
    type: 'website',
  },
};

export default function AutomotivePage() {
  const hero = mediaMeta('automotive-hero');
  const sell = mediaMeta('automotive-sell');

  return (
    <div style={themeVars(division.theme)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd(SLUG)) }}
      />
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

      {/* ------------------------------------------------------------ hero */}
      <section className="on-night relative overflow-hidden bg-night">
        {hero ? (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <Image
              src={hero.src}
              alt=""
              fill
              sizes={imageSizes.banner}
              placeholder="blur"
              blurDataURL={hero.blurDataURL}
              priority
              className="object-cover"
            />
          </div>
        ) : null}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-night/72" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-night via-night/80 to-night/40"
        />

        <div className="shell relative pb-14 pt-[calc(var(--header-h)+3.5rem)] md:pb-20 md:pt-[calc(var(--header-h)+5.5rem)]">
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

          <p className="eyebrow-accent">Vehicle sourcing</p>
          {/*
            The brief's heading, verbatim, and it doubles as the section label
            for the form immediately below it - which is why the form is the
            first thing on the page rather than the last.
          */}
          <h1 className="mt-4 max-w-[15ch] font-display text-[clamp(2.5rem,10vw,4.5rem)] font-semibold leading-[1.0] tracking-[-0.04em] text-paper">
            Tell us what you&rsquo;re looking for.
          </h1>
          <p className="mt-6 max-w-prose text-body-lg text-paper/75">
            Tell us the car you want &mdash; the make, budget and timeline &mdash; and we do the
            searching for you. We look across our network of dealerships, send you the vehicles that
            match, and connect you with the dealer selling the one you choose.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#requirements" className="btn btn-primary">
              Find My Vehicle
              <ArrowIcon width={16} height={16} />
            </a>
            <a href="#sell" className="btn btn-inverse">
              I want to sell a vehicle
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- disclaimer */}
      {/* Directly under the hero, above the fold on a phone. It is the first
          thing a visitor reads after the pitch, on purpose. */}
      <aside aria-label="Important notice" className="border-b border-line bg-paper-sunk">
        <div className="shell py-5">
          <p className="max-w-prose text-caption text-ink-soft">
            <strong className="font-semibold text-ink">Important:</strong> {SOURCING_DISCLAIMER}
          </p>
        </div>
      </aside>

      {/* ------------------------------------------------- requirements form */}
      <section
        id="requirements"
        aria-labelledby="requirements-heading"
        className="scroll-mt-24 bg-paper"
      >
        <div className="shell py-section md:py-section-lg">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
            <div>
              <p className="eyebrow">Requirements</p>
              <h2 id="requirements-heading" className="display-2 mt-5 max-w-[14ch]">
                Let us find your car.
              </h2>
              <p className="mt-6 max-w-prose text-body text-ink-soft">
                Two minutes now saves a fortnight of scrolling listings. Prefer to talk it
                through? Call{' '}
                <a
                  href={telHref}
                  className="phone-number font-medium text-accent-ink underline underline-offset-4"
                >
                  {site.contact.phoneDisplay}
                </a>
                , or message the same number on{' '}
                <a
                  href={waHref}
                  data-cta="whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent-ink underline underline-offset-4"
                >
                  WhatsApp
                </a>
                .
              </p>

              <ul className="mt-10 grid gap-3">
                {division.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-baseline gap-3">
                    <span
                      aria-hidden
                      className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    />
                    <span className="text-body text-ink">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>

            <InquiryForm form={sourcingForm} source="automotive:sourcing" />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- process */}
      <section aria-labelledby="process-heading" className="border-t border-line bg-paper-sunk">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-10 md:mb-14">
            <div data-reveal>
              <p className="eyebrow">How it works</p>
              <h2 id="process-heading" className="display-2 mt-5 max-w-[16ch]">
                Five steps, start to keys.
              </h2>
            </div>
          </Reveal>

          <Reveal as="ol" className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sourcingProcess.map((step, i) => (
              <li
                key={step.title}
                data-reveal
                className={[
                  'card p-6 md:p-8',
                  // The fifth step is the one that says the sale happens
                  // elsewhere, so it gets the full row and the accent border
                  // rather than being the runt at the end of a 3-up grid.
                  i === sourcingProcess.length - 1
                    ? 'border-accent/40 bg-accent-soft md:col-span-2 lg:col-span-1'
                    : '',
                ].join(' ')}
              >
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

      {/* ------------------------------------------------ selected vehicles */}
      {/* Self-hiding while the config array is empty. */}
      <SelectedVehicles />

      {/* ------------------------------------------------------------- sell */}
      <section id="sell" aria-labelledby="sell-heading" className="scroll-mt-24 bg-paper">
        <div className="shell py-section md:py-section-lg">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
            <div>
              <p className="eyebrow">The other direction</p>
              <h2 id="sell-heading" className="display-2 mt-5 max-w-[14ch]">
                Looking to sell your vehicle?
              </h2>
              <p className="mt-6 max-w-prose text-body text-ink-soft">
                Send us the details and we put the vehicle in front of buyers and the dealership
                partners we work with &mdash; instead of leaving you to field messages from
                strangers on a marketplace.
              </p>

              {sell ? (
                <div className="frame mt-9 aspect-[16/10] w-full rounded-panel shadow-raise">
                  <Image
                    src={sell.src}
                    alt="A car key held out over a plain background."
                    width={sell.width}
                    height={sell.height}
                    sizes={imageSizes.split}
                    placeholder="blur"
                    blurDataURL={sell.blurDataURL}
                    className="frame-img"
                  />
                </div>
              ) : null}
            </div>

            <InquiryForm form={sellingForm} source="automotive:selling" />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- other divisions */}
      <section aria-labelledby="other-heading" className="border-t border-line bg-paper-sunk">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-12">
            <div data-reveal>
              <p className="eyebrow">Also from {site.name}</p>
              <h2 id="other-heading" className="display-2 mt-5 max-w-[20ch]">
                The other divisions
              </h2>
            </div>
          </Reveal>
          <DivisionGrid excludeSlug={SLUG} />
        </div>
      </section>

      <CTABand
        title="Not sure where to start?"
        body="Tell us roughly what you need and roughly what you want to spend. We will take it from there."
      />
    </div>
  );
}
