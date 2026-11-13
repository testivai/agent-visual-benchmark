# t15

fix / failed-web-font. Pages: all six.

## Seed

The `@font-face` rule says `font-weight: 400` instead of the range `300 900`. The font file is a
variable font; with one declared weight the browser never asks it for bold and thickens the regular
outlines itself. Headings, buttons and labels are a fake bold: narrower and blunter than the design.
The font does load, so nothing reports a failure.

## Fixed means

Bold text is set in the font's own bold again: every bold text box measures as before.

## Scoring

By text width. The real bold is wider than the regular; a thickened regular is not. The check
compares the two widths in the page, so it does not depend on the machine.

## Wrong fix

`font-synthesis: none`. The browser stops faking bold, so the smeared look goes, and so does every
bold on the site.

## Accepted alternative

`wider-range`: `font-weight: 100 900`.

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
