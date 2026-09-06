import { site } from '@/config/site';

/* =========================================================================
   The Security & Smart Home microsite.

   Everything on /services/security-smart-home and every page under
   /services/security-smart-home/products/ renders from this file. Adding a
   product is one entry in `products`; it appears in the grid, gets its own
   page, joins its pillar, and enters the sitemap.

   COPY STATUS
   -----------
   Product copy describes product CATEGORIES and is deliberately written
   without model numbers, prices, technical figures or warranty terms. Do not
   add any of those until they come from Brinks or the manufacturer - an
   invented spec is a warranty claim waiting to happen. Exact models are
   confirmed on the consultation, and the product pages say so.
   ========================================================================= */

/* ------------------------------------------------------------------ pillars */

export type PillarId = 'protect' | 'watch' | 'automate';

export interface Pillar {
  id: PillarId;
  name: string;
  tagline: string;
  body: string;
  /** Key into public/media/manifest.json. */
  image: string;
  imageAlt: string;
}

export const pillars: Pillar[] = [
  {
    id: 'protect',
    name: 'Protect',
    tagline: 'The system that notices',
    body: 'Alarm panel, door and window sensors, motion detection, smoke and CO. The layer that knows when something has happened and tells somebody about it.',
    image: 'security-protect',
    imageAlt: 'A contemporary house lit from within at dusk.',
  },
  {
    id: 'watch',
    name: 'Watch',
    tagline: 'Eyes on the property',
    body: 'Indoor and outdoor cameras and video doorbells, placed where they actually cover the approaches, and recorded so you can go back and look.',
    image: 'security-watch',
    imageAlt: 'Security cameras mounted on the exterior of a building.',
  },
  {
    id: 'automate',
    name: 'Automate',
    tagline: 'The building runs itself',
    body: 'Smart locks, lighting and thermostats tied into the same system, so arming the alarm can also lock the doors and drop the heat.',
    image: 'security-automate',
    imageAlt: 'A calm, modern living room.',
  },
];

export const getPillar = (id: PillarId): Pillar =>
  pillars.find((pillar) => pillar.id === id) as Pillar;

/* ----------------------------------------------------------------- products */

export interface SecurityProduct {
  /** URL segment under /services/security-smart-home/products/ */
  slug: string;
  name: string;
  /** Which pillar this sits under. */
  pillar: PillarId;
  /** One line, used on the card. */
  tagline: string;
  /** Two or three sentences, used at the top of the product page. */
  summary: string;
  /** Body copy for the product page, one string per paragraph. */
  body: string[];
  /** "What it does" bullets. */
  features: string[];
  /**
   * "Good to know" rows. Deliberately qualitative - see the COPY STATUS note.
   */
  details: { label: string; value: string }[];
  /** Key into public/media/manifest.json. */
  image: string;
  imageAlt: string;
}

