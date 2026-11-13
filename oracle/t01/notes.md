# t01

fix / stacking-order. Page: pricing.

## Seed

The "Most popular" label on the highlighted plan gets a negative `z-index`. Its card is positioned but
makes no stacking context, so the label is painted behind the card's background: the half above the
card's edge stays visible, the half over the card disappears.

## Fixed means

The label is in front of the card again (it is what a click on its lower half lands on), at the
desktop and phone sizes, and it is where it was.

## Wrong fix

Moves the label up until it clears the card, leaving it behind everything. The label is fully
visible, but it sits 14px higher than designed and is still not on top.

## Accepted alternative

`higher-z-index`: any positive `z-index` (5 instead of 1). The scorer records what is on top, not the
`z-index` value.

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
