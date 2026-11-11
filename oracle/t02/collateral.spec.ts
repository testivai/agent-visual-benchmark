import { test } from '../lib/fixtures.mjs';

test('the rest of the site is unchanged', async ({ oracle }) => {
  oracle.expectCollateralClean();
});
