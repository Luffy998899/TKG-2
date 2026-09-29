import { toE164 } from '@/lib/phone';
import { parseMoney } from '@/lib/format';

/* CSV import: turning one spreadsheet row into a validated CRM row. Pure, so
   the dry run and the tests share exactly the same rules. */

export const IMPORT_FIELDS = [
  { key: 'full_name', label: 'Full name', required: true, hints: ['name', 'full name', 'customer', 'client'] },
  { key: 'phone', label: 'Phone', required: false, hints: ['phone', 'mobile', 'cell', 'telephone'] },
  { key: 'email', label: 'Email', required: false, hints: ['email', 'e-mail'] },
  { key: 'address', label: 'Address', required: false, hints: ['address', 'street'] },
  { key: 'city', label: 'City', required: false, hints: ['city', 'town'] },
  { key: 'pipeline', label: 'Pipeline / division', required: false, hints: ['pipeline', 'division', 'department'] },
  { key: 'service', label: 'Service', required: false, hints: ['service', 'product', 'plan', 'package'] },
  { key: 'stage', label: 'Stage', required: false, hints: ['stage', 'status'] },
  { key: 'rep_email', label: 'Rep email', required: false, hints: ['rep', 'rep email', 'salesperson', 'agent'] },
  { key: 'one_time_price', label: 'One-time price', required: false, hints: ['one-time', 'one time', 'setup', 'install price'] },
  { key: 'monthly_price', label: 'Monthly price', required: false, hints: ['monthly', 'mrr', 'per month'] },
  { key: 'term_months', label: 'Term (months)', required: false, hints: ['term', 'months'] },
  { key: 'installation_date', label: 'Installation date', required: false, hints: ['installation', 'install date', 'installed'] },
  { key: 'contract_start', label: 'Contract start', required: false, hints: ['start', 'contract start', 'signed'] },
  { key: 'contract_end', label: 'Contract end', required: false, hints: ['end', 'contract end', 'expiry', 'expires', 'renewal'] },
  { key: 'notes', label: 'Notes', required: false, hints: ['notes', 'comments', 'remarks'] },
] as const;

export type FieldKey = (typeof IMPORT_FIELDS)[number]['key'];
export type Mapping = Partial<Record<FieldKey, string>>;
export type DateFormat = 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY';
export const MAX_IMPORT_ROWS = 5000;

/** Best-guess mapping from the file's headers. */
export function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const used = new Set<string>();
  const clean = (text: string) => text.toLowerCase().replace(/[_\-]+/g, ' ').trim();
  for (const field of IMPORT_FIELDS) {
    const hit = headers.find((header) => !used.has(header) && field.hints.some((hint) => clean(header) === clean(hint)))
      ?? headers.find((header) => !used.has(header) && field.hints.some((hint) => clean(header).includes(clean(hint))));
    if (hit) {
      mapping[field.key] = hit;
      used.add(hit);
    }
  }
  return mapping;
}

/** A calendar date in the chosen format -> yyyy-mm-dd; null when blank; 'invalid' otherwise. */
export function parseDate(value: string | undefined, format: DateFormat): string | null | 'invalid' {
  const text = (value ?? '').trim();
  if (!text) return null;
  let y: number, m: number, d: number;
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const slash = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (format === 'YYYY-MM-DD' && iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (format === 'MM/DD/YYYY' && slash) [m, d, y] = [Number(slash[1]), Number(slash[2]), Number(slash[3])];
  else if (format === 'DD/MM/YYYY' && slash) [d, m, y] = [Number(slash[1]), Number(slash[2]), Number(slash[3])];
  else return 'invalid';
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || y < 1990 || y > 2100) return 'invalid';
  return date.toISOString().slice(0, 10);
}

export interface ImportContext {
  pipelines: { id: string; slug: string; name: string; allowed_stage_keys: string[] | null }[];
  stages: { id: number; key: string; name: string }[];
  reps: { id: string; email: string }[];
  defaultPipelineId: string;
  defaultStageKey: string;
}

