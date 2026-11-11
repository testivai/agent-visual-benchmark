# t08

fix / failed-web-font. Pages: all six.

## Seed

The `@font-face` URL says `../font/` instead of `../fonts/`. The request for the font fails, and all
text falls back to the system sans-serif: different letter shapes and widths, lines that wrap in
other places, pages that are taller or shorter.

## Fixed means

The web font loads and is in use on every page, and every text box measures as before.

## Scoring a failed font without a screenshot

Three independent signals, all DOM-level: the `FontFace` status in `document.fonts` (`loaded`, not
`error`), the computed `font-family`, and the measured width of every piece of text, which changes
with the font actually used. No pixel comparison is needed.

## Wrong fix

Adds look-alike system fonts to the font stack. On a machine that has one of them the text looks
closer to the design, and the web font still fails to load.

## Accepted alternative

`root-relative-url`: `/fonts/acme-sans.woff2`.

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
