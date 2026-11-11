import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { withLock } from './lock.mjs';

test('withLock runs one holder at a time and releases on error', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avb-lock-'));
  const file = path.join(dir, 'thing');
  const order = [];
  const slow = (name) => withLock(file, async () => {
    order.push(`${name}+`);
    await new Promise((d) => setTimeout(d, 100));
    order.push(`${name}-`);
  });
  await Promise.all([slow('a'), slow('b')]);
  assert.ok(['a+,a-,b+,b-', 'b+,b-,a+,a-'].includes(order.join(',')), order.join(','));
  await assert.rejects(() => withLock(file, async () => { throw new Error('inside'); }), /inside/);
  assert.equal(await withLock(file, async () => 'free again'), 'free again');
});
