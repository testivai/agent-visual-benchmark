// One line for TASKS.md.
export const summary = "The font rule declares the regular weight only, so bold text is a thickened regular.";

const css = 'site/css/tokens.css';

export default {
  seed: [
    { file: css, find: '  font-weight: 300 900;\n', replace: '  font-weight: 400;\n' },
  ],
  reference: 'revert',
  // Stops the browser faking bold: no smeared letters, and nothing on the site is bold any more.
  wrong: [
    { file: 'site/css/base.css', find: '  background: var(--color-bg);\n}', replace: '  background: var(--color-bg);\n  font-synthesis: none;\n}' },
  ],
  accepted: {
    'wider-range': [
      { file: css, find: '  font-weight: 400;\n', replace: '  font-weight: 100 900;\n' },
    ],
  },
};
