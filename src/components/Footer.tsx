import Link from 'next/link';
import { divisions, divisionPath } from '@/config/divisions';
import { contactLinks } from '@/config/site';
import { getSiteSettings } from '@/lib/settings';
import { Wordmark } from '@/components/Wordmark';
import { PhoneIcon, WhatsAppIcon, MailIcon, ArrowIcon } from '@/components/icons';

const company = [
  { href: '/about', label: 'About us' },
  { href: '/careers', label: 'Careers' },
  { href: '/contact', label: 'Contact us' },
  { href: '/quote', label: 'Request a quote' },
];

const legal = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Use' },
];

/**
 * The one footer, rendered by the root layout on every page. Contact details
 * come from the live settings, so a change made in /admin shows here without
 * a deploy.
 */
export async function Footer() {
  const site = await getSiteSettings();
  const { tel, wa, mail } = contactLinks(site);
  const year = new Date().getFullYear();
  const socials = (
    [
      ['Facebook', site.social.facebook],
      ['Instagram', site.social.instagram],
      ['LinkedIn', site.social.linkedin],
    ] as const
  ).filter(([, href]) => href);

  return (
    <footer className="border-t border-line bg-paper-sunk">
      <div className="shell py-16 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr_1fr_1.1fr]">
          <div>
            <Wordmark />
            <p className="mt-5 max-w-[22ch] font-display text-card-title font-semibold text-ink">
              {site.tagline}
            </p>
            <p className="mt-6 text-caption text-ink-mute">
              Serving the {site.serviceArea.join(' and the ')}.
            </p>
            {socials.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-2">
                {socials.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="chip"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <nav aria-labelledby="footer-divisions">
            <h2 id="footer-divisions" className="eyebrow">
              Divisions
            </h2>
            <ul className="mt-4 space-y-2.5">
              {divisions.map((division) => (
                <li key={division.slug}>
                  <Link
                    href={divisionPath(division.slug)}
                    className="text-caption text-ink-soft transition-colors duration-150 hover:text-accent-ink"
                  >
                    {division.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-company">
            <h2 id="footer-company" className="eyebrow">
              Company
            </h2>
            <ul className="mt-4 space-y-2.5">
              {company.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-caption text-ink-soft transition-colors duration-150 hover:text-accent-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            <h2 className="eyebrow mt-8">Legal</h2>
            <ul className="mt-4 space-y-2.5">
              {legal.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-caption text-ink-soft transition-colors duration-150 hover:text-accent-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow">Get in touch</h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href={tel}
                  data-cta="call"
                  className="inline-flex items-center gap-2 text-caption text-ink-soft transition-colors duration-150 hover:text-accent-ink"
                >
                  <PhoneIcon />
                  <span className="phone-number">{site.contact.phoneDisplay}</span>
                </a>
              </li>
              <li>
                <a
                  href={wa}
                  data-cta="whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-caption text-ink-soft transition-colors duration-150 hover:text-accent-ink"
                >
                  <WhatsAppIcon />
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={mail}
                  className="inline-flex items-center gap-2 text-caption text-ink-soft transition-colors duration-150 hover:text-accent-ink"
                >
                  <MailIcon />
                  {site.contact.email}
                </a>
              </li>
              {site.contact.hours ? (
                <li className="text-caption text-ink-mute">{site.contact.hours}</li>
              ) : null}
            </ul>

            <Link href="/quote" className="btn btn-primary mt-6" data-cta="quote">
              Get a quote
              <ArrowIcon width={16} height={16} />
            </Link>
          </div>
        </div>

        {/* Space, not a drawn line - see the same change in TrustStrip. */}
        <div className="mt-12 flex flex-col gap-4 text-caption text-ink-mute md:flex-row md:items-start md:justify-between">
          <p>
            &copy; {year} {site.legalName}. All rights reserved.
          </p>
          <p className="max-w-prose md:text-right">
            {site.name} is an umbrella company. Regulated services, including real estate, are
            provided by appropriately licensed professionals. See each division page for details.
          </p>
        </div>
      </div>
    </footer>
  );
}
