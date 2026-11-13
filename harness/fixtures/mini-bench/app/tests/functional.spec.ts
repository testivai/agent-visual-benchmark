import { test, expect } from '@playwright/test';

test('the page has its title and note', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#title')).toHaveText('Mini bench');
  await expect(page.locator('#note')).toBeVisible();
});
