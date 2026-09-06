import Link from 'next/link';
import { divisions, divisionPath } from '@/config/divisions';
import { themeVars } from '@/config/theme';
import { ArrowIcon, shapeMarks } from '@/components/icons';
import { Reveal } from '@/components/Reveal';

/**
 * The two ways in: home and personal, or business.
 *
 * WHY THIS SECTION EXISTS. Eight service pages listed flat read as eight
 * unrelated businesses that happen to share a logo. Sorted by WHO they serve,
 * the same eight read as one company covering both halves of a customer's
 * life - which is the actual proposition, and the thing the homepage was
 * failing to say.
 *
 * A division that genuinely serves both appears in both columns. That is not
 * duplication to pad the list; it is the point. The security team fits a
 * house and a warehouse, and a customer arriving from either side should find
 * it where they are looking.
 *
 * Everything here is derived from the `audience` field in the divisions
 * config, so a new division lands in the right column by being described
 * accurately rather than by editing this file.
 */

const PATHS = [
  {
    id: 'home' as const,
    eyebrow: 'For your home and life',
    title: 'Everything a household needs, from one number.',
    body: 'A move, an alarm, the internet, the clean afterwards, the car. Jobs that all tend to land at once, handled by people who already know your situation.',
  },
  {
    id: 'business' as const,
    eyebrow: 'For your business',
    title: 'The operational jobs, off your desk.',
    body: 'Premises secured, connectivity sorted, sites cleaned, shifts covered, and growth work when you want it. One relationship instead of five suppliers.',
  },
];

export function AudiencePaths() {
  return (
    <Reveal as="div" className="grid gap-5 lg:grid-cols-2">
      {PATHS.map((path) => {
        const items = divisions.filter((division) => division.audience.includes(path.id));

        return (
          <section
            key={path.id}
            data-reveal
            aria-labelledby={`path-${path.id}`}
            className="card flex flex-col p-7 md:p-9"
          >
            <p className="eyebrow">{path.eyebrow}</p>
            <h3
              id={`path-${path.id}`}
              className="mt-4 max-w-[18ch] font-display text-card-title font-semibold leading-tight text-ink md:text-h3"
            >
              {path.title}
            </h3>
            <p className="mt-4 max-w-prose text-body text-ink-soft">{path.body}</p>

            <ul className="mt-8 flex flex-1 flex-col gap-1">
              {items.map((division) => {
                const Mark = shapeMarks[division.scene.shape];
                return (
                  <li key={division.slug} style={themeVars(division.theme)}>
                    <Link
                      href={divisionPath(division.slug)}
                      className="group -mx-3 flex items-start gap-4 rounded-2xl px-3 py-3 transition-colors duration-200 hover:bg-accent-soft"
                    >
                      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink transition-colors duration-200 group-hover:bg-accent group-hover:text-accent-contrast">
                        <Mark width={18} height={18} />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-display text-body font-semibold text-ink">
                          {division.name}
                          <ArrowIcon
                            width={14}
                            height={14}
                            className="shrink-0 text-accent-ink opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                          />
                        </span>
                        <span className="mt-0.5 block text-caption text-ink-soft">
                          {division.audienceLine}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </Reveal>
  );
}
