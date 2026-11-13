// One line for TASKS.md.
export const summary = "On a phone the three plans stay side by side instead of stacking.";

const css = 'site/css/pages.css';

export default {
  seed: [
    { file: css, find: '  .bundles,\n  .plans,\n  .faq,', replace: '  .bundles,\n  .faq,' },
  ],
  reference: 'revert',
  // Two columns instead of three: less cramped, still not the one column of the design.
  wrong: [
    { file: css, find: '  .feature-art {\n    height: 160px;\n  }', replace: '  .feature-art {\n    height: 160px;\n  }\n\n  .plans {\n    grid-template-columns: repeat(2, 1fr);\n  }' },
  ],
  accepted: {
    'own-rule': [
      { file: css, find: '  .feature-art {\n    height: 160px;\n  }', replace: '  .feature-art {\n    height: 160px;\n  }\n\n  .plans {\n    grid-template-columns: 1fr;\n  }' },
    ],
  },
};
