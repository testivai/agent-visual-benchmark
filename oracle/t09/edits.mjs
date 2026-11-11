// One line for TASKS.md.
export const summary = "Two stray line breaks push the orders table down.";

const html = 'site/orders.html';
const heading = '        <h2 class="section-title">Recent orders</h2>\n';

export default {
  seed: [{ file: html, find: heading, replace: `        <br>\n        <br>\n${heading}` }],
  reference: 'revert',
  // Pulls the heading back up by a guessed amount instead of removing what was inserted.
  wrong: [
    { file: html, find: heading, replace: '        <h2 class="section-title" style="margin-top: -40px">Recent orders</h2>\n' },
  ],
};
