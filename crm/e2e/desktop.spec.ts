import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { seedRepWithLead, service } from './stack';

/** RFC 6238 TOTP, what an authenticator app computes. */
function totp(secret: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...secret.toUpperCase()].map((c) => alphabet.indexOf(c)).filter((v) => v >= 0).map((v) => v.toString(2).padStart(5, '0')).join('');
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const hmac = createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1]! & 15;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

test('desktop: an admin must enrol MFA, then works the kanban, assigns and exports', async ({ page }) => {
  const svc = service();
  const email = `e2e-admin-${randomUUID().slice(0, 6)}@crm-test.local`;
  const password = `Pw-${randomBytes(9).toString('base64url')}9a`;
  const created = await svc.auth.admin.createUser({ email, password, email_confirm: true });
  await svc.from('profiles').insert({ id: created.data.user!.id, email, full_name: 'E2E Admin', role: 'admin' });
  const lead = await seedRepWithLead();

  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // MFA is mandatory for admins: no way past this page without it.
  await expect(page).toHaveURL(/\/mfa\/enroll$/);
  await page.goto('/admin/users');
  await expect(page).toHaveURL(/\/mfa\/enroll$/);
  await page.getByRole('button', { name: 'Start setup' }).click();
  await page.getByText('Can’t scan? Enter this key instead').click();
  const secret = (await page.locator('details code').textContent())!.trim();
  await page.getByLabel('6-digit code').fill(totp(secret));
  await page.getByRole('button', { name: 'Turn on two-factor' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // The board: drag the lead from New Lead to Contacted by its handle.
  await page.goto(`/leads?q=${encodeURIComponent(lead.customerName)}`);
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
  await expect.poll(async () => (await svc.from('deals').select('stage_id').eq('id', lead.dealId).single()).data?.stage_id).toBe(2);

  // Assign from the profile: history, audit and the rep's notification follow.
  await page.goto(`/customers/${lead.customerId}?deal=${lead.dealId}`);
  await page.getByLabel('Assigned rep').selectOption(created.data.user!.id);
  await expect.poll(async () => (await svc.from('deals').select('assigned_to').eq('id', lead.dealId).single()).data?.assigned_to).toBe(created.data.user!.id);
  const audit = await svc.from('audit_log').select('action').eq('entity_id', lead.dealId).eq('action', 'deal.assigned');
  expect(audit.data?.length).toBe(1);

  // Export is admin-only, formula-safe, and audited.
  const csv = await page.request.get(`/api/export/deals?q=${encodeURIComponent(lead.customerName)}`);
  expect(csv.status()).toBe(200);
  expect(csv.headers()['content-type']).toContain('text/csv');
  expect(await csv.text()).toContain(lead.customerName);
  const exported = await svc.from('audit_log').select('action').eq('actor_id', created.data.user!.id).eq('action', 'export.csv');
  expect(exported.data?.length).toBeGreaterThan(0);

  // The same admin on a phone: every screen, admin ones included, fits 375px.
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/dashboard', '/leads', '/renewals', '/search?q=e2e', '/commissions', '/reports', '/admin/users', '/admin/pipelines', '/admin/import', '/admin/audit', `/customers/${lead.customerId}?deal=${lead.dealId}`]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} is wider than the phone`).toBeLessThanOrEqual(0);
  }
});
