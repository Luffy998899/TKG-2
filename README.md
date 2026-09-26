# TKG Ventures

Marketing site for TKG Ventures — an umbrella company with eight service divisions.
The homepage is a dark, scroll-driven WebGL journey over a full-bleed
photograph; every division has its own page, its own colour, its own photography
and its own inquiry form.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Three.js via
@react-three/fiber + drei · GSAP ScrollTrigger + Lenis · react-hook-form + zod.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

Two verification scripts, both dependency-free and safe for CI:

```bash
node scripts/check-contrast.mjs        # WCAG AA/AAA across both grounds
node scripts/fetch-division-images.mjs # re-downloads public/divisions/
```

---

## Before you launch

There are **no bracketed placeholders** anywhere on the site. Every business
detail is either real (from tkg-ventures-ltd.webflow.io), editable by the
owner from `/admin`, or hidden until it exists. Nothing is invented.

### `/admin` — the owner's control panel

`/admin` lets the owner change site data without a deploy:

| Page | What it does |
| --- | --- |
| **Inbox** (`/admin`) | Every form submission from every page, newest first, with read/unread state, a detail view, and a download link for any attached resume. |
| **Site details** (`/admin/settings`) | Phone (display + dialable), WhatsApp number, email, street address, hours, tagline, description, social URLs. Blank = hidden / built-in default. Saving revalidates the whole site immediately. |
| **Reviews** (`/admin/testimonials`) | Add a customer review with a mandatory "I have their permission" confirmation and a division to show it on. Reviews appear on the homepage and the relevant division page; the sections stay hidden until one exists. There are no placeholder reviews in code. |
| **Favicon** (`/admin/branding`) | Upload a PNG/ICO/SVG; it replaces the default `src/app/icon.svg` everywhere. |

**Enabling it:** set `ADMIN_PASSWORD` in the server environment (see
`.env.example`). Until it is set, `/admin` is switched off and says so — there
is no default password. Sessions are HMAC-signed HttpOnly cookies; no
dependencies were added. `/admin` is `noindex` and disallowed in `robots.txt`.

### The data store — read before choosing a host

Submissions, uploads and `/admin` overrides are written by
`src/lib/store.ts` to a `data/` directory (gitignored; override with
`TKG_DATA_DIR`). That is the **only** file that touches disk, so moving to a
hosted store is a one-file swap.

**It persists on any host with a disk** (a VPS, Railway/Render with a
volume, Docker). **It does not persist on Vercel** or other serverless hosts,
where the filesystem is discarded on every deploy — `/admin` shows a red
banner when it detects that. Before relying on it there, replace the bodies
of the functions in `store.ts` with Vercel Blob / KV, Postgres, or S3. The
inbox, settings and reviews UI will not change.

On a serverless host the store writes to `/tmp`, which is the only writable
path there. That is a way of not *failing* the request, not a way of keeping
it: **set `RESEND_API_KEY`** (below) so leads actually reach an inbox. A
submission is never lost to a storage failure — the route logs it and mails
it either way.

## Deploying to a server

Two scripts, for a plain Ubuntu or Debian VPS. This is the recommended host:
the data store keeps submissions on a real disk, which is the one thing
serverless cannot do.

```bash
sudo ./deploy.sh     # once, on a fresh server
sudo ./update.sh     # every time after that
```

`deploy.sh` asks for the domain, an admin password, the Resend key and the
optional extras, then installs Node 20, nginx and certbot, builds the site,
requests a real Let's Encrypt certificate, and starts it as a systemd service
that survives reboots. Re-running it is safe — previous answers come back as
defaults.

`update.sh` rebuilds and restarts. **The build runs before the running site is
touched**, so a change that does not compile leaves the live site untouched
and stops with the error. After restarting it polls the app and fails loudly
if it did not come back.

| Path | What it is |
| --- | --- |
| `/etc/tkg-ventures.env` | secrets and settings, root-only, `chmod 600` |
| `/etc/systemd/system/tkg-ventures.service` | the service |
| `/etc/nginx/sites-available/tkg-ventures` | the reverse proxy |
| `/var/lib/tkg/data` | submissions, uploads, `/admin` settings |

The data directory is deliberately **outside** the source tree, so no rebuild
or redeploy can delete it.

Two things worth knowing:

