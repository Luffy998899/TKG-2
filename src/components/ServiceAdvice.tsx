import Link from 'next/link';
import { getDivision, divisionPath } from '@/config/divisions';
import { guideForDivision, guidePath } from '@/config/service-guides';
import { ArrowIcon, CheckIcon } from '@/components/icons';

/** Visible buying help and contextual links, rendered on every service page. */
export function ServiceAdvice({ division }: { division: string }) {
  const guide = guideForDivision(division);
  if (!guide) return null;
  return (
    <section aria-labelledby="planning-heading" className="border-t border-line bg-paper-raised">
      <div className="shell py-section md:py-section-lg">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="eyebrow">Before you book</p>
            <h2 id="planning-heading" className="display-2 mt-5 max-w-[20ch]">{guide.serviceHeading}</h2>
            <p className="mt-6 max-w-prose text-body-lg text-ink-soft">{guide.serviceIntro}</p>
          </div>
          <div className="min-w-0">
            <ul className="space-y-5">
              {guide.quickChecks.map((check) => (
                <li key={check} className="flex items-start gap-3 text-body text-ink-soft">
                  <CheckIcon width={20} height={20} className="mt-1 shrink-0 text-accent-ink" />
                  <span>{check}</span>
                </li>
              ))}
            </ul>
            <Link href={guidePath(guide.slug)} className="mt-8 inline-flex items-start gap-3 font-display text-body-lg font-semibold text-accent-ink underline underline-offset-4">
              <span>{guide.title}</span><ArrowIcon width={20} height={20} className="mt-1 shrink-0" />
            </Link>
            <div className="mt-8 border-t border-line pt-6">
              <p className="text-caption text-ink-mute">Related services</p>
              <ul className="mt-3 flex flex-wrap gap-3">
                {guide.relatedDivisions.map((slug) => {
                  const related = getDivision(slug);
                  return related ? <li key={slug}><Link href={divisionPath(slug)} className="chip">{related.name}</Link></li> : null;
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
