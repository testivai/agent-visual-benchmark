import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

for (const label of ['New', 'Sale']) {
  test(`the "${label}" badge is not cut off`, async ({ page }) => {
    await page.goto('/products.html');
    const badge = page.getByText(label, { exact: true });
    await badge.scrollIntoViewIfNeeded();
    // the top right corner is the part that hangs outside the card
    const cornerShows = await badge.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.right - 3, r.top + 3);
      return hit === el || el.contains(hit);
    });
    expect(cornerShows).toBe(true);
  });
}