export interface NormalizedRow {
  full_name: string;
  phone_raw: string;
  phone_e164: string | null;
  email: string;
  address: string;
  city: string;
  notes: string;
  pipeline_id: string;
  stage_id: number;
  assigned_to: string | null;
  service: string;
  one_time_price_cents: number | null;
  monthly_price_cents: number | null;
  term_months: number | null;
  installation_date: string | null;
  contract_start: string | null;
  contract_end: string | null;
}

export function normalizeRow(raw: Record<string, string>, mapping: Mapping, format: DateFormat, ctx: ImportContext) {
  const errors: string[] = [];
  const get = (key: FieldKey) => (mapping[key] ? String(raw[mapping[key]!] ?? '').trim() : '');

  const fullName = get('full_name');
  if (!fullName) errors.push('Name is missing.');
  if (fullName.length > 200) errors.push('Name is longer than 200 characters.');

  const phoneRaw = get('phone');
  const phone = toE164(phoneRaw);
  if (phoneRaw && !phone) errors.push(`Phone "${phoneRaw.slice(0, 30)}" is not a valid number.`);
  const email = get('email').toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(`Email "${email.slice(0, 60)}" is not valid.`);
  if (!phone && !email) errors.push('Needs a phone number or an email.');

  const pipelineText = get('pipeline').toLowerCase();
  const pipeline = pipelineText
    ? ctx.pipelines.find((p) => p.slug === pipelineText || p.name.toLowerCase() === pipelineText)
    : ctx.pipelines.find((p) => p.id === ctx.defaultPipelineId);
  if (!pipeline) errors.push(pipelineText ? `Unknown pipeline "${pipelineText.slice(0, 40)}".` : 'Choose a default pipeline.');

  const stageText = get('stage').toLowerCase();
  const stage = stageText
    ? ctx.stages.find((s) => s.key === stageText || s.name.toLowerCase() === stageText)
    : ctx.stages.find((s) => s.key === ctx.defaultStageKey);
  if (!stage) errors.push(`Unknown stage "${stageText.slice(0, 40)}".`);
  if (stage?.key === 'cancelled') errors.push('Cancelled deals are not imported.');
  if (stage && pipeline?.allowed_stage_keys && !pipeline.allowed_stage_keys.includes(stage.key)) {
    errors.push(`${pipeline.name} cannot hold ${stage.name} deals.`);
  }

  const repEmail = get('rep_email').toLowerCase();
  const rep = repEmail ? ctx.reps.find((r) => r.email.toLowerCase() === repEmail) : undefined;
  if (repEmail && !rep) errors.push(`No active staff user "${repEmail.slice(0, 60)}".`);

  const money = (key: FieldKey, label: string) => {
    const value = parseMoney(get(key));
    if (Number.isNaN(value)) {
      errors.push(`${label} "${get(key).slice(0, 20)}" is not a number.`);
      return null;
    }
    return value;
  };
  const oneTime = money('one_time_price', 'One-time price');
  const monthly = money('monthly_price', 'Monthly price');
  const termText = get('term_months');
  const term = termText ? Number(termText) : null;
  if (termText && (!Number.isInteger(term) || term! < 1 || term! > 240)) errors.push(`Term "${termText}" is not a number of months.`);

  const date = (key: FieldKey, label: string) => {
    const value = parseDate(get(key), format);
    if (value === 'invalid') {
      errors.push(`${label} "${get(key).slice(0, 20)}" is not a ${format} date.`);
      return null;
    }
    return value;
  };
  const install = date('installation_date', 'Installation date');
  const start = date('contract_start', 'Contract start');
  const end = date('contract_end', 'Contract end');
  if (start && end && end < start) errors.push('Contract end is before its start.');

  const normalized: NormalizedRow = {
    full_name: fullName.slice(0, 200),
    phone_raw: phoneRaw.slice(0, 40),
    phone_e164: phone,
    email,
    address: get('address').slice(0, 300),
    city: get('city').slice(0, 100),
    notes: get('notes').slice(0, 5000),
    pipeline_id: pipeline?.id ?? '',
    stage_id: stage?.id ?? 0,
    assigned_to: rep?.id ?? null,
    service: get('service').slice(0, 300),
    one_time_price_cents: oneTime,
    monthly_price_cents: monthly,
    term_months: term !== null && Number.isInteger(term) ? term : null,
    installation_date: install,
    contract_start: start,
    contract_end: end,
  };
  return { normalized, errors };
}
