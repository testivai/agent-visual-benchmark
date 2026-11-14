import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withTempDir } from './tempdir.mjs';

test('the directory is there while the work runs and gone after it, whether the work succeeds or throws', async () => {
  let seen;
  assert.equal(await withTempDir('avb-test-', async (dir) => { seen = dir; assert.ok(fs.existsSync(dir)); return 7; }), 7);
  assert.ok(!fs.existsSync(seen));
  await assert.rejects(withTempDir('avb-test-', async (dir) => { seen = dir; throw new Error('the build failed'); }), /the build failed/);
  assert.ok(!fs.existsSync(seen), 'a failed build leaves nothing behind');
});
