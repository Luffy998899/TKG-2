import type { Metadata, Viewport } from 'next';
import { Archivo, Inter } from 'next/font/google';
import './globals.css';
import { site } from '@/config/site';
import { ScrollProvider } from '@/components/ScrollProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { StickyCTA } from '@/components/StickyCTA';
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

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} - ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name }],
  keywords: [
    'TKG Ventures',
    'automotive',
    'real estate',
    'security and smart home',
    'moving and delivery',
    'cleaning and staffing',
    'telecommunications',
    'business services',
    ...site.serviceArea,
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: `${site.name} - ${site.tagline}`,
    description: site.description,
    url: site.url,
    locale: 'en_CA',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${site.name} - ${site.tagline}`,
    description: site.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
  formatDetection: { telephone: true, address: false, email: true },
};

export const viewport: Viewport = {
  themeColor: '#F7F5F1',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  // Never block pinch-zoom.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        <script
          type="application/ld+json"
          // Static, author-controlled JSON built from src/config/site.ts.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd()) }}
        />

        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-caption focus:text-paper"
        >
          Skip to content
        </a>

        <ScrollProvider>
          <Header />
          <main id="main">{children}</main>
          <Footer />
          <StickyCTA />
        </ScrollProvider>
      </body>
    </html>
  );
}
