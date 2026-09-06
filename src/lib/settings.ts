import { unstable_cache } from 'next/cache';
import { site, type SiteSettings } from '@/config/site';
import { readOverrides, listTestimonials, type Testimonial } from '@/lib/store';

/**
 * Live site settings: code defaults merged with the owner's /admin overrides.
 *
 * Wrapped in unstable_cache with a tag, so statically rendered pages keep
 * their static output and only rebuild when /admin calls
 * revalidateTag('site') after a save. Server components call this directly;
 * client components get the same object through <SiteProvider>.
 */
export const SITE_TAG = 'site';
export const TESTIMONIALS_TAG = 'testimonials';

/**
 * A fingerprint of the code defaults, mixed into the cache key.
 *
 * WHY. `unstable_cache` holds its value until the tag is revalidated. It has
 * no idea that half of what it returns comes from a SOURCE FILE rather than
 * the store, and the cache outlives a deploy. So editing src/config/site.ts -
 * changing the phone number, say - would ship, and the site would keep
 * serving the old value until somebody happened to press Save in /admin.
 * That is exactly what happened when "+1" was added to the number.
 *
 * Putting the defaults in the key makes shipping new defaults its own
 * invalidation. Owner overrides still invalidate through the tag as before.
 */
const defaultsFingerprint = ((): string => {
  const json = JSON.stringify(site);
  // djb2. Not a security hash - it only needs to change when the input does.
  let hash = 5381;
  for (let i = 0; i < json.length; i += 1) hash = ((hash << 5) + hash + json.charCodeAt(i)) | 0;
  return (hash >>> 0).toString(36);
})();

export const getSiteSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    const o = await readOverrides();
    return {
      name: site.name,
      legalName: site.legalName,
      tagline: o.tagline ?? site.tagline,
      positioning: site.positioning,
      description: o.description ?? site.description,
      descriptionLong: site.descriptionLong,
      url: site.url,
      contact: {
        phoneDisplay: o.phoneDisplay ?? site.contact.phoneDisplay,
        phoneHref: o.phoneHref ?? site.contact.phoneHref,
        whatsapp: o.whatsapp ?? site.contact.whatsapp,
        email: o.email ?? site.contact.email,
        addressLine: o.addressLine ?? site.contact.addressLine,
        locality: o.locality ?? site.contact.locality,
        region: o.region ?? site.contact.region,
        postalCode: o.postalCode ?? site.contact.postalCode,
        country: o.country ?? site.contact.country,
        hours: o.hours ?? site.contact.hours,
      },
      serviceArea: site.serviceArea,
      social: {
        facebook: o.facebook ?? site.social.facebook,
        instagram: o.instagram ?? site.social.instagram,
        linkedin: o.linkedin ?? site.social.linkedin,
      },
      realEstateNotice: site.realEstateNotice,
      faviconVersion: o.favicon ? o.faviconVersion ?? '1' : undefined,
    };
  },
  ['site-settings', defaultsFingerprint],
  { tags: [SITE_TAG] },
);

/** Published testimonials, optionally for one division. Only real, permissioned ones exist. */
export const getTestimonials = unstable_cache(
  async (division?: string): Promise<Testimonial[]> => {
    const all = await listTestimonials();
    return division ? all.filter((t) => t.division === division || t.division === 'general') : all;
  },
  ['testimonials'],
  { tags: [TESTIMONIALS_TAG] },
);

/** True when the business has published a postal address. */
export const hasAddress = (s: SiteSettings) =>
  Boolean(s.contact.addressLine && s.contact.locality);
