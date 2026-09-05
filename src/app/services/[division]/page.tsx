import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { divisions, getDivision, divisionPath } from '@/config/divisions';
import { themeVars } from '@/config/theme';
import { imageMeta, imageSizes } from '@/lib/images';
import { site, contactLinks } from '@/config/site';
import { getSiteSettings } from '@/lib/settings';
import { InquiryForm } from '@/components/form/InquiryForm';
import { FaqAccordion } from '@/components/security/FaqAccordion';
import { Testimonials } from '@/components/Testimonials';
import { DivisionGrid } from '@/components/DivisionGrid';
import { CTABand } from '@/components/CTABand';
import { Reveal } from '@/components/Reveal';
import { ArrowIcon, CheckIcon, PhoneIcon, WhatsAppIcon, shapeMarks } from '@/components/icons';
import { breadcrumbJsonLd, serviceJsonLd, faqJsonLd } from '@/lib/jsonld';

interface Params {
  params: { division: string };
}

/**
 * Divisions that have their own hand-built page under src/app/services/<slug>/.
 * A static segment already wins over this dynamic one at request time; they are
 * excluded here so the build does not also try to prerender them from the
 * generic template.
 */
const OVERRIDDEN = new Set(['automotive', 'security-smart-home']);

/** Every other division becomes a static route at build time, from config. */
export function generateStaticParams() {
  return divisions
    .filter((division) => !OVERRIDDEN.has(division.slug))
    .map((division) => ({ division: division.slug }));
}

export function generateMetadata({ params }: Params): Metadata {
  const division = getDivision(params.division);
  if (!division) return {};

  const path = divisionPath(division.slug);
  const meta = imageMeta(division.slug);

  return {
    title: division.seo.title,
    description: division.seo.description,
    alternates: { canonical: path },
    openGraph: {
      title: `${division.seo.title} | ${site.name}`,
      description: division.seo.description,
      url: path,
      type: 'website',
      images: meta ? [{ url: meta.src, width: meta.width, height: meta.height }] : undefined,
    },
  };
}

/**
 * The shared division page. Telecom, real estate, moving, cleaning and
 * business services all render from this one template; everything on it comes
 * from the division's config entry.
 *
 * Structure matches the hand-built security and automotive pages - dark
 * full-bleed hero, then alternating light sections - so the seven division
 * pages read as one site rather than two styles.
 */
