import type { Metadata } from 'next';
import Link from 'next/link';
import { Journey } from '@/components/journey/Journey';
import { DivisionGrid } from '@/components/DivisionGrid';
import { TrustStrip } from '@/components/TrustStrip';
import { CTABand } from '@/components/CTABand';
import { Testimonials } from '@/components/Testimonials';
import { Reveal } from '@/components/Reveal';
import { site } from '@/config/site';
import { divisions } from '@/config/divisions';
import { ArrowIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: `${site.name} - ${site.tagline}`,
  description: site.description,
  alternates: { canonical: '/' },
  openGraph: {
    title: `${site.name} - ${site.tagline}`,
    description: site.description,
    url: '/',
  },
};

const trust = [
  {
    label: 'One point of contact',
    body: 'Seven divisions, one phone number. You are never handed off to a stranger.',
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

      {/* --------------------------------------------------- about / intro */}
      <section aria-labelledby="about-heading" className="bg-paper">
        <Reveal className="shell py-section md:py-section-lg">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div data-reveal>
              <p className="eyebrow">About</p>
              <h2 id="about-heading" className="display-2 mt-5 max-w-[16ch]">
                An umbrella company, not a directory.
              </h2>
            </div>

            <div data-reveal>
              <p className="max-w-prose text-body-lg text-ink-soft">
                {site.name} runs {divisions.length} service divisions under one roof. The point is
                not breadth for its own sake &mdash; it is that a single relationship covers the
                things people usually have to solve separately.
              </p>

              <dl className="mt-12 grid gap-8 sm:grid-cols-3">
                {trust.map((item) => (
                  <div key={item.label}>
                    <span aria-hidden className="mb-4 block h-px w-8 bg-accent" />
                    <dt className="font-display text-body-lg font-semibold text-ink">
                      {item.label}
                    </dt>
                    <dd className="mt-2 text-caption text-ink-soft">{item.body}</dd>
                  </div>
                ))}
              </dl>

              <Link
                href="/about"
                className="mt-12 inline-flex items-center gap-2 text-caption font-semibold text-ink underline decoration-line underline-offset-[6px] transition-colors duration-150 hover:decoration-accent"
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
