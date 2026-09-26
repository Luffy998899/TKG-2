import { site, type SiteSettings } from '@/config/site';
import { divisions, divisionPath } from '@/config/divisions';

const abs = (path: string) => new URL(path, site.url).toString();

/**
 * A PostalAddress, or nothing at all. Google penalises structured data that
 * contains empty or placeholder fields more than it rewards partial data, so
 * the address only appears once the owner has entered one in /admin.
 */
function address(s: SiteSettings) {
  if (!s.contact.addressLine || !s.contact.locality) return undefined;
  return {
    '@type': 'PostalAddress',
    streetAddress: s.contact.addressLine,
    addressLocality: s.contact.locality,
    addressRegion: s.contact.region,
    postalCode: s.contact.postalCode,
    addressCountry: s.contact.country,
  };
}

/** Drops undefined values, so optional fields do not appear as `null`. */
const compact = <T extends Record<string, unknown>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export function organizationJsonLd(s: SiteSettings) {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site.url}#organization`,
    name: s.name,
    legalName: s.legalName,
    url: site.url,
    slogan: s.tagline,
    description: s.description,
    telephone: s.contact.phoneDisplay,
    email: s.contact.email,
    sameAs: Object.values(s.social).filter(Boolean),
    address: address(s),
  });
}

export function localBusinessJsonLd(s: SiteSettings) {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${site.url}#localbusiness`,
    name: s.name,
    url: site.url,
    description: s.description,
    telephone: s.contact.phoneDisplay,
    email: s.contact.email,
    openingHours: s.contact.hours || undefined,
    address: address(s),
    areaServed: s.serviceArea.map((area) => ({ '@type': 'Place', name: area })),
    parentOrganization: { '@id': `${site.url}#organization` },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'TKG Ventures divisions',
      itemListElement: divisions.map((division) => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: division.name,
          description: division.summary,
          url: abs(divisionPath(division.slug)),
          provider: { '@id': `${site.url}#organization` },
        },
      })),
    },
  });
}

export function serviceJsonLd(slug: string) {
  const division = divisions.find((d) => d.slug === slug);
  if (!division) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${division.name} | ${site.name}`,
    serviceType: division.name,
    description: division.summary,
    url: abs(divisionPath(division.slug)),
    provider: { '@id': `${site.url}#organization` },
    areaServed: site.serviceArea.map((area) => ({ '@type': 'Place', name: area })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `${division.name} services`,
      itemListElement: division.services.map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.title, description: s.body },
      })),
    },
  };
}

/**
 * A posted role, as schema.org JobPosting.
 *
 * `baseSalary` is deliberately omitted: the roles are commission-based or
 * the structure is discussed at interview, and a structured salary must never
 * be invented.
 */
export function jobPostingJsonLd(position: {
  id: string;
  title: string;
  summary: string;
  employmentType: string;
  location: string;
  responsibilities: string[];
  requirements: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: position.title,
    description: [position.summary, ...position.responsibilities, ...position.requirements].join(
      ' ',
    ),
    employmentType: position.employmentType.toUpperCase().replace(/[^A-Z]+/g, '_'),
    hiringOrganization: { '@id': `${site.url}#organization` },
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: position.location },
    },
    url: abs(`/careers?role=${position.id}`),
    directApply: true,
  };
}

/** A list of Q&A pairs, as schema.org FAQPage. */
export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}
