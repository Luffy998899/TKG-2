import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { site, contactLinks } from '@/config/site';
import { getSiteSettings } from '@/lib/settings';
import { positions, RESUME_MAX_MB } from '@/config/careers';
import { mediaMeta, imageSizes } from '@/lib/images';
import { divisions } from '@/config/divisions';
import { ApplicationForm } from '@/components/careers/ApplicationForm';
import { CTABand } from '@/components/CTABand';
import { Reveal } from '@/components/Reveal';
import { ArrowIcon, CheckIcon, MailIcon, PhoneIcon } from '@/components/icons';
import { breadcrumbJsonLd, jobPostingJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Careers',
  description: `${site.legalName} is hiring across its ${divisions.length} divisions. Open sales and appointment-setting roles in the ${site.serviceArea[0]}, with one application form for every position.`,
  alternates: { canonical: '/careers' },
  openGraph: {
    title: `Careers | ${site.name}`,
    description: `Open roles at ${site.legalName}, and a route in for people we have not posted a role for yet.`,
    url: '/careers',
  },
};

export default async function CareersPage() {
  const settings = await getSiteSettings();
  const { tel: telHref, mail: mailHref } = contactLinks(settings);
  const hero = mediaMeta('careers-hero');

  return (
    <>
      {positions.map((position) => (
        <script
          key={position.id}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd(position)) }}
        />
      ))}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Careers', path: '/careers' },
            ]),
          ),
        }}
      />

      {/* ------------------------------------------------------------ hero */}
      <section data-header-dark className="on-night relative overflow-hidden bg-night">
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
        {/* Same two-layer scrim logic as the homepage: a flat wash for the
            whole frame, then a bottom-left weighting under the copy. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-night/70" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-night via-night/75 to-night/35"
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
              <li className="text-paper">Careers</li>
            </ol>
          </nav>

          {/* No "Careers" eyebrow here: the breadcrumb directly above already
              says Careers, and the two stacked read as the word twice. */}
          <h1 className="max-w-[16ch] font-display text-[clamp(2.5rem,10vw,4.5rem)] font-semibold leading-[1.0] tracking-[-0.04em] text-paper">
            Come build this with us.
          </h1>
          <p className="mt-6 max-w-prose text-body-lg text-paper/75">
            {settings.legalName} is growing across {divisions.length} divisions, and we are looking for
            motivated people to join. If you can hold a conversation and you want to be paid for
            what you actually close, there is a seat here.
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <a href="#open-positions" className="btn btn-primary">
              See open positions
              <ArrowIcon width={16} height={16} />
            </a>
            <a href="#apply" className="btn btn-inverse">
              Apply now
            </a>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- why us */}
      <section aria-labelledby="why-heading" className="border-b border-line bg-paper">
        <Reveal className="shell py-section">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div data-reveal>
              <p className="eyebrow">Working here</p>
              <h2 id="why-heading" className="display-2 mt-5 max-w-[14ch]">
                Small company. Real ownership.
              </h2>
            </div>
            <dl data-reveal className="grid gap-8 sm:grid-cols-3">
              {[
                {
                  term: 'You sell across divisions',
                  detail: `Security, telecom, automotive and the rest. One customer conversation can touch several of our ${divisions.length} divisions, which means more ways to say yes.`,
                },
                {
                  term: 'Earnings follow results',
                  detail:
                    'Commission-based roles, so the ceiling is set by your pipeline rather than by a pay band.',
                },
                {
                  term: 'Experience is welcome, not required',
                  detail:
                    'We would rather train someone who communicates well than inherit someone else’s habits.',
                },
              ].map((item) => (
                <div key={item.term}>
                  <span aria-hidden className="mb-4 block h-px w-8 bg-accent" />
                  <dt className="font-display text-body-lg font-semibold text-ink">{item.term}</dt>
                  <dd className="mt-2 text-caption text-ink-soft">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------- open positions */}
      <section
        id="open-positions"
        aria-labelledby="positions-heading"
        className="scroll-mt-24 bg-paper-sunk"
      >
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-6 md:mb-14">
            <div data-reveal>
              <p className="eyebrow">Open positions</p>
              <h2 id="positions-heading" className="display-2 mt-5 max-w-[16ch]">
                {positions.length} roles open right now.
              </h2>
            </div>
            <p data-reveal className="max-w-[34ch] text-body text-ink-soft">
              Every role below uses the same application form. Pick one and we will come back to
              you.
            </p>
          </Reveal>

          {/*
            Rendered from src/config/careers.ts. Adding a role is a config
            entry, not a layout change - which is the whole point, because the
            next set (security sales, telecom, cleaning, moving, automotive,
            office/admin) is already on the way.
          */}
          <Reveal as="ul" className="grid gap-5 lg:grid-cols-2">
            {positions.map((position) => (
              <li key={position.id} data-reveal>
                <article
                  id={position.id}
                  className="card flex h-full scroll-mt-24 flex-col p-6 md:p-9"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip">{position.employmentType}</span>
                    <span className="chip">{position.location}</span>
                  </div>

                  <h3 className="mt-5 font-display text-h3 font-semibold text-ink">
                    {position.title}
                  </h3>
                  <p className="mt-3 max-w-prose text-body text-ink-soft">{position.summary}</p>

                  <div className="mt-8 grid gap-8 sm:grid-cols-2">
                    <div>
                      <p className="eyebrow">What you&rsquo;ll do</p>
                      <ul className="mt-3 grid gap-2">
                        {position.responsibilities.map((item) => (
                          <li key={item} className="flex items-start gap-2.5">
                            <CheckIcon
                              width={15}
                              height={15}
                              className="mt-[0.28rem] shrink-0 text-accent"
                            />
                            <span className="text-caption text-ink-soft">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="eyebrow">What we&rsquo;re looking for</p>
                      <ul className="mt-3 grid gap-2">
                        {position.requirements.map((item) => (
                          <li key={item} className="flex items-start gap-2.5">
                            <CheckIcon
                              width={15}
                              height={15}
                              className="mt-[0.28rem] shrink-0 text-accent"
                            />
                            <span className="text-caption text-ink-soft">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* mt-auto pins the action to the bottom, so two cards of
                      different copy length still end on the same line. */}
                  <div className="mt-auto pt-8">
                    <p className="text-caption text-ink-mute">
                      <span className="font-semibold text-ink-soft">Compensation:</span>{' '}
                      {position.compensation}
                    </p>
                    <Link
                      href={`/careers?role=${position.id}#apply`}
                      className="btn btn-accent mt-5 w-full sm:w-auto"
                    >
                      Apply now
                      <ArrowIcon width={16} height={16} />
                    </Link>
                  </div>
                </article>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------- apply */}
      <section id="apply" aria-labelledby="apply-heading" className="scroll-mt-24 bg-paper">
        <div className="shell py-section md:py-section-lg">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
            <div>
              <p className="eyebrow">Application</p>
              <h2 id="apply-heading" className="display-2 mt-5 max-w-[14ch]">
                One form, every role.
              </h2>
              <p className="mt-6 max-w-prose text-body text-ink-soft">
                Takes about three minutes. If you would rather talk first, call{' '}
                <a
                  href={telHref}
                  className="phone-number font-medium text-accent-ink underline underline-offset-4"
                >
                  {settings.contact.phoneDisplay}
                </a>
                .
              </p>

              <p className="mt-8 rounded-card border border-line bg-paper-sunk p-5 text-caption text-ink-soft">
                Attach your resume as a PDF or Word document (up to {RESUME_MAX_MB}MB). It is
                stored securely and only seen by the people doing the hiring.
              </p>
            </div>

            <ApplicationForm />
          </div>
        </div>
      </section>

      {/* ------------------------------------------- future opportunities */}
      <section
        aria-labelledby="future-heading"
        className="border-t border-line bg-paper-sunk"
      >
        <Reveal className="shell py-section">
          <div className="card grid gap-8 p-7 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-center md:p-12">
            <div data-reveal>
              <p className="eyebrow">Nothing quite right?</p>
              <h2 id="future-heading" className="display-3 mt-4 max-w-[18ch]">
                Don&rsquo;t see the right position?
              </h2>
              <p className="mt-4 max-w-prose text-body text-ink-soft">
                We open roles across security, telecom, cleaning, moving, automotive and
                office administration as the divisions grow. Send your resume anyway and tell us
                what you are good at. We keep them on file and go there first.
              </p>
            </div>
            <div data-reveal className="flex flex-wrap gap-3 md:justify-end">
              <Link href="/careers?role=future#apply" className="btn btn-accent">
                Send us your resume
                <ArrowIcon width={16} height={16} />
              </Link>
              <a href={mailHref} className="btn btn-ghost">
                <MailIcon />
                Email us
              </a>
              <a href={telHref} data-cta="call" className="btn btn-ghost">
                <PhoneIcon />
                <span className="phone-number">{settings.contact.phoneDisplay}</span>
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      <CTABand
        title="Questions before you apply?"
        body="Call or message us. We would rather answer them now than have you guess."
      />
    </>
  );
}
