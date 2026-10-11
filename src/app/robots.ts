import type { MetadataRoute } from 'next';
import { site } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  return {
    // CRM pages return X-Robots-Tag: noindex. Let crawlers read that header;
    // a robots.txt block would hide the noindex directive and can leave a URL
    // indexed without its content. Authentication remains the access control.
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin'] }],
    sitemap: new URL('/sitemap.xml', site.url).toString(),
    host: site.url,
  };
}
