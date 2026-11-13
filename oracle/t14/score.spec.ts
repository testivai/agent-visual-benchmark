import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

test('the orders table has a heading for every column, and "Total" is over the amounts', async ({ page }) => {
  await page.goto('/orders.html');
  const table = page.locator('table').first();
  await expect(table.locator('thead th')).toHaveCount(6);
  await expect(table.locator('thead th')).toHaveText(['Order', 'Date', 'Customer', 'Status', 'Total', '']);
  const heading = await table.locator('thead th', { hasText: 'Total' }).boundingBox();
  const amount = await table.locator('tbody tr').first().getByText('$67.00').boundingBox();
  // both are right-aligned in the same column
  expect(Math.abs(heading!.x + heading!.width - (amount!.x + amount!.width))).toBeLessThanOrEqual(1);
});
