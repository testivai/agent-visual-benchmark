# t12

fix / stacking-order. Page: home.

## Seed

The stats strip overlaps the bottom of the hero by 56px. It loses `position: relative; z-index: 1`,
so the hero (which is positioned) is painted over it: the top of the three stat cards, with their
figures, disappears behind the hero's background.

## Fixed means

The strip is in front of the hero again and still overlaps it by 56px.

## Wrong fix

Replaces the negative margin with a positive one. The strip is fully visible, but it no longer
overlaps the hero and everything below it sits 80px lower.

## Accepted alternative

`other-z-index`: `position: relative` with a different positive `z-index`.

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
