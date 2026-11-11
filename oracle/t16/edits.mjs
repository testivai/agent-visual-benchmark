// One line for TASKS.md.
export const summary = "Tighten the rows of the orders table. The table component is also the plan comparison on the pricing page.";

const pages = 'site/css/pages.css';
const components = 'site/css/components.css';
const rule = (selector) => `${selector} {\n  padding-top: 6px;\n  padding-bottom: 6px;\n}`;

export default {
  seed: [],
  reference: [
    { file: pages, find: '.table-tools {', replace: `${rule('.page-orders .table td')}\n\n.table-tools {` },
  ],
  // The careless edit: tightens every table on the site.
  wrong: [
    { file: components, find: '.table tbody tr:last-child td {', replace: `${rule('.table td')}\n\n.table tbody tr:last-child td {` },
  ],
  accepted: {
    'compact-table-class': [
      { file: components, find: '.table tbody tr:last-child td {', replace: `${rule('.table-compact td')}\n\n.table tbody tr:last-child td {` },
      { file: 'site/orders.html', find: '<table class="table">', replace: '<table class="table table-compact">' },
    ],
  },
};
