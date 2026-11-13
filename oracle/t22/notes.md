# t22

fix / style-only. Page: contact.

## Seed

`.form-field` loses its bottom margin (`var(--space-4)`, 16px, becomes `0`). The labels of the
contact form sit directly under the field above them and the form is 80px shorter.

## Fixed means

16px between each field and the next label, as on the spacing scale, and everything below the form
back where it was.

## Wrong fix

Half the space (`var(--space-2)`, 8px). It looks less cramped, and it is not the design.

## Accepted alternative

`space-as-padding`: 16px of bottom padding on the field instead of margin. The field boxes are 16px
taller; they have no background or border, so nothing looks different. The heights of those boxes
are therefore not required to match.

## Screenshot

Full-page screenshot at 1280x800 shows it: yes
Full-page screenshot at 390x844 shows it: yes
