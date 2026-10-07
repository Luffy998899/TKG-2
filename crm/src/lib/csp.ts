/**
 * The Content-Security-Policy for every page. Scripts and styles run only with
 * this request's nonce; nothing may frame the CRM; no third-party origin is
 * allowed at all (documents are served by the CRM itself).
 */
export function buildCsp(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Production: styles by nonce only. Dev: Next's error overlay injects
    // inline styles, so dev alone allows them (a nonce would disable that).
    dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}
