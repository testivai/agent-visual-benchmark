import { test, expect } from '../lib/fixtures.mjs';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`the button on the highlighted plan is the success green with white text at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/pricing.html');
    const button = page.getByRole('link', { name: 'Choose Pro' });
    await expect(button).toHaveCSS('background-color', 'rgb(26, 127, 55)');
    await expect(button).toHaveCSS('background-image', 'none');
    await expect(button).toHaveCSS('color', 'rgb(255, 255, 255)');
  });
}
