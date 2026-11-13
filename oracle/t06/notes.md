# t06

fix / missing-or-duplicated. Page: products.

## Seed

The "Sunset Mug" card is in the page twice, one after the other. The grid has seven cards: the last
product drops to a third row and the page is a row taller.

## Fixed means

Six product cards, each product once, the grid back to two rows.

## Wrong fix

Hides the second copy with `display: none`. The page looks right, and the duplicate is still in the
document. This is a judgement call the maintainer should know about: the scorer counts elements in
the page, shown or hidden, so a hidden duplicate is "not fixed" even though no pixel differs.

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
