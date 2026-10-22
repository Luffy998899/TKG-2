import { writeFile } from 'node:fs/promises';

// Validate rendered output, including metadata inheritance and JSON-LD. Run
// against a local production server before release, then the deployed website.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:3000');
const output = process.argv[3];
const errors = [];
const warnings = [];
const decode = (value = '') => value.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const attributes = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((match) => [match[1], decode(match[2])]));
const text = (html) => decode(html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
const fetchPage = async (path) => {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000) });
  return { response, html: await response.text() };
};
const { response: sitemapResponse, html: sitemap } = await fetchPage('/sitemap.xml');
if (!sitemapResponse.ok) throw new Error(`Sitemap returned ${sitemapResponse.status}`);
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => decode(match[1]));
if (!urls.length || urls.length > 100) throw new Error('Expected 1–100 public sitemap URLs.');
const productionOrigin = new URL(urls[0]).origin;
const paths = new Set(urls.map((url) => new URL(url).pathname));
const pages = [];
const pageIds = new Map();
const guideFragments = [];
const fail = (path, message) => errors.push(`${path}: ${message}`);

async function check(url) {
  const path = new URL(url).pathname;
  if (/^\/(?:crm|admin|api)(?:\/|$)/.test(path)) return fail(path, 'Private page appears in the public sitemap.');
  const { response, html } = await fetchPage(path);
  if (response.status !== 200) return fail(path, `HTTP ${response.status}`);
  pageIds.set(path, new Set([...html.matchAll(/\bid="([^"]*)"/g)].map((match) => decode(match[1]))));
  const title = text(html.match(/<title>(.*?)<\/title>/s)?.[1] ?? '');
  const h1 = [...html.matchAll(/<h1\b[^>]*>(.*?)<\/h1>/gs)].map((match) => text(match[1]));
  const meta = Object.fromEntries([...html.matchAll(/<meta\b[^>]*>/g)].map((match) => {
    const attrs = attributes(match[0]); return [attrs.name ?? attrs.property, attrs.content];
  }));
  const canonical = [...html.matchAll(/<link\b[^>]*>/g)].map((match) => attributes(match[0])).find((attrs) => attrs.rel === 'canonical')?.href;
  if (!title) fail(path, 'Missing title.');
  if (title.length > 65) warnings.push(`${path}: title exceeds the editorial target of 65 characters (${title.length}).`);
  if (!meta.description) fail(path, 'Missing meta description.');
  if ((meta.description?.length ?? 0) > 165) warnings.push(`${path}: description exceeds the editorial target of 165 characters.`);
  if (h1.length !== 1) fail(path, `Expected one H1, found ${h1.length}.`);
  if (!canonical || new URL(canonical).href !== new URL(url).href) fail(path, `Canonical ${canonical} differs from sitemap URL ${url}.`);
  if (/noindex/i.test(meta.robots ?? '') || /noindex/i.test(response.headers.get('x-robots-tag') ?? '')) fail(path, 'Public sitemap page is noindex.');
  for (const prefix of ['og', 'twitter']) {
    if (meta[`${prefix}:title`] !== title) fail(path, `${prefix} title differs from page title.`);
    if (meta[`${prefix}:description`] !== meta.description) fail(path, `${prefix} description differs from page description.`);
    if (!meta[`${prefix}:image`]) fail(path, `Missing ${prefix} sharing image.`);
  }
  const schemas = [];
  for (const match of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)) {
    try { schemas.push(JSON.parse(match[1])); } catch { fail(path, 'Invalid JSON-LD.'); }
  }
  if (!schemas.some((schema) => schema['@type'] === 'Organization')) fail(path, 'Missing organization identity.');
  if (!schemas.some((schema) => schema['@type'] === 'WebSite')) fail(path, 'Missing website identity.');
  for (const schema of schemas) {
    if (schema['@type'] === 'LocalBusiness' && (!schema.address?.streetAddress || !schema.address?.addressLocality)) fail(path, 'LocalBusiness requires a real address.');
    if (schema['@type'] === 'Product' && !schema.offers && !schema.review && !schema.aggregateRating) fail(path, 'Product has no published offer or review data.');
    if (schema['@type'] === 'JobPosting' && (!schema.datePosted || path === '/careers')) fail(path, 'JobPosting requires a dated, individual role page.');
  }
  const links = new Set();
  for (const match of html.matchAll(/<a\b[^>]*>/g)) {
    const href = attributes(match[0]).href;
    if (!href) continue;
    try {
      const target = new URL(href, url);
      if (path.startsWith('/guides/') && target.origin === productionOrigin && target.hash) guideFragments.push({ source: path, path: target.pathname, id: decodeURIComponent(target.hash.slice(1)) });
      if (target.origin === productionOrigin && target.pathname.startsWith('/guides/') && !paths.has(target.pathname)) fail(path, `Guide link is not in the sitemap: ${target.pathname}`);
      if (target.origin === productionOrigin && paths.has(target.pathname)) links.add(target.pathname);
    } catch { fail(path, `Invalid link: ${href}`); }
  }
  if (path.startsWith('/guides/')) {
    const visible = text(html.replace(/<script\b[^>]*>.*?<\/script>/gs, ''));
    const faq = schemas.find((schema) => schema['@type'] === 'FAQPage');
    if (!faq?.mainEntity?.length) fail(path, 'Planning guide is missing its FAQ.');
    for (const question of faq?.mainEntity ?? []) {
      if (!visible.includes(question.name) || !visible.includes(question.acceptedAnswer.text)) fail(path, 'FAQ markup differs from visible guide content.');
    }
    const serviceUrl = schemas.find((schema) => schema['@type'] === 'WebPage')?.about?.url;
    if (!serviceUrl || !links.has(new URL(serviceUrl).pathname)) fail(path, 'Guide must link to its corresponding service.');
  }
  for (const match of html.matchAll(/<img\b[^>]*>/g)) {
    if (!Object.hasOwn(attributes(match[0]), 'alt')) fail(path, 'Image is missing its alt attribute.');
  }
  pages.push({ path, title, description: meta.description, h1, canonical, htmlBytes: Buffer.byteLength(html), schemaTypes: schemas.map((schema) => schema['@type']), socialImage: meta['og:image'], links: [...links] });
}

for (let index = 0; index < urls.length; index += 4) await Promise.all(urls.slice(index, index + 4).map(check));
for (const target of guideFragments) {
  if (!pageIds.get(target.path)?.has(target.id)) fail(target.source, `Broken guide or inquiry anchor: ${target.path}#${target.id}`);
}
for (const key of ['title', 'description']) {
  const seen = new Map();
  for (const page of pages) {
    if (seen.has(page[key])) fail(page.path, `Duplicate ${key} with ${seen.get(page[key])}.`);
    seen.set(page[key], page.path);
  }
}
for (const page of pages.filter((item) => item.path.includes('/products/'))) {
  const incoming = pages.filter((source) => source.path !== page.path && source.links.includes(page.path)).length;
  if (incoming < 2) fail(page.path, `Only ${incoming} distinct internal pages link here.`);
}
const guides = pages.filter((page) => page.path.startsWith('/guides/'));
const services = pages.filter((page) => /^\/services\/[^/]+$/.test(page.path));
if (guides.length !== services.length) fail('/guides', `Expected one planning guide per service; found ${guides.length} guides and ${services.length} services.`);
for (const page of [...guides, ...services]) {
  if (guides.includes(page)) {
    const incoming = pages.filter((source) => source.path !== page.path && source.links.includes(page.path)).length;
    if (incoming < 2) fail(page.path, `Only ${incoming} distinct pages link to this guide.`);
  } else if (!pageIds.get(page.path)?.has('planning-heading') || !guides.some((guide) => page.links.includes(guide.path))) fail(page.path, 'Service is missing its planning section or guide link.');
}
for (const image of new Set(pages.map((page) => page.socialImage).filter(Boolean))) {
  const { response } = await fetchPage(new URL(image).pathname);
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) fail(image, 'Social image is not accessible as an image.');
}
const { response: robotsResponse, html: robots } = await fetchPage('/robots.txt');
if (!robotsResponse.ok || !robots.includes(`${productionOrigin}/sitemap.xml`)) fail('/robots.txt', 'Sitemap declaration is missing or incorrect.');
const { response: llmsResponse, html: llms } = await fetchPage('/llms.txt');
if (!llmsResponse.ok || !llms.includes(`${productionOrigin}/services/`)) fail('/llms.txt', 'Public service guide is missing.');
const { response: queryResponse, html: queryHtml } = await fetchPage('/careers?role=sales-representative');
if (!queryResponse.ok || !queryHtml.includes(`rel="canonical" href="${productionOrigin}/careers"`)) fail('/careers?role=sales-representative', 'Application query must canonicalize to /careers.');
const result = { checkedAt: new Date().toISOString(), base: base.origin, pages: pages.sort((a, b) => a.path.localeCompare(b.path)), errors, warnings };
if (output) await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(`SEO checks: ${pages.length} public pages, ${errors.length} errors, ${warnings.length} editorial warnings.`);
for (const message of [...errors, ...warnings]) console.log(message);
process.exitCode = errors.length ? 1 : 0;
