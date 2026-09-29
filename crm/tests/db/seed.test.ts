import { describe, expect, it } from 'vitest';
import { createStaff, serviceClient, signIn } from '../helpers/stack';

describe('reference data', () => {
  it('has one pipeline per website division plus General, with the site accents', async () => {
    const { data } = await serviceClient().from('pipelines').select('slug, name, accent, is_system, allowed_stage_keys').order('sort_order');
    expect(data?.map((p) => [p.slug, p.accent])).toEqual([
      ['security-smart-home', '#5A3FC0'],
      ['telecommunications', '#08718F'],
      ['automotive', '#BC4A17'],
      ['real-estate', '#1F5CA8'],
      ['moving-delivery', '#9A6206'],
      ['cleaning', '#07786A'],
      ['staffing', '#8A4BB0'],
      ['business-services', '#4A7A1C'],
      ['general', '#6F6960'],
    ]);
    expect(data?.at(-1)).toMatchObject({ is_system: true, allowed_stage_keys: ['new_lead', 'contacted', 'cancelled'] });
  });

  it('has the eight stages in order, with Cancelled requiring a reason', async () => {
    const { data } = await serviceClient().from('stages').select('key, name, is_sale, requires_reason').order('position');
    expect(data?.map((s) => s.name)).toEqual([
      'New Lead', 'Contacted', 'Appointment', 'Sold', 'Documents Pending', 'Installation', 'Completed', 'Cancelled',
    ]);
    expect(data?.filter((s) => s.is_sale).map((s) => s.key)).toEqual(['sold', 'documents_pending', 'installation', 'completed']);
    expect(data?.filter((s) => s.requires_reason).map((s) => s.key)).toEqual(['cancelled']);
  });

  it('shows reps the active pipelines and stages but not commission rules', async () => {
    const asRep = await signIn(await createStaff('sales_rep'));
    expect((await asRep.from('pipelines').select('id')).data).toHaveLength(9);
    expect((await asRep.from('stages').select('id')).data).toHaveLength(8);
    expect((await asRep.from('commission_rules').select('pipeline_id')).data).toEqual([]);
  });
});
