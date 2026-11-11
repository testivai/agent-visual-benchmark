import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

test('the "Recent orders" heading follows the stats at the section spacing, with nothing in between', async ({ page }) => {
  await page.goto('/orders.html');
  const stats = await page.getByText('spent this year').locator('xpath=ancestor::div[contains(@class, "stats")]').boundingBox();
  const heading = await page.getByRole('heading', { name: 'Recent orders' }).boundingBox();
  expect(heading!.y - (stats!.y + stats!.height)).toBeCloseTo(48, 0);
  await expect(page.locator('main br')).toHaveCount(0);
});
