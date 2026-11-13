import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

for (const url of ['/', '/pricing.html', '/contact.html']) {
  test(`the web font is loaded and in use on ${url}`, async ({ page }) => {
    await page.goto(url);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].map((f) => ({ family: f.family.replace(/["']/g, ''), status: f.status }));
    });
    expect(fonts).toContainEqual({ family: 'Acme Sans', status: 'loaded' });
    expect(fonts.filter((f) => f.status === 'error')).toEqual([]);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-family', /^"?Acme Sans"?/);
  });
}
