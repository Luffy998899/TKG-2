import { z } from 'zod';

/**
 * The filters shared by Leads, Search and Export, parsed from the query
 * string. Everything is validated; anything unexpected is simply ignored.
 */
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const filterSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  pipeline: z.string().regex(/^[a-z0-9-]{1,60}$/).optional().catch(undefined),
  stage: z.string().regex(/^[a-z_]{1,40}$/).optional().catch(undefined),
  rep: z.union([z.uuid(), z.literal('unassigned')]).optional().catch(undefined),
  expires_from: dateSchema.optional().catch(undefined),
  expires_to: dateSchema.optional().catch(undefined),
  review: z.literal('1').optional().catch(undefined),
});

export type DealFilters = z.infer<typeof filterSchema>;

export function parseFilters(params: Record<string, string | string[] | undefined>): DealFilters {
  const flat = Object.fromEntries(Object.entries(params).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  return filterSchema.parse(flat);
}

/** Free text made safe for a PostgREST or() filter: letters, digits and a few separators only. */
export function sanitizeQuery(q: string): string {
  return q.replace(/[^\p{L}\p{N}@.\-' ]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export const toQueryString = (filters: Partial<Record<string, string | undefined>>): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `?${text}` : '';
};
