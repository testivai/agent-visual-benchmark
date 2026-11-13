import { test, expect } from '../lib/fixtures.mjs';

const TEAM = [
  ['MO', 'Mira Okafor', 'Founder, lamps'],
  ['TB', 'Tomas Berg', 'Workshop'],
  ['LS', 'Lena Sato', 'Orders and support'],
  ['JR', 'Jonah Reyes', 'Design'],
];

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`initials, name and role are centred in each team card at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/about.html');
    for (const [initials, name, role] of TEAM) {
      const card = page.locator('.card').filter({ hasText: name });
      const box = await card.boundingBox();
      const middle = box!.x + box!.width / 2;
      for (const text of [initials, name, role]) {
        // the middle of the text itself, not of the box it sits in
        const textMiddle = await card.getByText(text, { exact: true }).evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          return r.left + r.width / 2;
        });
        expect(Math.abs(textMiddle - middle), `${text} in the card of ${name}`).toBeLessThanOrEqual(1);
      }
    }
  });
}
