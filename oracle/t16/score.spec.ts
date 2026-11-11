import { test, expect } from '../lib/fixtures.mjs';

test('order rows have 6px above and below; the heading row keeps 12px', async ({ page }) => {
  await page.goto('/orders.html');
  const table = page.locator('table').first();
  const cells = table.locator('tbody td');
  expect(await cells.count()).toBe(36);
  const paddings = await cells.evaluateAll((tds) => tds.map((td) => {
    const cs = getComputedStyle(td);
    return `${cs.paddingTop} ${cs.paddingBottom}`;
  }));
  expect([...new Set(paddings)]).toEqual(['6px 6px']);
  await expect(table.locator('thead th').first()).toHaveCSS('padding-top', '12px');
  await expect(table.locator('thead th').first()).toHaveCSS('padding-bottom', '12px');
});

test('each order row is 12px shorter than it was', async ({ page, oracle }) => {
  await page.goto('/orders.html');
  const before = oracle.clean.views['orders@desktop'].elements['tr[1]'].h;
  const rows = page.locator('table').first().locator('tbody tr');
  for (let i = 0; i < 6; i++) {
    const box = await rows.nth(i).boundingBox();
    expect(Math.abs(box!.height - (before - 12))).toBeLessThanOrEqual(1.5);
  }
});
