import { test, expect } from '../../../../../oracle/lib/fixtures.mjs';

test('the note margin is back', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#note')).toHaveCSS('margin-top', '16px', { timeout: 1000 });
});