- **Do not keep the source under `/root`.** It is mode `0700`, so the
  unprivileged service user cannot descend into it and systemd fails with a
  bare `status=203/EXEC`. `deploy.sh` detects this, offers to copy the tree to
  `/opt/tkg-ventures` and continues from there — but `/opt` is the better place
  to put it in the first place. Run `./update.sh` from wherever the app ended
  up, not from the original copy.
- The scripts must have Unix line endings and the executable bit. If you copied
  them from Windows: `sed -i 's/\r$//' deploy.sh update.sh && chmod +x deploy.sh update.sh`.
- `NEXT_PUBLIC_SITE_URL` is **baked into the pages at build time**, not read at
  startup. Changing the domain means running `./update.sh`, not just restarting.

### Why the build output is `standalone`

`next.config.mjs` sets `output: 'standalone'`, which traces only the code
actually reached at runtime: **46MB shipped instead of a 537MB
`node_modules`**. Next does not copy `public/` or `.next/static` into that
bundle, because they are assets rather than traced code, so both scripts copy
them in after every build — deleting the destination first, since `cp -r a b`
into an existing `b` would produce `public/public` and 404 every image.

### Where a submission goes — email

`notify()` in `src/app/api/inquiry/route.ts` emails every inquiry, and never
throws. **`RESEND_API_KEY` is the only variable you need**; the addresses are
defaults in code:

    from  TKG Ventures <mail@kaisoul.tech>     (INQUIRY_FROM_EMAIL overrides)
    to    info@tkgventuresltd.ca               (INQUIRY_TO_EMAIL overrides)

Each email carries every field as a table, the customer's **uploads as real
attachments** (resume, moving photos, telecom bill — up to 15MB), and
`Reply-To` set to the customer, so hitting reply answers them directly.
Attachments matter most on a serverless host: the stored copy does not
survive there, so the email is the only copy that will still exist tomorrow.

**Two things to do before mail arrives:**

