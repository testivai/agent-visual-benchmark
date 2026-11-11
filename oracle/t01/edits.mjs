// One line for TASKS.md.
export const summary = "The \"Most popular\" label on the highlighted plan is painted behind its card.";

const css = 'site/css/pages.css';

export default {
  seed: [
    { file: css, find: '  left: 50%;\n  z-index: 1;\n  padding: 3px 12px;', replace: '  left: 50%;\n  z-index: -1;\n  padding: 3px 12px;' },
  ],
  reference: 'revert',
  // Lifts the label clear of the card instead of bringing it to the front.
  wrong: [
    { file: css, find: '  position: absolute;\n  top: -13px;\n  left: 50%;', replace: '  position: absolute;\n  top: -27px;\n  left: 50%;' },
  ],
  accepted: {
    // Any positive z-index puts the label back in front.
    'higher-z-index': [
      { file: css, find: '  left: 50%;\n  z-index: -1;\n  padding: 3px 12px;', replace: '  left: 50%;\n  z-index: 5;\n  padding: 3px 12px;' },
    ],
  },
};
