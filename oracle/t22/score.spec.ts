import { test, expect } from '../lib/fixtures.mjs';

test('everything the seed changed is back as it was', async ({ oracle }) => {
  oracle.expectRestored();
});

test('there are 16px between one field and the label of the next', async ({ page }) => {
  await page.goto('/contact.html');
  const bottomOf = async (label: string) => {
    const box = await page.getByLabel(label, { exact: true }).boundingBox();
    return box!.y + box!.height;
  };
  const topOfLabel = async (text: string) => (await page.locator('label', { hasText: text }).first().boundingBox())!.y;
  expect((await topOfLabel('Email')) - (await bottomOf('Name'))).toBeCloseTo(16, 0);
  expect((await topOfLabel('Topic')) - (await bottomOf('Email'))).toBeCloseTo(16, 0);
  expect((await topOfLabel('Message')) - (await bottomOf('Topic'))).toBeCloseTo(16, 0);
});
