import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

const BUTTONS = [
  ['/products.html', 'Add to cart'],
  ['/', 'See plans'],
  ['/pricing.html', 'Choose Starter'],
  ['/orders.html', 'View'],
];

for (const [url, name] of BUTTONS) {
  test(`the "${name}" button on ${url} has a readable label`, async ({ page }) => {
    await page.goto(url);
    const button = page.getByRole('link', { name }).or(page.getByRole('button', { name })).first();
    await expect(button).toHaveCSS('color', 'rgb(31, 35, 40)');
    await expect(button).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  });
}
