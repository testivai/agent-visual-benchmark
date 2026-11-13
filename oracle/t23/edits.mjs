// One line for TASKS.md.
export const summary = "Centre the team cards. The card component is shared with three other pages.";

const pages = 'site/css/pages.css';
const components = 'site/css/components.css';

export default {
  seed: [],
  reference: [
    { file: pages, find: '.timeline {\n  padding-left', replace: '.member .card-body {\n  text-align: center;\n}\n\n.member .avatar {\n  margin-right: auto;\n  margin-left: auto;\n}\n\n.timeline {\n  padding-left' },
  ],
  // The careless edit: centres the body of every card on the site.
  wrong: [
    { file: components, find: '.card-body {\n  padding: var(--space-5);\n}', replace: '.card-body {\n  padding: var(--space-5);\n  text-align: center;\n}' },
    { file: pages, find: '  margin-bottom: var(--space-3);\n  border-radius: 50%;', replace: '  margin: 0 auto var(--space-3);\n  border-radius: 50%;' },
  ],
  accepted: {
    'flex-column': [
      { file: pages, find: '.timeline {\n  padding-left', replace: '.member .card-body {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  text-align: center;\n}\n\n.timeline {\n  padding-left' },
    ],
  },
};
