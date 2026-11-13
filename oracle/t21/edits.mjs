// One line for TASKS.md.
export const summary = "Set the products page's section headings in capitals. Their class is used on every page.";

const pages = 'site/css/pages.css';
const style = '  font-size: 16px;\n  letter-spacing: 0.08em;\n  text-transform: uppercase;\n';

export default {
  seed: [],
  reference: [
    { file: pages, find: '/* Products */\n', replace: `/* Products */\n\n.page-products .section-title {\n${style}}\n` },
  ],
  // The careless edit: restyles the shared heading class, so the section headings of every page change.
  wrong: [
    { file: 'site/css/base.css', find: '.section-title {\n  margin-bottom: var(--space-5);\n}', replace: `.section-title {\n  margin-bottom: var(--space-5);\n${style}}` },
  ],
  accepted: {
    'by-heading-level': [
      { file: pages, find: '/* Products */\n', replace: `/* Products */\n\n.page-products h2 {\n${style}}\n` },
    ],
  },
};
