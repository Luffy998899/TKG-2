import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getDivision, divisionPath } from '@/config/divisions';
import {
  pillars,
  products,
  productsInPillar,
  trustPoints,
  audiencePaths,
  whyChoose,
  installProcess,
  testimonials,
  installGallery,
  faqs,
  productPath,
} from '@/config/security';
import { themeVars } from '@/config/theme';
import { site, telHref } from '@/config/site';
import { mediaMeta, imageSizes } from '@/lib/images';
import { InquiryForm } from '@/components/form/InquiryForm';
import { FaqAccordion } from '@/components/security/FaqAccordion';
import { CTABand } from '@/components/CTABand';
import { Reveal } from '@/components/Reveal';
import { ArrowIcon, CheckIcon, PhoneIcon, securityMarks } from '@/components/icons';
import { breadcrumbJsonLd, serviceJsonLd, faqJsonLd } from '@/lib/jsonld';

const SLUG = 'security-smart-home';
const division = getDivision(SLUG)!;

export const metadata: Metadata = {
  title: 'Security & Smart Home',
  description:
    'Alarm systems, cameras, video doorbells and smart-home automation from an authorized Brinks Home Security dealer. Professional installation and 24/7 monitoring across the Lower Mainland.',
  alternates: { canonical: divisionPath(SLUG) },
  openGraph: {
    title: `Security & Smart Home | ${site.name}`,
    description:
      'Protect, Watch and Automate your home or business. An authorized Brinks Home Security dealer, with professional installation and 24/7 monitoring.',
    url: divisionPath(SLUG),
    type: 'website',
  },
};

