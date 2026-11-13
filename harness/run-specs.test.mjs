import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReport } from './run-specs.mjs';

const root = '/bench/oracle';
const spec = (title, ok, results) => ({ title, ok, tests: [{ results }] });
const passed = [{ status: 'passed' }];
const failed = (message = 'Error: expect(received).toBe(expected)') => [{ status: 'failed', error: { message } }];
const report = (suites, errors = []) => ({ config: { rootDir: root }, suites, errors });

test('a file whose tests all pass is passed', () => {
  const out = summarizeReport(
    report([{ file: 't01/score.spec.ts', specs: [spec('a', true, passed), spec('b', true, passed)] }]),
    ['/bench/oracle/t01/score.spec.ts'],
  );
  assert.equal(out['/bench/oracle/t01/score.spec.ts'].status, 'passed');
  assert.equal(out['/bench/oracle/t01/score.spec.ts'].tests, 2);
});

test('one failing assertion makes the file failed, and keeps the message without colour codes', () => {
  const out = summarizeReport(
    report([{ file: 't01/score.spec.ts', specs: [spec('a', true, passed), spec('b', false, failed('Error: \u001b[31mexpected\u001b[39m 1'))] }]),
    ['/bench/oracle/t01/score.spec.ts'],
  );
  const r = out['/bench/oracle/t01/score.spec.ts'];
  assert.equal(r.status, 'failed');
  assert.deepEqual(r.failures, [{ title: 'b', message: 'Error: expected 1' }]);
});

test('tests inside describe blocks are counted', () => {
  const out = summarizeReport(
    report([{ file: 't01/score.spec.ts', specs: [], suites: [{ file: 't01/score.spec.ts', specs: [spec('nested', false, failed())], suites: [] }] }]),
    ['/bench/oracle/t01/score.spec.ts'],
  );
  assert.equal(out['/bench/oracle/t01/score.spec.ts'].status, 'failed');
});

test('each requested file gets its own outcome', () => {
  const out = summarizeReport(
    report([
      { file: 't01/score.spec.ts', specs: [spec('a', false, failed())] },
      { file: 't01/collateral.spec.ts', specs: [spec('a', true, passed)] },
    ]),
    ['/bench/oracle/t01/score.spec.ts', '/bench/oracle/t01/collateral.spec.ts'],
  );
  assert.equal(out['/bench/oracle/t01/score.spec.ts'].status, 'failed');
  assert.equal(out['/bench/oracle/t01/collateral.spec.ts'].status, 'passed');
});

test('a file that ran no tests is an error, not a pass', () => {
  const out = summarizeReport(report([]), ['/bench/oracle/t01/score.spec.ts']);
  assert.equal(out['/bench/oracle/t01/score.spec.ts'].status, 'error');
  assert.match(out['/bench/oracle/t01/score.spec.ts'].failures[0].message, /no tests/i);
});

test('a file whose tests were all skipped is an error', () => {
  const out = summarizeReport(
    report([{ file: 't01/score.spec.ts', specs: [spec('a', true, [{ status: 'skipped' }])] }]),
    ['/bench/oracle/t01/score.spec.ts'],
  );
  assert.equal(out['/bench/oracle/t01/score.spec.ts'].status, 'error');
});

test('a timeout or an interrupted test is an error, not a fail', () => {
  for (const status of ['timedOut', 'interrupted']) {
    const out = summarizeReport(
      report([{ file: 't01/score.spec.ts', specs: [spec('a', false, [{ status, error: { message: 'Test timeout' } }])] }]),
      ['/bench/oracle/t01/score.spec.ts'],
    );
    assert.equal(out['/bench/oracle/t01/score.spec.ts'].status, 'error', status);
  }
});

test('a scorer infrastructure error is an error, even next to a real failure', () => {
  const out = summarizeReport(
    report([{ file: 't01/score.spec.ts', specs: [
      spec('a', false, failed()),
      spec('b', false, failed('Error: ORACLE_INFRA: BENCH_APP_DIR is not set')),
    ] }]),
    ['/bench/oracle/t01/score.spec.ts'],
  );
  assert.equal(out['/bench/oracle/t01/score.spec.ts'].status, 'error');
});

test('a report-level error (a spec that does not compile) makes every file an error', () => {
  const out = summarizeReport(
    report(
      [{ file: 't01/collateral.spec.ts', specs: [spec('a', true, passed)] }],
      [{ message: 'SyntaxError: Unexpected token' }],
    ),
    ['/bench/oracle/t01/score.spec.ts', '/bench/oracle/t01/collateral.spec.ts'],
  );
  assert.equal(out['/bench/oracle/t01/score.spec.ts'].status, 'error');
  assert.equal(out['/bench/oracle/t01/collateral.spec.ts'].status, 'error');
  assert.match(out['/bench/oracle/t01/score.spec.ts'].failures[0].message, /SyntaxError/);
});

test('a retried test that failed first and passed later is an error: scorers must be deterministic', () => {
  const out = summarizeReport(
    report([{ file: 't01/score.spec.ts', specs: [spec('a', true, [...failed(), ...passed])] }]),
    ['/bench/oracle/t01/score.spec.ts'],
  );
  assert.equal(out['/bench/oracle/t01/score.spec.ts'].status, 'error');
});

test('no report at all is an error for every file', () => {
  const out = summarizeReport(null, ['/bench/oracle/t01/score.spec.ts'], 'playwright exited with code 2');
  assert.equal(out['/bench/oracle/t01/score.spec.ts'].status, 'error');
  assert.match(out['/bench/oracle/t01/score.spec.ts'].failures[0].message, /code 2/);
});
