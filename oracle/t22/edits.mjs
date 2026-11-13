// One line for TASKS.md.
export const summary = "The space between the contact form's fields is gone.";

const css = 'site/css/components.css';

export default {
  seed: [
    { file: css, find: '.form-field {\n  margin-bottom: var(--space-4);\n}', replace: '.form-field {\n  margin-bottom: 0;\n}' },
  ],
  reference: 'revert',
  // Puts some space back, but half of what the design has.
  wrong: [
    { file: css, find: '.form-field {\n  margin-bottom: 0;\n}', replace: '.form-field {\n  margin-bottom: var(--space-2);\n}' },
  ],
  accepted: {
    // The same space as padding instead of margin: the fields' boxes are taller, nothing looks different.
    'space-as-padding': [
      { file: css, find: '.form-field {\n  margin-bottom: 0;\n}', replace: '.form-field {\n  margin-bottom: 0;\n  padding-bottom: var(--space-4);\n}' },
    ],
  },
};
