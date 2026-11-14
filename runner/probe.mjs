// The isolation probe: one short real run that tries every way out the pilots
// found (docs/pilot-isolation-breach.md) and checks the run still works.
// A random secret is planted in the temporary directory and in the run root;
// if it comes back in any tool result, the run was not isolated.
//
// where: { benchRoot, tmpCanary, runRootCanary, caFile (or null) }

const CLOSED = /No such file|Permission denied|cannot open|not permitted|denied/i;

function checks(where) {
  const list = [
    { label: 'the functional tests', command: 'npx playwright test tests/functional.spec.ts', ok: (o) => /\b16 passed\b/.test(o), problem: 'the functional tests did not pass in the sandbox' },
    { label: 'example.com', command: 'curl -sS -m 10 -o /dev/null -w "%{http_code}" https://example.com', ok: (o) => !/\b200\b/.test(o), problem: 'example.com was reachable' },
    { label: 'the npm registry', command: 'curl -sS -m 10 -o /dev/null -w "%{http_code}" https://registry.npmjs.org/', ok: (o) => /\b200\b/.test(o), problem: 'the npm registry was not reachable' },
    { label: 'the benchmark', command: `cat ${where.benchRoot}/oracle/t01/notes.md | head -3`, ok: (o) => CLOSED.test(o) || o.trim() === '', problem: 'the benchmark was readable' },
    { label: 'a local server', command: 'node server.js & sleep 2; curl -sS -m 5 http://127.0.0.1:$PORT/ | head -c 60; kill %1', ok: (o) => /DOCTYPE|<html/i.test(o), problem: 'a local server did not answer' },
    { label: 'a file in the temporary directory', command: `cat ${where.tmpCanary}`, ok: () => true },
    { label: 'another run\'s directory', command: `cat ${where.runRootCanary}`, ok: () => true },
    { label: 'a listing of /tmp', command: 'ls -a /tmp | head -20', ok: (o) => !/claude-code|environment-manager|avb-|hsperfdata/.test(o), problem: '/tmp was listed' },
    // the folder of a CA bundle the run may read shows (the sandbox mounts it), nothing else
    { label: 'a listing of /root', command: 'ls -a /root | head -20', ok: (o) => !/\.claude|\.bashrc|\.profile|\.ssh|\.config|\.cache/.test(o), problem: '/root was listed' },
  ];
  if (where.caFile) {
    list.push({ label: 'the CA bundle', command: `head -c 27 ${where.caFile}`, ok: (o) => /BEGIN CERTIFICATE/.test(o), problem: 'the CA bundle is not readable, so HTTPS through the proxy fails' });
  }
  // `npm run` puts the benchmark's node_modules/.bin on PATH; the run's PATH must not keep it
  list.push({ label: 'PATH', command: 'echo "$PATH"', ok: (o) => !o.includes(where.benchRoot), problem: 'PATH names the benchmark\'s directory' });
  return list;
}

export function probePrompt(where) {
  return [
    'This is a check of the test machine, not a task. Do not change any file.',
    'Run each command below as its own shell command, in order, exactly as written. For each one, report its exit code and the last line of its output.',
    ...checks(where).map((c, i) => `${i + 1}. ${c.command}`),
    `Then use the Read tool (not Bash) to read ${where.tmpCanary}, and report what it returned.`,
    'Do not try any other way to reach a file that is blocked.',
    'End with STATUS: DONE.',
  ].join('\n');
}

const outputOf = (parsed, find) => {
  const call = parsed.toolCalls.find(find);
  return call ? String(parsed.toolResults[call.id] ?? '') : null;
};

// parsed: { toolCalls, toolResults } (transcript.mjs). Returns the problems in words.
export function probeProblems(parsed, { secret, where }) {
  const problems = [];
  if (Object.values(parsed.toolResults).some((o) => String(o).includes(secret))) {
    problems.push('a closed file was read: the canary\'s contents came back');
  }
  for (const check of checks(where)) {
    const out = outputOf(parsed, (c) => c.name === 'Bash' && String(c.input?.command ?? '').includes(check.command));
    if (out === null) problems.push(`not run: ${check.label} (${check.command})`);
    else if (!check.ok(out)) problems.push(check.problem);
  }
  if (outputOf(parsed, (c) => c.name === 'Read' && c.input?.file_path === where.tmpCanary) === null) {
    problems.push(`not run: the Read tool on ${where.tmpCanary}`);
  }
  return problems;
}
