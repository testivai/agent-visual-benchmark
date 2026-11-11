# t18

fix / layout-shift (resized content). Page: home.

## Seed

`hero.svg` is saved with a 420x380 artboard instead of 420x280. The drawing is unchanged and fills
the top 280px; the image is 100px taller, so the hero grows and everything below it moves down. The
page's own markup still says the image is 420x280.

## Fixed means

The illustration is 3:2 again, both in the file and on the page, and the content below is back in
place.

## Wrong fix

Forces the image box to 280px high in CSS. The page layout is back, and the drawing is scaled down
to fit a box it does not match: smaller than designed, with empty space beside it.

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
