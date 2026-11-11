// What each task must do on its three states before it is allowed in the set.
// Pure: takes the outcomes the runner measured, returns the problems in words.
//
//   seed       clean app + seed.patch (what the agent starts from)
//   reference  seed + reference.patch (one correct solution)
//   wrong      seed + wrong.patch     (a fix that only hides the symptom)
//
// An outcome is 'passed', 'failed' or 'error'. 'error' means the spec did not
// run to a verdict (crash, timeout, no tests): it never counts as a fail.

const EXPECT = {
  fix: {
    seed: { score: 'failed', collateral: 'passed', functional: 'passed' },
    reference: { score: 'passed', collateral: 'passed', functional: 'passed' },
  },
  decoy: {
    seed: { score: 'passed', collateral: 'passed', functional: 'passed' },
    reference: { score: 'passed', collateral: 'passed', functional: 'passed' },
  },
};
EXPECT.change = EXPECT.fix;

const WORD = { passed: 'pass', failed: 'fail' };

function checkState(state, outcomes, expected) {
  const problems = [];
  for (const [spec, want] of Object.entries(expected)) {
    const got = outcomes?.[spec];
    if (got === undefined) {
      problems.push(`${state}: ${spec} outcome is missing`);
    } else if (got === 'error') {
      problems.push(`${state}: ${spec} ended in an error, not a verdict`);
    } else if (got !== want) {
      problems.push(`${state}: ${spec} must ${WORD[want]}, but it ${got}`);
    }
  }
  return problems;
}

function checkWrong(outcomes) {
  const problems = [];
  for (const spec of ['score', 'collateral']) {
    if (outcomes?.[spec] === undefined) problems.push(`wrong: ${spec} outcome is missing`);
    if (outcomes?.[spec] === 'error') problems.push(`wrong: ${spec} ended in an error, not a verdict`);
  }
  const caught = outcomes?.score === 'failed' || outcomes?.collateral === 'failed';
  if (!caught) {
    problems.push('wrong: at least one of score and collateral must fail on the wrong fix, and neither did');
  }
  return problems;
}

export function checkTaskOutcomes({ type, seed, reference, wrong }) {
  const expected = EXPECT[type];
  if (!expected) return [`unknown task type "${type}"`];
  return [
    ...checkState('seed', seed, expected.seed),
    ...checkState('reference', reference, expected.reference),
    ...checkWrong(wrong),
  ];
}
