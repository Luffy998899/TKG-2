import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/config/site';
import { divisions } from '@/config/divisions';
import { DivisionGrid } from '@/components/DivisionGrid';
import { CTABand } from '@/components/CTABand';
import { Reveal } from '@/components/Reveal';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { ArrowIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'About us',
  description: `${site.name} is an umbrella company running ${divisions.length} service divisions under one roof, serving the ${site.serviceArea.join(' and the ')}.`,
  alternates: { canonical: '/about' },
  openGraph: {
    title: `About ${site.name}`,
    description: `${site.name} runs ${divisions.length} service divisions under one roof.`,
    url: '/about',
  },
};

const principles = [
  {
    title: 'One relationship, many problems',
    body: 'Most people end up juggling separate providers for things that keep landing at the same time - a move, a new alarm, an internet switch, a car. Keeping them under one roof means one number to call and one team that already knows your situation.',
  },
  {
    title: 'The right licence for the job',
    body: 'Some of this work is regulated and some is not. Where a licence is required - real estate most obviously - the work is carried out by an appropriately licensed partner, and we name them on the relevant page rather than blurring the line.',
  },
  {
    title: 'Local, not a call centre',
    body: `We work across the ${site.serviceArea.join(' and the ')}. That is a deliberate limit: it is the area we can actually turn up in.`,
  },
];

export default function AboutPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'About us', path: '/about' },
            ]),
          ),
        }}
      />

      <section className="border-b border-line bg-paper">
        <div className="shell pb-16 pt-[calc(var(--header-h)+3.5rem)] md:pb-24 md:pt-[calc(var(--header-h)+6rem)]">
          <p className="eyebrow">About us</p>
          <h1 className="display-1 mt-5 max-w-[16ch]">
            One company. Multiple solutions.
          </h1>
          <p className="mt-6 max-w-prose text-lead text-ink-soft">{site.description}</p>
          <p className="mt-5 max-w-prose text-body-lg text-ink-soft">
            {site.descriptionLong}
          </p>
        </div>
      </section>

      <section className="bg-paper">
        <Reveal className="shell py-section md:py-section-lg">
          <div className="grid gap-16 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div data-reveal>
              <p className="eyebrow">How we work</p>
              <h2 className="display-2 mt-5 max-w-[16ch]">
                Breadth is only useful if it is joined up.
              </h2>
            </div>

            <dl data-reveal className="space-y-12">
              {principles.map((principle) => (
                <div key={principle.title}>
                  <dt className="display-3">{principle.title}</dt>
                  <dd className="mt-3 max-w-prose text-body-lg text-ink-soft">{principle.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
      </section>

      <section className="border-t border-line bg-paper-sunk">
        <div className="shell py-section md:py-section-lg">
          <Reveal className="mb-12 md:mb-16">
            <div data-reveal>
              <p className="eyebrow">Divisions</p>
              <h2 className="display-2 mt-5 max-w-[20ch]">
                What sits under the umbrella
              </h2>
            </div>
          </Reveal>
          <DivisionGrid />

          <Reveal className="mt-12">
            <p data-reveal className="max-w-prose text-body text-ink-soft">
              Company details, hours and registration information live on the{' '}
              <Link href="/contact" className="underline underline-offset-4 hover:text-ink">
                contact page
              </Link>
              . Anything not covered there, ask us.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="bg-paper">
        <Reveal className="shell py-section md:py-section-lg">
          <div data-reveal className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="display-2 max-w-[18ch]">
              Not sure which division you need?
            </h2>
            <Link href="/quote" className="btn btn-primary" data-cta="quote">
              Tell us what you need
              <ArrowIcon width={16} height={16} />
            </Link>
          </div>
        </Reveal>
      </section>

      <CTABand />
    </>
  );
}
