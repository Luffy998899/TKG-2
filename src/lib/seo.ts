import type { Metadata } from 'next';
import { site } from '@/config/site';

type Image = { src: string; width: number; height: number; alt?: string };

/** Keep search, social previews and canonical URLs in step for each public page. */
export function pageMetadata(title: string, description: string, path: string, image?: Image): Metadata {
  const fullTitle = path === '/' ? title : `${title} | ${site.seo.titleSuffix}`;
  const images = image
    ? [{ url: image.src, width: image.width, height: image.height, alt: image.alt ?? title }]
    : [{ url: '/og/tkg-ventures.png', width: 1200, height: 630, alt: 'TKG Ventures Ltd — home and business services in BC' }];

  return {
    title: { absolute: fullTitle },
    description,
    alternates: { canonical: path },
    openGraph: { title: fullTitle, description, url: path, type: 'website', siteName: site.name, locale: 'en_CA', images },
    twitter: { card: 'summary_large_image', title: fullTitle, description, images },
  };
}

/** Script contents must stay valid JSON even when an editable description contains HTML. */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
