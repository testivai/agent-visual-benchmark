// One line for TASKS.md.
export const summary = "The stats strip that overlaps the hero is painted behind it.";

const css = 'site/css/pages.css';

export default {
  seed: [
    { file: css, find: '.stats-overlap {\n  position: relative;\n  z-index: 1;\n  margin-top: -56px;\n}', replace: '.stats-overlap {\n  margin-top: -56px;\n}' },
  ],
  reference: 'revert',
  // Stops the strip overlapping the hero instead of bringing it to the front.
  wrong: [
    { file: css, find: '.stats-overlap {\n  margin-top: -56px;\n}', replace: '.stats-overlap {\n  margin-top: var(--space-5);\n}' },
  ],
  accepted: {
    'other-z-index': [
      { file: css, find: '.stats-overlap {\n  margin-top: -56px;\n}', replace: '.stats-overlap {\n  position: relative;\n  z-index: 3;\n  margin-top: -56px;\n}' },
    ],
  },
};
