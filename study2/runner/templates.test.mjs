import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { templateKey, templateName, driftEnv, leakProblems } from './templates.mjs';
import { DRIFT_SETTINGS } from '../drift.mjs';
import { withTempDir } from '../../runner/tempdir.mjs';

const HINTING = DRIFT_SETTINGS[0];

test('a template per site, arm and baselines (clean or drifted); its key changes with any of them', () => {
  const key = (o) => templateKey({ site: 'bare', arm: 'B', drift: null, ...o });
  assert.equal(key({}), key({}), 'stable');
  const keys = [key({}), key({ site: 'agency' }), key({ arm: 'C' }), key({ drift: HINTING }), key({ drift: DRIFT_SETTINGS[1] })];
  assert.equal(new Set(keys).size, keys.length);
  assert.match(templateName({ site: 'bare', arm: 'B', drift: null }), /^s2-bare-B-clean-[0-9a-f]{16}$/);
  assert.match(templateName({ site: 'bare', arm: 'C', drift: HINTING }), /^s2-bare-C-font-hinting-full-[0-9a-f]{16}$/);
});

test('drifted baselines are recorded with the setting\'s fontconfig; clean ones with nothing added', async () => {
  await withTempDir('avb-s2-env-', (dir) => {
    assert.deepEqual(driftEnv(null, dir), {});
    const env = driftEnv(HINTING, dir);
    assert.deepEqual(Object.keys(env), ['FONTCONFIG_FILE']);
    assert.match(fs.readFileSync(env.FONTCONFIG_FILE, 'utf8'), /hintfull/);
    assert.throws(() => driftEnv(DRIFT_SETTINGS[2], dir), /only font settings/);
  });
});

test('nothing in a template may tell the agent how its baselines were recorded', async () => {
  await withTempDir('avb-s2-leak-', (dir) => {
    const base = path.join(dir, '.testivai', 'baselines', 'home-desktop');
    fs.mkdirSync(base, { recursive: true });
    fs.writeFileSync(path.join(base, 'metadata.json'), '{"environment":{"os":{"platform":"linux"}}}');
    assert.deepEqual(leakProblems(dir, { holder: '/tmp/avb-template-x' }), []);
    fs.writeFileSync(path.join(base, 'metadata.json'), '{"env":"FONTCONFIG_FILE=/tmp/avb-template-x/fonts.conf"}');
    assert.deepEqual(leakProblems(dir, { holder: '/tmp/avb-template-x' }), [
      '.testivai/baselines/home-desktop/metadata.json mentions "/tmp/avb-template-x"',
      '.testivai/baselines/home-desktop/metadata.json mentions "fonts.conf"',
      '.testivai/baselines/home-desktop/metadata.json mentions "FONTCONFIG"',
    ]);
  });
});
