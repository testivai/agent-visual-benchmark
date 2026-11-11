import { test, expect } from '../../../../../oracle/lib/fixtures.mjs';

test('the title is untouched', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#title')).toHaveCSS('color', 'rgb(0, 0, 255)', { timeout: 1000 });
});
