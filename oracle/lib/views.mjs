// The views the oracle measures: every page at two viewport sizes, plus the
// states a visitor can reach (menu open, order dialog open, form errors, form sent).

export const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};

export const PAGES = {
  home: 'index.html',
  products: 'products.html',
  pricing: 'pricing.html',
  orders: 'orders.html',
  contact: 'contact.html',
  about: 'about.html',
};

// How to reach each state, by role and name, as a visitor would.
export const STATES = {
  menu: {
    what: 'open the menu',
    async reach(page, timeout) {
      await page.getByRole('button', { name: 'Menu' }).click({ timeout });
      await page.getByRole('navigation', { name: 'Main' }).waitFor({ state: 'visible', timeout });
    },
  },
  dialog: {
    what: 'open the order dialog',
    async reach(page, timeout) {
      await page.getByRole('button', { name: 'View' }).first().click({ timeout });
      await page.getByRole('dialog').waitFor({ state: 'visible', timeout });
    },
  },
  errors: {
    what: 'show the contact form errors',
    async reach(page, timeout) {
      await page.getByRole('button', { name: 'Send message' }).click({ timeout });
      await page.getByText('Please enter your name.').waitFor({ state: 'visible', timeout });
    },
  },
  sent: {
    what: 'send the contact form',
    async reach(page, timeout) {
      await page.getByLabel('Name', { exact: true }).fill('Dana Whitfield', { timeout });
      await page.getByLabel('Email', { exact: true }).fill('dana@example.com', { timeout });
      await page.getByLabel('Message', { exact: true }).fill('Does the Aurora Lamp come in black?', { timeout });
      await page.getByLabel('You may store this message').check({ timeout });
      await page.getByRole('button', { name: 'Send message' }).click({ timeout });
      await page.getByRole('status').waitFor({ state: 'visible', timeout });
    },
  },
};

export const viewId = ({ page, viewport, state }) => `${page}@${viewport}${state ? `#${state}` : ''}`;

const pages = Object.keys(PAGES);

export const VIEWS = [
  ...pages.flatMap((page) => ['desktop', 'mobile'].map((viewport) => ({ page, viewport }))),
  ...pages.map((page) => ({ page, viewport: 'mobile', state: 'menu' })),
  { page: 'orders', viewport: 'desktop', state: 'dialog' },
  { page: 'orders', viewport: 'mobile', state: 'dialog' },
  { page: 'contact', viewport: 'desktop', state: 'errors' },
  { page: 'contact', viewport: 'mobile', state: 'errors' },
  { page: 'contact', viewport: 'desktop', state: 'sent' },
];
