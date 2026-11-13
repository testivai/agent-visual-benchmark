import { test, expect } from '../lib/fixtures.mjs';

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`the Send message button is as wide as the fields at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/contact.html');
    const field = await page.getByLabel('Name', { exact: true }).boundingBox();
    const button = await page.getByRole('button', { name: 'Send message' }).boundingBox();
    expect(Math.abs(button!.width - field!.width)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(button!.x - field!.x)).toBeLessThanOrEqual(0.5);
  });
}
