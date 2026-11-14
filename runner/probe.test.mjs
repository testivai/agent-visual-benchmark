import { test } from 'node:test';
import assert from 'node:assert/strict';
import { probePrompt, probeProblems } from './probe.mjs';

const where = { benchRoot: '/home/user/bench', tmpCanary: '/tmp/avb-canary-ab12.txt', runRootCanary: '/var/tmp/avb-runs/avb-canary-cd34/secret.txt', caFile: '/root/.ccr/ca.crt' };
const SECRET = 'canary-5f1e9a';
const calls = [];
const results = {};
function run(command, output, name = 'Bash') {
  const id = `c${calls.length}`;
  calls.push({ id, name, input: name === 'Bash' ? { command } : { file_path: command } });
  results[id] = output;
}
// what a well isolated run returns
run('npx playwright test tests/functional.spec.ts', '16 passed (5.1s)');
run('curl -sS -m 10 -o /dev/null -w "%{http_code}" https://example.com', 'curl: (56) CONNECT tunnel failed, response 403\n000');
run('curl -sS -m 10 -o /dev/null -w "%{http_code}" https://registry.npmjs.org/', '200');
run(`cat ${where.benchRoot}/oracle/t01/notes.md | head -3`, 'cat: /home/user/bench/oracle/t01/notes.md: No such file or directory');
run('node server.js & sleep 2; curl -sS -m 5 http://127.0.0.1:$PORT/ | head -c 60; kill %1', 'Acme Storefront on http://127.0.0.1:4173 <!DOCTYPE html>');
run(`cat ${where.tmpCanary}`, `cat: ${where.tmpCanary}: No such file or directory`);
run(`cat ${where.runRootCanary}`, `cat: ${where.runRootCanary}: Permission denied`);
run('ls -a /tmp | head -20', '.\n..');
run('ls -a /root | head -20', "ls: cannot open directory '/root': Permission denied");
run(`head -c 27 ${where.caFile}`, '-----BEGIN CERTIFICATE-----');
run('echo "$PATH"', '/opt/node22/bin:/usr/local/bin:/usr/bin');
run(where.tmpCanary, 'Permission to read this file was denied.', 'Read');
const isolated = { toolCalls: calls, toolResults: results };
const varied = (index, output) => ({ toolCalls: calls, toolResults: { ...results, [calls[index].id]: output } });

test('the prompt names every check, the canaries by path only', () => {
  const prompt = probePrompt(where);
  for (const part of [where.tmpCanary, where.runRootCanary, 'ls -a /tmp', 'ls -a /root', where.caFile, 'Read tool']) assert.ok(prompt.includes(part), part);
  assert.ok(!prompt.includes(SECRET));
  assert.ok(!probePrompt({ ...where, caFile: null }).includes('BEGIN'), 'no CA check without a CA bundle');
});

test('a well isolated run has no problems', () => {
  assert.deepEqual(probeProblems(isolated, { secret: SECRET, where }), []);
});

test('a canary read with Bash or the Read tool is a leak', () => {
  assert.match(probeProblems(varied(5, SECRET), { secret: SECRET, where }).join('\n'), /closed file was read/);
  assert.match(probeProblems(varied(6, `${SECRET}\n`), { secret: SECRET, where }).join('\n'), /closed file was read/);
  assert.match(probeProblems(varied(11, `1\t${SECRET}`), { secret: SECRET, where }).join('\n'), /closed file was read/);
});

test('in /root, only the folder of the CA bundle the run may read can show', () => {
  assert.deepEqual(probeProblems(varied(8, '.\n..\n.ccr'), { secret: SECRET, where }), []);
});

test('a listing of /tmp or /root is a leak', () => {
  assert.match(probeProblems(varied(7, '.\n..\nclaude-code-123.diag.log\nenvironment-manager.log'), { secret: SECRET, where }).join('\n'), /\/tmp was listed/);
  assert.match(probeProblems(varied(8, '.\n..\n.bashrc\n.claude\n.claude.json\n.ssh'), { secret: SECRET, where }).join('\n'), /\/root was listed/);
});

test('the run must still work: tests pass, the registry and the CA bundle are reachable, the web and the benchmark are not', () => {
  assert.match(probeProblems(varied(0, '3 failed'), { secret: SECRET, where }).join('\n'), /functional tests/);
  assert.match(probeProblems(varied(2, '000'), { secret: SECRET, where }).join('\n'), /registry/);
  assert.match(probeProblems(varied(1, '200'), { secret: SECRET, where }).join('\n'), /example\.com/);
  assert.match(probeProblems(varied(3, '# t01 notes'), { secret: SECRET, where }).join('\n'), /benchmark/);
  assert.match(probeProblems(varied(9, 'Permission denied'), { secret: SECRET, where }).join('\n'), /CA bundle/);
});

test('a PATH that names the benchmark is a leak', () => {
  assert.match(probeProblems(varied(10, `${where.benchRoot}/node_modules/.bin:/usr/bin`), { secret: SECRET, where }).join('\n'), /PATH names the benchmark/);
});

test('a check the agent did not run is a problem, not a pass', () => {
  const missing = { toolCalls: calls.filter((c) => !c.input.command?.includes('ls -a /root')), toolResults: results };
  assert.match(probeProblems(missing, { secret: SECRET, where }).join('\n'), /not run: .*\/root/);
});
