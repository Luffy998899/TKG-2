/**
 * The CRM lives at https://tkgventuresltd.ca/crm, beside the marketing site.
 * Must equal `basePath` in next.config.ts (tests/unit/base-path.test.ts).
 * next/link, redirect() and router calls add it automatically; plain URLs
 * built by hand (cookies, absolute redirects, fetch, <link href>) use this.
 */
export const BASE_PATH = '/crm';
