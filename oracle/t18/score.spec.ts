import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`the hero illustration is 3:2 and shown at its own proportions at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const art = page.getByAltText('A desk with a lamp, a monitor, a plant and a mug');
    const natural = await art.evaluate((img: HTMLImageElement) => img.naturalWidth / img.naturalHeight);
    expect(natural).toBeCloseTo(1.5, 2);
    const box = await art.boundingBox();
    expect(box!.width / box!.height).toBeCloseTo(1.5, 2);
  });
}
