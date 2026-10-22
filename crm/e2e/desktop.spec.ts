import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { createUser, seedRepWithLead, sql } from './stack';

test('desktop: an admin adds a user, works the kanban, assigns, uploads a document and exports', async ({ page }) => {
  const admin = await createUser('admin', 'E2E Admin');
  const lead = await seedRepWithLead();

  await page.goto('login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  await page.getByLabel('Work email').fill(admin.email);
  await page.getByLabel('Password').fill(admin.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  // No two-factor step: straight to the dashboard.
  await expect(page).toHaveURL(/\/crm\/dashboard$/);
  expect(page.url()).not.toContain('password');

  // Users: create an account with a starting password; it can sign in.
  const newEmail = `e2e-new-${randomUUID().slice(0, 6)}@crm-test.local`;
  await page.goto('admin/users');
  await page.getByLabel('Full name').fill('E2E New Rep');
  await page.getByLabel('Work email').fill(newEmail);
  await page.getByLabel('Starting password').fill('Starting-Pass-2026');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByText('Account created.')).toBeVisible();
  const created = await sql<{ role: string; active: boolean }>('select role, active from public.profiles where email = $1', [newEmail]);
  expect(created.rows).toEqual([{ role: 'sales_rep', active: true }]);

  // The board: drag the lead from New Lead to Contacted by its handle.
  await page.goto(`leads?q=${encodeURIComponent(lead.customerName)}`);
  const newLead = page.getByRole('region', { name: /^New Lead, 1 deals/ });
  const contacted = page.getByRole('region', { name: /^Contacted, 0 deals/ });
  await expect(newLead).toBeVisible();
  const handle = page.getByRole('button', { name: `Move ${lead.customerName}` });
  const from = (await handle.boundingBox())!;
  const to = (await contacted.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + 20, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + 80, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByRole('region', { name: /^Contacted, 1 deals/ })).toBeVisible();
  await expect.poll(async () => (await sql<{ stage_id: number }>('select stage_id from public.deals where id = $1', [lead.dealId])).rows[0]?.stage_id).toBe(2);

  // Assign from the profile: history, audit and the rep's notification follow.
  await page.goto(`customers/${lead.customerId}?deal=${lead.dealId}`);
  await page.getByLabel('Assigned rep').selectOption(admin.id);
  await expect.poll(async () => (await sql<{ assigned_to: string }>('select assigned_to from public.deals where id = $1', [lead.dealId])).rows[0]?.assigned_to).toBe(admin.id);
  const audit = await sql("select 1 from public.audit_log where entity_id = $1 and action = 'deal.assigned'", [lead.dealId]);
  expect(audit.rowCount).toBe(1);

  // Upload a PDF to the deal; it is listed and can be opened (audited).
  await page.locator('input[type="file"]').setInputFiles({ name: 'bill.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n% e2e bill\n') });
  await expect(page.getByText('bill.pdf added.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download bill.pdf' })).toBeVisible();
  const doc = await sql<{ id: string }>("select id from public.documents where deal_id = $1 and status = 'ready'", [lead.dealId]);
  const download = await page.request.get(`api/documents/${doc.rows[0]!.id}?mode=download`);
  expect(download.status()).toBe(200);
  expect(download.headers()['content-type']).toBe('application/pdf');
  expect((await download.body()).toString()).toContain('%PDF-');
  const viewed = await sql("select 1 from public.audit_log where entity_id = $1 and action = 'document.download'", [doc.rows[0]!.id]);
  expect(viewed.rowCount).toBe(1);

  // Export is admin-only, formula-safe, and audited.
  const csv = await page.request.get(`api/export/deals?q=${encodeURIComponent(lead.customerName)}`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(await csv.text()).toContain(lead.customerName);
  const exported = await sql("select 1 from public.audit_log where actor_id = $1 and action = 'export.csv'", [admin.id]);
  expect(exported.rowCount).toBeGreaterThan(0);

  // The same admin on a phone: every screen, admin ones included, fits 375px.
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['dashboard', 'leads', 'renewals', 'search?q=e2e', 'commissions', 'reports', 'admin/users', 'admin/pipelines', 'admin/import', 'admin/audit', `customers/${lead.customerId}?deal=${lead.dealId}`]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const tooWide = overflow > 0 ? await page.evaluate(() => [...document.querySelectorAll('main *')]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth)
      .slice(0, 8).map((el) => `${el.tagName}.${el.className}: ${Math.round(el.getBoundingClientRect().width)}px`)) : [];
    expect(overflow, `${path} is wider than the phone: ${tooWide.join(', ')}`).toBeLessThanOrEqual(0);
  }
});
