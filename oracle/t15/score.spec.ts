import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

test('bold text uses the font\'s own bold, which is wider than its regular', async ({ page }) => {
  await page.goto('/');
  const widths = await page.evaluate(async () => {
    await document.fonts.ready;
    const measure = (weight: number) => {
      const span = document.createElement('span');
      span.textContent = 'Hamburgefonstiv 0123456789';
      span.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${weight} 40px "Acme Sans"`;
      document.body.append(span);
      const width = span.getBoundingClientRect().width;
      span.remove();
      return width;
    };
    return { regular: measure(400), bold: measure(800) };
  });
  // This font's own bold sets about 3.8% wider than its regular; a regular thickened by the
  // browser keeps the regular's widths exactly (ratio 1.00). 2% separates the two.
  expect(widths.bold / widths.regular).toBeGreaterThan(1.02);
});
