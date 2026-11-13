# t05

fix / breakpoint-only. Page: pricing.

## Seed

`.plans` is removed from the list of grids that switch to one column under 720px. On a phone the
three plans stay side by side, about 100px wide each, with their text broken into short lines. At
desktop width nothing changes.

## Fixed means

Under 720px the three plans are stacked in one column, as before.

## Wrong fix

Two columns on a phone. Less cramped than three, and not the design.

## Accepted alternative

`own-rule`: a separate one-column rule for `.plans` inside the same media query.

## Screenshot

Full-page screenshot at 1280x800 shows it: no
Full-page screenshot at 390x844 shows it: yes

**Flag: not visible at the default viewport.** An arm whose screenshots are taken at desktop width
only cannot see this task. The report says "on my phone", which is the only hint.
