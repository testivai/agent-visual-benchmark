import { test } from '@playwright/test';
import { witness } from '@testivai/witness-playwright';

// The page against its approved baseline, at every size in the config.
const PAGES = [
  ['home', '/'],
];

for (const [name, url] of PAGES) {
  test(name, async ({ page }, testInfo) => {
    await page.goto(url);
    await witness(page, testInfo, name);
  });
}
