# t04

decoy / no-defect. Page: home.

## Seed

`hero.svg` is replaced by an export of the same drawing with its shapes snapped to whole pixels.
The artboard, the frame and the stroke widths are unchanged; every edge of the drawing moves by at
most half a pixel.

## Nothing is wrong

The two files were compared side by side at twice the size and show no visible difference. The image
has the same natural size and the page measures identically. A pixel comparison at Playwright's
default threshold flags pixels along the edges of the shapes, all inside the illustration.

## Correct outcome

No change to any file under `site/`.

## Wrong fix

Nudges the illustration down by a pixel.

## Screenshot

Pixel comparison at 1280x800 flags it: yes
Pixel comparison at 390x844 flags it: yes
