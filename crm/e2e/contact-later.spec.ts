import { test, expect } from '@playwright/test';
import { seedRepWithLead, sql } from './stack';

test('a rep can mark a lead Contact Later, schedule a reminder and find it with the stage filter', async ({ page }) => {
  const lead = await seedRepWithLead();
  await page.goto('login');
  await page.getByLabel('Work email').fill(lead.email);
  await page.getByLabel('Password', { exact: true }).fill(lead.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto(`customers/${lead.customerId}?deal=${lead.dealId}`);
  await page.getByRole('button', { name: /^Stage: New Lead/ }).click();
  await page.getByRole('button', { name: 'Contact Later', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Contact Later', exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'In 3 days', exact: true }).click();
  const due = await dialog.getByLabel('Contact again on (optional)', { exact: true }).inputValue();
  expect(due).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await dialog.getByRole('button', { name: 'Save and move to Contact Later', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: /^Stage: Contact Later/ })).toBeVisible();
  await expect(page.getByText('Contact customer again', { exact: true })).toBeVisible();
  expect((await sql('select due_date::text, assigned_to from public.tasks where deal_id=$1', [lead.dealId])).rows).toEqual([{ due_date: due, assigned_to: lead.repId }]);
  await page.goto('leads?pipeline=telecommunications&stage=contact_later');
  await expect(page.getByRole('link').filter({ hasText: lead.customerName })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});
