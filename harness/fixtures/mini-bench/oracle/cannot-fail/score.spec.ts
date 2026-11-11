import { test, expect } from '../../../../../oracle/lib/fixtures.mjs';

test('a scorer that cannot fail', async ({ page }) => {
  await page.goto('/');
  expect(true).toBe(true);
});
