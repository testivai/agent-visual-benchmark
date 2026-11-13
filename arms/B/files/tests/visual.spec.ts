import { test, expect } from '@playwright/test';

// Each page against its approved screenshot, at every size in the config.
const PAGES = [
  ['home', '/'],
  ['products', '/products.html'],
  ['pricing', '/pricing.html'],
  ['orders', '/orders.html'],
  ['contact', '/contact.html'],
  ['about', '/about.html'],
];

for (const [name, url] of PAGES) {
  test(name, async ({ page }) => {
    await page.goto(url);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}