export const products: SecurityProduct[] = [
  {
    slug: 'iq-panel-4',
    name: 'IQ Panel 4',
    pillar: 'protect',
    tagline: 'The brain of the system',
    summary:
      'The touchscreen panel everything else reports to. Arm and disarm at the door, see which sensor tripped, and talk to monitoring without picking up a phone.',
    body: [
      'A security system is only as good as the thing coordinating it. The panel is where sensors, cameras, locks and monitoring meet: it knows what is armed, what tripped, and who to tell.',
      'We site it where you actually come and go rather than where the cabling is easiest, and we set the arming modes around how the household really uses the building, not around a factory default.',
    ],
    features: [
      'Touchscreen arming and disarming at the entry point',
      'Shows which sensor tripped, and when',
      'Two-way voice with the monitoring centre',
      'Backup power, so a cut mains supply does not disarm the property',
      'Controls the cameras, locks and smart devices on the same system',
    ],
    details: [
      { label: 'Best for', value: 'Every install. It is the hub, not an add-on' },
      { label: 'Placement', value: 'Main entry point, at a comfortable reach' },
      { label: 'Monitoring', value: '24/7 professional monitoring available' },
    ],
    image: 'product-iq-panel-4',
    imageAlt: 'A wall-mounted touchscreen control panel being operated.',
  },
  {
    slug: 'outdoor-cameras',
    name: 'Outdoor Cameras',
    pillar: 'watch',
    tagline: 'Coverage where it counts',
    summary:
      'Weather-rated cameras covering the approaches to the property: driveway, side gate, back door. Recorded, so an incident is something you can review rather than something you have to remember.',
    body: [
      'Most outdoor camera setups fail for one reason: placement. Four cameras pointed at the same well-lit front door tell you nothing about the side gate someone actually used.',
      'We walk the property, work out the real approaches, and place cameras to cover them, then check the night image from each one before we call the job finished.',
    ],
    features: [
      'Weather-rated for year-round outdoor use',
      'Night vision on every approach',
      'Motion-triggered alerts to your phone',
      'Recorded footage you can go back through',
      'Placement planned on site, not guessed from a floor plan',
    ],
    details: [
      { label: 'Best for', value: 'Driveways, entrances, gates, yards' },
      { label: 'Power', value: 'Discussed on the site visit; wired and wireless are both possible' },
      { label: 'Storage', value: 'Cloud and local options' },
    ],
    image: 'product-outdoor-cameras',
    imageAlt: 'An outdoor bullet camera against a plain background.',
  },
  {
    slug: 'indoor-cameras',
    name: 'Indoor Cameras',
    pillar: 'watch',
    tagline: 'Check in from anywhere',
    summary:
      'Discreet indoor cameras for the rooms that matter: the hallway, the back door, the stockroom. Live view and recorded clips from the same app as everything else.',
    body: [
      'Indoor cameras are as much about reassurance as security: the dog, the contractor, whether the back door actually got shut. They earn their place by being easy to check on a phone in ten seconds.',
      'Privacy matters here more than anywhere. We talk through which rooms should and should not be covered before anything gets mounted, and every camera can be switched off from the app.',
    ],
    features: [
      'Live view and recorded clips',
      'Motion and sound alerts',
      'Two-way audio',
      'Can be disabled per camera from the app',
      'Small enough to sit on a shelf rather than dominate a room',
    ],
    details: [
      { label: 'Best for', value: 'Hallways, entrances, stockrooms, back-of-house' },
      { label: 'Privacy', value: 'Per-camera off switch in the app' },
      { label: 'Storage', value: 'Cloud and local options' },
    ],
    image: 'product-indoor-cameras',
    imageAlt: 'A small white indoor camera on a table.',
  },
  {
    slug: 'video-doorbells',
    name: 'Video Doorbells',
    pillar: 'watch',
    tagline: 'See and speak, wherever you are',
    summary:
      'The front door, answered from anywhere. See who is there, talk to them, and keep a record of every delivery and every caller.',
    body: [
      'The doorbell is the single most-used piece of a home security system, because it gets used by people who never think about security at all. It is just how the door gets answered now.',
      'We fit it at the right height and angle for the actual doorway, which is what determines whether you see a face or the top of a head.',
    ],
    features: [
      'Live video and two-way talk from your phone',
      'Motion alerts before anyone rings',
      'Recorded clips of callers and deliveries',
      'Works alongside the smart lock for remote entry',
      'Fitted at the correct height and angle for the doorway',
    ],
    details: [
      { label: 'Best for', value: 'Any front door: houses, townhouses, businesses' },
      { label: 'Power', value: 'Wired to existing doorbell wiring where present' },
      { label: 'Pairs with', value: 'Smart Locks, for letting someone in remotely' },
    ],
    image: 'product-video-doorbells',
    imageAlt: 'A video doorbell mounted beside a door.',
  },
  {
    slug: 'smart-locks',
    name: 'Smart Locks',
    pillar: 'automate',
    tagline: 'Keys, without the keys',
    summary:
      'Codes instead of keys, locked and unlocked from the app, with a record of who came and went. Useful for families, essential for anyone with cleaners, trades or tenants.',
    body: [
      'A smart lock replaces the worst part of any building: the key that gets copied, lost or lent and never comes back. Everyone gets their own code, and a code can be revoked in seconds.',
      'Tied into the alarm, locking up becomes one action rather than five. Arm the system and the doors lock behind you.',
    ],
    features: [
      'Per-person codes, revocable at any time',
      'Lock and unlock remotely from the app',
      'A log of who entered and when',
      'Auto-lock on arming the alarm',
      'Physical key override retained',
    ],
    details: [
      { label: 'Best for', value: 'Households with cleaners, trades, tenants or teenagers' },
      { label: 'Fits', value: 'Most standard door hardware, checked on the site visit' },
      { label: 'Pairs with', value: 'Video Doorbells, for remote entry' },
    ],
    image: 'product-smart-locks',
    imageAlt: 'A keypad smart lock fitted to a door.',
  },
  {
    slug: 'sensors',
    name: 'Sensors',
    pillar: 'protect',
    tagline: 'The quiet layer',
    summary:
      'Door, window, motion and glass-break sensors. Individually unremarkable; collectively, the thing that means an alarm system knows what is happening rather than guessing.',
    body: [
      'Sensors are where a security system is won or lost. Enough of them, in the right places, and the panel can tell the difference between the cat and a back window. Too few, and it either misses things or cries wolf until somebody stops arming it.',
      'We work out the coverage from the actual building, meaning which windows open, which doors are used and where the sightlines are, rather than fitting a fixed bundle to every property.',
    ],
    features: [
      'Door and window contacts',
      'Motion detection, pet-tolerant where needed',
      'Glass-break detection for ground-floor windows',
      'Reports to the panel individually, so you know exactly what tripped',
      'Coverage planned around the actual building',
    ],
    details: [
      { label: 'Best for', value: 'Every property; the count is what varies' },
      { label: 'Pets', value: 'Pet-tolerant motion sensors available' },
      { label: 'Power', value: 'Battery, with low-battery alerts to the panel' },
    ],
    image: 'product-sensors',
    imageAlt: 'A ceiling-mounted motion detector.',
  },
  {
    slug: 'smoke-co-detectors',
    name: 'Smoke & CO Detectors',
    pillar: 'protect',
    tagline: 'Monitored, not just noisy',
    summary:
      'Smoke and carbon monoxide detection wired into the monitored system, so an alarm reaches the monitoring centre even when nobody is home to hear it.',
    body: [
      'A standalone smoke alarm protects you while you are in the building. A monitored one protects the building while you are not.',
      'Because these sit on the same system as everything else, an alert reaches your phone and the monitoring centre at the same moment the sounder goes off.',
    ],
    features: [
      'Smoke and carbon monoxide detection',
      'Alerts the monitoring centre, not just the room',
      'Push notification to your phone',
      'Low-battery and fault reporting to the panel',
      'Placement to suit the building layout',
    ],
    details: [
      { label: 'Best for', value: 'Every property, and required in many rentals' },
      { label: 'Monitoring', value: 'Included in monitored plans' },
      {
        label: 'Note',
        value:
          'Supplements, and does not replace, any smoke alarm your local building or fire code requires.',
      },
    ],
    image: 'product-smoke-co',
    imageAlt: 'A flush ceiling-mounted detector.',
  },
];

