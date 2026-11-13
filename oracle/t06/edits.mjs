// One line for TASKS.md.
export const summary = "One product card is in the page twice.";

const html = 'site/products.html';

const mug = `          <div class="card product">
            <div class="card-thumb thumb-2"></div>
            <div class="card-body">
              <h3>Sunset Mug</h3>
              <p>Keeps coffee warm through a long meeting.</p>
              <div class="card-foot">
                <span class="price">$18</span>
                <a class="btn btn-secondary btn-sm" href="contact.html">Add to cart</a>
              </div>
            </div>
          </div>
`;
const twice = mug + mug;

export default {
  seed: [{ file: html, find: mug, replace: twice }],
  reference: 'revert',
  // Hides the second copy with CSS. The grid looks right; the duplicate is still in the page.
  wrong: [
    { file: 'site/css/pages.css', find: '.bundles {', replace: '.cards .product:nth-child(3) {\n  display: none;\n}\n\n.bundles {' },
  ],
};
