import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { divisions, getDivision, divisionPath } from '@/config/divisions';
import { themeVars } from '@/config/theme';
import { imageMeta, imageSizes } from '@/lib/images';
import { site, telHref, waHref } from '@/config/site';
import { InquiryForm } from '@/components/form/InquiryForm';
import { DivisionGrid } from '@/components/DivisionGrid';
import { Reveal } from '@/components/Reveal';
import { ArrowIcon, PhoneIcon, WhatsAppIcon, shapeMarks } from '@/components/icons';
import { breadcrumbJsonLd, serviceJsonLd } from '@/lib/jsonld';

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

export default function DivisionPage({ params }: Params) {
  const division = getDivision(params.division);
  if (!division) notFound();

  const Mark = shapeMarks[division.scene.shape];
  const meta = imageMeta(division.slug);
  const index = divisions.indexOf(division);

  return (
    // One wrapper sets --accent* for the whole page: buttons, focus rings,
    // rules, form validation states and the image wash all pick it up.
    <div style={themeVars(division.theme)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd(division.slug)) }}
      />
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
      <section className="relative overflow-hidden border-b border-line bg-paper">
        {/* A single soft accent wash behind the hero — the "one gradient
            field" move from the recent.design corporate references. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[70%] bg-gradient-to-b from-accent-soft to-transparent"
        />

        <div className="shell relative pb-16 pt-[calc(var(--header-h)+3.5rem)] md:pb-24 md:pt-[calc(var(--header-h)+6rem)]">
          <nav aria-label="Breadcrumb" className="mb-10">
            <ol className="flex items-center gap-2 text-caption text-ink-mute">
              <li>
                <Link href="/" className="transition-colors hover:text-accent-ink">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="text-ink">{division.name}</li>
            </ol>
          </nav>

          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16">
            <div>
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-contrast">
                  <Mark width={24} height={24} />
                </span>
                <span className="counter">
                  Division {String(index + 1).padStart(2, '0')} /{' '}
                  {String(divisions.length).padStart(2, '0')}
                </span>
              </div>

              {/*
                Not `display-1`. Division names run long - "Telecommunications"
                is one unbreakable 18-character word - so this H1 is fluid
                rather than stepped: it scales with the viewport and caps at the
                h1 size, which keeps it inside its column at every width
                without hyphenating. Tracking and leading are set explicitly
                because an arbitrary font-size opts out of the type scale.
              */}
              <h1 className="mt-8 max-w-[18ch] hyphens-auto font-display text-[clamp(2.25rem,7.2vw,3.75rem)] font-semibold leading-[1.02] tracking-[-0.035em] text-ink">
                {division.name}
              </h1>
              <p className="eyebrow-accent mt-5">{division.tagline}</p>
              <p className="mt-6 max-w-measure text-lead text-ink-soft">{division.summary}</p>

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

              <div className="mt-10 flex flex-wrap gap-3">
                <a href="#inquiry" className="btn btn-accent">
                  {division.form.submitLabel.replace(/^Send |^Request /, 'Start ')}
                  <ArrowIcon width={16} height={16} />
                </a>
                <a href={telHref} data-cta="call" className="btn btn-ghost">
                  <PhoneIcon />
                  <span className="phone-number">{site.contact.phoneDisplay}</span>
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

            {/* The hero image. `priority` because it is above the fold on
                every division page — the one image on the site that is. */}
            <div className="frame aspect-[4/3] w-full rounded-panel shadow-lift lg:aspect-[5/4]">
              {meta ? (
                <Image
                  src={meta.src}
                  alt={division.image.alt}
                  width={meta.width}
                  height={meta.height}
                  sizes={imageSizes.pageHero}
                  placeholder="blur"
                  blurDataURL={meta.blurDataURL}
                  priority
                  className="h-full w-full object-cover"
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------- regulatory notice */}
      {division.notice ? (
        <aside aria-label="Important notice" className="border-b border-line bg-paper-sunk">
          <div className="shell py-6">
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
              <h2 id="services-heading" className="display-2 mt-5 max-w-[20ch]">
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
                  {site.contact.phoneDisplay}
                </a>
                , or message the same number on{' '}
                <a
                  href={waHref}
                  data-cta="whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="phone-number font-medium text-accent-ink underline underline-offset-4"
                >
                  WhatsApp
                </a>
                .
              </p>
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
              <p className="eyebrow">Also from {site.name}</p>
              <h2 id="other-heading" className="display-2 mt-5 max-w-[20ch]">
                The other divisions
              </h2>
            </div>
          </Reveal>
          <DivisionGrid excludeSlug={division.slug} />
        </div>
      </section>
    </div>
  );
}
