// Static checks on a task: its files, its task.json, and that neither the
// prompt nor the seed gives the answer away. Pure: no file or browser access.

export const TASK_TYPES = ['fix', 'change', 'decoy'];
export const TASK_FILES = ['seed.patch', 'task.json'];
export const ORACLE_FILES = ['collateral.spec.ts', 'notes.md', 'reference.patch', 'score.spec.ts', 'wrong.patch'];
export const CHANGE_CATEGORIES = ['shared-css'];
export const DECOY_CATEGORIES = ['no-defect'];
const TASK_KEYS = ['id', 'type', 'category', 'prompt', 'pages'];

const HEX_COLOUR = /^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

// [what to say, pattern]
const PROMPT_RULES = [
  ['a class selector', /(?:^|[\s(,'"`])\.[A-Za-z_][\w-]*/],
  ['an HTML tag', /<\/?[A-Za-z][\w-]*/],
  ['a file name', /\b[\w./-]*\.(?:css|html?|m?js|ts|json|svg|png|jpe?g|woff2?)\b/i],
  ['a CSS word', /\b(?:css|selectors?|stylesheets?|class(?:es)?|padding|margins?|z-index)\b/i],
  ['a CSS property name', /\b(?:border-radius|background-color|font-size|font-weight|font-family|line-height|letter-spacing|text-transform|text-align|text-decoration|white-space|box-shadow|max-width|min-width|max-height|min-height|flex-direction|grid-template[\w-]*|overflow-[xy]|object-fit|align-items|justify-content)\b/i],
  ['a CSS declaration', /\b(?:color|background|width|height|display|position|top|left|right|bottom|opacity|border|gap|float)\s*:\s*\S/i],
  ['a word that names the bug category', /\b(?:overflow\w*|clip(?:s|ped|ping)?|fonts?|typefaces?|breakpoints?|media quer\w+|responsive|viewports?|duplicat\w*|missing|stacking|stack order|layout shift\w*|decoys?|noise|anti-?alias\w*|regress\w*)\b/i],
];

function idSelectors(prompt) {
  const found = [];
  for (const m of prompt.matchAll(/(?:^|[\s(,'"`])#([A-Za-z_][\w-]*)/g)) {
    if (!HEX_COLOUR.test(m[1])) found.push(`#${m[1]}`);
  }
  return found;
}

export function lintPrompt(prompt) {
  if (typeof prompt !== 'string' || prompt.trim() === '') return ['the prompt is empty'];
  const problems = [];
  for (const [what, pattern] of PROMPT_RULES) {
    const m = prompt.match(pattern);
    if (m) problems.push(`the prompt contains ${what}: "${m[0].trim()}"`);
  }
  for (const sel of idSelectors(prompt)) problems.push(`the prompt contains an id selector: "${sel}"`);
  return problems;
}

const HINT = /\b(?:bug|fixme|todo|hack|xxx|broken|seed(?:ed)?|oracle|benchmark|decoy|regression)\b/i;

export function lintPatchForHints(patch) {
  const problems = [];
  for (const line of String(patch ?? '').split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    const m = line.match(HINT);
    if (m) problems.push(`the seed adds a line with the hint word "${m[0]}": ${line.slice(1).trim()}`);
  }
  return problems;
}

function categoriesFor(type, config) {
  if (type === 'fix') return config.fixCategories ?? [];
  if (type === 'change') return CHANGE_CATEGORIES;
  return DECOY_CATEGORIES;
}

function lintTaskJson(id, task, config) {
  const problems = [];
  if (task.id !== id) problems.push(`task.json id "${task.id}" does not match the directory "${id}"`);
  for (const key of Object.keys(task)) {
    if (!TASK_KEYS.includes(key)) problems.push(`task.json has an unknown key "${key}"`);
  }
  if (!TASK_TYPES.includes(task.type)) {
    problems.push(`task.json type "${task.type}" is not one of ${TASK_TYPES.join(', ')}`);
  } else if (!categoriesFor(task.type, config).includes(task.category)) {
    problems.push(`task.json category "${task.category}" is not a ${task.type} category (${categoriesFor(task.type, config).join(', ')})`);
  }
  if (!Array.isArray(task.pages) || task.pages.length === 0) {
    problems.push('task.json pages must list at least one page');
  } else {
    for (const page of task.pages) {
      if (!config.pages.includes(page)) problems.push(`task.json pages names an unknown page "${page}"`);
    }
  }
  return [...problems, ...lintPrompt(task.prompt).map((p) => `prompt: ${p}`)];
}

function lintFiles(found, required, where, exact) {
  const problems = [];
  for (const file of required) {
    if (!found.includes(file)) problems.push(`${where} is missing ${file}`);
  }
  if (exact) {
    for (const file of found) {
      if (!required.includes(file)) problems.push(`${where} must hold nothing but ${required.join(' and ')}: found ${file}`);
    }
  }
  return problems;
}

export function lintTask({ id, task, taskFiles, oracleFiles, seedPatch }, config) {
  const problems = [];
  if (!new RegExp(config.idPattern ?? '.').test(id)) {
    problems.push(`the task id "${id}" must match ${config.idPattern} (an id must not say what the task is)`);
  }
  problems.push(...lintTaskJson(id, task ?? {}, config));
  problems.push(...lintFiles(taskFiles, TASK_FILES, 'the task directory', true));
  problems.push(...lintFiles(oracleFiles, ORACLE_FILES, 'the oracle directory', false));
  if (String(seedPatch ?? '').trim() === '' && task?.type !== 'change') {
    problems.push('seed.patch is empty: only a change task may start from the clean app');
  }
  problems.push(...lintPatchForHints(seedPatch));
  return problems;
}

function sharedSeeds(tasks) {
  const problems = [];
  const seen = new Map();
  for (const t of tasks) {
    const seed = String(t.seedPatch ?? '').trim();
    if (seed === '') continue;
    if (seen.has(seed)) problems.push(`${seen.get(seed)} and ${t.id} share a seed`);
    else seen.set(seed, t.id);
  }
  return problems;
}

export function lintTaskSet(tasks, config) {
  const problems = [];
  const ids = new Set();
  for (const t of tasks) {
    if (ids.has(t.id)) problems.push(`duplicate id ${t.id}`);
    ids.add(t.id);
  }
  if (tasks.length < (config.minTasks ?? 0)) {
    problems.push(`the set needs at least ${config.minTasks} tasks, found ${tasks.length}`);
  }
  for (const category of config.fixCategories ?? []) {
    const n = tasks.filter((t) => t.task?.type === 'fix' && t.task?.category === category).length;
    if (n < (config.minPerFixCategory ?? 0)) {
      problems.push(`fix category ${category} needs at least ${config.minPerFixCategory} task(s), found ${n}`);
    }
  }
  return [...problems, ...sharedSeeds(tasks)];
}
