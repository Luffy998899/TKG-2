import { site, type SiteSettings } from '@/config/site';
import { divisions, divisionPath } from '@/config/divisions';

const abs = (path: string) => new URL(path, site.url).toString();

/** Publish only the actual address supplied by the owner. */
function address(s: SiteSettings) {
  if (!s.contact.addressLine || !s.contact.locality) {
    return undefined;
  }
  return {
    '@type': 'PostalAddress',
    streetAddress: s.contact.addressLine,
    addressLocality: s.contact.locality,
    addressRegion: s.contact.region,
    postalCode: s.contact.postalCode,
    addressCountry: ['Canada', 'CA'].includes(s.contact.country) ? 'CA' : s.contact.country,
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
    // The legal name leads: "TKG Ventures" alone is also a US real-estate
    // firm and a Korean investment arm.
    name: s.legalName,
    alternateName: s.name,
    legalName: s.legalName,
    url: site.url,
    areaServed: s.serviceArea.map((area) => ({ '@type': 'Place', name: `${area}, BC, Canada` })),
    slogan: s.tagline,
    description: s.description,
    telephone: s.contact.phoneDisplay,
    email: s.contact.email,
    sameAs: Object.values(s.social).filter(Boolean),
    address: address(s),
  });
}

export function localBusinessJsonLd(s: SiteSettings) {
  // A service region is not a physical street address. Keep Organization markup
  // until the owner supplies the real address needed for LocalBusiness results.
  if (!s.contact.addressLine || !s.contact.locality) return null;
  return compact({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${site.url}#localbusiness`,
    name: s.legalName,
    alternateName: s.name,
    url: site.url,
    image: abs('/og/tkg-ventures.png'),
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

export function websiteJsonLd(s: SiteSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.url}#website`,
    url: site.url,
    name: s.legalName,
    alternateName: s.name,
    inLanguage: 'en-CA',
    publisher: { '@id': `${site.url}#organization` },
  };
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

/** The careers index lists roles; JobPosting belongs on a dated single-role page. */
export function careersListJsonLd(positions: { id: string; title: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Open roles at TKG Ventures',
    itemListElement: positions.map((position, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: position.title,
      url: abs(`/careers#${position.id}`),
    })),
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
