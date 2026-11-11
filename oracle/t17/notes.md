# t17

fix / overflow-or-clipping. Page: products.

## Seed

`.card` gets `overflow: hidden`. The "New" and "Sale" badges are positioned 10px outside the top
right corner of their product cards, so the part outside the card is cut off. Cards on the other
pages have nothing outside their box and look the same.

## Fixed means

Both badges are whole again (their outer corner is visible) and are where they were.

## Wrong fix

Moves the badges inside the card. Nothing is cut off, but the badges no longer hang over the corner.

## Accepted alternative

`override-on-product-cards`: keeps the new declaration on `.card` and sets `overflow: visible` on
product cards. The other cards keep a clip that hides nothing, which measures the same.

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
