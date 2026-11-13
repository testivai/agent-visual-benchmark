# t03

fix / style-only. Page named in the report: products. The defect is on every page with a secondary
button (home, products, pricing, orders).

## Seed

`.btn-secondary` gets `color: var(--color-surface)`: white text on a white button. "Add to cart",
"See plans", "Choose Starter", "View", "Close", "Previous" and "Next" become blank outlined boxes.

## Fixed means

Every secondary button has its ink-coloured label back, on every page, not only the one the report
names.

## Wrong fix

Adds an override for the buttons in product cards only. The page in the report looks right; the same
button on the home, pricing and orders pages is still blank.

## Accepted alternative

`same-colour-written-out`: the same colour as a hex value instead of the token.

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
