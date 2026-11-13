// One line for TASKS.md.
export const summary = "Secondary buttons have white text on a white button, on every page that has one.";

const components = 'site/css/components.css';

export default {
  seed: [
    { file: components, find: '.btn-secondary {\n  background: var(--color-surface);\n  color: var(--color-ink);', replace: '.btn-secondary {\n  background: var(--color-surface);\n  color: var(--color-surface);' },
  ],
  reference: 'revert',
  // Fixes the buttons on the page the report names, and leaves the same button broken everywhere else.
  wrong: [
    { file: 'site/css/pages.css', find: '.bundles {', replace: '.product .btn-secondary {\n  color: var(--color-ink);\n}\n\n.bundles {' },
  ],
  accepted: {
    'same-colour-written-out': [
      { file: components, find: '.btn-secondary {\n  background: var(--color-surface);\n  color: var(--color-surface);', replace: '.btn-secondary {\n  background: var(--color-surface);\n  color: #1f2328;' },
    ],
  },
};
