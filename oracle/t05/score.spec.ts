import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

test('on a phone the three plans are stacked, each as wide as the page allows', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/pricing.html');
  const boxes = [];
  for (const name of ['Choose Starter', 'Choose Pro', 'Choose Team']) {
    boxes.push(await page.getByRole('link', { name }).boundingBox());
  }
  for (const box of boxes) expect(box!.width).toBeGreaterThan(280);
  expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y + boxes[0]!.height);
  expect(boxes[2]!.y).toBeGreaterThan(boxes[1]!.y + boxes[1]!.height);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scroll).toBeLessThanOrEqual(390);
});
