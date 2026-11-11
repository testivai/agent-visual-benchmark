import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintPrompt, lintPatchForHints, lintTask, lintTaskSet } from './lint.mjs';

const config = {
  pages: ['home', 'pricing', 'products'],
  idPattern: '^t\\d{2}$',
  minTasks: 3,
  fixCategories: ['style-only', 'stacking-order'],
  minPerFixCategory: 1,
  bannedText: ['testivai'],
};

const goodTask = (over = {}) => ({
  id: 't01',
  task: {
    id: 't01', type: 'fix', category: 'style-only', pages: ['pricing'],
    prompt: 'The pricing page looks off since the last change. Can you take a look and fix it?',
  },
  taskFiles: ['seed.patch', 'task.json'],
  oracleFiles: ['collateral.spec.ts', 'notes.md', 'reference.patch', 'score.spec.ts', 'wrong.patch'],
  seedPatch: '+++ b/site/a.css\n+a { color: red; }\n',
  ...over,
});

test('a vague user-style report passes the prompt lint', () => {
  assert.deepEqual(lintPrompt('The pricing page looks off since the last change. Can you take a look and fix it?'), []);
  assert.deepEqual(lintPrompt('The products page looks broken on my phone since yesterday.'), []);
});

test('a design value such as a hex colour or a pixel size is allowed', () => {
  assert.deepEqual(lintPrompt('On the home page, the grey supporting text should be #3d4650.'), []);
  assert.deepEqual(lintPrompt('Rows should have 6px of space above and below the text.'), []);
});

test('selectors are flagged', () => {
  assert.match(lintPrompt('The .btn-primary on pricing looks wrong.').join('\n'), /selector/i);
  assert.match(lintPrompt('Something is wrong with #site-nav on phones.').join('\n'), /selector/i);
  assert.match(lintPrompt('The <h2> looks odd.').join('\n'), /tag/i);
});

test('file names are flagged', () => {
  assert.match(lintPrompt('pricing.html looks off.').join('\n'), /file name/i);
  assert.match(lintPrompt('Something in css/components.css changed the page.').join('\n'), /file name/i);
});

test('CSS property names and CSS words are flagged', () => {
  for (const p of [
    'The padding of the cards is off.',
    'Check the z-index of the banner.',
    'The border-radius changed.',
    'Set letter-spacing: 0.08em on the headings.',
    'A CSS rule changed the page.',
    'The margin looks wrong.',
  ]) {
    assert.ok(lintPrompt(p).length > 0, p);
  }
});

test('words that name the bug category are flagged', () => {
  for (const p of [
    'The text overflows its box.',
    'The label is clipped.',
    'The web font did not load.',
    'It breaks at the mobile breakpoint.',
    'A card is duplicated.',
    'The header link is missing.',
    'The ribbon is behind the card, a stacking problem.',
    'Everything shifted down, a layout shift.',
    'This is a decoy.',
    'It is just render noise.',
  ]) {
    assert.ok(lintPrompt(p).length > 0, p);
  }
});

test('an empty prompt is flagged', () => {
  assert.match(lintPrompt('  ').join('\n'), /empty/i);
  assert.match(lintPrompt(undefined).join('\n'), /empty/i);
});

test('a seed patch must not carry a hint in the lines it adds', () => {
  assert.deepEqual(lintPatchForHints('+++ b/site/a.css\n+a { color: red; }\n-/* bug here */\n'), []);
  assert.match(lintPatchForHints('+++ b/site/a.css\n+a { color: red; } /* BUG */\n').join('\n'), /bug/i);
  assert.match(lintPatchForHints('+  <!-- TODO: remove -->\n').join('\n'), /todo/i);
  assert.match(lintPatchForHints('+/* seeded for the benchmark */\n').join('\n'), /seed/i);
});

test('a well-formed task has no lint problems', () => {
  assert.deepEqual(lintTask(goodTask(), config), []);
});

