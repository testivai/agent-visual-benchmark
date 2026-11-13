import { test, expect } from '../lib/fixtures.mjs';

const DESCRIPTIONS = [
  'Lamps, mugs and mats, made in small batches and shipped the same day.',
  'Soft gradient light for long evenings. Dimmable, USB-C, and calm on the eyes.',
  'Orders leave the warehouse the same day.',
  'Thirty days, no questions, free labels.',
  'A person answers within one business day.',
];

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`the descriptions under the home page headings are #3d4650 at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (const text of DESCRIPTIONS) {
      await expect(page.getByText(text, { exact: true }), text).toHaveCSS('color', 'rgb(61, 70, 80)');
    }
  });
}
