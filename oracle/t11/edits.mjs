// One line for TASKS.md.
export const summary = "Darken the grey text on the home page. The grey is one token used by every page.";

const pages = 'site/css/pages.css';

export default {
  seed: [],
  reference: [
    { file: pages, find: '/* Home */\n', replace: '/* Home */\n\n.page-home main {\n  --color-muted: #3d4650;\n}\n' },
  ],
  // The careless edit: changes the token, so the grey text of every page changes.
  wrong: [
    { file: 'site/css/tokens.css', find: '--color-muted: #59636e;', replace: '--color-muted: #3d4650;' },
  ],
  accepted: {
    // The whole page, footer included.
    'whole-page': [
      { file: pages, find: '/* Home */\n', replace: '/* Home */\n\n.page-home {\n  --color-muted: #3d4650;\n}\n' },
    ],
    // Only the descriptions named in the request.
    'named-descriptions-only': [
      { file: pages, find: '/* Home */\n', replace: '/* Home */\n\n.page-home .lede,\n.page-home .card p {\n  color: #3d4650;\n}\n' },
    ],
  },
};
