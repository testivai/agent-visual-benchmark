# t02

change / shared-css. Page: contact.

## The change

The "Send message" button is as wide as the fields of the contact form.

## The trap

The stylesheet already has a `.form .btn` rule, and it looks scoped to the form. It also matches the
"Subscribe" button of the newsletter form on the home page, where a full-width button squeezes the
email field in the same row.

## Done means

The button has the width and left edge of the Name field, at desktop and phone width, and the
newsletter form and every other button measure as before.

## Wrong fix

Adds `width: 100%` to `.form .btn`. The contact button is right (score passes); the newsletter row on
the home page breaks (collateral fails).

## Accepted alternative

`block-button-class`: a `.btn-block` modifier used on that button only.

## Screenshot

Not applicable: a change task starts from the clean app.
