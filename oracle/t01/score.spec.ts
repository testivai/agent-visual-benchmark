import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`the "Most popular" label is in front of its card at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/pricing.html');
    const label = page.getByText('Most popular', { exact: true });
    await label.scrollIntoViewIfNeeded();
    // the lower part of the label is the part that overlaps the card
    const inFront = await label.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height * 0.75);
      return hit === el || el.contains(hit);
    });
    expect(inFront).toBe(true);
  });
}
