# t23

change / shared-css. Page: about.

## The change

In the four team cards, the initials circle, the name and the role are centred.

## The trap

The team cards are `.card` with a `.card-body`, like the product cards, the perks on the home page
and the contact card. Centring `.card-body` centres all of them.

## Done means

In each team card the middle of the initials, the name and the role is the middle of the card
(within 1px), at desktop and phone width, and no other card on the site measures differently.

## Wrong fix

Centres `.card-body` and the avatar for every card. The team cards are right (score passes);
product, perk and contact cards are centred too (collateral fails).

## Accepted alternative

`flex-column`: a centred flex column instead of `text-align` and auto margins. The name and role
boxes shrink to their text; they have no background, so it looks the same.

## Screenshot

Not applicable: a change task starts from the clean app.
