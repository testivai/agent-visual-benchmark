// One line for TASKS.md.
export const summary = "The New and Sale badges are cut off by their cards.";

const css = 'site/css/components.css';

export default {
  seed: [
    { file: css, find: '.card {\n  position: relative;\n  background: var(--color-surface);', replace: '.card {\n  position: relative;\n  overflow: hidden;\n  background: var(--color-surface);' },
  ],
  reference: 'revert',
  // Moves the badges inside the card, so nothing is cut off, but they no longer hang over the corner.
  wrong: [
    { file: css, find: '.badge {\n  position: absolute;\n  top: -10px;\n  right: -10px;', replace: '.badge {\n  position: absolute;\n  top: 10px;\n  right: 10px;' },
  ],
  accepted: {
    // Leaves the new declaration and switches it off for product cards.
    'override-on-product-cards': [
      { file: css, find: '.card-body {\n  padding: var(--space-5);\n}', replace: '.product {\n  overflow: visible;\n}\n\n.card-body {\n  padding: var(--space-5);\n}' },
    ],
  },
};
