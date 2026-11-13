// One line for TASKS.md.
export const summary = "The long email address runs out of its card.";

const css = 'site/css/pages.css';

export default {
  seed: [
    { file: css, find: '.info-list dd {\n  overflow-wrap: anywhere;\n}\n\n', replace: '' },
  ],
  reference: 'revert',
  // Cuts the address short instead of letting it wrap: nothing spills, but half the address is gone.
  wrong: [
    { file: css, find: '.info-list dt:first-child {\n  margin-top: 0;\n}', replace: '.info-list dt:first-child {\n  margin-top: 0;\n}\n\n.info-list dd {\n  overflow: hidden;\n  text-overflow: ellipsis;\n}' },
  ],
  accepted: {
    'break-all': [
      { file: css, find: '.info-list dt:first-child {\n  margin-top: 0;\n}', replace: '.info-list dt:first-child {\n  margin-top: 0;\n}\n\n.info-list dd {\n  word-break: break-all;\n}' },
    ],
  },
};
