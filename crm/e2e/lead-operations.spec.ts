import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createUser, sql } from './stack';

test('admin bulk assignment, equal distribution and conversion work on a phone', async ({ page }) => {
  const prefix = `Operations ${randomUUID().slice(0, 8)}`;
  const repNameA = `${prefix} Rep A`;
  const repNameB = `${prefix} Rep B`;
  const [admin, repA, repB] = await Promise.all([createUser('admin', 'Operations Admin'), createUser('sales_rep', repNameA), createUser('sales_rep', repNameB)]);
  const { rows } = await sql<{ id: string; customer_id: string }>(`
    with customers as (
      insert into public.customers(full_name, address, city, notes)
      select $1 || ' ' || i, '123 Main St', 'Surrey', 'Preserve details' from generate_series(1,4) i returning id
    )
    insert into public.deals(customer_id, pipeline_id, stage_id, source, service)
    select c.id, p.id, 1, 'import', 'TELUS' from customers c cross join public.pipelines p
    where p.slug = 'telecommunications' returning id, customer_id`, [prefix]);

  await page.goto('login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  await page.getByLabel('Work email').fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill(admin.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`leads?pipeline=telecommunications&rep=unassigned&q=${encodeURIComponent(prefix)}`);
  await page.getByText('Bulk assignment · 4 unassigned in these results', { exact: true }).click();
  await page.getByLabel('Number of unassigned leads').fill('2');
  await page.getByRole('button', { name: 'Select first 2 unassigned', exact: true }).click();
  await page.getByLabel('Assign to sales rep', { exact: true }).selectOption(repA.id);
  await expect(page.getByText('2 of these unassigned leads will remain unassigned.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Assign 2 leads', exact: true }).click();
  await expect(page.getByText('2 leads assigned successfully.', { exact: true })).toBeVisible();
  const after = await sql<{ assigned_to: string | null; stage_id: number }>('select assigned_to, stage_id from public.deals where id = any($1::uuid[])', [rows.map((r) => r.id)]);
  expect(after.rows.filter((d) => d.assigned_to === repA.id)).toHaveLength(2);
  expect(after.rows.filter((d) => d.assigned_to === null)).toHaveLength(2);
  expect(after.rows.every((d) => d.stage_id === 1)).toBe(true);

  await expect(page.getByText('Bulk assignment · 2 unassigned in these results', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select all results (2)', exact: true }).click();
  await page.getByLabel('Distribute selected leads equally between reps').check();
  await page.getByLabel(repNameA, { exact: true }).check();
  await page.getByLabel(repNameB, { exact: true }).check();
  await page.getByRole('button', { name: 'Distribute 2 leads equally', exact: true }).click();
  await expect.poll(async () => (await sql<{ assigned_to: string }>('select assigned_to from public.deals where id = any($1::uuid[])', [rows.map((r) => r.id)])).rows.filter((d) => d.assigned_to === repB.id).length).toBe(1);

  await page.goto(`customers/${rows[0]!.customer_id}?deal=${rows[0]!.id}`);
  await expect(page.getByText('Missing Contact', { exact: true })).toBeVisible();
  await page.getByLabel('Existing monthly bill (CAD)', { exact: true }).fill('155');
  await page.getByLabel('New deal price / month (CAD)', { exact: true }).fill('75');
  await page.getByLabel('Existing contract status', { exact: true }).selectOption('out_of_contract');
  await page.getByRole('button', { name: 'Save deal details' }).click();
  await expect.poll(async () => (await sql<{ monthly_price_cents: string }>('select monthly_price_cents from public.deals where id=$1', [rows[0]!.id])).rows[0]?.monthly_price_cents).toBe('7500');
  await page.getByLabel('Call status', { exact: true }).selectOption('interested');
  await page.getByLabel('What happened? (optional)').fill('Wants the new offer');
  await page.getByRole('button', { name: 'Add to timeline' }).click();
  await expect(page.getByText('Interested · Wants the new offer', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Call back in 3 days' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Call back', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^Stage: New Lead/ }).click();
  await page.getByRole('button', { name: 'Sold', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New contract dates' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('New contract start', { exact: true }).fill('2026-10-22');
  await dialog.getByLabel('New contract expiry', { exact: true }).fill('2027-10-21');
  await dialog.getByRole('button', { name: 'Save and move to Sold', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /^Stage: Sold/ })).toBeVisible();
  expect((await sql('select start_date::text, end_date::text from public.contracts where deal_id=$1', [rows[0]!.id])).rows).toEqual([{ start_date: '2026-10-22', end_date: '2027-10-21' }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test('CSV import cleans phones, extracts cities, flags duplicates and saves contactless leads', async ({ page }) => {
  const admin = await createUser('admin', 'Import Operations Admin');
  const prefix = `CSV ${randomUUID().slice(0, 8)}`;
  const phone = `778${Math.floor(2000000 + Math.random() * 7999999)}`;
  const csv = [
    'Name,Phone,Address,Current Monthly Bill,New Deal Price,Contract Status',
    `${prefix} A,${phone},"123 Main St, Surrey, BC V3T 1A1",160,80,Out of Contract`,
    `${prefix} Duplicate,(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)},,160,,Unknown`,
    `${prefix} Missing,,"42 Test St, Burnaby BC",110,,Active Contract`,
  ].join('\n');
  await page.goto('login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  await page.getByLabel('Work email').fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill(admin.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto('admin/import');
  await page.locator('input[type=file]').setInputFiles({ name: 'telus.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByLabel('Existing monthly bill (excluded from revenue)', { exact: true })).toHaveValue('Current Monthly Bill');
  await expect(page.getByLabel('Existing contract status', { exact: true })).toHaveValue('Contract Status');
  await page.getByLabel('Pipeline when not in the file').selectOption({ label: 'Telecommunications' });
  await expect(page.getByLabel('Stage when not in the file')).toHaveValue('new_lead');
  await page.getByRole('button', { name: /Check the file/ }).click();
  await expect(page.getByText('Duplicate of row 1 in this file.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Import 2 rows', exact: true }).click();
  await expect(page.getByText(/Imported 2 deals: 2 new customers/)).toBeVisible();
  const result = await sql<{ full_name: string; city: string; phone_e164: string | null; existing_monthly_bill_cents: string; monthly_price_cents: string | null; contract_status: string }>(`
    select c.full_name, c.city, c.phone_e164, d.existing_monthly_bill_cents, d.monthly_price_cents, d.contract_status
    from public.customers c join public.deals d on d.customer_id=c.id where c.full_name like $1 order by c.full_name`, [`${prefix}%`]);
  expect(result.rows).toEqual([
    { full_name: `${prefix} A`, city: 'Surrey', phone_e164: `+1${phone}`, existing_monthly_bill_cents: '16000', monthly_price_cents: '8000', contract_status: 'out_of_contract' },
    { full_name: `${prefix} Missing`, city: 'Burnaby', phone_e164: null, existing_monthly_bill_cents: '11000', monthly_price_cents: null, contract_status: 'active_contract' },
  ]);
});