1. Create the key at [resend.com/api-keys](https://resend.com/api-keys) and
   put it in `.env.local` *and* in the host's environment variables — a
   `.env.local` file is not uploaded to Vercel.
2. **Verify `kaisoul.tech` in Resend** (Domains → Add domain → add the DNS
   records). Until that is done Resend accepts the request and silently drops
   the message. A refusal is logged in full: look for `[inquiry] Resend
   refused` in the host's logs.

`INQUIRY_WEBHOOK_URL` is optional and independent: it POSTs the same
submission as JSON to Zapier, Make, n8n, a Sheet or a CRM.

### Address autocomplete

Any field with `type: 'address'` suggests real addresses as the customer
types, through `/api/address`. The customer picks one, and the exact address
they picked is what the inquiry carries.

**No API key, no account, nothing to configure.** It runs on Photon
(OpenStreetMap), which is free and unmetered. Two details make it usable
rather than merely present, and both live in `photon()`:

- **Two searches per lookup, in parallel** — one restricted to a Fraser
  Valley / Lower Mainland bounding box, one to Canada. Local results are
  listed first, national ones fill the rest. Photon's `lat`/`lon` is only a
  soft bias, and on its own it answers "123 Main St" with Winnipeg, then New
  Zealand, then India. `bbox` is the only real filter it has.
- **Re-ranked before returning** — by how many of the typed words actually
  appear in the result, then by whether a numeric query found a house number.
  Photon orders by prominence, which puts a railway stop above the street you
  named. Duplicates (a building, its entrance, the shop inside it) collapse to
  one row.

Results are cached in-process for five minutes, so backspacing over a street
name does not re-hit a free service.

Setting `GOOGLE_MAPS_API_KEY` switches the route to Google Places (New) with
no code change. Worth doing only if unit numbers inside buildings or
brand-new subdivisions start coming up missing — that is the one place
OpenStreetMap coverage is thin.

### Still to do by the business

- **Resend API key.** The one thing that has to be set for inquiries to reach
  an inbox — see "Where a submission goes" above. Address autocomplete needs
  nothing.
- **Address and hours** — enter them in `/admin/settings` when the business
  wants them published. The contact page and LocalBusiness JSON-LD omit them
  while blank.
- **Real estate** — the site states, factually, that TKG is not a licensed
  brokerage and regulated work is done by licensed professionals. When there
  is an actual brokerage partner, add their name/licence in
  `src/config/site.ts` (`realEstateNotice`) — never before.
- **Security product specs** — product pages describe categories and say
  exact models are confirmed on the consultation. Do not add model numbers,
  prices or warranty claims until Brinks supplies them.
- **Installation photos** — `installGallery` in `src/config/security.ts` is
  empty; add real job photos and the section appears.
- **Careers pay** — Sales Representative states the $18.25/hour minimum
  earnings guarantee plus commission, as BC employment standards require for
  a commission role. Appointment Setter still says "Discussed at interview.";
  give it a stated rate in `src/config/careers.ts` before advertising it.
- **Legal pages** — `/privacy` and `/terms` describe what the site actually
  does (BC PIPA / PIPEDA framing). Have counsel review them before launch, and
  update them if analytics, ads or an email provider are added.
- **`[PHOTOGRAPHER]` credit slots** in the two fetch scripts are optional
  attribution under the Unsplash licence — see **Imagery**.

`site.url` defaults to `https://tkg-ventures.example.com` (a reserved example
domain) so `new URL()` parses during build. Set the real origin via
`NEXT_PUBLIC_SITE_URL` — see `.env.example`.

---

## Adding a division

Still **one config entry**. Nothing else needs touching: the homepage grid, the
3D scroll journey, the header dropdown, the footer, the `/services/<slug>` route,
the inquiry form, page metadata, JSON-LD and `sitemap.xml` all render from the
same array.

Open **`src/config/divisions.ts`** and append an object to `divisions`:

```ts
{
  slug: 'landscaping',                  // becomes /services/landscaping
  name: 'Landscaping',
  shortName: 'Landscaping',             // nav, cards, buttons
  tagline: 'Gardens kept, seasons covered',
  summary: 'One or two sentences, shown under the H1 and on every card.',
  body: ['Paragraph one.', 'Paragraph two.'],
  services: [{ title: 'Maintenance', body: 'What it covers.' }],
  highlights: ['At-a-glance point', 'Another', 'A third'],

  // ---- COLOUR. Two forms of the same hue, because the site has two grounds.
  // See "Colour" below, then run the contrast script.
  theme: {
    accent: '#4A7A1C',          // on LIGHT ground: fills, rules, active states
    accentInk: '#3B6116',       // the accent as TEXT on light (AA on paper)
    accentSoft: '#EEF4E2',      // tint background
    accentContrast: '#FFFFFF',  // text on a solid accent fill
    accentBright: '#A2DD5F',    // on DARK ground: the hero and the CTA band
    glow: '#86AC5C',            // emissive colour in the 3D scene
  },

  // ---- IMAGERY. See "Imagery" below.
  image: {
    src: '/divisions/landscaping.jpg',
    alt: 'Describe what is actually in the photograph.',
  },

  scene: { shape: 'ring' },     // icon + 3D geometry archetype

  notice: undefined,            // optional regulatory notice under the hero

  form: {
    title: 'Landscaping inquiry',
    intro: 'One line under the form heading.',
    submitLabel: 'Send landscaping inquiry',
    disclaimer: undefined,
    fields: [
      { name: 'phone', label: 'Phone', type: 'tel', required: true, span: 'half', autoComplete: 'tel' },
      { name: 'details', label: 'Details', type: 'textarea', required: true, rows: 5 },
    ],
  },

  seo: {
    title: 'Landscaping - maintenance and seasonal work',
    description: 'Under ~155 characters. Used for <meta description> and OG.',
  },
}
```

Then add the photograph to the `IMAGES` array in
`scripts/fetch-division-images.mjs` (same `slug`, an `unsplashId`, and a `note`
saying why that photo), and run:

```bash
node scripts/fetch-division-images.mjs   # downloads the photo + builds the manifest
node scripts/check-contrast.mjs          # must print 80/80 pass
```

### What happens automatically

- `/services/landscaping` is statically generated (`generateStaticParams`)
- it appears in the header dropdown, mobile menu, footer, both division grids,
  the contact-page chips and the 404 page
- the homepage journey grows by one camera stop and one viewport of scroll —
  the track height is `(divisions.length + 2) * 100svh`, computed from the array
- its `theme` recolours its card, its page (buttons, focus rings, rules, form
  validation), its rail tick and its 3D slab — no per-division CSS
- its artwork appears on the grid card, the journey overlay card, the page hero,
  the OG image and the 3D slab texture
- it becomes an option in the general quote and contact forms
- it gets a `sitemap.xml` entry and `Service` / `OfferCatalog` JSON-LD

### `scene.shape`

Picks the division's icon from `shapeMarks` in `src/components/icons.tsx`.
Current values: `slab`, `column`, `lattice`, `stack`, `ring`, `arc`, `prism`. To
add a new one, add an entry to `shapeMarks` and widen the `shape` union in the
`Division` interface.

### Which side a division appears on

Nothing to configure. `cardSide()` and `slabSide()` in
`src/components/journey/journey-config.ts` derive it from the array index: the
overlay card alternates right, left, right… and the 3D slab always takes the
opposite half of the frame. They are mirrored together deliberately — flipping
one without the other puts a white slab underneath a text card. Inserting a
division mid-array re-flips everything after it, which is fine.

### Form field types

Defined in `src/lib/form-schema.ts`; zod validation is generated from them.

`text` · `email` · `tel` · `textarea` · `select` · `radio` · `date` · `number` ·
`checkbox-group`

Per-field options: `required`, `placeholder`, `help`, `span` (`'half'` on the
two-column grid, default full), `options`, `rows`, `min`, `max`, `autoComplete`.

`name` and `email` are prepended to every form by `commonFields` — don't repeat
them. A honeypot field (`company_website`) is added and checked automatically.

---

## Design system

### Reference calibration

Two rounds of references, recorded so the choices are arguable rather than
arbitrary.

**Round 1 — structure and restraint.**

| Reference | What was taken | Where it landed |
| --- | --- | --- |
| **recent.design/websites** — *Augen*, *"Ship software that never breaks"* | One soft gradient wash per view; colour reserved for state, never for decoration | The `accent-soft` wash behind each division hero, and the rule that accents only appear on active/hover/focus, rules, marks and CTAs |
| **recent.design/websites** — the *"H … A"* portfolio index, the *GREGOR / LIENNE* collage | Oversized display grotesk as layout furniture; tracked micro-labels above headings; asymmetric image/text splits | Archivo as a display face distinct from the body, the `.eyebrow` above every section heading, and the `1.05fr / 0.95fr` hero split |
| **collectui.com** | Elevated card = hairline border + soft *ambient* shadow; tag chips; big-numeral / small-label stat pairs | The `.card` component and the `shadow-raise/lift/float` scale, `.chip`, and the TrustStrip stat row |

**Round 2 — the dark hero.** Three landing pages supplied as direction (a
Diesel/Porsche watch page, TestiQA, Amwaj). All three share one language, and
that language is what the homepage hero now speaks:

| Taken from | What it is | Where it landed |
| --- | --- | --- |
| All three | A **dark ground** carrying the hero, with the light content below it | `--night` (`#0E1219`), the photographic hero stage, and the dark CTA band that closes the page. The page now reads dark → light → dark |
| Amwaj | A **full-bleed photograph** behind oversized display type, dimmed enough for white type to clear AA | The dusk skyline backdrop, its two-layer scrim, and the white `text-display` wordmark over it |
| Diesel/Porsche, TestiQA | A **split composition** — content on one side, the subject on the other — and **one saturated accent** doing all the signalling | The alternating card/slab layout, and the `accentBright` form of each division colour |
| Diesel/Porsche | Chrome that **inverts over the hero** rather than sitting on an opaque bar | The header's `on-night` state, driven by an IntersectionObserver against its own band |

### Colour

The site runs **two grounds**, and that is the single most important thing to
know before changing a colour.

- A warm **light** ground (`paper`) for the content sections. Accents must be
  dark enough to be legible *on* it: `accent`, `accentInk`.
- A deep cool **night** ground for the photographic hero and the closing CTA
  band. Contrast runs the other way, so accents must be *light*: `accentBright`.

One value cannot pass AA on both. That is why every division carries a dark and
a bright form of its colour, and why `.on-night` in `globals.css` swaps between
them rather than restyling components by hand.

| Token | Hex | Use |
| --- | --- | --- |
| `paper` | `#F7F5F1` | Light page ground (warm off-white) |
| `paper-raised` | `#FFFFFF` | Cards, form controls |
| `paper-sunk` | `#EFECE5` | Alternating section bands, footer |
| `ink` | `#1C1A17` | Body text (warm charcoal, not black) |
| `ink-soft` | `#55504A` | Secondary text |
| `ink-mute` | `#6F6960` | Labels, meta |
| `line` | `#DFDAD1` | Hairline borders |
| `line-strong` | `#C7C1B5` | Hover borders, rails |
| `night` | `#0E1219` | Dark ground: hero stage, CTA band |
| `night-soft` | `#1A2029` | Raised surfaces on dark |
| `night-line` | `#2C3440` | Hairlines on dark |
| `danger` / `ok` | `#A32F2A` / `#166F4E` | Form states |

`night` is pulled **blue**, not warm. It sits behind blue-hour photography, and
a warm charcoal under that image reads as a colour cast.

Seven division accents, one family: mid-dark and saturated on light, with a
light vivid twin for the dark ground.

| Division | `accent` | `accentInk` | `accentSoft` | `accentBright` | `glow` (3D) |
| --- | --- | --- | --- | --- | --- |
| Automotive | `#BC4A17` | `#96380F` | `#FBEBE2` | `#FF9163` | `#FF8A4C` |
| Real Estate | `#1F5CA8` | `#1B4C8A` | `#E6EDF7` | `#7FB6F2` | `#6FA3D8` |
| Security & Smart Home | `#5A3FC0` | `#4A3399` | `#EDE9F9` | `#B39CFA` | `#9182D4` |
| Moving & Delivery | `#9A6206` | `#7C4E05` | `#FAEFD9` | `#F0AE43` | `#D2A24F` |
| Cleaning | `#07786A` | `#065E53` | `#DFF2EF` | `#3FD9C0` | `#4FB3A3` |
| Staffing | `#8A4BB0` | `#6F3B8F` | `#F1E8F7` | `#CDA0E8` | `#A97BC7` |
| Telecommunications | `#08718F` | `#065A72` | `#DEF0F6` | `#4FCBEB` | `#46A9C6` |
| Business Services | `#4A7A1C` | `#3B6116` | `#EEF4E2` | `#A2DD5F` | `#86AC5C` |
| *(site default)* | `#1F5CA8` | `#1B4C8A` | `#E6EDF7` | `#7FB6F2` | `#5C8FC4` |

`accentContrast` is `#FFFFFF` for all nine.

**How theming works.** `themeVars(theme)` returns the `--accent*` custom
properties; setting them via inline `style` on any wrapper recolours its whole
subtree, because `bg-accent`, `text-accent-ink`, `text-accent-bright`,
`bg-accent-soft` and the focus ring all read those variables. That is one line
on the division page wrapper, one on each grid card, one on each header
dropdown row.

**Contrast.** `node scripts/check-contrast.mjs` parses the hex values out of
`theme.ts` and `divisions.ts` — it cannot drift from what ships — and asserts
every pair on **both** grounds. It exits non-zero on failure. Current status:
**72/72 pass**; the tightest is white-on-`accent` for Automotive at 5.08:1
against a 4.5:1 minimum.

### Typography

Two variable faces, both SIL Open Font Licence, both self-hosted by `next/font`
(no third-party request, no layout shift).

- **Display — Archivo** (`--font-display`). A tight, squarish grotesk with far
  more presence than Inter at 3rem+. Used for H1/H2/H3, card titles, the
  wordmark, stat numerals and counters.
- **Body/UI — Inter** (`--font-sans`). Neutral, optically tuned for small sizes.
  Everything else.

The scale lives in `tailwind.config.ts`. Tracking is **size-specific** and
tightens as type grows — a single global `letter-spacing` is wrong somewhere by
definition.

| Step | Size | Leading | Tracking |
| --- | --- | --- | --- |
| `display-xl` | 7rem | 0.90 | −0.050em |
| `display` | 5.5rem | 0.92 | −0.045em |
| `h1` | 3.75rem | 1.00 | −0.038em |
| `h2` | 2.75rem | 1.06 | −0.032em |
| `h3` | 1.875rem | 1.15 | −0.026em |
| `card-title` | 1.5rem | 1.20 | −0.022em |
| `lead` | 1.375rem | 1.45 | −0.014em |
| `body-lg` | 1.125rem | 1.60 | −0.006em |
| `body` | 1rem | 1.65 | 0 |
| `caption` | 0.8125rem | 1.50 | +0.004em |
| `micro` | 0.6875rem | 1.35 | +0.100em |

Composites in `globals.css`: `.display-1/2/3` (family + size + weight + colour),
`.eyebrow` / `.eyebrow-accent` (tracked-out uppercase micro label), `.counter`
(tabular numerals for `01 / 07`).

One exception worth knowing about: the **division page H1 is fluid**,
`clamp(2.25rem, 7.2vw, 3.75rem)`, not a scale step. Division names run long and
"Telecommunications" is a single unbreakable 18-character word; a stepped size
either overflowed the column at 1024px or forced an ugly mid-word break.

Related: every asymmetric grid uses `minmax(0, Nfr)` rather than bare `Nfr`.
A bare `fr` track takes its min-content width as a floor, so one long heading
silently starves the column next to it — that is what was crushing the division
hero image to 149px before the fix.

Body copy is capped at `max-w-prose` (68ch) or `max-w-measure` (62ch).

---

## Imagery

### Where it comes from

All photography is from **Unsplash**, downloaded by
`scripts/fetch-division-images.mjs` and committed to `public/divisions/` rather
than hot-linked — the site never depends on Unsplash being up.

**Licence position, which needs a decision before launch.** The Unsplash Licence
is free for commercial use with no permission required and attribution
appreciated but not required. Two things it does *not* cover:

1. **No model or property releases.** The set was chosen to avoid recognisable
   faces and identifiable branded property for exactly this reason, but
   commercial use should still be signed off.
2. **Photos can be withdrawn** by their author. The committed files keep working;
   only a re-run of the fetch script would fail.

Each entry in the script carries a `[PHOTOGRAPHER]` slot and the `unsplashId`.
Credits are optional under the licence — to add them, look each id up via the
Unsplash API `/photos/:id`.

### Files

| File | Size | Used by |
| --- | --- | --- |
| `<slug>.jpg` | 1600×1000 | `next/image` — grid cards, journey thumbnails, page hero, OG |
| `<slug>-tex.jpg` | 512×320 | the WebGL slab texture |
| `hero-backdrop.jpg` | 2000×1125 | the full-bleed photograph behind the homepage hero |

The small texture copies exist because three.js fetches the raw file — it cannot
use `next/image`'s optimised variants — so shipping the 1600px original into the
scene would waste most of the 3D budget. The textures total ~212 KB and are
desktop-only; everything else goes through `next/image` and never ships at its
source size.

`public/divisions/manifest.json` is written by the same script and imported by
`src/lib/images.ts`, so `next/image` always gets the true intrinsic dimensions
and a real 12×8 LQIP blur, and both stay correct when the photos are replaced.

### Swapping in your own photography

Either point `unsplashId` at a different photo and re-run the script, or replace
the files directly (`<slug>.jpg` at 1600×1000, `<slug>-tex.jpg` at 512×320) and
update the matching `width`/`height`/`blurDataURL` in `manifest.json`. Then
update `image.alt` in `src/config/divisions.ts` so it describes the new photo.
No component changes either way.

### Image rules applied everywhere

- `next/image` with an explicit `sizes` from `imageSizes` in `src/lib/images.ts`
  (`gridCard`, `pageHero`, `thumb`, `strip`) — the difference between shipping a
  1600px file to a 375px phone and shipping a 375px one.
- `placeholder="blur"` with the generated LQIP on every image.
- `priority` on exactly two images: the hero backdrop and the division page hero,
  the only ones above the fold.
- Descriptive `alt` from config; the journey thumbnail uses `alt=""` because the
  card's own heading already names it, and the backdrop uses `alt=""` because it
  is decorative.
- Every image sits in a `.frame`: fixed aspect, consistent radius, accent-tinted
  ground while it loads, and a **1px outline at 10% opacity** — pure black over
  the light ground, pure white over dark (`.frame-dark`). Never a tinted
  neutral, which picks up the surface underneath and reads as dirt on the edge.

## The scroll engine

**Unchanged by the visual pass.** Worth understanding before touching the
homepage.

Lenis, GSAP and the R3F render loop share **one clock**. If they don't, the 3D
scene drifts a frame or two behind the DOM and the whole thing reads as cheap.

**`src/components/ScrollProvider.tsx`** — mounted once in the root layout:

1. Lenis owns scroll position (`autoRaf: false` — it does not run its own loop).
2. Lenis's `scroll` event calls `ScrollTrigger.update()`, so every trigger reads
   the smoothed position rather than the raw native one.
3. `gsap.ticker` drives `lenis.raf(time * 1000)` — GSAP is the single clock.
4. `gsap.ticker.lagSmoothing(0)` stops GSAP jumping ahead after a long frame,
   which would desync scrub from the scrollbar.
5. No `scrollerProxy`: Lenis in window mode moves the real document scroll
   position, so ScrollTrigger's default scroller is already correct — proxying it
   would break `pin`.

**`src/components/journey/CameraTimeline.tsx`** — one GSAP timeline with
`scrub: 1`, `trigger: #journey-track`, `start: 'top top'`, `end: 'bottom bottom'`,
pinning `#journey-stage`. It tweens the real `THREE.PerspectiveCamera` position
and a look-at vector through the stops in `journey-config.ts`, and it schedules
the DOM overlay cards **on the same timeline** — so copy and camera cannot drift.
Camera position is a pure function of scrollbar position: scroll up and it runs
backwards, frame for frame. Nothing autoplays.

**`src/lib/scroll-store.ts`** — the bridge. ScrollTrigger writes
`journey.progress` (0→1) on every scrub tick; `useFrame` reads it every frame.
Deliberately not React state. The one thing the DOM re-renders on — which beat is
active — goes through a tiny `useSyncExternalStore` publisher.

**`src/components/journey/Scene.tsx`** — slab rotation, emissive intensity and
the depth field are lerped from `journey.progress` with a frame-rate independent
`damp()`, so 120Hz and 60Hz displays settle at the same speed.

### Tuning

- **Pace** — `SPACING` and the track height multiplier in `Journey.tsx`.
- **Framing** — the `layouts` table in `journey-config.ts` (`full` and `lite`).
  Slabs sit on the right of the corridor, the camera travels down the left, and
  the overlay card is always bottom-left, so the two never collide.
- **Card timing** — `CARD_IN` / `CARD_OUT`. Deliberately adjacent, not
  overlapping: card *i* finishes leaving exactly when card *i+1* starts arriving.

---

## Performance

- The WebGL canvas is `dynamic(..., { ssr: false })` — three.js is never in the
  server bundle and never blocks first paint. Homepage first-load JS is ~158 kB;
  three.js and the slab textures load after.
- **No 3D model files.** The scene is procedural geometry (boxes, planes, one
  points cloud) plus one 512×320 photographic texture per division, so there is no GLB to
  download and nothing to Draco-compress. If a model is added later: export Draco-compressed,
  keep textures ≤2K, load through `useGLTF` with `useGLTF.setDecoderPath()`, and
  preload it only on the `full` tier.
- **Tiering** — `detectTier()` in `SceneCanvas.tsx` returns `lite` for viewports
  ≤768px, coarse pointers, or ≤4 CPU cores. `lite` narrows the corridor, widens
  the lens, drops the fill light and the ground glows, halves the depth field,
  caps DPR at 1.5 (2 on `full`), and **skips the slab textures entirely** — the
  phone gets the same artwork as a `next/image` thumbnail in the overlay card,
  for a fraction of the bandwidth.
- **Texture loading** is wrapped in a per-slab `<Suspense fallback={null}>`, so
  the corridor and panels render immediately and the art fades in behind them.
- **Idle GPU** — an IntersectionObserver flips `frameloop` to `'never'` when the
  pinned stage leaves the viewport, so every other section renders nothing.
- The scene has no time-based animation. Everything is scroll-derived, so a still
  page is a still scene.
- The CTA band's grain is an inline SVG data URI at 4% opacity — no request.

---

## Accessibility

- **`prefers-reduced-motion: reduce`** — the canvas is never downloaded
  (`usePrefersReducedMotion` gates the dynamic import), the journey track
  collapses to auto height, pinning and scrub are skipped, the hero becomes a
  normal static section, and a static one-card-per-division strip (`[data-journey-static]`)
  replaces the 3D beats. Those overrides live in `globals.css` rather than as
  `motion-reduce:` utilities because they must beat `md:` variants, which
  Tailwind emits last.
- **`prefers-reduced-transparency`** and **`prefers-contrast: more`** solidify
  every `backdrop-filter` surface; the latter also darkens `line`/`line-strong`
  and gives cards a stronger border.
- One `<h1>` per page. The division content in the 3D journey is duplicated as a
  server-rendered `<DivisionGrid>` further down the homepage — that is what
  crawlers and no-JS visitors read.
- Forms: real `<label>`/`<fieldset>` bindings, `aria-invalid`,
  `aria-describedby` for help and error text, `role="alert"` on messages, focus
  moved to the status region on submit, 48px minimum control height, and
  `.field-tile` making the whole radio/checkbox row the target.
- Skip link, accent-tinted focus rings everywhere, sticky CTA hides while a field
  is focused so it can't cover the on-screen keyboard.
- Every colour pairing is machine-verified — see the contrast script above.

---

## Project layout

```
scripts/
  fetch-division-images.mjs      downloads the division photography + manifest
  fetch-page-images.mjs          security / automotive / careers photography
  check-contrast.mjs             WCAG verification, both grounds (no deps)
public/divisions/                8 x .jpg + 7 x -tex.jpg + manifest.json
public/media/                    page photography (security, auto, careers) + manifest
src/
  app/
    layout.tsx                   root layout, live settings -> <SiteProvider>, JSON-LD, chrome
    icon.svg                     default favicon (overridable from /admin)
    privacy/ terms/              legal pages (plain-language, BC PIPA / PIPEDA)
    admin/                       owner control panel: inbox, settings, reviews, favicon
    api/favicon/                 serves the uploaded favicon
    api/admin/files/[name]/      owner-only download of uploads
    page.tsx                     journey + trust strip + about + grid + CTA
    about/ contact/ quote/       standard pages
    careers/                     careers page (data-driven roles + application form)
    services/[division]/         one template, five static routes (auto + security overridden)
    services/automotive/         vehicle-sourcing page (NOT a dealership)
    services/security-smart-home/            the 12-section security microsite
    services/security-smart-home/products/[slug]/   one product page per product
    api/inquiry/route.ts         intake: JSON or multipart, persists to the store  <- TODO: email notify
    sitemap.ts robots.ts not-found.tsx globals.css
  components/
    SiteProvider.tsx             live settings for client components (useSite / useContact)
    Testimonials.tsx             real, permissioned reviews from the store; hides when empty
    ScrollProvider.tsx           Lenis + GSAP ticker + ScrollTrigger
    Header / Footer / StickyCTA / CTABand / TrustStrip / DivisionGrid / Reveal
    FloatingContact.tsx          persistent WhatsApp (+ desktop call) button
    careers/ApplicationForm.tsx  reads ?role= to preselect the position
    automotive/SelectedVehicles.tsx   self-hiding partner-vehicle grid
    security/FaqAccordion.tsx    native <details> FAQ accordion
    form/InquiryForm.tsx         one form component for every division + page
    form/Field.tsx               renders one configured field (incl. file upload)
    journey/
      Journey.tsx                track, pinned stage, backdrop, cards, rail, flagship CTA
      SceneCanvas.tsx            Canvas host, tiering, frameloop throttle
      CameraTimeline.tsx         the scrubbed GSAP camera timeline
      Scene.tsx                  meshes, textures, scroll-derived motion
      journey-config.ts          camera stops + per-tier layout
  config/
    site.ts                      brand + contact DEFAULTS (overridable from /admin)
    divisions.ts                 <- the eight divisions (order drives everything)
    security.ts                  security pillars, products, FAQs, testimonials
    automotive.ts                sourcing/selling forms, 5-step process, disclaimer
    careers.ts                   <- post a role here (feeds page, dropdown, JSON-LD)
    theme.ts                     base palette (both grounds), themeVars()
    general-forms.ts             quote + contact form configs
  lib/
    store.ts                     THE data store (JSON files + uploads) - swap here for a hosted DB
    settings.ts                  code defaults merged with /admin overrides, tag-cached
    admin-auth.ts                password check + HMAC session cookie, no deps
    form-schema.ts               field types (incl. file), zod builder
    scroll-store.ts              ScrollTrigger -> R3F bridge
    images.ts                    manifest types, sizes presets
    motion.ts                    damp, smootherstep, momentum projection
    jsonld.ts                    Organization / LocalBusiness / Service
    usePrefersReducedMotion.ts
```

---

## Animation plans

`plans/` holds the motion audit (7 plans, all applied on 2026-09-05) produced
by the `improve-animations` workflow: press-feedback fixes, an interruptible
header dropdown, the mobile sheet entrance, the FAQ reveal, hover gating for
touch, reduced-motion feedback and the form success entrance. Each plan is
self-contained and records what changed and how to feel-check it.
