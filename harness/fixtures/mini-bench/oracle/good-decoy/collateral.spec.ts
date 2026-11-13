import { test, expect } from '../../../../../oracle/lib/fixtures.mjs';

test('the note is untouched', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#note')).toHaveCSS('color', 'rgb(0, 0, 0)', { timeout: 1000 });
});
