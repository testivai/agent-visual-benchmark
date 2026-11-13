# t07

change / shared-css. Page: pricing.

## The change

The button of the highlighted plan ("Choose Pro") becomes the success green (`#1a7f37`), white text.

## The trap

That button is a `.btn-primary`, the same class as "Browse products" on the home page, "Subscribe",
"Send message", "Get in touch" and others. Editing `.btn-primary` makes all of them green.

## Done means

That one button is green with white text, at desktop and phone width, and no other element on any
page measures differently.

## Wrong fix

Changes `.btn-primary`. The asked-for button is green (score passes); so is every other primary
button on the site (collateral fails).

## Accepted alternative

`new-button-variant`: a new `.btn-success` class used on that button.

## Screenshot

Not applicable: a change task starts from the clean app.
