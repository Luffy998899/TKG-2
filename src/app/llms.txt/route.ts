import { site } from '@/config/site';
import { divisions, divisionPath } from '@/config/divisions';
import { products, productPath } from '@/config/security';
import { serviceGuides, guidePath } from '@/config/service-guides';

export const dynamic = 'force-static';

/** A public content guide for assistants; search engines still use sitemap.xml. */
export function GET() {
  const absolute = (path: string) => new URL(path, site.url).toString();
  const lines = [
    `# ${site.legalName}`, '',
    `> ${site.descriptionLong}`, '',
    `Service area: ${site.serviceArea.join(' and ')}, British Columbia, Canada.`,
    'Service availability, equipment compatibility and quotes are confirmed by the team for each inquiry.', '',
    '## Company',
    `- [About](${absolute('/about')}): Company background and service divisions.`,
    `- [Contact](${absolute('/contact')}): Public contact details and inquiry form.`,
    `- [Request a quote](${absolute('/quote')}): Describe a home or business service requirement.`,
    `- [Careers](${absolute('/careers')}): Current roles and the application form.`, '',
    '## Services',
    ...divisions.map((division) => `- [${division.name}](${absolute(divisionPath(division.slug))}): ${division.summary}`), '',
    '## Security equipment and installation',
    ...products.map((product) => `- [${product.name}](${absolute(productPath(product.slug))}): ${product.tagline}`), '',
    '## Planning guides',
    `- [All service guides](${absolute('/guides')}): Practical planning help for all eight divisions.`,
    ...serviceGuides.map((guide) => `- [${guide.title}](${absolute(guidePath(guide.slug))}): ${guide.description}`), '',
    '## Policies',
    `- [Privacy](${absolute('/privacy')})`,
    `- [Terms](${absolute('/terms')})`, '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
