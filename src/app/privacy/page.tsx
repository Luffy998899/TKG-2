import type { Metadata } from 'next';
import Link from 'next/link';
import { site, contactLinks } from '@/config/site';
import { getSiteSettings } from '@/lib/settings';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${site.legalName} collects, uses and protects the personal information you send through this website.`,
  alternates: { canonical: '/privacy' },
};

/** Keep in step with the wording below whenever it changes. */
const LAST_UPDATED = '5 September 2026';

/*
 * This policy describes what the site ACTUALLY does - nothing more. If the
 * business adds analytics, advertising pixels, an email provider or a CRM, the
 * relevant section must be updated first. It is written to the standard of
 * BC's Personal Information Protection Act (PIPA) and Canada's PIPEDA, which
 * is what applies to a BC business, and should be reviewed by counsel before
 * the site goes live.
 */
export default async function PrivacyPage() {
  const s = await getSiteSettings();
  const { mail, tel } = contactLinks(s);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Privacy Policy', path: '/privacy' },
            ]),
          ),
        }}
      />

      <section className="border-b border-line bg-paper">
        <div className="shell pb-12 pt-[calc(var(--header-h)+3.5rem)] md:pb-16 md:pt-[calc(var(--header-h)+6rem)]">
          <p className="eyebrow">Legal</p>
          <h1 className="display-1 mt-5 max-w-[14ch]">Privacy Policy</h1>
          <p className="mt-6 max-w-prose text-lead text-ink-soft">
            What we collect through this website, why, and what you can ask us to do about it.
          </p>
          <p className="mt-4 text-caption text-ink-mute">Last updated {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="bg-paper">
        <div className="shell py-section">
          <div className="prose-legal max-w-prose">
            <h2>Who we are</h2>
            <p>
              This website is operated by {s.legalName} (&ldquo;{s.name}&rdquo;, &ldquo;we&rdquo;,
              &ldquo;us&rdquo;), a company based in British Columbia, Canada, serving the{' '}
              {s.serviceArea.join(' and the ')}. We are responsible for the personal information
              collected through this site and handle it in accordance with British Columbia&rsquo;s
              Personal Information Protection Act (PIPA) and, where it applies, the federal
              Personal Information Protection and Electronic Documents Act (PIPEDA).
            </p>

            <h2>What we collect</h2>
            <p>
              We only collect personal information that you choose to send us through the forms
              on this site. Depending on the form, that may include:
            </p>
            <ul>
              <li>Your name, email address and phone number.</li>
              <li>Your city or service address, where a service needs one.</li>
              <li>Details of what you are asking about &mdash; for example the type of property,
                vehicle, move, cleaning or telecom service you are interested in.</li>
              <li>For job applications: your city, availability, experience, a message, and a
                resume file if you attach one.</li>
            </ul>
            <p>
              We do not use advertising trackers, analytics cookies or social-media pixels on
              this site. The site sets one cookie only, and only for the site owner when they
              log in to the private administration area; visitors are never given a cookie.
            </p>

            <h2>Why we collect it</h2>
            <p>We use the information you send us to:</p>
            <ul>
              <li>Respond to your inquiry, quote request or message.</li>
              <li>Provide the service you asked about, including passing your details to the
                relevant division within {s.name}.</li>
              <li>Where you asked about a regulated service &mdash; real estate, vehicle
                financing, alarm monitoring &mdash; introduce you to the licensed partner who
                provides it, with your knowledge.</li>
              <li>Consider your job application and contact you about it.</li>
            </ul>
            <p>
              We do not sell, rent or trade personal information, and we do not use it for
              marketing you have not asked for.
            </p>

            <h2>Who we share it with</h2>
            <p>
              Your information is seen by the {s.name} staff who handle your inquiry. Where your
              request involves one of our licensed partners (for example a real estate
              professional, a dealership, or Brinks Home Security for monitoring), we share what
              is needed to arrange that service, and we tell you when we do. We do not share
              information with anyone else unless the law requires it.
            </p>

            <h2>How long we keep it</h2>
            <p>
              We keep inquiries for as long as needed to deal with them and for a reasonable
              period afterwards in case you come back to us. Job applications and resumes are
              kept while a position is open and for future opportunities you have asked to be
              considered for. You can ask us to delete your information at any time (see below).
            </p>

            <h2>How we protect it</h2>
            <p>
              Form submissions are transmitted over an encrypted connection and stored on
              systems that only authorised {s.name} staff can access. No method of storage is
              perfectly secure, but we take reasonable steps to protect what you send us.
            </p>

            <h2>Your rights</h2>
            <p>You can ask us, at any time, to:</p>
            <ul>
              <li>Tell you what personal information we hold about you.</li>
              <li>Correct anything that is inaccurate.</li>
              <li>Delete your information, subject to any legal obligation to keep it.</li>
              <li>Stop contacting you.</li>
            </ul>
            <p>
              To do any of these, email{' '}
              <a href={mail}>{s.contact.email}</a> or call{' '}
              <a href={tel} className="phone-number">
                {s.contact.phoneDisplay}
              </a>
              . We will respond within 30 days. If you are not satisfied with our response, you
              can contact the Office of the Information and Privacy Commissioner for British
              Columbia.
            </p>

            <h2>Links to other sites</h2>
            <p>
              Our site links to other websites, including WhatsApp and our partners. This policy
              covers only this site; those services have their own privacy policies.
            </p>

            <h2>Changes</h2>
            <p>
              If we change how we handle personal information, we will update this page and the
              date at the top. Continued use of the site after a change means you accept the
              updated policy.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about this policy or your information: email{' '}
              <a href={mail}>{s.contact.email}</a>, or use the{' '}
              <Link href="/contact">contact page</Link>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
