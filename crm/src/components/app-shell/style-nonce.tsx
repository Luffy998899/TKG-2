'use client';

declare global {
  // Read by get-nonce (used by react-remove-scroll inside Radix dialogs) when
  // it injects its scroll-lock <style>.
  var __webpack_nonce__: string | undefined;
}

/**
 * Hands this request's CSP nonce to libraries that inject <style> tags at
 * runtime (Radix dialog's scroll lock). Without it the strict CSP - styles by
 * nonce only - blocks them. The nonce is already on every script tag in the
 * page, so exposing it here reveals nothing new. Set during render so it is in
 * place before any dialog can open.
 */
export function StyleNonce({ nonce }: { nonce: string | null }) {
  if (typeof window !== 'undefined' && nonce) globalThis.__webpack_nonce__ = nonce;
  return null;
}