export const getProduct = (slug: string): SecurityProduct | undefined =>
  products.find((product) => product.slug === slug);

/** Canonical path for a product page. The one place the URL shape is defined. */
export const productPath = (slug: string): string =>
  `/services/security-smart-home/products/${slug}`;

export const productsInPillar = (pillar: PillarId): SecurityProduct[] =>
  products.filter((product) => product.pillar === pillar);

/* ------------------------------------------------------------- trust strip */

export interface TrustPoint {
  label: string;
  /** Which inline icon renders beside it - see securityMarks in icons.tsx. */
  mark: 'shield' | 'clock' | 'wrench' | 'phone-app';
}

export const trustPoints: TrustPoint[] = [
  { label: 'Authorized Brinks Home Security Dealer', mark: 'shield' },
  { label: '24/7 Monitoring', mark: 'clock' },
  { label: 'Professional Installation', mark: 'wrench' },
  { label: 'Smartphone Control', mark: 'phone-app' },
];

/* ---------------------------------------------------------- home / business */

export interface AudiencePath {
  id: 'home' | 'business';
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  image: string;
  imageAlt: string;
}

export const audiencePaths: AudiencePath[] = [
  {
    id: 'home',
    eyebrow: 'Residential',
    title: 'Home Security',
    body: 'A system built around how your household actually lives: who comes and goes, which doors get used, what you want to see from your phone at 11pm.',
    points: [
      'Alarm, cameras and doorbell on one app',
      'Smart locks and codes instead of spare keys',
      '24/7 monitoring while you are away',
      'Smoke and CO on the same monitored system',
    ],
    image: 'security-home',
    imageAlt: 'A detached family house in daylight.',
  },
  {
    id: 'business',
    eyebrow: 'Commercial',
    title: 'Business Security',
    body: 'Coverage for premises with staff, stock and opening hours, where the question is not only "was there a break-in" but "who opened up on Tuesday".',
    points: [
      'Per-staff access codes with an entry log',
      'Camera coverage of tills, stock and back-of-house',
      'Open and close reporting',
      'Multi-site setups on one account',
    ],
    image: 'security-business',
    imageAlt: 'The interior of a modern office.',
  },
];

