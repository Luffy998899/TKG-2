import type { Metadata } from 'next';
import Link from 'next/link';
import { Journey } from '@/components/journey/Journey';
import { DivisionGrid } from '@/components/DivisionGrid';
import { TrustStrip } from '@/components/TrustStrip';
import { AudiencePaths } from '@/components/AudiencePaths';
import { CTABand } from '@/components/CTABand';
import { Testimonials } from '@/components/Testimonials';
import { Reveal } from '@/components/Reveal';
import { divisionCountWord } from '@/config/divisions';
import { site } from '@/config/site';
import { divisions } from '@/config/divisions';
import { ArrowIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: `${site.name} | ${site.tagline}`,
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: {
    title: `${site.name} | ${site.tagline}`,
    description: site.description,
    url: '/',
  },
};

const trust = [
  {
    label: 'One point of contact',
    // Counted, not typed. This said "Seven" for a week after the eighth
    // division was added.
    body: `${divisionCountWord.replace(/^./, (c) => c.toUpperCase())} divisions, one phone number. You are never handed off to a stranger.`,
  },
  {
    label: 'Local operators',
    body: `We work across the ${site.serviceArea.join(' and the ')}, not from a call centre somewhere else.`,
  },
  {
    label: 'Licensed where it matters',
    body: 'Regulated work is carried out by appropriately licensed partners, named on each page.',
  },
];

export default function HomePage() {
  return (
    <>
      <Journey />

      {/* ------------------------------------------------------ trust strip */}
      <TrustStrip />

      {/* ------------------------------------------------- what TKG actually is */}
      {/*
        The section the homepage was missing. A visitor could previously
        understand each service and still not understand the company: eight
        divisions read as eight businesses. This says what TKG is in one line,
        then splits the divisions by WHO they serve, which is what makes the
        range look deliberate rather than random.
      */}
      <section aria-labelledby="what-heading" className="bg-paper">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-12 md:mb-16">
            <div data-reveal className="max-w-[52ch]">
              <p className="eyebrow">What we are</p>
              <h2 id="what-heading" className="display-2 mt-5">
                One company for the things that keep landing at once.
              </h2>
              <p className="mt-6 text-body-lg text-ink-soft">
                {site.name} runs {divisions.length} service divisions under one roof. The point is
                not breadth for its own sake. It is that a single relationship covers the things
                people usually have to solve separately, with the same team answering the phone
                each time.
              </p>
            </div>
          </Reveal>

          <AudiencePaths />

          <Reveal className="mt-12">
            <dl data-reveal className="grid gap-8 border-t border-line pt-12 sm:grid-cols-3">
              {trust.map((item) => (
                <div key={item.label}>
                  <dt className="font-display text-body-lg font-semibold text-ink">{item.label}</dt>
                  <dd className="mt-2 text-caption text-ink-soft">{item.body}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------- story */}
      {/*
        Where the company came from. It is the answer to "why does a security
        company also move furniture" - the range grew out of the customers,
        not out of a business plan drawn in a room.
      */}
      <section aria-labelledby="story-heading" className="border-t border-line bg-paper-raised">
        <Reveal className="shell py-section md:py-section-lg">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <div data-reveal>
              <p className="eyebrow">How we got here</p>
              <h2 id="story-heading" className="display-2 mt-5 max-w-[15ch]">
                We started with alarms and internet.
              </h2>
            </div>
            <div data-reveal className="space-y-5">
              {site.story.map((paragraph) => (
                <p key={paragraph.slice(0, 24)} className="max-w-prose text-body-lg text-ink-soft">
                  {paragraph}
                </p>
              ))}
              <Link
                href="/about"
                className="mt-4 inline-flex items-center gap-2 text-caption font-semibold text-ink underline decoration-line underline-offset-[6px] transition-colors duration-150 hover:decoration-accent"
              >
                More about {site.name}
                <ArrowIcon width={16} height={16} className="text-accent-ink" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* --------------------------------------------------- divisions grid */}
      <section aria-labelledby="divisions-heading" className="border-t border-line bg-paper-sunk">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-8 md:mb-16">
            <div data-reveal>
              <p className="eyebrow">Divisions</p>
              <h2 id="divisions-heading" className="display-2 mt-5 max-w-[18ch]">
                {divisions.length} divisions. One company behind all of them.
              </h2>
            </div>
            <p data-reveal className="max-w-[34ch] text-body text-ink-soft">
              Every division has its own team, its own page and its own inquiry form. Start
              wherever your question fits.
            </p>
          </Reveal>

          <DivisionGrid />
        </div>
      </section>

      <Testimonials tone="paper" />

      <CTABand />
    </>
  );
}
