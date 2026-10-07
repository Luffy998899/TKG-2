import type { NextConfig } from 'next';

/**
 * Static security headers, on every response. The Content-Security-Policy is
 * NOT here: it carries a per-request nonce, so src/proxy.ts sets it.
 */
const securityHeaders = [
  // This host only: the CRM now shares tkgventuresltd.ca with the marketing
  // site, so it must not pin every subdomain to HTTPS on the site's behalf.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // same-origin: no URL (which can contain a customer id) ever leaves for a
  // third party, while our own form POSTs keep a real Origin header (with
  // no-referrer, browsers send "Origin: null" and the logout CSRF check fails).
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Never indexed, never archived, whatever a crawler finds.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
];

// The repo root holds the marketing site. Pin the CRM's root to /crm so its
// build never resolves or traces a file from the site (update.sh builds with
// crm/ as the working directory).
const crmRoot = process.cwd();

const nextConfig: NextConfig = {
  // Served at https://tkgventuresltd.ca/crm, beside the marketing site (nginx
  // sends /crm/ here). Must equal BASE_PATH in src/lib/base-path.ts.
  basePath: '/crm',
  // A self-contained server (.next/standalone/server.js) for the VPS.
  output: 'standalone',
  serverExternalPackages: ['pg'],
  poweredByHeader: false,
  turbopack: { root: crmRoot },
  outputFileTracingRoot: crmRoot,
  // Local dev is served at 127.0.0.1; Next's dev server otherwise refuses its
  // own HMR/dev requests from that host.
  allowedDevOrigins: ['127.0.0.1'],
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
