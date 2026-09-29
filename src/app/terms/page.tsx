import type { Metadata } from 'next';
import Link from 'next/link';
import { site, contactLinks } from '@/config/site';
import { getSiteSettings } from '@/lib/settings';
import { breadcrumbJsonLd } from '@/lib/jsonld';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: `The terms on which ${site.legalName} makes this website available.`,
  alternates: { canonical: '/terms' },
};

/** Keep in step with the wording below whenever it changes. */
const LAST_UPDATED = '5 September 2026';

/*
 * Plain-language terms for a company website that takes inquiries and job
 * applications. It does NOT create a contract for any service - services are
 * agreed separately - and it says so. Review by counsel before launch.
 */
export default async function TermsPage() {
  const s = await getSiteSettings();
  const { mail } = contactLinks(s);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Home', path: '/' },
              { name: 'Terms of Use', path: '/terms' },
            ]),
          ),
        }}
      />

      <section className="border-b border-line bg-paper">
        <div className="shell pb-12 pt-[calc(var(--header-h)+3.5rem)] md:pb-16 md:pt-[calc(var(--header-h)+6rem)]">
          <p className="eyebrow">Legal</p>
          <h1 className="display-1 mt-5 max-w-[14ch]">Terms of Use</h1>
          <p className="mt-6 max-w-prose text-lead text-ink-soft">
            The terms on which we make this website available to you.
          </p>
          <p className="mt-4 text-caption text-ink-mute">Last updated {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="bg-paper">
        <div className="shell py-section">
          <div className="prose-legal max-w-prose">
            <h2>Agreement</h2>
            <p>
              This website is operated by {s.legalName} (&ldquo;{s.name}&rdquo;, &ldquo;we&rdquo;,
              &ldquo;us&rdquo;). By using the site you agree to these terms and to our{' '}
              <Link href="/privacy">Privacy Policy</Link>. If you do not agree, please do not use
              the site.
            </p>

            <h2>What the site is for</h2>
            <p>
              The site describes the services offered by {s.name} and its divisions, and lets you
              ask us about them, request a quote, or apply for a role. Sending an inquiry or
              quote request does not create a contract for any service. Services are agreed
              separately, in writing, once we have discussed what you need.
            </p>

            <h2>Information on the site</h2>
            <p>
              We try to keep the information on this site accurate and current, but it is
              provided for general information only. Product descriptions, service details and
              process descriptions are summaries; the exact scope, equipment and price of any
              service are confirmed in the quote or agreement for that service. We may change
              the site&rsquo;s content at any time without notice.
            </p>

            <h2>Regulated and partner services</h2>
            <p>
              Some services described on this site are provided by, or completed through,
              licensed third parties:
            </p>
            <ul>
              <li>
                <strong>Real estate.</strong> {s.realEstateNotice}
              </li>
              <li>
                <strong>Vehicles.</strong> {s.name} provides vehicle sourcing and referral
                services. Vehicle sales, financing and applicable dealership transactions are
                completed through licensed dealership partners.
              </li>
              <li>
                <strong>Security monitoring.</strong> {s.name} is an authorized dealer of Brinks
                Home Security. Monitoring services are provided under Brinks&rsquo; own terms,
                which you will receive before any monitoring agreement starts.
              </li>
            </ul>
            <p>
              Where a service is provided by a third party, that party&rsquo;s terms apply to
              that service, and we will make sure you have them before you commit.
            </p>

            <h2>Your use of the site</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Submit information that is false, misleading, or that you do not have the right
                to share.</li>
              <li>Use the forms to send spam, bulk messages or anything unlawful.</li>
              <li>Attempt to access parts of the site that are not intended for the public, or to
                interfere with how the site works.</li>
              <li>Copy or reuse the site&rsquo;s text, images or design for another business
                without our written permission.</li>
            </ul>

            <h2>Intellectual property</h2>
            <p>
              The {s.name} name, wordmark and the content of this site belong to {s.legalName} or
              are used with permission. Brinks Home Security and other partner names are the
              trademarks of their owners and are used to describe our authorised relationship
              with them.
            </p>

            <h2>Links</h2>
            <p>
              The site links to services we do not control, including WhatsApp and our
              partners&rsquo; websites. We are not responsible for their content or their
              handling of your information.
            </p>

            <h2>Limitation of liability</h2>
            <p>
              To the extent permitted by law, {s.legalName} is not liable for any loss arising
              from your use of this site or reliance on its content. Nothing in these terms
              limits any liability that cannot be limited under the laws of British Columbia.
            </p>

            <h2>Governing law</h2>
            <p>
              These terms are governed by the laws of British Columbia and the federal laws of
              Canada applicable there. Any dispute about them will be dealt with by the courts of
              British Columbia.
            </p>

            <h2>Changes</h2>
            <p>
              We may update these terms from time to time. The date at the top shows when they
              last changed. Continued use of the site after a change means you accept the
              updated terms.
            </p>

            <h2>Contact</h2>
            <p>
              Questions about these terms: <a href={mail}>{s.contact.email}</a>.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
