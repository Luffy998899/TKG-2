import { NextResponse } from 'next/server';

/**
 * Address lookup, proxied.
 *
 * Every address field on the site (`type: 'address'` in a form config) types
 * into <AddressAutocomplete>, which asks this route for suggestions. The route
 * exists rather than calling a provider from the browser so that:
 *
 *   - the API key never reaches the client,
 *   - the provider can be swapped without touching a component, and
 *   - both providers below return the SAME shape, so the UI has one code path.
 *
 * TWO PROVIDERS
 * -------------
 *   Google Places (New)  used when GOOGLE_MAPS_API_KEY is set. This is the one
 *                        to run in production - best Canadian coverage, unit
 *                        numbers, and it understands partial input.
 *   Photon (OpenStreetMap)  the keyless fallback, so the field still works on a
 *                        preview deploy with no key configured. Free, no
 *                        registration, but thinner on new-build and unit-level
 *                        addresses.
 *
 * To turn Google on: create a key at console.cloud.google.com with the
 * "Places API (New)" enabled, restrict it to your server IPs (it is used
 * server-side, so an HTTP-referrer restriction will NOT work), and set
 * GOOGLE_MAPS_API_KEY in the host's environment.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** What the component consumes. Identical from either provider. */
export interface AddressSuggestion {
  id: string;
  /** The full single-line address, and what lands in the form value. */
  label: string;
  /** Street line, bolded in the list. */
  main: string;
  /** City / province / country, shown underneath. */
  secondary: string;
}

/** Canada only - every division serves BC. */
const REGION = 'ca';

/** Biases results towards the Lower Mainland without excluding anywhere else. */
const BIAS = { lat: 49.19, lon: -122.85 };

const MIN_QUERY = 3;
const LIMIT = 6;

/* ------------------------------------------------------------------ google */

