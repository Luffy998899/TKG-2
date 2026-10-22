import { describe, expect, it } from 'vitest';
import { guessMapping, normalizeRow, parseDate, splitAddress, type ImportContext } from '@/lib/import/normalize';
import { toE164 } from '@/lib/phone';
import { leadFormSchema } from '@/lib/deals/schemas';

const ctx: ImportContext = {
  pipelines: [
    { id: 'p-sec', slug: 'security-smart-home', name: 'Security & Smart Home', allowed_stage_keys: null },
    { id: 'p-gen', slug: 'general', name: 'General / Unsorted', allowed_stage_keys: ['new_lead', 'contacted', 'cancelled'] },
  ],
  stages: [
    { id: 1, key: 'new_lead', name: 'New Lead' },
    { id: 7, key: 'completed', name: 'Completed' },
    { id: 8, key: 'cancelled', name: 'Cancelled' },
  ],
  reps: [{ id: 'rep-1', email: 'rep@tkg.ca' }],
  defaultPipelineId: 'p-sec',
  defaultStageKey: 'completed',
};

describe('import date parsing', () => {
  it('reads the chosen format and refuses impossible dates', () => {
    expect(parseDate('2025-03-31', 'YYYY-MM-DD')).toBe('2025-03-31');
    expect(parseDate('03/31/2025', 'MM/DD/YYYY')).toBe('2025-03-31');
    expect(parseDate('31/03/2025', 'DD/MM/YYYY')).toBe('2025-03-31');
    expect(parseDate('31/03/2025', 'MM/DD/YYYY')).toBe('invalid');
    expect(parseDate('2025-02-30', 'YYYY-MM-DD')).toBe('invalid');
    expect(parseDate('', 'YYYY-MM-DD')).toBeNull();
  });
});

describe('import mapping', () => {
  it('keeps current payments, offer price and contract status separate', () => {
    expect(guessMapping(['Name', 'Contract Status', 'Existing Monthly Bill', 'New Deal Price'])).toEqual({
      full_name: 'Name', contract_status: 'Contract Status', existing_monthly_bill: 'Existing Monthly Bill', monthly_price: 'New Deal Price',
    });
  });
  it('guesses columns from common header names', () => {
    expect(guessMapping(['Customer Name', 'Mobile', 'E-mail', 'Contract End', 'New Monthly Price'])).toMatchObject({
      full_name: 'Customer Name', phone: 'Mobile', email: 'E-mail', contract_end: 'Contract End', monthly_price: 'New Monthly Price',
    });
  });
  it('leaves ambiguous monthly columns for explicit mapping', () => {
    expect(guessMapping(['Name', 'Monthly', 'Per Month']).monthly_price).toBeUndefined();
  });
});

describe('import row validation', () => {
  const mapping = { full_name: 'Name', phone: 'Phone', email: 'Email', monthly_price: 'Monthly', contract_end: 'End', rep_email: 'Rep', stage: 'Stage', pipeline: 'Pipeline' };

  it('accepts missing contacts without making the bill into revenue', () => {
    const { normalized, errors } = normalizeRow({ Name: 'Contactless', Bill: '$159.99', Status: 'Out of Contract' }, { full_name: 'Name', existing_monthly_bill: 'Bill', contract_status: 'Status' }, 'YYYY-MM-DD', ctx);
    expect(errors).toEqual([]);
    expect(normalized).toMatchObject({ phone_e164: null, email: '', existing_monthly_bill_cents: 15999, monthly_price_cents: null, contract_status: 'out_of_contract' });
    expect(leadFormSchema.safeParse({ fullName: 'Contactless', pipelineId: 'eab8291d-6807-4b7f-91fb-f01dc5076ca0' }).success).toBe(true);
  });

  it('extracts Canadian cities while preserving uncertain addresses and explicit city values', () => {
    expect(splitAddress('123 Main St, Surrey, BC V3T 1A1', '')).toEqual({ address: '123 Main St, Surrey, BC V3T 1A1', city: 'Surrey' });
    expect(splitAddress('123 Main St, New Westminster BC V3M 1A1', '')).toEqual({ address: '123 Main St, New Westminster BC V3M 1A1', city: 'New Westminster' });
    expect(splitAddress('Unit 2, 123 Main St,Surrey,BC V3T 1A1', '')).toEqual({ address: 'Unit 2, 123 Main St,Surrey,BC V3T 1A1', city: 'Surrey' });
    expect(splitAddress('123 Main St', '')).toEqual({ address: '123 Main St', city: '' });
    expect(splitAddress('123 Main St, Surrey, BC', 'Burnaby')).toEqual({ address: '123 Main St, Surrey, BC', city: 'Burnaby' });
  });

  it('cleans Excel phone formats to the same duplicate key', () => {
    for (const raw of ["'6045550188", '6045550188.0', '6.045550188E+9', '(604) 555-0188', '+1 604-555-0188']) expect(toE164(raw)).toBe('+16045550188');
    expect(toE164('12')).toBeNull();
  });

  it('normalises a good row', () => {
    const { normalized, errors } = normalizeRow(
      { Name: ' Asha Patel ', Phone: '(604) 555-0188', Email: 'ASHA@EXAMPLE.COM', Monthly: '$49.99', End: '2027-01-31', Rep: 'rep@tkg.ca', Stage: '', Pipeline: '' },
      mapping, 'YYYY-MM-DD', ctx,
    );
    expect(errors).toEqual([]);
    expect(normalized).toMatchObject({
      full_name: 'Asha Patel', phone_e164: '+16045550188', email: 'asha@example.com', monthly_price_cents: 4999,
      contract_end: '2027-01-31', assigned_to: 'rep-1', stage_id: 7, pipeline_id: 'p-sec',
    });
  });

  it('reports every problem on a bad row', () => {
    const { errors } = normalizeRow(
      { Name: '', Phone: '12', Email: 'not-an-email', Monthly: 'lots', End: '31/31/2025', Rep: 'ghost@x.ca', Stage: 'cancelled', Pipeline: 'Plumbing' },
      mapping, 'YYYY-MM-DD', ctx,
    );
    expect(errors).toEqual(expect.arrayContaining([
      'Name is missing.',
      expect.stringContaining('is not a valid number'),
      expect.stringContaining('is not valid'),
      'Unknown pipeline "plumbing".',
      'Cancelled deals are not imported.',
      expect.stringContaining('No active staff user'),
      expect.stringContaining('Monthly price'),
      expect.stringContaining('Contract end'),
    ]));
  });

  it('respects a pipeline’s allowed stages (General cannot hold Completed)', () => {
    const { errors } = normalizeRow({ Name: 'X', Phone: '6045550100', Pipeline: 'general', Stage: 'completed' }, mapping, 'YYYY-MM-DD', ctx);
    expect(errors).toContain('General / Unsorted cannot hold Completed deals.');
  });
});
