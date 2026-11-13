# t21

change / shared-css. Page: products.

## The change

The two section headings of the products page ("All products", "Bundles") are set in capitals at
16px with 0.08em letter spacing.

## The trap

The headings are `h2.section-title`. That class, and `h2` itself, are styled once for the whole
site: restyling either changes the section headings of all six pages.

## Done means

Both headings are capitals, 16px, with 1.28px between letters; the page title is untouched; no
heading on another page measures differently.

## Wrong fix

Restyles `.section-title` in the base stylesheet. The products headings are right (score passes);
the headings of every other page changed (collateral fails).

## Accepted alternative

`by-heading-level`: the same styles on `.page-products h2`.

## Screenshot

Not applicable: a change task starts from the clean app.
