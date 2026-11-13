import { test } from '@playwright/test';
import { witness } from '@testivai/witness-playwright';

// Each page against its approved baseline, at every size in the config.
const PAGES = [
  ['home', '/'],
  ['products', '/products.html'],
  ['pricing', '/pricing.html'],
  ['orders', '/orders.html'],
  ['contact', '/contact.html'],
  ['about', '/about.html'],
];

for (const [name, url] of PAGES) {
  test(name, async ({ page }, testInfo) => {
    await page.goto(url);
    await witness(page, testInfo, name);
  });
}
