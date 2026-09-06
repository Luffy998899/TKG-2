import { site } from '@/config/site';
import { divisions } from '@/config/divisions';
import { Reveal } from '@/components/Reveal';
import { CountUp } from '@/components/CountUp';

/**
 * The proof moment, directly under the hero.
 *
 * This is the section that answers "is this a real company or a landing
 * page". It sits high on purpose: a visitor who has just read that one
 * company does eight things needs a reason to believe it before they will
 * read anything else.
 *
 * The figures come from src/config/site.ts, where the note explains that they
 * are supplied by the business. A `null` value is filled in from the live
 * config here rather than typed, so the division count cannot drift.
 */

const stats = site.proof.map((stat) => ({
  ...stat,
  value: stat.value ?? String(divisions.length),
}));

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
                <CountUp
                  value={stat.value}
                  className="block font-display text-h2 font-semibold tabular-nums text-ink"
                />
                {/* Not `.eyebrow`: these labels are full phrases rather than
                    one or two words, and uppercase tracking at that length is
                    hard work to read. */}
                <span className="mt-3 block max-w-[22ch] text-caption font-medium leading-snug text-ink-soft">
                  {stat.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>

        {/* Separated by space rather than a drawn line. The rule that used to
            sit here read as filler. */}
        <div
          data-reveal
          className="mt-14 flex flex-col gap-6 md:flex-row md:items-center md:gap-10"
        >
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
