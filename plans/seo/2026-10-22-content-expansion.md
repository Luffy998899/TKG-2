# Competitor-informed content update — 22 October 2026

All eight service divisions have equal implementation priority, as requested.
Each now has a distinct customer planning guide, a visible planning section on
its service page, a three-point inquiry checklist and contextual links to
related services. The guides hub presents all eight with the same card format.
The home page and footer link to the hub; the sitemap and llms.txt include it
and the individual guides.

## Research and the resulting content

Semrush database: **Canada (`ca`)**. Volumes are national estimates for the
exact query, including its city term where present, not searches restricted to
that city. Competitor positions are returned samples, not TKG rankings. Do not
add keyword volumes together to predict reach: related queries overlap.

| Division | Search evidence (monthly volume; difficulty) | Content implemented |
| --- | --- | --- |
| Security | security camera installation (1,000; 21), home alarm systems (1,900; 35) | Coverage, wiring and recording questions, itemized installation scope, existing-equipment compatibility |
| Telecommunications | internet providers surrey (90; 12); Wakey's page appears at position 2 for that query | Address availability, upload/download needs, promotional versus ongoing pricing, equipment and switching checklist |
| Automotive | car buying assistance (70; 29), car buying service (70; 47); CarSmart appears at positions 4 and 1 respectively | Vehicle brief, shortlist checks, inspection coordination and the selling dealership's role |
| Real estate | realtor referral (30; 0), real estate referral (10; 0) | Buyer/seller referral brief, questions for a licensed representative, responsibilities and timing |
| Moving | movers for small moves (720; 13); Small Moves Vancouver appears at position 1 | Load and dimensions, access at both ends, Marketplace pickup coordination and single-item delivery |
| Cleaning | cleaning services surrey (720; 10), deep cleaning services surrey (170; 14); Merry Maids' page appears at position 1 for each | Maintenance versus deep/move-out scope, written checklist, timing, pricing factors and carpet-cleaning exclusions |
| Staffing | temp agency surrey (210; 17); Insight Global's page appears at position 1 | Duties, credentials, headcount, schedule, supervision and supply placement versus managed cleaning |
| Business services | small business marketing vancouver (170; 12), lead generation vancouver (30; 0) | Audience and offer, qualified-lead definition, follow-up ownership and outcome measurement |

The cleaning question report also returned cost, duration and carpet-inclusion
questions. Those are addressed using the actual quote process; no made-up
prices or durations were supplied. Camera question data includes installation
and rental-property questions; the guide stays within planning and permission
coordination rather than giving legal or electrical installation instructions.

Automotive content uses vehicle sourcing and car buying assistance. The query
`auto broker vancouver` was researched but not adopted as a claim: TKG is not
described as a licensed dealership or broker. CarSmart is a national-query
comparison from Toronto, not evidence of a local BC competitor office.

## Missing Semrush data

Semrush returned no SERP data for each of these requests:

- `home security bc`, Canada
- `realtor referral`, Canada
- `lead generation vancouver`, Canada

Those results were not retried through other reports or sources. No competitor
names, positions or traffic figures were fabricated for them. The prior TKG
domain overview and Surrey camera-installation SERP requests also remain
unavailable. Keyword-summary rows are separate reports and do not establish
competitor positions.

Raw results, query parameters in source links, sample limits and API-unit usage
are retained in [content research](2026-10-22-content-research.json). Prior
baseline evidence is in [the initial audit](2026-10-22-semrush.json).

## Implementation boundaries

City references invite visitors to check availability for their actual address.
No physical city office, guaranteed appointment, customer result or new service
capability is asserted. Existing service definitions and the automotive and
real-estate role distinctions remain in force. New guides have WebPage,
breadcrumb and matching visible FAQ markup. They do not carry invented author
credentials or publication dates.

The content helps a visitor prepare an inquiry and compare its scope. It is
original writing grounded in TKG's existing service configuration; competitor
copy, reviews and prices have not been transplanted. There are no hidden
keyword blocks, city-swapped landing pages or bulk backlinks.

## Release verification

- Production build, lint and type checking pass.
- All 31 public pages pass the rendered SEO checks with zero errors and zero
  editorial warnings. New checks cover the guide-to-service relationships,
  inquiry anchors, visible FAQ/markup agreement and internal discovery.
- All 17 service/guide/hub pages have no horizontal overflow at 320px.
  Twelve representative browser checks at 320px, 390px and 1440px also pass,
  including FAQ interaction and browser page-error checks.
- Unknown guide slugs return HTTP 404.

Evidence: [rendered SEO checks](2026-10-22-content-verification.json),
[browser checks](2026-10-22-browser-verification.json).

## Measuring whether it works

After the Hostinger team deploys this release, verify the new URLs, submit the
updated sitemap in the owner's Search Console property, and record impressions,
clicks and qualified inquiries for all eight service groups. Compare equivalent
periods after indexing has had time to settle. Track the actual target location
and device in Semrush; national keyword volume is not a local ranking.

Search Console and Business Profile access are still not connected here, so
indexing requests, profile edits, ranking gains and Google/AI recommendations
have not been claimed as completed. Competitor research cannot guarantee that
Google or an assistant will recommend the site.

Sources for implementation principles:
[Google's people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content),
[crawlable, descriptive links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

Competitor pages inspected:
[Merry Maids Surrey](https://merrymaids.ca/home-cleaners-surrey-bc),
[Small Moves Vancouver](https://www.smallmovesvancouver.com/),
[Wakey Surrey](https://wakeyinternet.ca/landing/surrey),
[CarSmart](https://carsmart.ca/),
[Insight Global Surrey](https://insightglobal.com/locations/british-columbia/staffing-agency-surrey-bc/).
