# t19

decoy / no-defect. Pages: all six.

## Seed

The web font file is replaced by a re-export of the same font at 2048 units per em instead of 1000
(`tools/fonts/build_fonts.py`). The design is identical; outlines sit on a finer grid, so glyph
edges move by a fraction of a pixel.

## Nothing is wrong

Measured on all 23 views: every box and every text width is within half a pixel of the clean app
(no measured difference at all). The font loads. A pixel comparison at Playwright's default
threshold flags scattered pixels on the edges of text on every page.

## Correct outcome

No change to any file under `site/`.

## Wrong fix

Adds font-smoothing and text-rendering declarations to "sharpen" the text.

## Screenshot

Pixel comparison at 1280x800 flags it: yes
Pixel comparison at 390x844 flags it: yes