export default function SecurityPage() {
  const hero = mediaMeta('security-hero');
  const oneApp = mediaMeta('security-one-app');

  return (
    <div style={themeVars(division.theme)}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd(SLUG)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(faqs)) }}
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

      {/* ============================================== 1. FULL-WIDTH HERO */}
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
        {/* Three-layer scrim, same reasoning as the homepage hero: overall
            wash, bottom weight, and a left wedge so the copy always has a floor. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-night/45" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night via-night/60 to-night/20"
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

          <span className="inline-flex items-center gap-2 rounded-full border border-paper/20 bg-night/50 px-3.5 py-2 text-micro font-semibold uppercase text-paper/80 backdrop-blur-sm">
            <span className="text-accent-bright">
              <securityMarks.shield width={16} height={16} />
            </span>
            Authorized Brinks Home Security Dealer
          </span>

          <h1 className="mt-6 max-w-[18ch] font-display text-[clamp(2.5rem,9vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-paper">
            Security that fits the building it protects.
          </h1>
          <p className="mt-6 max-w-prose text-body-lg text-paper/80">
            Alarms, cameras, video doorbells and smart-home automation &mdash; specified for your
            property, installed properly, and monitored around the clock. One system, one app, one
            number to call.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#build" className="btn btn-accent">
              Build My System
              <ArrowIcon width={16} height={16} />
            </a>
            <Link href="/quote" data-cta="quote" className="btn btn-inverse">
              Get a Quote
            </Link>
          </div>
        </div>
      </section>

      {/* ================================================= 2. TRUST STRIP */}
      <section aria-label="What you get" className="border-b border-line bg-paper-raised">
        <ul className="shell grid grid-cols-2 gap-x-6 gap-y-8 py-10 md:grid-cols-4 md:py-12">
          {trustPoints.map((point) => {
            const Mark = securityMarks[point.mark];
            return (
              <li key={point.label} className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
                  <Mark width={22} height={22} />
                </span>
                <span className="font-display text-caption font-semibold leading-tight text-ink">
                  {point.label}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ============================================ 3. PRODUCT CATEGORIES */}
      <section aria-labelledby="pillars-heading" className="bg-paper">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-12 md:mb-16">
            <div data-reveal className="max-w-[46ch]">
              <p className="eyebrow">Three layers</p>
              <h2 id="pillars-heading" className="display-2 mt-5">
                Protect, watch, automate.
              </h2>
              <p className="mt-5 text-body-lg text-ink-soft">
                A complete system does three jobs. Most people start with one and grow into the
                rest &mdash; the panel is built to add to.
              </p>
            </div>
          </Reveal>

          <Reveal as="ul" className="grid gap-5 md:grid-cols-3">
            {pillars.map((pillar) => {
              const image = mediaMeta(pillar.image);
              const items = productsInPillar(pillar.id);
              return (
                <li key={pillar.id} data-reveal>
                  <article className="card flex h-full flex-col overflow-hidden">
                    <div className="frame aspect-[16/10] w-full rounded-none">
                      {image ? (
                        <Image
                          src={image.src}
                          alt={pillar.imageAlt}
                          width={image.width}
                          height={image.height}
                          sizes={imageSizes.productCard}
                          placeholder="blur"
                          blurDataURL={image.blurDataURL}
                          className="frame-img"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col p-6 md:p-7">
                      <h3 className="font-display text-h3 font-semibold text-ink">{pillar.name}</h3>
                      <p className="eyebrow-accent mt-2">{pillar.tagline}</p>
                      <p className="mt-4 text-body text-ink-soft">{pillar.body}</p>
                      <ul className="mt-6 flex flex-wrap gap-2">
                        {items.map((product) => (
                          <li key={product.slug}>
                            <Link href={productPath(product.slug)} className="chip">
                              {product.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </article>
                </li>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* =============================================== 4. PRODUCT CARDS */}
      <section
        id="products"
        aria-labelledby="products-heading"
        className="scroll-mt-24 border-t border-line bg-paper-sunk"
      >
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-10 md:mb-14">
            <div data-reveal>
              <p className="eyebrow">The equipment</p>
              <h2 id="products-heading" className="display-2 mt-5 max-w-[18ch]">
                Everything on one system.
              </h2>
            </div>
          </Reveal>

          <Reveal as="ul" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => {
              const image = mediaMeta(product.image);
              return (
                <li key={product.slug} data-reveal>
                  <Link
                    href={productPath(product.slug)}
                    className="card card-interactive group flex h-full flex-col overflow-hidden focus-visible:outline-offset-4"
                  >
                    <div className="frame aspect-[16/10] w-full rounded-none">
                      {image ? (
                        <Image
                          src={image.src}
                          alt={product.imageAlt}
                          width={image.width}
                          height={image.height}
                          sizes={imageSizes.productCard}
                          placeholder="blur"
                          blurDataURL={image.blurDataURL}
                          className="frame-img"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="font-display text-card-title font-semibold text-ink">
                        {product.name}
                      </h3>
                      <p className="mt-2 text-body text-ink-soft">{product.tagline}</p>
                      <span className="mt-auto inline-flex items-center gap-2 pt-6 text-caption font-semibold text-ink">
                        View details
                        <ArrowIcon
                          width={16}
                          height={16}
                          className="text-accent-ink transition-transform duration-300 ease-out-soft group-hover:translate-x-1"
                        />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* ================================================= 6. ONE APP */}
      <section aria-labelledby="app-heading" className="overflow-hidden bg-paper">
        <div className="shell py-section md:py-section-lg">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="eyebrow">One app</p>
              <h2 id="app-heading" className="display-2 mt-5 max-w-[16ch]">
                The whole system in your pocket.
              </h2>
              <p className="mt-6 max-w-prose text-body-lg text-ink-soft">
                Arm the alarm, watch a camera, unlock the door for a delivery, check the front step
                &mdash; all from one app, whether you are upstairs or in another country.
              </p>
              <ul className="mt-8 grid gap-3">
                {[
                  'Arm and disarm from anywhere',
                  'Live and recorded camera footage',
                  'Lock, unlock and grant access remotely',
                  'Alerts that tell you what happened, not just that something did',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckIcon width={18} height={18} className="mt-0.5 shrink-0 text-accent" />
                    <span className="text-body text-ink">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="frame aspect-[4/3] w-full rounded-panel shadow-lift">
              {oneApp ? (
                <Image
                  src={oneApp.src}
                  alt="A smartphone running the security app, held in one hand."
                  width={oneApp.width}
                  height={oneApp.height}
                  sizes={imageSizes.split}
                  placeholder="blur"
                  blurDataURL={oneApp.blurDataURL}
                  className="frame-img"
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ================================= 7. HOME vs BUSINESS */}
      <section
        aria-labelledby="audience-heading"
        className="border-t border-line bg-paper-sunk"
      >
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-10 md:mb-14">
            <div data-reveal className="max-w-[42ch]">
              <p className="eyebrow">Two paths</p>
              <h2 id="audience-heading" className="display-2 mt-5">
                Home or business?
              </h2>
              <p className="mt-5 text-body-lg text-ink-soft">
                The equipment overlaps; the questions do not. Pick the one that fits and we will
                take it from there.
              </p>
            </div>
          </Reveal>

          <Reveal as="ul" className="grid gap-5 md:grid-cols-2">
            {audiencePaths.map((path) => {
              const image = mediaMeta(path.image);
              return (
                <li key={path.id} data-reveal>
                  <article className="card flex h-full flex-col overflow-hidden">
                    <div className="frame aspect-[16/9] w-full rounded-none">
                      {image ? (
                        <Image
                          src={image.src}
                          alt={path.imageAlt}
                          width={image.width}
                          height={image.height}
                          sizes={imageSizes.split}
                          placeholder="blur"
                          blurDataURL={image.blurDataURL}
                          className="frame-img"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col p-6 md:p-8">
                      <p className="eyebrow-accent">{path.eyebrow}</p>
                      <h3 className="mt-2 font-display text-h3 font-semibold text-ink">
                        {path.title}
                      </h3>
                      <p className="mt-3 text-body text-ink-soft">{path.body}</p>
                      <ul className="mt-6 grid gap-2.5">
                        {path.points.map((point) => (
                          <li key={point} className="flex items-start gap-3">
                            <CheckIcon
                              width={16}
                              height={16}
                              className="mt-0.5 shrink-0 text-accent"
                            />
                            <span className="text-caption text-ink-soft">{point}</span>
                          </li>
                        ))}
                      </ul>
                      <a href="#build" className="btn btn-ghost mt-8 self-start">
                        Build a {path.id} system
                        <ArrowIcon width={16} height={16} />
                      </a>
                    </div>
                  </article>
                </li>
              );
            })}
          </Reveal>
        </div>
      </section>

      {/* ============================================ 8. WHY CHOOSE */}
      <section aria-labelledby="why-heading" className="bg-paper">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-10 md:mb-14">
            <div data-reveal>
              <p className="eyebrow">Why us</p>
              <h2 id="why-heading" className="display-2 mt-5 max-w-[18ch]">
                Why choose TKG for security.
              </h2>
            </div>
          </Reveal>
          <Reveal as="ul" className="grid gap-5 md:grid-cols-2">
            {whyChoose.map((item, i) => (
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

      {/* =============================================== 9. PROCESS */}
      <section aria-labelledby="process-heading" className="border-t border-line bg-paper-sunk">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-10 md:mb-14">
            <div data-reveal>
              <p className="eyebrow">How it works</p>
              <h2 id="process-heading" className="display-2 mt-5 max-w-[16ch]">
                From first call to fully monitored.
              </h2>
            </div>
          </Reveal>
          <Reveal as="ol" className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {installProcess.map((step, i) => (
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

      {/* ======================================= 10. REVIEWS + PHOTOS */}
      {testimonials.length > 0 ? (
        <section aria-labelledby="reviews-heading" className="bg-paper">
          <div className="shell py-section md:py-section-lg">
            <Reveal className="mb-10 md:mb-14">
              <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Reviews</p>
                  <h2 id="reviews-heading" className="display-2 mt-5 max-w-[16ch]">
                    What people say.
                  </h2>
                </div>
                {/* Honest label - these are illustrative until real, permissioned
                    quotes replace them. */}
                <p className="max-w-[28ch] text-caption text-ink-mute">
                  Illustrative examples &mdash; real customer reviews replace these before launch.
                </p>
              </div>
            </Reveal>

            <Reveal as="ul" className="grid gap-5 md:grid-cols-3">
              {testimonials.map((testimonial) => (
                <li key={testimonial.quote} data-reveal className="card flex h-full flex-col p-6 md:p-8">
                  <p className="text-body-lg text-ink">&ldquo;{testimonial.quote}&rdquo;</p>
                  <div className="mt-auto pt-6">
                    <p className="font-display text-caption font-semibold text-ink">
                      {testimonial.name}
                    </p>
                    <p className="mt-1 text-caption text-ink-mute">{testimonial.context}</p>
                  </div>
                </li>
              ))}
            </Reveal>

            {/* Representative installation photography. Labelled, because these
                are not yet TKG's own job photos - see the fetch script header. */}
            <Reveal className="mt-12">
              <ul data-reveal className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {installGallery.map((shot) => {
                  const image = mediaMeta(shot.image);
                  return (
                    <li key={shot.image} className="frame aspect-[4/3] w-full">
                      {image ? (
                        <Image
                          src={image.src}
                          alt={shot.alt}
                          width={image.width}
                          height={image.height}
                          sizes={imageSizes.tile}
                          placeholder="blur"
                          blurDataURL={image.blurDataURL}
                          className="frame-img"
                        />
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-4 text-caption text-ink-mute">
                Representative installation photography.
              </p>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* =================================================== 11. FAQs */}
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
                  {site.contact.phoneDisplay}
                </a>{' '}
                and ask a person.
              </p>
            </div>
            <FaqAccordion faqs={faqs} />
          </div>
        </div>
      </section>

      {/* ============================================ 1/12. BUILD FORM */}
      <section id="build" aria-labelledby="build-heading" className="scroll-mt-24 bg-paper">
        <div className="shell py-section md:py-section-lg">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
            <div>
              <p className="eyebrow">Build my system</p>
              <h2 id="build-heading" className="display-2 mt-5 max-w-[14ch]">
                Tell us about the property.
              </h2>
              <p className="mt-6 max-w-prose text-body text-ink-soft">
                A few details and we will come back with a plan and a price &mdash; no obligation.
                Prefer to talk? Call{' '}
                <a
                  href={telHref}
                  className="phone-number font-medium text-accent-ink underline underline-offset-4"
                >
                  {site.contact.phoneDisplay}
                </a>
                .
              </p>

              {division.notice ? (
                <p className="mt-8 rounded-card border border-accent/25 bg-accent-soft p-5 text-caption text-ink-soft">
                  <strong className="font-semibold text-ink">Authorized dealer:</strong>{' '}
                  {division.notice}
                </p>
              ) : null}
            </div>

            <InquiryForm form={division.form} source={`division:${SLUG}`} />
          </div>
        </div>
      </section>

      {/* ================================================ 12. CLOSING CTA */}
      <CTABand
        title="Ready to build your system?"
        body="Start with a free consultation. We will look at the property, tell you what it actually needs, and quote it honestly."
      />
    </div>
  );
}
