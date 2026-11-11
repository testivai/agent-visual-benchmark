import { test } from '../lib/fixtures.mjs';

test('nothing was wrong, so no file under site/ is changed', async ({ oracle }) => {
  oracle.expectSourceUnchanged();
});
