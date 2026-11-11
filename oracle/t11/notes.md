# t11

change / shared-css. Page: home.

## The change

The grey descriptive text on the home page becomes `#3d4650`.

## The trap

The grey is the `--color-muted` token. Changing the token changes the grey text of all six pages.

## Done means

The five descriptions under the home page headings (hero, featured product, three perks) are
`#3d4650`, and nothing on the other five pages measures differently.

The request does not say whether smaller grey text on the home page (stat labels, the newsletter
note, the footer) should follow. The scorer requires only the five descriptions and allows the rest
either way: see the two accepted alternatives.

## Wrong fix

Changes the token. The home page is right (score passes); every other page changed (collateral
fails).

## Accepted alternatives

`whole-page`: overrides the token for the whole home page, footer included.
`named-descriptions-only`: recolours the lede and the card descriptions and nothing else.

## Screenshot

Not applicable: a change task starts from the clean app.
