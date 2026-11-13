# t20

fix / breakpoint-only. Page: about.

## Seed

A copy of the rule `.story { grid-template-columns: 1fr 480px; }` is added at the end of
`pages.css`, after the media query. It has the same specificity as the phone rule that makes the
story one column, and it comes later, so it wins: under 720px the story stays in two columns. The
480px picture column is wider than the screen, the text column collapses to a few characters, and
the page scrolls sideways. At desktop width the copy repeats what was already there: nothing
changes.

## Fixed means

Under 720px the story is one column again: the picture is under the text, both fit the screen and
the page does not scroll sideways.

## Wrong fix

`overflow: hidden` on the story. The page stops scrolling sideways, and the story is still two
squeezed columns with the picture cut off.

## Accepted alternative

`phone-rule-after-it`: keeps the copy and repeats the one-column rule in a second media query after
it.

## Why not the task that was here first

The first version of this task made the phone menu always open. The app's own functional suite
fails on that, so an agent with no visual tool would be pointed at it by a failing test.
`npm run validate` requires the functional suite to pass on every seeded state for that reason.

## Screenshot

Full-page screenshot at 1280x800 shows it: no
Full-page screenshot at 390x844 shows it: yes

**Flag: not visible at the default viewport.** As for the other breakpoint task, only a screenshot
at phone width shows it. The report says "on my phone".
