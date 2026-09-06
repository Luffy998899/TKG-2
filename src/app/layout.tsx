import type { Metadata, Viewport } from 'next';
import { Archivo, Inter } from 'next/font/google';
import './globals.css';
import { site } from '@/config/site';
import { getSiteSettings } from '@/lib/settings';
import { ScrollProvider } from '@/components/ScrollProvider';
import { SiteProvider } from '@/components/SiteProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { StickyCTA } from '@/components/StickyCTA';
import { FloatingContact } from '@/components/FloatingContact';
import { organizationJsonLd, localBusinessJsonLd } from '@/lib/jsonld';

/**
 * Two faces, both variable, both self-hosted by next/font (no third-party
 * request, no layout shift, both SIL Open Font Licence).
 *
 *   Archivo - display. A tight, squarish grotesk with far more presence than
 *   Inter at 3rem+, which is what gives the headings their character.
 *   Inter - body and UI. Neutral, optically tuned for small sizes.
 */
const display = Archivo({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

/**
 * Metadata reads the LIVE settings, so a tagline or description changed in
 * /admin reaches the <title> and Open Graph tags, not just the page body.
 */
export async function generateMetadata(): Promise<Metadata> {
  const s = await getSiteSettings();
  const title = `${s.name} | ${s.tagline}`;

  return {
    metadataBase: new URL(site.url),
    title: { default: title, template: `%s | ${s.name}` },
    description: s.description,
    applicationName: s.name,
    authors: [{ name: s.name }],
    keywords: [
      'TKG Ventures',
      'automotive',
      'real estate',
      'security and smart home',
      'moving and delivery',
      'cleaning and staffing',
      'telecommunications',
      'business services',
      ...s.serviceArea,
    ],
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      siteName: s.name,
      title,
      description: s.description,
      url: site.url,
      locale: 'en_CA',
    },
    twitter: { card: 'summary_large_image', title, description: s.description },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    formatDetection: { telephone: true, address: false, email: true },
    // The static src/app/icon.svg is the default. Once the owner uploads a
    // favicon from /admin, point at the route that serves it; the version
    // query makes browsers refetch after a change.
    icons: s.faviconVersion
      ? { icon: `/api/favicon?v=${s.faviconVersion}` }
      : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: '#F7F5F1',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  // Never block pinch-zoom.
  maximumScale: 5,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();

  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          // Author-controlled JSON built from the live settings.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(settings)) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd(settings)) }}
        />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-caption focus:text-paper"
        >
          Skip to content
        </a>

        <SiteProvider value={settings}>
          <ScrollProvider>
            <Header />
            <main id="main">{children}</main>
            <Footer />
            <StickyCTA />
            <FloatingContact />
          </ScrollProvider>
        </SiteProvider>
      </body>
    </html>
  );
}
