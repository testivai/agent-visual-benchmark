# t09

fix / layout-shift (inserted content). Page: orders.

## Seed

Two `<br>` elements are inserted in front of the "Recent orders" heading. Each makes an empty 24px
line, so the heading, the table and everything after them sit 48px lower.

## Fixed means

The inserted line breaks are gone and the heading follows the stats at the section spacing (48px).

## Wrong fix

A negative top margin of a guessed 40px on the heading. Most of the gap is hidden; 8px of it and
both line breaks are still there.

## Note on hacks

A hack that compensates by exactly 48px and leaves the `<br>` elements in place renders the same as
the clean page. It is still scored "not fixed", because the inserted elements are counted. See the
README, "What the scorer accepts".

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
