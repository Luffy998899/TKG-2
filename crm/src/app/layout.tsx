import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Archivo, Inter } from 'next/font/google';
import './globals.css';

// The marketing site's two faces, self-hosted by next/font (no runtime request).
const display = Archivo({ subsets: ['latin'], variable: '--font-archivo', display: 'swap' });
const sans = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'TKG CRM', template: '%s · TKG CRM' },
  // Never indexed. The X-Robots-Tag header says the same on every response.
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: 'no-referrer',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f7f5f1',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request makes every page dynamic, which the CSP needs: Next
  // stamps this request's nonce (set by src/proxy.ts) onto its scripts only
  // when rendering per request. A prerendered page would have its scripts
  // blocked.
  await headers();
  return (
    <html lang="en-CA" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
