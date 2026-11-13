import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

test('each product is in the page once', async ({ page }) => {
  await page.goto('/products.html');
  // counts elements in the page, shown or hidden
  await expect(page.locator('h3')).toHaveText([
    'Aurora Lamp', 'Sunset Mug', 'Forest Desk Mat', 'Orchid Notebook',
    'Slate Noise-Cancelling Headphones', 'Citrus Plant Pot', 'Desk starter', 'Quiet corner',
  ]);
});
