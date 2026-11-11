# Acme Storefront

A small static shop site: six pages, shared CSS, no build step.

```
site/
  index.html  products.html  pricing.html  orders.html  about.html  contact.html
  css/tokens.css      design tokens and the web font
  css/base.css        reset, typography, layout
  css/components.css  header, button, card, form, table, modal
  css/pages.css       page sections
  js/app.js           mobile menu, order dialog, forms
  assets/  fonts/
tests/functional.spec.ts
```

## Run

```bash
npm install
npm start        # http://127.0.0.1:4173
npm test         # functional tests (Playwright)
```

The layout has one breakpoint, at 720px.
