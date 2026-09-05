import { site } from '@/config/site';
import { divisions } from '@/config/divisions';
import { Reveal } from '@/components/Reveal';

/**
 * The trust moment. Two collectui patterns doing the work: a big-numeral /
 * small-label stat row, and a row of partner marques rendered as neutral
 * plates.
 */

const stats = [
  { value: String(divisions.length), label: 'Service divisions' },
  { value: String(site.serviceArea.length), label: 'Regions covered' },
  { value: '1', label: 'Number to call' },
  { value: '3', label: 'Years operating' },
];

/**
 * Confirmed partners only. Brinks is documented on tkg-ventures-ltd.webflow.io
 * ("an authorized dealer of Brinks Home Security"). Add a name here only when
 * the relationship is real; swap a plate for an <Image> of the supplied logo.
 */
const partners = ['Brinks Home Security'];

export function TrustStrip() {
  return (
    <Reveal className="border-y border-line bg-paper-raised">
      <div className="shell py-14 md:py-16">
        <dl
          data-reveal
          className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4"
        >
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="block font-display text-h2 font-semibold tabular-nums text-ink">
                  {stat.value}
                </span>
                <span className="eyebrow mt-2 block">{stat.label}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="rule my-12" />

        <div data-reveal className="flex flex-col gap-6 md:flex-row md:items-center md:gap-10">
          <p className="eyebrow shrink-0 md:max-w-[14ch]">Working alongside</p>
          <ul className="flex flex-wrap items-center gap-3">
            {partners.map((partner) => (
              <li
                key={partner}
                className="flex h-11 items-center rounded-full border border-line bg-paper px-5 font-display text-caption font-semibold tracking-[0.08em] text-ink-soft"
              >
                {partner}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Reveal>
  );
}
