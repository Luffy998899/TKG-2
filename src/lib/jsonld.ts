import { site } from '@/config/site';
import { divisions, divisionPath } from '@/config/divisions';

const abs = (path: string) => new URL(path, site.url).toString();

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site.url}#organization`,
    name: site.name,
    legalName: site.legalName,
    url: site.url,
    slogan: site.tagline,
    description: site.description,
    telephone: site.contact.phoneDisplay,
    email: site.contact.email,
    sameAs: Object.values(site.social).filter((v) => !v.startsWith('[')),
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.contact.addressLine,
      addressLocality: site.contact.locality,
      addressRegion: site.contact.region,
      postalCode: site.contact.postalCode,
      addressCountry: site.contact.country,
    },
  };
}

export function localBusinessJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${site.url}#localbusiness`,
    name: site.name,
    url: site.url,
    description: site.description,
    telephone: site.contact.phoneDisplay,
    email: site.contact.email,
    priceRange: '[PRICE RANGE]',
    openingHours: site.contact.hours,
    address: {
      '@type': 'PostalAddress',
      streetAddress: site.contact.addressLine,
      addressLocality: site.contact.locality,
      addressRegion: site.contact.region,
      postalCode: site.contact.postalCode,
      addressCountry: site.contact.country,
    },
    areaServed: site.serviceArea.map((area) => ({ '@type': 'Place', name: area })),
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
  };
}

export function serviceJsonLd(slug: string) {
  const division = divisions.find((d) => d.slug === slug);
  if (!division) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${division.name} - ${site.name}`,
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
 * `baseSalary` is deliberately omitted rather than guessed: the compensation
 * strings in the careers config are commission-based or still bracketed
 * placeholders, and a structured salary must never be invented.
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
