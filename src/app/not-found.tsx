import Link from 'next/link';
import type { Metadata } from 'next';
import { divisions, divisionPath } from '@/config/divisions';
import { site, telHref } from '@/config/site';
import { ArrowIcon } from '@/components/icons';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

/** Never a dead end: every route out of here is one tap away. */
export default function NotFound() {
  return (
    <section className="bg-paper">
      <div className="shell pb-24 pt-[calc(var(--header-h)+5rem)] md:pb-32 md:pt-[calc(var(--header-h)+8rem)]">
        <p className="eyebrow">404</p>
        <h1 className="display-1 mt-5 max-w-[16ch]">
          That page isn&rsquo;t here.
        </h1>
        <p className="mt-5 max-w-prose text-lead text-ink-soft">
          It may have moved, or the link may be wrong. Here is everything {site.name} does.
        </p>

        <ul className="mt-10 flex flex-wrap gap-2">
          {divisions.map((division) => (
            <li key={division.slug}>
              <Link
                href={divisionPath(division.slug)}
                className="chip px-4 py-2"
              >
                {division.name}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">
            Back to home
            <ArrowIcon width={16} height={16} />
          </Link>
          <a href={telHref} data-cta="call" className="btn btn-ghost">
            Call {site.contact.phoneDisplay}
          </a>
        </div>
      </div>
    </section>
  );
}
