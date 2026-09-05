import type { MetadataRoute } from 'next';
import { site } from '@/config/site';
import { divisions, divisionPath } from '@/config/divisions';
import { products, productPath } from '@/config/security';

/**
 * Generated from config: adding a division adds its URL here automatically.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const abs = (path: string) => new URL(path, site.url).toString();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: abs('/'), lastModified, changeFrequency: 'monthly', priority: 1 },
    { url: abs('/about'), lastModified, changeFrequency: 'yearly', priority: 0.6 },
    { url: abs('/contact'), lastModified, changeFrequency: 'yearly', priority: 0.8 },
    { url: abs('/quote'), lastModified, changeFrequency: 'yearly', priority: 0.9 },
    { url: abs('/careers'), lastModified, changeFrequency: 'weekly', priority: 0.7 },
    { url: abs('/privacy'), lastModified, changeFrequency: 'yearly', priority: 0.3 },
    { url: abs('/terms'), lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const divisionRoutes: MetadataRoute.Sitemap = divisions.map((division) => ({
    url: abs(divisionPath(division.slug)),
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((product) => ({
    url: abs(productPath(product.slug)),
    lastModified,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...divisionRoutes, ...productRoutes];
}
