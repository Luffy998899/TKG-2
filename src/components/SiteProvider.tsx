'use client';

import { createContext, useContext } from 'react';
import { site as defaults, contactLinks, type SiteSettings } from '@/config/site';

/**
 * Hands the live settings to client components.
 *
 * The root layout (a server component) loads settings from the store and
 * renders this provider around the app. Client components - the header, the
 * sticky bars, the forms - read them with useSite() rather than importing the
 * config constant, so a phone number changed in /admin reaches every link.
 */
const SiteContext = createContext<SiteSettings>(defaults as unknown as SiteSettings);

export function SiteProvider({
  value,
  children,
}: {
  value: SiteSettings;
  children: React.ReactNode;
}) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteSettings {
  return useContext(SiteContext);
}

/** Settings plus the derived contact hrefs, in one call. */
export function useContact() {
  const s = useSite();
  return { site: s, ...contactLinks(s) };
}
