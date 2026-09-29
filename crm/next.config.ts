import type { NextConfig } from 'next';

/**
 * Static security headers, on every response. The Content-Security-Policy is
 * NOT here: it carries a per-request nonce, so src/proxy.ts sets it.
 */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Never indexed, never archived, whatever a crawler finds.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
];

// The repo root holds the marketing site. Pin the CRM's root to /crm so its
// build never resolves or traces a file from the site (Vercel builds with
// Root Directory = crm, so this is the working directory there too).
const crmRoot = process.cwd();

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: crmRoot },
  outputFileTracingRoot: crmRoot,
  // Local dev is served at 127.0.0.1 (Supabase auth links point there); Next's
  // dev server otherwise refuses its own HMR/dev requests from that host.
  allowedDevOrigins: ['127.0.0.1'],
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