test('the task directory holds task.json and seed.patch and nothing else', () => {
  const problems = lintTask(goodTask({ taskFiles: ['hint.md', 'seed.patch', 'task.json'] }), config);
  assert.match(problems.join('\n'), /hint\.md/);
  assert.match(lintTask(goodTask({ taskFiles: ['task.json'] }), config).join('\n'), /seed\.patch/);
});

test('the oracle directory must hold every required file', () => {
  const problems = lintTask(goodTask({ oracleFiles: ['score.spec.ts', 'reference.patch', 'notes.md'] }), config);
  assert.match(problems.join('\n'), /collateral\.spec\.ts/);
  assert.match(problems.join('\n'), /wrong\.patch/);
});

test('task.json is checked: id, type, category, pages, prompt', () => {
  const bad = (task) => lintTask(goodTask({ task: { ...goodTask().task, ...task } }), config).join('\n');
  assert.match(bad({ id: 't02' }), /id/i);
  assert.match(bad({ type: 'bugfix' }), /type/i);
  assert.match(bad({ category: 'colour' }), /category/i);
  assert.match(bad({ pages: [] }), /pages/i);
  assert.match(bad({ pages: ['checkout'] }), /checkout/);
  assert.match(bad({ prompt: 'The .card is clipped.' }), /prompt/i);
  assert.match(bad({ extra: 1 }), /extra/);
});

test('change and decoy tasks have their own categories', () => {
  const t = (type, category) => lintTask(goodTask({ task: { ...goodTask().task, type, category } }), config);
  assert.deepEqual(t('change', 'shared-css'), []);
  assert.deepEqual(t('decoy', 'no-defect'), []);
  assert.match(t('change', 'style-only').join('\n'), /category/i);
  assert.match(t('decoy', 'shared-css').join('\n'), /category/i);
});

test('the task id must not say what the task is', () => {
  const problems = lintTask(goodTask({ id: 'font-404', task: { ...goodTask().task, id: 'font-404' } }), config);
  assert.match(problems.join('\n'), /id/i);
});

test('a fix or decoy task needs a seed that changes something; a change task may start clean', () => {
  assert.match(lintTask(goodTask({ seedPatch: '' }), config).join('\n'), /seed\.patch is empty/i);
  const change = goodTask({ seedPatch: '', task: { ...goodTask().task, type: 'change', category: 'shared-css' } });
  assert.deepEqual(lintTask(change, config), []);
});

test('the set needs enough tasks and enough of each fix category', () => {
  const tasks = [
    goodTask(),
    goodTask({ id: 't02', task: { ...goodTask().task, id: 't02' }, seedPatch: '+b{}\n' }),
  ];
  const problems = lintTaskSet(tasks, config).join('\n');
  assert.match(problems, /at least 3 tasks/i);
  assert.match(problems, /stacking-order/);
});

test('two tasks must not share a seed', () => {
  const tasks = [
    goodTask(),
    goodTask({ id: 't02', task: { ...goodTask().task, id: 't02', category: 'stacking-order' } }),
    goodTask({ id: 't03', task: { ...goodTask().task, id: 't03' }, seedPatch: '+c{}\n' }),
  ];
  assert.match(lintTaskSet(tasks, config).join('\n'), /t01 and t02 share a seed/);
});

test('change tasks that all start from the clean app do not count as sharing a seed', () => {
  const change = (id) => goodTask({
    id, seedPatch: '', task: { ...goodTask().task, id, type: 'change', category: 'shared-css' },
  });
  const tasks = [
    goodTask(),
    goodTask({ id: 't02', task: { ...goodTask().task, id: 't02', category: 'stacking-order' }, seedPatch: '+b{}\n' }),
    change('t03'), change('t04'),
  ];
  assert.deepEqual(lintTaskSet(tasks, config), []);
});

test('duplicate ids are reported', () => {
  const tasks = [goodTask(), goodTask({ seedPatch: '+b{}\n' }), goodTask({ id: 't03', task: { ...goodTask().task, id: 't03', category: 'stacking-order' }, seedPatch: '+c{}\n' })];
  assert.match(lintTaskSet(tasks, config).join('\n'), /duplicate id t01/i);
});
