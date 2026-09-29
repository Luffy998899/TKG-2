import { expect, test, type Page } from '@playwright/test';
import { seedRepWithLead, service } from './stack';

/**
 * ACCEPTANCE (Phase 7): at 375x812 a sales rep can
 *   log in -> open a lead -> log a call note -> move it to Contacted
 *   -> see it in the timeline.
 * Plus: every visible control on the way is a 48px touch target, and the
 * rep is refused admin-only export.
 */

async function expectTouchTargets(page: Page) {
  const small = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('main a, main button, main input, main select, main textarea, main summary, header a, nav a')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        // Skip hidden and visually-hidden (sr-only) controls, and inline text links inside sentences.
        if (r.width < 2 || r.height < 2 || style.visibility === 'hidden' || style.display === 'none') return false;
        if (el.tagName === 'A' && style.display === 'inline' && el.closest('p')) return false;
        if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) return false; // wrapped in a 48px label
        return r.height < 47.5;
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40)}" ${Math.round(el.getBoundingClientRect().height)}px`),
  );
  expect(small, `touch targets under 48px:\n${small.join('\n')}`).toEqual([]);
}

test('a rep logs a call and moves a lead to Contacted on a phone', async ({ page }) => {
  const seed = await seedRepWithLead();

  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  await page.getByLabel('Work email').fill(seed.email);
  await page.getByLabel('Password').fill(seed.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // Signing in must never put credentials in the URL.
  expect(page.url()).not.toContain('password');

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Leads' }).click();
  await expect(page).toHaveURL(/\/leads/);
  await expectTouchTargets(page);

  await page.getByRole('link', { name: new RegExp(seed.customerName) }).click();
  await expect(page.getByRole('heading', { level: 1, name: seed.customerName })).toBeVisible();
  await expect(page.getByText('Last contacted: Never')).toBeVisible();
  await expectTouchTargets(page);

  // Log a call note.
  await page.getByLabel('What happened? (optional)').fill('Called, they want a quote by Friday');
  await page.getByRole('button', { name: 'Add to timeline' }).click();
  const timeline = page.getByRole('heading', { name: 'Timeline' }).locator('..');
  await expect(timeline.getByText('Called, they want a quote by Friday')).toBeVisible();
  await expect(page.getByText(/Last contacted: \d+ seconds? ago|Last contacted: less than/)).toBeVisible();

  // Move it to Contacted.
  await page.getByRole('button', { name: /^Stage: New Lead/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Move to stage' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Contacted', exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: /^Stage: Contacted/ })).toBeVisible();
  await expect(timeline.getByText('New Lead → Contacted')).toBeVisible();

  // And it really is in the database, logged with who.
  const history = await service().from('deal_stage_history').select('to_stage_id, changed_by').eq('deal_id', seed.dealId);
  expect(history.data).toEqual([{ to_stage_id: 2, changed_by: seed.repId }]);

  // Nothing scrolls sideways on a 375px phone.
  for (const path of ['/dashboard', '/leads', '/leads/new', '/renewals', '/search?q=e2e', '/tasks', '/notifications', '/commissions', '/reports', '/more', '/settings/security', `/customers/${seed.customerId}?deal=${seed.dealId}`]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} is wider than the phone`).toBeLessThanOrEqual(0);
  }

  // A rep cannot export or reach admin pages.
  expect((await page.request.get('/api/export/deals?q=a')).status()).toBe(404);
  expect((await page.request.get('/admin/users')).status()).toBe(404);

  // Signing out is a real POST and ends the session.
  await page.goto('/more');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login\?reason=signed_out/);
  await page.goto('/leads');
  await expect(page).toHaveURL(/\/login/);
});
