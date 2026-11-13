import { test, expect } from '../../../../../oracle/lib/fixtures.mjs';

test('the title is bold again', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#title')).toHaveCSS('font-weight', '700', { timeout: 1000 });
});
