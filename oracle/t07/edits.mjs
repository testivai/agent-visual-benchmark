// One line for TASKS.md.
export const summary = "Make the highlighted plan's button green. Its class is the primary button of every page.";

const pages = 'site/css/pages.css';
const components = 'site/css/components.css';

export default {
  seed: [],
  reference: [
    { file: pages, find: '.plan .btn {\n  width: 100%;\n}', replace: '.plan .btn {\n  width: 100%;\n}\n\n.plan-featured .btn {\n  background: var(--color-success);\n}' },
  ],
  // The careless edit: recolours the shared primary button, so every primary button on the site turns green.
  wrong: [
    { file: components, find: '.btn-primary {\n  background: var(--color-brand);', replace: '.btn-primary {\n  background: var(--color-success);' },
  ],
  accepted: {
    'new-button-variant': [
      { file: components, find: '.btn-secondary {\n  background: var(--color-surface);', replace: '.btn-success {\n  background: var(--color-success);\n  color: #ffffff;\n}\n\n.btn-secondary {\n  background: var(--color-surface);' },
      { file: 'site/pricing.html', find: '<a class="btn btn-primary" href="contact.html">Choose Pro</a>', replace: '<a class="btn btn-success" href="contact.html">Choose Pro</a>' },
    ],
  },
};
