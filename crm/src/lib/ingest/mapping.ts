/**
 * Which website submissions become CRM leads, and where they land.
 *
 * Source strings come from the marketing site (see plans/crm/00-plan.md s0):
 *   division:<slug>      a division page form
 *   automotive:sourcing  automotive "find my vehicle"
 *   automotive:selling   automotive "sell my vehicle"
 *   page:quote           general quote form (division is a field)
 *   page:contact         general contact form (division optional)
 *   careers:*            job applications - NEVER a CRM record
 */

export const DIVISION_SLUGS = [
  'security-smart-home', 'telecommunications', 'automotive', 'real-estate',
  'moving-delivery', 'cleaning', 'staffing', 'business-services',
] as const;

const SOURCE_RE = /^(division:[a-z0-9-]{1,60}|automotive:(sourcing|selling)|page:(quote|contact))$/;

/** True only for the sales sources above; careers and anything unknown are refused. */
export const isSalesSource = (source: string): boolean => SOURCE_RE.test(source) && !source.startsWith('careers');

/** Target pipeline slug; the database falls back to `general` for an inactive/unknown one. */
export function pipelineSlugFor(source: string, values: Record<string, unknown>): string {
  if (source.startsWith('division:')) return source.slice('division:'.length);
  if (source.startsWith('automotive:')) return 'automotive';
  const division = typeof values.division === 'string' ? values.division : '';
  return (DIVISION_SLUGS as readonly string[]).includes(division) ? division : 'general';
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export interface ExtractedCustomer {
  full_name: string;
  phone_raw: string;
  email: string;
  address: string;
  city: string;
}

/** The person, from whichever field names that form uses. */
export function extractCustomer(values: Record<string, unknown>): ExtractedCustomer {
  const address = str(values.address) || str(values.siteAddress) || str(values.pickupAddress);
  return {
    full_name: str(values.name).slice(0, 200),
    phone_raw: str(values.phone).slice(0, 40),
    email: str(values.email).toLowerCase().slice(0, 254),
    address: address.slice(0, 300),
    // Quote "location" and real-estate "area" are a city or a whole address.
    city: (str(values.city) || str(values.location) || str(values.area)).slice(0, 100),
  };
}

/**
 * The site's labelled answers, exactly as its notification email shows them:
 * [fieldName, human-readable value] (option slugs already swapped for labels).
 */
type Display = [string, string][];

/** Which answers make a good one-line "service" for each source, by field name. */
const SERVICE_FIELDS: Record<string, string[]> = {
  'division:security-smart-home': ['systems', 'jobType'],
  'division:telecommunications': ['lookingFor', 'accountType'],
  'division:automotive': ['intent', 'vehicle'],
  'automotive:sourcing': ['make', 'model', 'yearRange'],
  'automotive:selling': ['make', 'model', 'year'],
  'division:real-estate': ['intent', 'propertyType'],
  'division:moving-delivery': ['jobType'],
  'division:cleaning': ['serviceType', 'frequency'],
  'division:staffing': ['roles', 'headcount'],
  'division:business-services': ['interest'],
  'page:quote': ['division'],
  'page:contact': ['division'],
};

const PREFIX: Record<string, string> = {
  'automotive:sourcing': 'Vehicle sourcing',
  'automotive:selling': 'Selling a vehicle',
  'page:quote': 'Quote request',
  'page:contact': 'Contact message',
};

export function serviceSummary(source: string, display: Display): string {
  const wanted = SERVICE_FIELDS[source] ?? [];
  const byField = new Map(display);
  const parts = wanted.map((field) => byField.get(field)).filter((value): value is string => Boolean(value));
  return [PREFIX[source], ...parts].filter(Boolean).join(' · ').slice(0, 300);
}
