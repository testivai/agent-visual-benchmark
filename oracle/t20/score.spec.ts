import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

test('on a phone the story is one column: the picture is under the text and fits the screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about.html');
  const picture = await page.getByAltText('The workshop, a white house with a red roof next to a warehouse').boundingBox();
  const text = await page.getByText('We still make everything in small batches').boundingBox();
  expect(picture!.y).toBeGreaterThanOrEqual(text!.y + text!.height);
  expect(picture!.x).toBeGreaterThanOrEqual(0);
  expect(picture!.x + picture!.width).toBeLessThanOrEqual(390);
  expect(text!.width).toBeGreaterThan(300);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scroll).toBeLessThanOrEqual(390);
});
