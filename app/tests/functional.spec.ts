import { test, expect } from '@playwright/test';

const PAGES = [
  { link: 'Home', file: 'index.html', heading: 'Small things that make a desk feel like yours' },
  { link: 'Products', file: 'products.html', heading: 'Products' },
  { link: 'Pricing', file: 'pricing.html', heading: 'Pricing' },
  { link: 'Orders', file: 'orders.html', heading: 'Orders' },
  { link: 'About', file: 'about.html', heading: 'About' },
  { link: 'Contact', file: 'contact.html', heading: 'Contact' },
];

test.describe('navigation', () => {
  for (const { link, file, heading } of PAGES) {
    test(`the ${link} link opens ${file}`, async ({ page }) => {
      await page.goto(file === 'index.html' ? '/about.html' : '/');
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: link, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/${file.replace('.', '\\.')}$`));
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      await expect(
        page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: link, exact: true }),
      ).toHaveAttribute('aria-current', 'page');
    });
  }

  test('every page lists the same six links', async ({ page }) => {
    for (const { file } of PAGES) {
      await page.goto(`/${file}`);
      await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link')).toHaveText(
        PAGES.map((p) => p.link),
      );
    }
  });

  test('on a phone the menu opens from the Menu button', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });
    const menu = page.getByRole('button', { name: 'Menu' });
    await expect(nav).toBeHidden();
    await menu.click();
    await expect(nav).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await nav.getByRole('link', { name: 'Pricing', exact: true }).click();
    await expect(page).toHaveURL(/\/pricing\.html$/);
  });
});

test.describe('contact form', () => {
  test('an empty form shows what is needed and sends nothing', async ({ page }) => {
    await page.goto('/contact.html');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Please enter your name.')).toBeVisible();
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Please write at least 10 characters.')).toBeVisible();
    await expect(page.getByText('Please agree before sending.')).toBeVisible();
    await expect(page.getByRole('status')).toBeHidden();
  });

  test('a bad email address is refused', async ({ page }) => {
    await page.goto('/contact.html');
    await page.getByLabel('Name', { exact: true }).fill('Dana');
    await page.getByLabel('Email', { exact: true }).fill('dana-at-example');
    await page.getByLabel('Message', { exact: true }).fill('Where is my order 1041?');
    await page.getByLabel('You may store this message').check();
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
    await expect(page.getByText('Please enter your name.')).toBeHidden();
    await expect(page.getByRole('status')).toBeHidden();
  });

  test('a complete form is sent and thanks the sender by name', async ({ page }) => {
    await page.goto('/contact.html');
    await page.getByLabel('Name', { exact: true }).fill('Dana Whitfield');
    await page.getByLabel('Email', { exact: true }).fill('dana@example.com');
    await page.getByLabel('Topic', { exact: true }).selectOption('A product');
    await page.getByLabel('Message', { exact: true }).fill('Does the Aurora Lamp come in black?');
    await page.getByLabel('You may store this message').check();
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Thanks, Dana Whitfield. We will reply within one business day.',
    );
    await expect(page.getByRole('button', { name: 'Send message' })).toBeHidden();
  });
});

test.describe('newsletter', () => {
  test('a valid address is accepted', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email address').fill('dana@example.com');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByText('You are on the list. Look out for the next issue.')).toBeVisible();
    await expect(page.getByLabel('Email address')).toHaveValue('');
  });

  test('an invalid address is refused', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email address').fill('dana');
    await page.getByRole('button', { name: 'Subscribe' }).click();
    await expect(page.getByText('Please enter a valid email address.')).toBeVisible();
  });
});

test.describe('order details', () => {
  test('View opens the dialog with that order', async ({ page }) => {
    await page.goto('/orders.html');
    await page.getByRole('row', { name: /#1041/ }).getByRole('button', { name: 'View' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading')).toHaveText('Order #1041');
    await expect(dialog).toContainText('9 May 2026');
    await expect(dialog).toContainText('On its way');
    await expect(dialog).toContainText('$129.00');
  });

  test('the dialog closes with Escape, with Close and with the × button', async ({ page }) => {
    await page.goto('/orders.html');
    const open = () => page.getByRole('row', { name: /#1042/ }).getByRole('button', { name: 'View' }).click();
    const dialog = page.getByRole('dialog');

    await open();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await open();
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
    await expect(dialog).toBeHidden();

    await open();
    await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();
    await expect(dialog).toBeHidden();
  });

  test('the orders table has one row per order', async ({ page }) => {
    await page.goto('/orders.html');
    await expect(page.locator('tbody tr')).toHaveCount(6);
  });
});
