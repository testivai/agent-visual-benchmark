import { test } from 'node:test';
import assert from 'node:assert/strict';
import { studyTwo } from './study.mjs';
import { PROMPT } from './arms.mjs';
import { DRIFT_SETTINGS } from '../drift.mjs';

const TASKS = [
  { id: 's2t01', stratum: 'S2', site: 'bare', drift: false, mutations: [{ valueStart: 1 }, { valueStart: 2 }] },
  { id: 's2t02', stratum: 'S3', site: 'bare', drift: true, mutations: [{ valueStart: 1 }] },
  { id: 's2t03', stratum: 'S4', site: 'agency', drift: true, mutations: [] },
];
const study = studyTwo({ tasks: TASKS });
const run = (task, arm) => ({ runId: 'r', task, arm, repeat: 1 });

test('each run gets the one prompt; the record says fix or decoy, and the stratum', () => {
  assert.deepEqual(study.task({ run: run('s2t01', 'B') }), { id: 's2t01', prompt: PROMPT, type: 'fix', category: 'S2' });
  assert.deepEqual(study.task({ run: run('s2t03', 'C') }), { id: 's2t03', prompt: PROMPT, type: 'decoy', category: 'S4' });
  assert.throws(() => study.task({ run: run('s2t99', 'B') }), /no study 2 task s2t99/);
});

test('one template per site, arm and baselines: drifted for the drift strata, with the chosen setting', () => {
  assert.equal(study.drift.name, 'font-hinting-full', 'the setting in study2/drift.json');
  assert.ok(DRIFT_SETTINGS.includes(study.drift));
  assert.equal(study.templateKey(run('s2t01', 'B')), 'bare/B/clean');
  assert.equal(study.templateKey(run('s2t02', 'B')), 'bare/B/font-hinting-full');
  assert.equal(study.templateKey(run('s2t03', 'C')), 'agency/C/font-hinting-full');
});

test('the record adds the site, the stratum, partial credit and what the oracle measured', () => {
  const scored = { partial: { restored: 1, of: 2, share: 0.5, each: [true, false] }, siteFilesChanged: ['site/css/styles.css'], measured: { notRestored: 3, collateral: 0 } };
  assert.deepEqual(study.recordFields(scored, run('s2t01', 'C')), {
    site: 'bare', stratum: 'S2', drift: false, partial_credit: scored.partial, site_files: ['site/css/styles.css'], measured: { notRestored: 3, collateral: 0 },
  });
});
