// One line for TASKS.md.
export const summary = "Make the Send message button as wide as the form. The form rule it uses also styles the newsletter form on the home page.";

const pages = 'site/css/pages.css';
const components = 'site/css/components.css';

export default {
  seed: [],
  reference: [
    { file: pages, find: '.info-list dt {', replace: '.page-contact .form .btn {\n  width: 100%;\n}\n\n.info-list dt {' },
  ],
  // The careless edit: widens the button of every form, the newsletter form on the home page included.
  wrong: [
    { file: components, find: '.form .btn {\n  min-width: 140px;\n}', replace: '.form .btn {\n  width: 100%;\n  min-width: 140px;\n}' },
  ],
  accepted: {
    'block-button-class': [
      { file: components, find: '.btn[disabled] {', replace: '.btn-block {\n  display: flex;\n  width: 100%;\n}\n\n.btn[disabled] {' },
      { file: 'site/contact.html', find: '<button class="btn btn-primary" type="submit">Send message</button>', replace: '<button class="btn btn-primary btn-block" type="submit">Send message</button>' },
    ],
  },
};
