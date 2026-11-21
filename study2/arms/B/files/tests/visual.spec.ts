import { test, expect } from '@playwright/test';

// The page against its approved screenshot, at every size in the config.
const PAGES = [
  ['home', '/'],
];

for (const [name, url] of PAGES) {
  test(name, async ({ page }) => {
    await page.goto(url);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}
