import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`the email address stays inside its card, in full, at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/contact.html');
    const address = page.getByText('customer.support.team@acmestorefront.example');
    await expect(address).toBeVisible();
    const card = page.locator('aside, .card').filter({ hasText: 'Other ways to reach us' }).last();
    const cardBox = await card.boundingBox();
    const text = await address.evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      const rects = [...range.getClientRects()];
      return {
        right: Math.max(...rects.map((r) => r.right)),
        // text that is cut off scrolls inside its box
        cut: el.scrollWidth > el.clientWidth + 1,
      };
    });
    expect(text.right).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 0.5);
    expect(text.cut).toBe(false);
  });
}
