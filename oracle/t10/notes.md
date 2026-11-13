# t10

fix / overflow-or-clipping. Page: contact.

## Seed

The rule that lets the long email address break (`overflow-wrap: anywhere` on the definitions of the
contact card) is removed. The address has no break point, so it stays on one line and runs out of
the right side of the card.

## Fixed means

The whole address is inside the card, on two lines as before.

## Wrong fix

Hides what spills with `overflow: hidden; text-overflow: ellipsis`. Nothing runs out of the card,
but the address is cut short and unusable.

## Accepted alternative

`break-all`: `word-break: break-all` wraps the address at the same place, since it has no ordinary
break point.

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