interface GooglePrediction {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

async function google(query: string, key: string, session?: string): Promise<AddressSuggestion[]> {
  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
    },
    body: JSON.stringify({
      input: query,
      includedRegionCodes: [REGION],
      // Street addresses, not restaurants. `geocode` keeps localities in the
      // list so "Surrey" still resolves while the user is mid-typing.
      includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'route', 'geocode'],
      languageCode: 'en-CA',
      regionCode: 'CA',
      locationBias: {
        circle: {
          center: { latitude: BIAS.lat, longitude: BIAS.lon },
          radius: 120_000,
        },
      },
      ...(session ? { sessionToken: session } : {}),
    }),
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Places responded ${response.status}`);

  const data = (await response.json()) as { suggestions?: GooglePrediction[] };

  return (data.suggestions ?? [])
    .map((suggestion, index): AddressSuggestion | null => {
      const prediction = suggestion.placePrediction;
      const label = prediction?.text?.text;
      if (!label) return null;
      const main = prediction.structuredFormat?.mainText?.text ?? label;
      const secondary =
        prediction.structuredFormat?.secondaryText?.text ??
        label.slice(main.length).replace(/^,\s*/, '');
      return { id: prediction.placeId ?? `g-${index}`, label, main, secondary };
    })
    .filter((s): s is AddressSuggestion => s !== null)
    .slice(0, LIMIT);
}

/* ------------------------------------------------------------------ photon */

interface PhotonFeature {
  properties?: {
    osm_id?: number | string;
    countrycode?: string;
    housenumber?: string;
    street?: string;
    name?: string;
    city?: string;
    district?: string;
    state?: string;
    postcode?: string;
  };
}

/**
 * Bounding boxes, which are Photon's only geographic FILTER - `lat`/`lon` is
 * merely a soft bias and is not nearly strong enough on its own. Typing
 * "123 Main St" with only a bias returns Winnipeg, then New Zealand, then
 * India, before anything in British Columbia.
 *
 * So the search runs twice, in parallel: once restricted to the service area,
 * once to Canada. Local results are listed first and the national ones fill
 * the rest, which is the order a customer here expects - and the customer who
 * is moving from Calgary still finds their old address.
 *
 * minLon, minLat, maxLon, maxLat.
 */
const LOCAL_BBOX = '-124.2,48.7,-120.3,50.4'; // Lower Mainland + Fraser Valley
const CANADA_BBOX = '-141.1,41.6,-52.6,73.0';

async function photonSearch(query: string, bbox: string): Promise<PhotonFeature[]> {
  const url = new URL('https://photon.komoot.io/api');
  url.searchParams.set('q', query);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('limit', '15');
  url.searchParams.set('bbox', bbox);
  // Still worth sending: it orders results within the box.
  url.searchParams.set('lat', String(BIAS.lat));
  url.searchParams.set('lon', String(BIAS.lon));

  const response = await fetch(url, {
    headers: { 'User-Agent': 'TKG Ventures website (address autocomplete)' },
    cache: 'no-store',
  });

  if (!response.ok) throw new Error(`Photon responded ${response.status}`);

  const data = (await response.json()) as { features?: PhotonFeature[] };
  return data.features ?? [];
}

function describe(feature: PhotonFeature, index: number): AddressSuggestion | null {
  const p = feature.properties ?? {};
  const street = [p.housenumber, p.street ?? p.name].filter(Boolean).join(' ').trim();
  const main = street || p.name || '';
  if (!main) return null;
  const secondary = [p.city ?? p.district, p.state, p.postcode].filter(Boolean).join(', ');
  return {
    id: String(p.osm_id ?? `p-${index}`),
    label: [main, secondary].filter(Boolean).join(', '),
    main,
    secondary,
  };
}

async function photon(query: string): Promise<AddressSuggestion[]> {
  const [local, national] = await Promise.all([
    photonSearch(query, LOCAL_BBOX),
    // A national search must never fail the local one - the local results are
    // the ones that matter most.
    photonSearch(query, CANADA_BBOX).catch(() => [] as PhotonFeature[]),
  ]);

  /*
   * Photon's own ordering is by prominence, which is wrong for an address
   * field: searching "Granville St Vancouver" offers a railway stop on a
   * different street before Granville Street itself. Two corrections, applied
   * as a stable sort so Photon's order survives as the tiebreak:
   *
   *   1. more of the words the customer typed actually appearing in the
   *      result wins;
   *   2. a query that starts with a number wants a building at that number,
   *      not the street it is on or the café inside it.
   */
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 1);
  const numeric = /^\s*\d/.test(query);

  const score = (feature: PhotonFeature): number => {
    const p = feature.properties ?? {};
    const haystack = [p.housenumber, p.street, p.name, p.city, p.district, p.postcode]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matched = words.filter((word) => haystack.includes(word)).length;
    // Negative: lower sorts first.
    return -(matched * 2 + (numeric && p.housenumber ? 1 : 0));
  };

  const ordered = [
    ...[...local].sort((a, b) => score(a) - score(b)),
    ...[...national].sort((a, b) => score(a) - score(b)),
  ];

  return ordered
    // The boxes are rectangles, so the Canadian one clips a strip of the
    // northern US. Photon has no country parameter; this is the filter.
    .filter((feature) => feature.properties?.countrycode === 'CA')
    .map(describe)
    .filter((s): s is AddressSuggestion => s !== null)
    // OpenStreetMap frequently holds the same address as more than one object
    // (a building, its entrance, the business inside it), which would read as
    // the same row three times. The local copy wins, because it is first.
    .filter((s, index, all) => all.findIndex((other) => other.label === s.label) === index)
    .slice(0, LIMIT);
}

/* ------------------------------------------------------------------- route */

/**
 * A small in-process cache.
 *
 * Photon's public instance is free and asks callers to be fair. Typing an
 * address produces the same prefixes over and over - backspacing, a second
 * person on the same street, the same customer returning - and every one of
 * those is two upstream requests. This serves the repeats itself.
 *
 * Per-instance and lost on restart, which is all it needs to be.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 300;
const cache = new Map<string, { at: number; suggestions: AddressSuggestion[] }>();

function cached(key: string): AddressSuggestion[] | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.suggestions;
}

function remember(key: string, suggestions: AddressSuggestion[]) {
  // Map preserves insertion order, so the oldest key is the first one.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), suggestions });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim();
  const session = searchParams.get('session') ?? undefined;

  if (query.length < MIN_QUERY) {
    return NextResponse.json({ suggestions: [] as AddressSuggestion[] });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  const provider = key ? 'google' : 'photon';
  const cacheKey = `${provider}:${query.toLowerCase()}`;

  const hit = cached(cacheKey);
  if (hit) {
    return NextResponse.json(
      { suggestions: hit, provider, cached: true },
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  }

  try {
    const suggestions = key ? await google(query, key, session) : await photon(query);
    // Only a real answer is worth keeping; an empty one may just be a
    // half-typed word that will match once the next letter arrives.
    if (suggestions.length > 0) remember(cacheKey, suggestions);
    return NextResponse.json(
      { suggestions, provider },
      // Suggestions for a given prefix are stable enough to cache briefly, and
      // a fast second keystroke on the same prefix is common on a phone.
      { headers: { 'Cache-Control': 'private, max-age=60' } },
    );
  } catch (error) {
    console.error('[address] lookup failed', error);
    // A dead lookup service must never block the form: the component falls
    // back to a plain text field when this returns nothing.
    return NextResponse.json({ suggestions: [] as AddressSuggestion[], error: true });
  }
}
