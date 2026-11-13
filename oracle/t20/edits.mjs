// One line for TASKS.md.
export const summary = "On a phone the About page's story stays in two columns, so the picture runs off the screen.";

const css = 'site/css/pages.css';
const duplicate = '\n.story {\n  grid-template-columns: 1fr 480px;\n}\n';

export default {
  // A copy of an existing rule, added after the media query. It changes nothing at desktop width.
  seed: [{ file: css, append: duplicate }],
  reference: 'revert',
  // Hides what runs off the screen. The page no longer scrolls sideways; the story is still two squeezed columns.
  wrong: [
    { file: css, find: duplicate, replace: '\n.story {\n  grid-template-columns: 1fr 480px;\n  overflow: hidden;\n}\n' },
  ],
  accepted: {
    // Keeps the added rule and repeats the phone rule after it.
    'phone-rule-after-it': [
      { file: css, append: '\n@media (max-width: 720px) {\n  .story {\n    grid-template-columns: 1fr;\n  }\n}\n' },
    ],
  },
};
