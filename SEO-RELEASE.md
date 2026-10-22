# TKG Ventures SEO release — 22 October 2026

The website changes are complete and checked locally. They are ready for the
Hostinger team to deploy. The public website and its Semrush audit have not yet
been updated by this release. Search rankings are earned over time; a technical
audit score does not guarantee a position in Google.

## What the connected Semrush account actually shows

[Project 31634254](https://www.semrush.com/siteaudit/?id=31634254),
`tkgventuresltd.ca`, latest completed crawl **19 October 2026, 01:13 UTC**:

| Baseline | Result |
| --- | ---: |
| Site Health | 94/100 |
| Pages crawled | 29 |
| Errors | 40 |
| Warnings | 27 |
| Notices | 4 |

The 40 errors are structured-data items: 25 incomplete LocalBusiness addresses,
7 Product items without published offers or reviews, and 8 undated JobPosting
items across careers URL variants. The warnings cover 2 long page titles and
25 low text-to-HTML ratios. Notices identify missing llms.txt, missing HSTS on
two hosts, and one equipment page with only one internal linking source.

The Canadian domain-overview request returned **no data**. Current organic
traffic and ranking totals are therefore unavailable; they have not been
reported as zero. The camera-installation Surrey SERP request also returned no
data. Raw account results are saved in
[the Semrush baseline](plans/seo/2026-10-22-semrush.json).

## Completed changes

- All 31 public pages have distinct, concise titles and descriptions, canonical
  URLs, and matching Open Graph/Twitter previews. The main company preview is
  a static 1200 × 630 image included in the release.
- Organization and WebSite identity markup appears throughout the public site.
  LocalBusiness appears only when the owner's actual street address and city
  are supplied in website settings. A service region is not used as an address.
- Equipment pages describe the actual consultation/installation Service. No
  product prices, customer reviews or brand affiliations have been invented to
  satisfy a validator.
- The careers index describes its list of roles with ItemList. Google Jobs
  markup would require separate, dated role pages; this release does not claim
  Google Jobs eligibility.
- JSON-LD is safely serialized, including editable text containing HTML.
- Equipment pages link to the other equipment options, including smart locks.
- All 29 image placeholders retain their photos and dimensions but use compact
  WebP data. Embedded placeholder text fell from 95,063 to 3,467 characters
  (96%). The image-fetching scripts now preserve this improvement.
- A public `/llms.txt` guide links to company, service, equipment and policy
  pages. It excludes CRM and private data. It is an assistant discovery aid,
  not a promised Google ranking improvement.
- The existing HTTPS deployment configuration now emits HSTS on its TLS
  server blocks. This takes effect only after the deployment regenerates and
  reloads Nginx; it cannot be verified from the local Next.js server.

The existing sitemap, old cleaning/staffing redirect, and HTTP/www canonical
redirects are retained. No city offices or fabricated location pages were added.

## Verification

Production build and lint pass. The rendered production site passes
`scripts/check-seo.mjs`: **31 pages, 0 errors, 0 editorial warnings**. This checks
HTTP responses, metadata, one H1 per page, canonicals, indexability, JSON-LD,
image alt attributes, sharing images, equipment linking, robots, llms.txt and
the careers query canonical. The expanded checks also verify matching visible
guide FAQs, inquiry anchors, guide discovery and one guide for each service.
Browser checks cover all eight service pages, eight guides and the hub at
320px with no horizontal overflow, plus representative 320px, 390px and 1440px
layouts with no page errors and working FAQ disclosures. An unknown guide
returns HTTP 404. See [browser checks](plans/seo/2026-10-22-browser-verification.json).

All 8 existing website-to-CRM forwarding regression tests also pass, covering
inquiry signing, retries, timeouts, attachments and careers isolation.

The following measurements were taken during the initial technical pass,
before the additional customer guides and service sections were added:

| Sample page | Published HTML | Initial technical pass HTML | Reduction |
| --- | ---: | ---: | ---: |
| Home | 365,997 bytes | 241,760 bytes | 34% |
| Cleaning | 233,434 bytes | 169,800 bytes | 27% |
| Security & Smart Home | 264,432 bytes | 196,742 bytes | 26% |

These compare rendered HTML payloads, not measured loading speed or Core Web
Vitals. Semrush's text-to-HTML warning may remain on some React pages; the
HTML reduction is real, but a fresh crawl is needed for its new counts.

Evidence:
[published crawl](plans/seo/2026-10-22-live-audit.json),
[initial technical checks](plans/seo/2026-10-22-local-verification.json),
[current release checks](plans/seo/2026-10-22-content-verification.json).

## Additional content across all eight divisions

The follow-up Semrush competitor research is implemented with **equal priority
for all eight services**. There are eight distinct planning guides and a
`/guides` hub, with a homepage link, footer link, service-specific checklists and
contextual links between related services. Each guide answers a different
customer planning need; these are not city-swapped pages.

Service headings and relevant search titles now describe what customers are
looking for, including car buying assistance, temporary staffing and business
marketing. City references ask visitors to confirm availability for the actual
address. No new city office or guaranteed service availability is asserted.

See [the competitor research and content map](plans/seo/2026-10-22-content-expansion.md)
for all eight groups, five competitor keyword samples and the separately noted
Semrush no-data requests. The sitemap now contains 31 public pages, including
the guides hub and eight guides.

## Hostinger deployment handoff

1. Put this reviewed source release onto the existing server using the team's
   normal release process. Preserve the live environment, settings, uploads
   and database. Follow [the existing deployment instructions](crm/DEPLOY.md).
2. Run the normal `sudo ./update.sh` process. It builds the website, stages
   `public/` and `.next/static`, updates the CRM, applies migrations and
   regenerates the site's Nginx configuration. This release includes the CRM
   migration `20261022100000_lead_operations.sql`; do not deploy only half of
   the coordinated release.
3. Keep `NEXT_PUBLIC_SITE_URL=https://tkgventuresltd.ca` in the website build
   environment. The canonical domain must not be a preview or local URL.
4. Check the published site with:

   ```bash
   node scripts/check-seo.mjs https://tkgventuresltd.ca
   curl -I https://tkgventuresltd.ca
   curl -I https://www.tkgventuresltd.ca
   ```

   Confirm the checks pass, both HTTPS responses include
   `Strict-Transport-Security: max-age=31536000`, and www redirects to the
   canonical host. Check HTTP-to-HTTPS redirects as well.
5. Confirm the new homepage title is
   `TKG Ventures Ltd | Home & Business Services in BC`, and the new sharing
   image is accessible at `/og/tkg-ventures.png`. Check a quote submission and
   CRM sign-in through the published site.
6. Start a fresh crawl in the existing Semrush Site Audit project after the
   release is live. Compare the issue counts against the saved baseline;
   do not present the local checks as a new Semrush score.

CRM behavior and the exact **98 Eva / 98 unassigned** admin action are documented
in [Lead operations update](crm/LEAD-UPDATES.md). The production assignment has
not been executed from the local test database.

## Keyword priorities from Semrush Canada

These are estimated monthly searches in the **Canadian national database**
for the exact phrases shown, including city terms. They are not city-only
search totals, local-pack positions or promised traffic. Keyword Difficulty
uses Semrush's 0–100 scale. Data was retrieved on 22 October 2026.

| Phrase | Searches/month | Difficulty | Relevant existing page |
| --- | ---: | ---: | --- |
| cleaning services surrey | 720 | 10 | `/services/cleaning` |
| move out cleaning surrey | 110 | 7 | `/services/cleaning` |
| commercial cleaning surrey | 140 | 12 | `/services/cleaning` |
| cleaning services abbotsford | 320 | 22 | `/services/cleaning` |
| small moves vancouver | 590 | 27 | `/services/moving-delivery` |
| furniture delivery vancouver | 70 | 12 | `/services/moving-delivery` |
| moving services surrey | 880 | 22 | `/services/moving-delivery` |
| security camera installation | 1,000 | 21 | `/services/security-smart-home` |
| security camera installation surrey | 20 | 0 | `/services/security-smart-home` |
| home security surrey | 20 | 0 | `/services/security-smart-home` |
| home security bc | 20 | 0 | `/services/security-smart-home` |
| internet providers surrey | 90 | 12 | `/services/telecommunications` |
| internet plans surrey | 20 | 0 | `/services/telecommunications` |
| internet plans bc | 90 | 41 | `/services/telecommunications` |
| staffing agency surrey | 170 | 17 | `/services/staffing` |
| general labour staffing | 20 | 0 | `/services/staffing` |
| lead generation vancouver | 30 | 0 | `/services/business-services` |

All eight services have equal priority in the content release. Cleaning and
moving were early research examples; they do not take precedence over the
other six divisions. Continue adding original job photos and completed-work
examples across the service pages as the owner supplies them. Confirm actual
city coverage before stronger city claims. Separate city pages should only
follow when there is enough distinct, verifiable local information to help a
customer.

The returned cleaning SERP includes Merry Maids and Molly Maid's Surrey pages;
the small-moves SERP includes Small Moves Vancouver and MiniMove. Those are
useful competitors for service-depth comparisons, not evidence of TKG's own
position. No data was returned for some requested automotive, realtor-referral
and brand phrases; those are not recorded as having zero demand.

## Account work after deployment

Search Console and Google Business Profile are not connected to this task.
Their setup and verification have not been claimed as completed.

- In the owner's verified Search Console property, submit
  `https://tkgventuresltd.ca/sitemap.xml`, inspect the home page and priority
  service pages, and monitor indexing, queries, clicks and conversions. Use
  PageSpeed Insights/Search Console for actual Core Web Vitals measurements.
- Maintain an eligible Google Business Profile with the real service area,
  accurate categories and matching public contact details. Follow Google's
  rules for service-area businesses and address visibility. Add genuine work
  photos and request honest reviews from actual customers.
- Use the researched phrases in Semrush Position Tracking with the actual
  target location and device. Compare a baseline after deployment, then review
  progress over subsequent weeks; this release has not created a tracking
  campaign or purchased backlinks.
- Use real customer/project material for further content. The current release
  completes the technical foundation; ongoing content, local reputation and
  measured conversions determine the next improvements.

Reference documentation:
[Google title links](https://developers.google.com/search/docs/appearance/title-link),
[LocalBusiness](https://developers.google.com/search/docs/appearance/structured-data/local-business),
[Product snippets](https://developers.google.com/search/docs/appearance/structured-data/product-snippet),
[JobPosting](https://developers.google.com/search/docs/appearance/structured-data/job-posting),
[sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview),
[Business Profile eligibility](https://support.google.com/business/answer/3038177).
