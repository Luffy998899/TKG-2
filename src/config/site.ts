/**
 * Brand + contact DEFAULTS.
 *
 * This file is the fallback. The owner can override every field in
 * `contact`, `social`, `tagline` and `description` from /admin without a
 * deploy; those overrides live in the data store (see src/lib/store.ts) and
 * are merged over these values by getSiteSettings() in src/lib/settings.ts.
 *
 * Nothing here is invented. A field the business has not published is an
 * empty string, and every component that renders it hides itself when it is
 * empty - there are no bracketed placeholders anywhere on the site.
 */
export const site = {
  name: 'TKG Ventures',
  legalName: 'TKG Ventures Ltd',
  /** From tkg-ventures-ltd.webflow.io. Editable from /admin. */
  tagline: 'Scaling Businesses. Powering Growth.',
  description:
    'TKG Ventures Ltd is a Canadian multi-vertical company delivering sales, technology, security, and digital solutions through high-performance teams.',
  /** Longer form, used where the seven divisions need naming explicitly. */
  descriptionLong:
    'TKG Ventures Ltd is an umbrella company operating seven service divisions — automotive, real estate, security & smart home, moving & delivery, cleaning & staffing, telecommunications and business services.',

  /**
   * Used for absolute OG/canonical URLs and sitemap.xml.
   * example.com is an RFC 2606 reserved domain, used here only so `new URL()`
   * parses at build time. Set NEXT_PUBLIC_SITE_URL to the real domain.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tkg-ventures.example.com',

  contact: {
    /** From the live site. */
    phoneDisplay: '(778) 927-5027',
    phoneHref: '+17789275027',
    /**
     * The live site publishes no WhatsApp number, so this reuses the main
     * line. Change it from /admin if WhatsApp runs on a different number.
     */
    whatsapp: '17789275027',
    email: 'info@tkgventuresltd.ca',
    /* Not published by the business. Empty until set from /admin; the
       contact page and the LocalBusiness JSON-LD omit them while empty. */
    addressLine: '',
    locality: '',
    region: 'BC',
    postalCode: '',
    country: 'Canada',
    hours: '',
  },

  /** Shown on service pages and in the LocalBusiness JSON-LD. */
  serviceArea: ['Lower Mainland', 'Fraser Valley'],

  /** Empty until set from /admin. Filtered out of JSON-LD `sameAs` while empty. */
  social: {
    facebook: '',
    instagram: '',
    linkedin: '',
  },

  /**
   * Real estate. TKG Ventures is not a licensed brokerage; regulated work is
   * carried out by licensed professionals. This is the factual statement of
   * that position and names nobody - a brokerage name and licence number are
   * only added once the business has an actual brokerage partner.
   */
  realEstateNotice:
    'Real estate services are provided by licensed real estate professionals. TKG Ventures Ltd is not a licensed real estate brokerage and does not provide regulated real estate services directly.',
} as const;

/** The shape of the settings object every component receives. */
export type SiteSettings = {
  name: string;
  legalName: string;
  tagline: string;
  description: string;
  descriptionLong: string;
  url: string;
  contact: {
    phoneDisplay: string;
    phoneHref: string;
    whatsapp: string;
    email: string;
    addressLine: string;
    locality: string;
    region: string;
    postalCode: string;
    country: string;
    hours: string;
  };
  serviceArea: readonly string[];
  social: { facebook: string; instagram: string; linkedin: string };
  realEstateNotice: string;
  /** Set when the owner has uploaded a favicon from /admin. */
  faviconVersion?: string;
};

/**
 * The contact hrefs, derived from whatever settings are in force. Always call
 * these with the settings object rather than importing a constant, so an
 * override made in /admin reaches every link.
 */
export const contactLinks = (s: Pick<SiteSettings, 'contact'>) => ({
  tel: `tel:${s.contact.phoneHref}`,
  wa: `https://wa.me/${s.contact.whatsapp}`,
  mail: `mailto:${s.contact.email}`,
});

/*
 * Convenience constants built from the DEFAULTS. Fine for build-time-only
 * uses (sitemap, robots). Rendered contact links should use contactLinks()
 * with live settings instead.
 */
export const waHref = contactLinks(site).wa;
export const telHref = contactLinks(site).tel;
export const mailHref = contactLinks(site).mail;
