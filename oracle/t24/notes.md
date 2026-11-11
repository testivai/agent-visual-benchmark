# t24

decoy / no-defect. Page: about. A control: a file changed, and nothing shows.

## Seed

`workshop.png` is replaced by an export of the same picture at 1440x900 instead of 960x600
(`tools/assets/build-png.mjs 3`). It is displayed at 480x300 either way.

## Nothing is wrong

The page measures identically apart from the image's natural size. A pixel comparison at
Playwright's default threshold finds no differing pixel at either viewport; at half that threshold
it finds a few on the edges of the picture's shapes.

## Correct outcome

No change to any file under `site/`.

## Wrong fix

Sets `image-rendering: pixelated` on the picture.

## Screenshot

Pixel comparison at 1280x800 flags it: no
Pixel comparison at 390x844 flags it: no
