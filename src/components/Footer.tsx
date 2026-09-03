import Link from 'next/link';
import { divisions, divisionPath } from '@/config/divisions';
import { site, telHref, waHref, mailHref } from '@/config/site';
import { Wordmark } from '@/components/Wordmark';
import { PhoneIcon, WhatsAppIcon, MailIcon, ArrowIcon } from '@/components/icons';

const company = [
  { href: '/about', label: 'About us' },
  { href: '/careers', label: 'Careers' },
  { href: '/contact', label: 'Contact us' },
  { href: '/quote', label: 'Request a quote' },
];

export function Footer() {
  const year = new Date().getFullYear();

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
              Serving {site.serviceArea.join(' and the ')}.
            </p>
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
          </nav>

          <div>
            <h2 className="eyebrow">Get in touch</h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href={telHref}
                  data-cta="call"
                  className="inline-flex items-center gap-2 text-caption text-ink-soft transition-colors duration-150 hover:text-accent-ink"
                >
                  <PhoneIcon />
                  <span className="phone-number">{site.contact.phoneDisplay}</span>
                </a>
              </li>
              <li>
                <a
                  href={waHref}
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
                  href={mailHref}
                  className="inline-flex items-center gap-2 text-caption text-ink-soft transition-colors duration-150 hover:text-accent-ink"
                >
                  <MailIcon />
                  {site.contact.email}
                </a>
              </li>
            </ul>

            <Link href="/quote" className="btn btn-primary mt-6" data-cta="quote">
              Get a quote
              <ArrowIcon width={16} height={16} />
            </Link>
          </div>
        </div>

        <div className="rule my-10" />

        <div className="flex flex-col gap-4 text-caption text-ink-mute md:flex-row md:items-start md:justify-between">
          <p>
            &copy; {year} {site.legalName}. All rights reserved.
          </p>
          <p className="max-w-prose md:text-right">
            {site.name} is an umbrella company. Regulated services, including real estate, are
            provided by appropriately licensed partners. See each division page for details.
          </p>
        </div>
      </div>
    </footer>
  );
}
