import { test, expect } from '../lib/fixtures.mjs';

test('the two section headings are capitals, 16px, letters 0.08em apart', async ({ page }) => {
  await page.goto('/products.html');
  for (const name of ['All products', 'Bundles']) {
    const heading = page.getByRole('heading', { name, exact: true });
    await expect(heading).toHaveCSS('font-size', '16px');
    await expect(heading).toHaveCSS('letter-spacing', '1.28px');
    const capitals = await heading.evaluate((el) => (
      getComputedStyle(el).textTransform === 'uppercase' || el.textContent === el.textContent!.toUpperCase()
    ));
    expect(capitals, name).toBe(true);
  }
});

test('the page title is not restyled', async ({ page }) => {
  await page.goto('/products.html');
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toHaveCSS('font-size', '36px');
  await expect(title).toHaveCSS('text-transform', 'none');
});
