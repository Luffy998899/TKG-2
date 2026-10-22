import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { site } from '@/config/site';
import { getDivision, divisionPath } from '@/config/divisions';
import { serviceGuides, getServiceGuide, guideForDivision, guidePath } from '@/config/service-guides';
import { themeVars } from '@/config/theme';
import { pageMetadata, serializeJsonLd } from '@/lib/seo';
import { breadcrumbJsonLd, faqJsonLd } from '@/lib/jsonld';
import { FaqAccordion } from '@/components/security/FaqAccordion';
import { ArrowIcon, CheckIcon } from '@/components/icons';

interface Params { params: { slug: string } }
export const dynamicParams = false;
export function generateStaticParams() { return serviceGuides.map(({ slug }) => ({ slug })); }
export function generateMetadata({ params }: Params): Metadata {
  const guide = getServiceGuide(params.slug);
  return guide ? pageMetadata(guide.seoTitle, guide.description, guidePath(guide.slug)) : {};
}

export default function ServiceGuidePage({ params }: Params) {
  const guide = getServiceGuide(params.slug);
  if (!guide) notFound();
  const division = getDivision(guide.division)!;
  const servicePath = divisionPath(division.slug);
  const inquiryId = ({ automotive: 'requirements', telecommunications: 'check', 'security-smart-home': 'build' } as Record<string, string>)[division.slug] ?? 'inquiry';
  const url = new URL(guidePath(guide.slug), site.url).toString();
  const relatedGuides = guide.relatedDivisions.map(guideForDivision).filter((item) => item !== undefined);
  return (
    <div style={themeVars(division.theme)}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Planning guides', path: '/guides' }, { name: guide.title, path: guidePath(guide.slug) }])) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
        '@context': 'https://schema.org', '@type': 'WebPage', '@id': `${url}#webpage`, url,
        name: guide.title, description: guide.description, inLanguage: 'en-CA',
        isPartOf: { '@id': `${site.url}#website` }, publisher: { '@id': `${site.url}#organization` },
        about: { '@type': 'Service', name: division.name, url: new URL(servicePath, site.url).toString(), provider: { '@id': `${site.url}#organization` } },
      }) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd(guide.faqs)) }} />
      <article>
        <header className="border-b border-line bg-paper">
          <div className="shell pb-14 pt-[calc(var(--header-h)+3rem)] md:pb-20 md:pt-[calc(var(--header-h)+5rem)]">
            <nav aria-label="Breadcrumb" className="mb-8 text-caption text-ink-mute"><ol className="flex flex-wrap gap-2"><li><Link href="/" className="underline underline-offset-4">Home</Link></li><li aria-hidden>/</li><li><Link href="/guides" className="underline underline-offset-4">Planning guides</Link></li><li aria-hidden>/</li><li>{division.name}</li></ol></nav>
            <p className="eyebrow-accent">{division.name} · Planning guide</p>
            <h1 className="mt-5 max-w-[25ch] font-display text-[clamp(2.1rem,6vw,4rem)] font-semibold leading-[1.08] tracking-[-0.035em] text-ink">{guide.title}</h1>
            <p className="mt-7 max-w-prose text-lead text-ink-soft">{guide.intro}</p>
            <p className="mt-5 text-caption text-ink-mute">From TKG Ventures Ltd · Lower Mainland &amp; Fraser Valley, BC</p>
            <Link href={servicePath} className="btn btn-accent mt-7">Explore {division.name.toLowerCase()} <ArrowIcon width={18} height={18} /></Link>
          </div>
        </header>
        <div className="shell grid gap-12 py-section md:py-section-lg lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
          <div className="min-w-0">
            <nav aria-label="On this page" className="mb-12 rounded-panel border border-line bg-paper-raised p-6">
              <p className="eyebrow">In this guide</p>
              <ul className="mt-4 space-y-3">{guide.sections.map((section) => <li key={section.id}><a href={`#${section.id}`} className="text-body text-accent-ink underline underline-offset-4">{section.title}</a></li>)}<li><a href="#questions" className="text-body text-accent-ink underline underline-offset-4">Common questions</a></li></ul>
            </nav>
            <div className="space-y-12">
              {guide.sections.map((section) => (
                <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-28">
                  <h2 id={`${section.id}-heading`} className="font-display text-[clamp(1.5rem,3vw,2.1rem)] font-semibold leading-tight text-ink">{section.title}</h2>
                  {section.paragraphs.map((paragraph) => <p key={paragraph} className="mt-5 max-w-prose text-body-lg text-ink-soft">{paragraph}</p>)}
                  {section.checklist ? <ul className="mt-6 space-y-3 rounded-panel bg-paper-raised p-6">{section.checklist.map((item) => <li key={item} className="flex gap-3 text-body text-ink-soft"><CheckIcon width={18} height={18} className="mt-1 shrink-0 text-accent-ink" /><span>{item}</span></li>)}</ul> : null}
                </section>
              ))}
              <section id="questions" aria-labelledby="questions-heading" className="scroll-mt-28">
                <h2 id="questions-heading" className="mb-6 font-display text-2xl font-semibold text-ink md:text-3xl">Common questions</h2>
                <FaqAccordion faqs={guide.faqs} />
              </section>
            </div>
          </div>
          <aside aria-labelledby="next-step-heading" className="min-w-0">
            <div className="rounded-panel border border-line bg-paper-raised p-6 lg:sticky lg:top-28">
              <p className="eyebrow">Your next step</p>
              <h2 id="next-step-heading" className="mt-4 font-display text-card-title font-semibold">Get a scope for your inquiry.</h2>
              <p className="mt-4 text-body text-ink-soft">Share the details that apply to your situation. The team confirms availability, the work involved and the next steps.</p>
              <Link href={`${servicePath}#${inquiryId}`} className="btn btn-accent mt-6 w-full">Ask the team <ArrowIcon width={18} height={18} /></Link>
              <Link href="/contact" className="mt-4 block text-center text-caption text-accent-ink underline underline-offset-4">Contact TKG Ventures</Link>
            </div>
          </aside>
        </div>
      </article>
      <section aria-labelledby="related-guides-heading" className="border-t border-line bg-paper-sunk">
        <div className="shell py-section">
          <h2 id="related-guides-heading" className="font-display text-2xl font-semibold text-ink md:text-3xl">Related planning guides</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-2">{relatedGuides.map((related) => <Link key={related.slug} href={guidePath(related.slug)} className="card card-interactive p-6"><h3 className="font-display text-card-title font-semibold">{related.title}</h3><p className="mt-3 text-body text-ink-soft">{related.description}</p></Link>)}</div>
          <Link href="/guides" className="mt-7 inline-flex items-center gap-2 font-semibold text-accent-ink underline underline-offset-4">All eight service guides <ArrowIcon width={18} height={18} /></Link>
        </div>
      </section>
    </div>
  );
}
