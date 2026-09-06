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
  /**
   * The one line that has to land before anything else: what TKG actually is.
   *
   * The tagline above is brand voice and reads as business-only. This says
   * plainly that one company covers the home, personal and business side, which
   * is the thing a first-time visitor otherwise has to infer from eight
   * unrelated-looking service pages.
   */
  positioning:
    'One company for your home, your family and your business. Eight service divisions, one team, one number to call.',

  /** Longer form, used where the divisions need naming explicitly. */
  descriptionLong:
    'TKG Ventures Ltd is an umbrella company operating eight service divisions: automotive, real estate, security & smart home, moving & delivery, cleaning, staffing, telecommunications and business services.',

  /**
   * Used for absolute OG/canonical URLs and sitemap.xml.
   * example.com is an RFC 2606 reserved domain, used here only so `new URL()`
   * parses at build time. Set NEXT_PUBLIC_SITE_URL to the real domain.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tkg-ventures.example.com',

  contact: {
    /** From the live site. The country code is shown so it is unambiguous
        to anyone dialling from outside Canada, and so a phone offers the
        right thing when the number is copied. */
    phoneDisplay: '+1 (778) 927-5027',
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

  /**
   * The track record, shown as the stat row under the homepage hero.
   *
   * FIGURES SUPPLIED BY THE BUSINESS. Everything else on this site is written
   * to avoid claims nobody can stand behind; these are the exception, and they
   * are here rather than inline in a component so the owner can correct them
   * in one place. They are advertising claims in Canada: keep them accurate
   * and be able to substantiate them if asked.
   *
   * `value` carries its own "+" - the numbers are floors, not counts.
   */
  proof: [
    { value: '500+', label: 'Security sales & installations across BC' },
    { value: '1,000+', label: 'Internet customers served' },
    { value: '3+', label: 'Years serving the Lower Mainland' },
    // The fourth is filled in from the divisions array at render time, so it
    // cannot go stale the way "seven divisions" did.
    { value: null, label: 'Service divisions' },
  ],

  /**
   * How the company got here, in the customer's own framing: it started in
   * security and telecom and grew outwards from those customers. Two short
   * paragraphs, rendered on the homepage.
   */
  story: [
    'TKG Ventures started where the demand was: selling and installing home security systems, and getting people onto internet and TV plans that actually suited them. Those two jobs put us inside hundreds of homes and businesses across the Lower Mainland.',
    'The same customers kept asking for the next thing. Someone moving house needed the move, the clean and the internet switched over. A business owner who trusted us with the alarm asked who we would recommend for staff. Rather than hand people to strangers, we built the divisions and the partner network to do it ourselves, and the company grew outwards from there.',
  ],

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
  positioning: string;
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
