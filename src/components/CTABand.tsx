import Link from 'next/link';
import { contactLinks } from '@/config/site';
import { getSiteSettings } from '@/lib/settings';
import { ArrowIcon, PhoneIcon, WhatsAppIcon } from '@/components/icons';
import { Reveal } from '@/components/Reveal';

/**
 * The dark closing band. Two depth cues keep it from reading as a flat black
 * rectangle: a soft accent glow rising from the bottom-left, and a fine grain
 * over the whole surface. The grain is an inline SVG data URI at 4% opacity —
 * no image request, no measurable cost.
 */

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

export async function CTABand({
  title = 'Tell us what you need.',
  body = 'One conversation covers every division. Call, message, or send a few details and we will come back with next steps.',
}: {
  title?: string;
  body?: string;
}) {
  const site = await getSiteSettings();
  const { tel: telHref, wa: waHref } = contactLinks(site);
  return (
    <section aria-labelledby="cta-heading" className="on-night relative overflow-hidden bg-night">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-1/3 -left-1/4 h-[140%] w-[80%] rounded-full opacity-[0.22] blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(var(--accent)) 0%, transparent 65%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{ backgroundImage: GRAIN }}
      />

      <Reveal className="shell relative py-section md:py-section-lg">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-end">
          <div data-reveal>
            <p className="eyebrow">Get started</p>
            <h2
              id="cta-heading"
              className="mt-5 max-w-[14ch] font-display text-h2 font-semibold tracking-[-0.032em] md:text-h1"
            >
              {title}
            </h2>
            <p className="mt-6 max-w-prose text-body-lg text-paper/70">{body}</p>
          </div>

          <div data-reveal className="flex flex-wrap gap-3 lg:justify-end">
            <Link href="/quote" data-cta="quote" className="btn btn-primary">
              Request a quote
              <ArrowIcon width={16} height={16} />
            </Link>
            <a href={telHref} data-cta="call" className="btn btn-inverse">
              <PhoneIcon />
              <span className="phone-number">{site.contact.phoneDisplay}</span>
            </a>
            <a
              href={waHref}
              data-cta="whatsapp"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-inverse"
            >
              <WhatsAppIcon />
              WhatsApp
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
