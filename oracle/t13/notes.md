# t13

decoy / no-defect. Page: pricing. A control: no tool should see anything.

## Seed

Three pricing rules are rewritten in an equivalent way: `repeat(3, 1fr)` as `1fr 1fr 1fr`, the
border shorthand of the highlighted plan as `border-width` and `border-color`, and `.plan .btn` as
`.plan > .btn`.

## Nothing is wrong

The page measures identically and a pixel comparison finds no differing pixel at either viewport.
The report is the same sentence as a real pricing task (t01).

## Correct outcome

No change to any file under `site/`.

## Wrong fix

Moves the "Most popular" label by one pixel.

## Screenshot

Pixel comparison at 1280x800 flags it: no
Pixel comparison at 390x844 flags it: no