export default async function DivisionPage({ params }: Params) {
  const division = getDivision(params.division);
  if (!division) notFound();

  const settings = await getSiteSettings();
  const { tel: telHref, wa: waHref } = contactLinks(settings);

  const Mark = shapeMarks[division.scene.shape];
  const meta = imageMeta(division.slug);
  const index = divisions.indexOf(division);
  const process = division.process ?? [];
  const faqs = division.faqs ?? [];
  const whyPoints = division.why ?? [];

  return (
    // One wrapper sets --accent* for the whole page: buttons, focus rings,
    // rules, form validation states and the image wash all pick it up.
    <div style={themeVars(division.theme)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd(division.slug)) }}
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
              { name: division.name, path: divisionPath(division.slug) },
            ]),
          ),
        }}
      />

      {/* ------------------------------------------------------------ hero */}
      <section data-header-dark className="on-night relative overflow-hidden bg-night">
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
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-night/55" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night via-night/65 to-night/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-night/85 to-transparent md:w-[60%]"
        />

        <div className="shell relative pb-16 pt-[calc(var(--header-h)+3.5rem)] md:pb-24 md:pt-[calc(var(--header-h)+6rem)]">
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

          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-contrast">
              <Mark width={22} height={22} />
            </span>
            <span className="counter">
              Division {String(index + 1).padStart(2, '0')} /{' '}
              {String(divisions.length).padStart(2, '0')}
            </span>
          </div>

          {/*
            Fluid, not stepped: "Telecommunications" is one unbreakable
            18-character word, so the H1 scales with the viewport and caps at
            the display size rather than hyphenating.
          */}
          <h1 className="mt-6 max-w-[16ch] font-display text-[clamp(1.9rem,9vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-paper">
            {division.name}
          </h1>
          <p className="eyebrow-accent mt-5">{division.tagline}</p>
          <p className="mt-6 max-w-prose text-body-lg text-paper/80">{division.summary}</p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#inquiry" className="btn btn-accent">
              {division.form.submitLabel.replace(/^Send |^Request /, 'Start ')}
              <ArrowIcon width={16} height={16} />
            </a>
            <a href={telHref} data-cta="call" className="btn btn-inverse">
              <PhoneIcon />
              <span className="phone-number">{settings.contact.phoneDisplay}</span>
            </a>
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

      {/* -------------------------------------------- regulatory notice */}
      {division.notice ? (
        <aside aria-label="Important notice" className="border-b border-line bg-paper-sunk">
          <div className="shell py-5">
            <p className="max-w-prose text-caption text-ink-soft">
              <strong className="font-semibold text-ink">Important:</strong> {division.notice}
            </p>
          </div>
        </aside>
      ) : null}

      {/* ---------------------------------------------------------- body */}
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

      {/* ------------------------------------------------------ services */}
      <section aria-labelledby="services-heading" className="border-t border-line bg-paper-sunk">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-12 md:mb-16">
            <div data-reveal>
              <p className="eyebrow">What we do</p>
              {/* Fluid for the same reason as the H1: this carries the division
                  name, and "Telecommunications" alone is wider than a phone at
                  the stepped h2 size. */}
              <h2
                id="services-heading"
                className="mt-5 max-w-[20ch] font-display text-[clamp(1.75rem,8vw,2.75rem)] font-semibold leading-[1.06] tracking-[-0.032em] text-ink"
              >
                {division.name} services
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

      {/* ------------------------------------------------------- process */}
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
            <Reveal
              as="ol"
              className={[
                'grid gap-5 md:grid-cols-2',
                process.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
              ].join(' ')}
            >
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

      {/* -------------------------------------------------------- why us */}
      {whyPoints.length > 0 ? (
        <section aria-labelledby="why-heading" className="border-t border-line bg-paper-sunk">
          <div className="shell py-section md:py-section-lg">
            <Reveal className="mb-10 md:mb-14">
              <div data-reveal>
                <p className="eyebrow">Why us</p>
                <h2 id="why-heading" className="display-2 mt-5 max-w-[18ch]">
                  Why {division.shortName.toLowerCase()} with {settings.name}.
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

      {/* ------------------------------------------------------- reviews */}
      <Testimonials division={division.slug} tone="paper" />

      {/* ---------------------------------------------------------- FAQs */}
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

      {/* ------------------------------------------------------- inquiry */}
      <section id="inquiry" aria-labelledby="inquiry-heading" className="scroll-mt-28 bg-paper">
        <div className="shell py-section md:py-section-lg">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
            <div>
              <p className="eyebrow">Get in touch</p>
              <h2 id="inquiry-heading" className="display-2 mt-5 max-w-[16ch]">
                Start a {division.shortName.toLowerCase()} inquiry
              </h2>
              <p className="mt-6 max-w-prose text-body text-ink-soft">
                This form goes straight to the {division.name.toLowerCase()} team. Prefer to talk?
                Call{' '}
                <a
                  href={telHref}
                  className="phone-number font-medium text-accent-ink underline underline-offset-4"
                >
                  {settings.contact.phoneDisplay}
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
              <a
                href={waHref}
                data-cta="whatsapp"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost mt-8"
              >
                <WhatsAppIcon />
                Message on WhatsApp
              </a>
            </div>

            <InquiryForm form={division.form} source={`division:${division.slug}`} />
          </div>
        </div>
      </section>

      {/* --------------------------------------------- other divisions */}
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
          <DivisionGrid excludeSlug={division.slug} />
        </div>
      </section>

      <CTABand />
    </div>
  );
}
