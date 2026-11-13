# t16

change / shared-css. Page: orders.

## The change

The body rows of the orders table get 6px of padding above and below instead of 12px. The heading
row stays as it is.

## The trap

`.table` is one component, used for the orders table and for "Compare plans" on the pricing page.
Changing `.table td` tightens both.

## Done means

All 36 body cells of the orders table have 6px top and bottom padding, the heading cells keep 12px,
each row is 12px shorter, and the comparison table on the pricing page measures as before.

## Wrong fix

Changes `.table td` for every table. The orders table is right (score passes); the pricing table
changed too (collateral fails).

## Accepted alternative

`compact-table-class`: a `.table-compact` modifier used on the orders table only.

## Screenshot

Not applicable: a change task starts from the clean app.
