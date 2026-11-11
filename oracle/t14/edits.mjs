// One line for TASKS.md.
export const summary = "The Total heading of the orders table is gone.";

const html = 'site/orders.html';

export default {
  seed: [
    { file: html, find: '                <th class="num">Total</th>\n', replace: '' },
  ],
  reference: 'revert',
  // Adds an empty heading cell: the columns line up again, and the amounts still have no heading.
  wrong: [
    { file: html, find: '                <th>Status</th>\n', replace: '                <th>Status</th>\n                <th class="num"></th>\n' },
  ],
};
