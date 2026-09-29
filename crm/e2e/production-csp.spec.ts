import { expect, test } from '@playwright/test';
import { seedRepWithLead } from './stack';

/**
 * Against a PRODUCTION build (dev relaxes styles for its overlay):
 *   npm run build && npx next start --port 3002
 *   E2E_PROD_URL=http://127.0.0.1:3002 npx playwright test e2e/production-csp.spec.ts
 */
const PROD = process.env.E2E_PROD_URL;
test.skip(!PROD, 'set E2E_PROD_URL to a running production build');

test('production build: no CSP violations or SSR style attributes on the main screens', async ({ browser }) => {
  const seed = await seedRepWithLead();
  for (const viewport of [{ width: 375, height: 812 }, { width: 1280, height: 800 }]) {
    const context = await browser.newContext({ viewport, baseURL: PROD });
    const page = await context.newPage();
    const violations: string[] = [];
    page.on('console', (msg) => { if (/Content Security Policy|hydrat/i.test(msg.text())) violations.push(`${viewport.width} ${page.url()} ${msg.location().url.split('/').pop()}:${msg.location().lineNumber} ${msg.text().slice(120, 260)}`); });
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    await page.getByLabel('Work email').fill(seed.email);
    await page.getByLabel('Password').fill(seed.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/dashboard/);
    // Soft navigation from the dashboard to Leads: chips must keep their colours.
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Leads' }).first().click();
    await expect(page).toHaveURL(/leads/);
    const chipBg = await page.locator('[class*="pl-"]:visible').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(chipBg, 'pipeline chip colour after client navigation').not.toBe('rgba(0, 0, 0, 0)');
    for (const path of ['/dashboard', '/leads', `/customers/${seed.customerId}?deal=${seed.dealId}`, '/renewals', '/search?q=e2e', '/tasks', '/commissions', '/reports', '/more', '/notifications', '/settings/security']) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await page.waitForLoadState('networkidle');
      const html = await response!.text();
      const styleAttrs = (html.match(/<[a-z][^>]*\sstyle="[^"]*"/gi) ?? []).map((tag) => tag.slice(0, 120));
      expect(styleAttrs, `${path} @${viewport.width}: server-rendered style attributes`).toEqual([]);
    }
    await page.goto(`/customers/${seed.customerId}?deal=${seed.dealId}`);
    await page.getByRole('button', { name: /^Stage:/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    expect(violations).toEqual([]);
    await context.close();
  }
});