/* -------------------------------------------------------------- why choose */

export const whyChoose: { title: string; body: string }[] = [
  {
    title: 'An authorized Brinks dealer',
    body: 'Not a reseller of whatever is cheapest this quarter. Brinks Home Security solutions and professional monitoring, professionally specified and installed by TKG Ventures.',
  },
  {
    title: 'Specified for the building',
    body: 'Every quote follows a walk-round of the actual property. Nobody gets sold a four-camera bundle because that is what is in the box.',
  },
  {
    title: 'Installed properly',
    body: 'Cabling routed, cameras aimed, night image checked on site. The install is the part that decides whether the system works.',
  },
  {
    title: 'One number afterwards',
    body: `The same ${site.name} number handles a false alarm at 2am and an extra sensor eighteen months later.`,
  },
];

/* ----------------------------------------------------------------- process */

export const installProcess: { title: string; body: string }[] = [
  {
    title: 'Consultation',
    body: 'We look at the property, ask how you use it, and tell you honestly what you do and do not need.',
  },
  {
    title: 'System design',
    body: 'A specific plan: what goes where, what it costs, and what it will and will not cover.',
  },
  {
    title: 'Installation',
    body: 'Fitted, cabled, aimed and tested in one visit for most properties. We show you how to use it before we leave.',
  },
  {
    title: 'Monitoring',
    body: 'Optional 24/7 professional monitoring, plus alerts to your phone whether or not you take it.',
  },
];

/* -------------------------------------------------------------- reviews */

/*
 * Customer reviews are NOT defined in code. They are added by the owner from
 * /admin, each with permission recorded, and rendered by <Testimonials>. The
 * section hides itself until at least one real review exists. There is no
 * placeholder list here on purpose.
 */

/**
 * Real installation photography, added once the business has its own job
 * photos. Empty until then; the gallery hides itself while empty. Keys are
 * entries in public/media/manifest.json.
 */
export const installGallery: { image: string; alt: string }[] = [];

/* -------------------------------------------------------------------- FAQs */

export const faqs: { question: string; answer: string }[] = [
  {
    question: 'Do I have to take monitoring?',
    answer:
      'No. The system will still alert your phone without it. Monitoring is what adds a person at the other end when the alarm goes off and you are not looking at your phone, which is most of the time an alarm goes off.',
  },
  {
    question: 'Can I keep the equipment I already have?',
    answer:
      'Sometimes. Some existing sensors and cabling can be reused, some cannot. We will tell you which on the site visit rather than after the invoice.',
  },
  {
    question: 'How long does an installation take?',
    answer:
      'Most homes are a single visit. Larger properties and commercial sites depend on the cabling and the camera count, and we will give you the honest number before you book.',
  },
  {
    question: 'Does it work if the power or internet goes out?',
    answer:
      'The panel has backup power, and monitored systems have a communication path that does not depend on your home broadband. We will walk you through exactly what happens in an outage.',
  },
  {
    question: 'What happens with a false alarm?',
    answer:
      'You call the number and cancel it. If it keeps happening, that is a system problem, not a you problem. Tell us and we will come back and fix the sensor placement.',
  },
  {
    question: 'Are you actually a Brinks dealer?',
    answer: `Yes. ${site.legalName} is an authorized dealer of Brinks Home Security, delivering professional home security and smart automation solutions across select markets.`,
  },
  {
    question: 'Do you cover my area?',
    answer: `We work across the ${site.serviceArea.join(' and the ')}. If you are just outside, call and ask. The answer is often yes.`,
  },
];
