import { test, expect } from '../../../../../oracle/lib/fixtures.mjs';

test('the title margin is back', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#title')).toHaveCSS('margin-top', '16px', { timeout: 1000 });
});
