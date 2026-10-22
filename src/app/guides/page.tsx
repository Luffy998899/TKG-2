import type { Metadata } from 'next';
import Link from 'next/link';
import { pageMetadata, serializeJsonLd } from '@/lib/seo';
import { breadcrumbJsonLd } from '@/lib/jsonld';
import { site } from '@/config/site';
import { getDivision, divisionPath } from '@/config/divisions';
import { serviceGuides, guidePath } from '@/config/service-guides';
import { themeVars } from '@/config/theme';
import { ArrowIcon } from '@/components/icons';

export const metadata: Metadata = pageMetadata('Home & Business Service Planning Guides', 'Practical TKG guides for security, internet, vehicle sourcing, realtor referrals, moving, cleaning, staffing and business marketing in BC.', '/guides');

export default function GuidesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Planning guides', path: '/guides' }])) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: 'TKG Ventures service planning guides', url: `${site.url}/guides`,
        isPartOf: { '@id': `${site.url}#website` },
        mainEntity: { '@type': 'ItemList', itemListElement: serviceGuides.map((guide, index) => ({ '@type': 'ListItem', position: index + 1, name: guide.title, url: new URL(guidePath(guide.slug), site.url).toString() })) },
      }) }} />
      <section className="border-b border-line bg-paper">
        <div className="shell pb-16 pt-[calc(var(--header-h)+3.5rem)] md:pb-20 md:pt-[calc(var(--header-h)+5rem)]">
          <nav aria-label="Breadcrumb" className="mb-8 text-caption text-ink-mute"><Link href="/" className="underline underline-offset-4">Home</Link><span aria-hidden> / </span><span>Planning guides</span></nav>
          <p className="eyebrow">Plan with TKG Ventures</p>
          <h1 className="display-1 mt-5 max-w-[19ch]">Know what to ask before you book.</h1>
          <p className="mt-6 max-w-prose text-lead text-ink-soft">Practical checklists for our eight home and business services. Understand the scope, gather the details and start a more useful conversation with the team.</p>
          <p className="mt-4 max-w-prose text-body text-ink-mute">Serving the Lower Mainland and Fraser Valley, BC. Availability and the final scope are confirmed for each inquiry.</p>
        </div>
      </section>
      <section aria-label="Guides by service" className="bg-paper-sunk">
        <div className="shell grid gap-6 py-section sm:grid-cols-2 md:py-section-lg">
          {serviceGuides.map((guide) => {
            const division = getDivision(guide.division)!;
            return (
              <article key={guide.slug} style={themeVars(division.theme)} className="card flex flex-col border-t-4 border-t-accent p-7 md:p-9">
                <Link href={divisionPath(division.slug)} className="eyebrow-accent self-start hover:underline">{division.name}</Link>
                <h2 className="mt-4 font-display text-card-title font-semibold text-ink"><Link href={guidePath(guide.slug)} className="hover:text-accent-ink hover:underline">{guide.title}</Link></h2>
                <p className="mt-4 text-body text-ink-soft">{guide.description}</p>
                <Link href={guidePath(guide.slug)} className="mt-auto inline-flex items-center gap-2 pt-7 text-caption font-semibold text-accent-ink">Read the {division.shortName.toLowerCase()} guide <ArrowIcon width={18} height={18} /></Link>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}
