/**
 * Single source of truth for brand + contact details.
 *
 * Every value in square brackets is a PLACEHOLDER. Replace them with the
 * real business details before launch — nothing here is invented.
 */
export const site = {
  name: 'TKG Ventures',
  legalName: 'TKG Ventures Ltd',
  /**
   * Taken from tkg-ventures-ltd.webflow.io. NOTE: the original brief for this
   * build specified "One Company. Multiple Solutions." — the live site says
   * this instead. Pick one; everything reads from here.
   */
  tagline: 'Scaling Businesses. Powering Growth.',
  description:
    'TKG Ventures Ltd is a Canadian multi-vertical company delivering sales, technology, security, and digital solutions through high-performance teams.',
  /** Longer form, used where the seven divisions need naming explicitly. */
  descriptionLong:
    'TKG Ventures Ltd is an umbrella company operating seven service divisions — automotive, real estate, security & smart home, moving & delivery, cleaning & staffing, telecommunications and business services.',

  /**
   * Used for absolute OG/canonical URLs and sitemap.xml.
   * PLACEHOLDER: example.com is an RFC 2606 reserved domain, used here only so
   * `new URL()` parses at build time. Set NEXT_PUBLIC_SITE_URL to the real
   * domain before launch - see .env.example.
   */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tkg-ventures.example.com',

  contact: {
    /** From the live site. */
    phoneDisplay: '(778) 927-5027',
    phoneHref: '+17789275027',
    /**
     * VERIFY BEFORE LAUNCH. The live site publishes no WhatsApp number, so this
     * assumes the main line is WhatsApp-capable. If it is a landline, wa.me
     * will dead-end — replace it, or drop the WhatsApp CTA.
     */
    whatsapp: '17789275027',
    email: 'info@tkgventuresltd.ca',
    addressLine: '[STREET ADDRESS]',
    locality: '[CITY]',
    region: '[PROVINCE]',
    postalCode: '[POSTAL CODE]',
    country: '[COUNTRY]',
    hours: '[BUSINESS HOURS]',
  },

  /** Shown on service pages and in the LocalBusiness JSON-LD. */
  serviceArea: ['Lower Mainland', 'Fraser Valley'],

  social: {
    facebook: '[FACEBOOK URL]',
    instagram: '[INSTAGRAM URL]',
    linkedin: '[LINKEDIN URL]',
  },

  /**
   * Real-estate regulatory identification. Legally required wording varies by
   * jurisdiction — leave these placeholders for the licensed brokerage to fill.
   */
  realEstate: {
    brokerageName: '[BROKERAGE NAME]',
    licenseNumber: '[LICENSE #]',
    realtorName: '[REALTOR NAME]',
    disclaimer:
      'Real estate services are provided by [REALTOR NAME], a licensed representative of [BROKERAGE NAME] (License #[LICENSE #]). TKG Ventures is not a licensed real estate brokerage and does not provide real estate services directly. [ADD JURISDICTION-REQUIRED DISCLAIMER TEXT HERE].',
  },
} as const;

export const waHref = `https://wa.me/${site.contact.whatsapp}`;
export const telHref = `tel:${site.contact.phoneHref}`;
export const mailHref = `mailto:${site.contact.email}`;
